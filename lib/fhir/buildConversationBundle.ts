import type { ChatMessage } from '@/types/chat';
import type { QuizQuestion, ConversationStats } from '@/types/records';
import type {
  FhirAnnotation,
  FhirCodeableConcept,
  FhirCommunication,
  FhirConversationBundle,
  FhirConversationResource,
  FhirDiagnosticReport,
  FhirEncounter,
  FhirObservation,
  FhirOrganization,
  FhirPatient,
  FhirQuestionnaire,
  FhirReference,
} from '@/types/fhir';

type BuildConversationBundleInput = {
  recordId: string;
  title: string;
  summary: string;
  highlights: string[];
  keywords: string[];
  createdAt: number;
  updatedAt: number;
  stats: ConversationStats;
  messages: ChatMessage[];
  quiz: QuizQuestion[];
};

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createNarrativeParagraphs(paragraphs: string[]) {
  const safeParagraphs = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  return `<div xmlns="http://www.w3.org/1999/xhtml">${safeParagraphs}</div>`;
}

function buildPatient(recordId: string, updatedAt: number): FhirPatient {
  return {
    resourceType: 'Patient',
    id: `patient-${recordId}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
      lastUpdated: toIso(updatedAt),
    },
    identifier: [
      {
        system: 'https://heama.app/fhir/conversation',
        value: recordId,
      },
    ],
    name: [
      {
        text: 'Heama 사용자',
      },
    ],
  };
}

function buildOrganization(): FhirOrganization {
  return {
    resourceType: 'Organization',
    id: 'organization-heama',
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Organization'],
    },
    name: 'Heama Virtual Memory Coach',
    identifier: [
      {
        system: 'https://heama.app/fhir/organization',
        value: 'heama-coach',
      },
    ],
  };
}

function buildEncounter(recordId: string, patient: FhirPatient, messages: ChatMessage[], createdAt: number, updatedAt: number): FhirEncounter {
  const timestamps = messages.map((message) => message.ts);
  const start = timestamps.length ? Math.min(...timestamps) : createdAt;
  const end = timestamps.length ? Math.max(...timestamps) : updatedAt;

  return {
    resourceType: 'Encounter',
    id: `encounter-${recordId}`,
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'VR',
      display: 'virtual encounter',
    },
    subject: {
      reference: `Patient/${patient.id}`,
      type: 'Patient',
      display: patient.name?.[0]?.text,
    },
    period: {
      start: toIso(start),
      end: toIso(end),
    },
    serviceType: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '408443003',
          display: 'Telephone encounter (procedure)',
        },
      ],
      text: 'Virtual dementia coaching session',
    },
  };
}

function buildCommunicationCategory(role: ChatMessage['role']): FhirCodeableConcept[] {
  return [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: role === 'user' ? 'patient-education' : 'instruction',
          display: role === 'user' ? 'Patient communication' : 'Clinical instruction',
        },
      ],
      text: role === 'user' ? 'Patient utterance' : 'Virtual coach response',
    },
  ];
}

function buildCommunication(
  recordId: string,
  encounter: FhirEncounter,
  patient: FhirPatient,
  organization: FhirOrganization,
  message: ChatMessage,
  ordinal: number,
): FhirCommunication {
  const commonReference: FhirReference = {
    reference: `Encounter/${encounter.id}`,
    type: 'Encounter',
    display: 'Heama coaching session',
  };
  const isUserMessage = message.role === 'user';

  return {
    resourceType: 'Communication',
    id: `communication-${recordId}-${ordinal}`,
    status: 'completed',
    category: buildCommunicationCategory(message.role),
    subject: {
      reference: `Patient/${patient.id}`,
      type: 'Patient',
      display: patient.name?.[0]?.text,
    },
    encounter: commonReference,
    sender: {
      reference: isUserMessage ? `Patient/${patient.id}` : `Organization/${organization.id}`,
      type: isUserMessage ? 'Patient' : 'Organization',
      display: isUserMessage ? patient.name?.[0]?.text : organization.name,
    },
    recipient: [
      {
        reference: isUserMessage ? `Organization/${organization.id}` : `Patient/${patient.id}`,
        type: isUserMessage ? 'Organization' : 'Patient',
        display: isUserMessage ? organization.name : patient.name?.[0]?.text,
      },
    ],
    sent: toIso(message.ts),
    received: toIso(message.ts),
    payload: [
      {
        contentString: message.text,
      },
    ],
    note: [
      {
        text: `Original role: ${message.role}`,
        time: toIso(message.ts),
      },
    ],
  };
}

function buildInterpretation(score: number): FhirCodeableConcept[] | undefined {
  if (score >= 70) {
    return [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: 'H',
            display: 'High',
          },
        ],
        text: '위험 수준이 높습니다.',
      },
    ];
  }
  if (score <= 30) {
    return [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: 'L',
            display: 'Low',
          },
        ],
        text: '위험 수준이 낮습니다.',
      },
    ];
  }
  return [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
          code: 'N',
          display: 'Normal',
        },
      ],
      text: '위험 수준이 보통입니다.',
    },
  ];
}

function buildObservation(
  recordId: string,
  encounter: FhirEncounter,
  patient: FhirPatient,
  type: 'risk' | 'mood',
  score: number,
  effective: string,
  note?: FhirAnnotation[],
): FhirObservation {
  const baseId = type === 'risk' ? 'risk' : 'mood';
  const category: FhirCodeableConcept[] = [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: type === 'risk' ? 'social-history' : 'survey',
          display: type === 'risk' ? 'Social History' : 'Survey',
        },
      ],
      text: type === 'risk' ? '치매 위험 평가' : '감정 상태 평가',
    },
  ];

  const code: FhirCodeableConcept =
    type === 'risk'
      ? {
          coding: [
            {
              system: 'http://loinc.org',
              code: '72145-2',
              display: 'Risk assessment summary note',
            },
          ],
          text: 'Conversation dementia risk score',
        }
      : {
          coding: [
            {
              system: 'http://loinc.org',
              code: '75321-0',
              display: 'Mood assessment note',
            },
          ],
          text: 'Conversation mood score',
        };

  return {
    resourceType: 'Observation',
    id: `observation-${baseId}-${recordId}`,
    status: 'final',
    category,
    code,
    subject: {
      reference: `Patient/${patient.id}`,
      type: 'Patient',
      display: patient.name?.[0]?.text,
    },
    encounter: {
      reference: `Encounter/${encounter.id}`,
      type: 'Encounter',
      display: 'Heama coaching session',
    },
    effectiveDateTime: effective,
    valueQuantity: {
      value: score,
      unit: 'score',
      system: 'http://unitsofmeasure.org',
      code: '{score}',
    },
    interpretation: type === 'risk' ? buildInterpretation(score) : undefined,
    note,
  };
}

function toAnnotations(label: string, values: string[]): FhirAnnotation[] | undefined {
  if (!values.length) {
    return undefined;
  }
  return values.map((value) => ({
    text: `${label}: ${value}`,
  }));
}

function buildDiagnosticReport(
  recordId: string,
  patient: FhirPatient,
  encounter: FhirEncounter,
  summary: string,
  keywords: string[],
  highlights: string[],
  updatedAt: number,
  observations: FhirObservation[],
  title: string,
): FhirDiagnosticReport {
  const observationRefs: FhirReference[] = observations.map((observation) => ({
    reference: `Observation/${observation.id}`,
    type: 'Observation',
    display: observation.code.text,
  }));

  const narrative = createNarrativeParagraphs([summary, `핵심 키워드: ${keywords.join(', ')}`]);

  const notes: FhirAnnotation[] = [
    ...(toAnnotations('키워드', keywords) ?? []),
    ...(toAnnotations('하이라이트', highlights) ?? []),
  ];

  return {
    resourceType: 'DiagnosticReport',
    id: `diagnostic-report-${recordId}`,
    status: 'final',
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'],
      lastUpdated: toIso(updatedAt),
    },
    text: {
      status: 'generated',
      div: narrative,
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'PSY',
            display: 'Psychiatry',
          },
        ],
        text: 'Cognitive health summary',
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '55108-5',
          display: 'Clinical note - Patient',
        },
      ],
      text: title,
    },
    subject: {
      reference: `Patient/${patient.id}`,
      type: 'Patient',
      display: patient.name?.[0]?.text,
    },
    encounter: {
      reference: `Encounter/${encounter.id}`,
      type: 'Encounter',
      display: 'Heama coaching session',
    },
    effectiveDateTime: encounter.period?.end,
    issued: toIso(updatedAt),
    conclusion: summary,
    result: observationRefs,
    note: notes.length ? notes : undefined,
  };
}

function buildQuestionnaire(recordId: string, title: string, description: string, quiz: BuildConversationBundleInput['quiz']): FhirQuestionnaire {
  return {
    resourceType: 'Questionnaire',
    id: `questionnaire-${recordId}`,
    status: 'active',
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Questionnaire'],
    },
    title: `${title} 회상 퀴즈`,
    description,
    subjectType: ['Patient'],
    item: quiz.map((question, index) => ({
      linkId: `${index + 1}`,
      text: question.question,
      type: 'choice',
      required: false,
      repeats: false,
      answerOption: question.choices.map((choice) => ({
        valueString: choice,
        initialSelected: choice === question.answer,
      })),
    })),
  };
}

export function buildConversationBundle(input: BuildConversationBundleInput): FhirConversationBundle {
  const patient = buildPatient(input.recordId, input.updatedAt);
  const organization = buildOrganization();
  const encounter = buildEncounter(input.recordId, patient, input.messages, input.createdAt, input.updatedAt);

  const communications = input.messages.map((message, index) =>
    buildCommunication(input.recordId, encounter, patient, organization, message, index + 1),
  );

  const effective = encounter.period?.end ?? toIso(input.updatedAt);
  const riskObservation = buildObservation(
    input.recordId,
    encounter,
    patient,
    'risk',
    input.stats.riskScore,
    effective,
    toAnnotations('위험 평가 참고', input.highlights),
  );
  const moodObservation = buildObservation(
    input.recordId,
    encounter,
    patient,
    'mood',
    input.stats.moodScore,
    effective,
  );

  const diagnosticReport = buildDiagnosticReport(
    input.recordId,
    patient,
    encounter,
    input.summary,
    input.keywords,
    input.highlights,
    input.updatedAt,
    [riskObservation, moodObservation],
    input.title,
  );

  const questionnaire = buildQuestionnaire(
    input.recordId,
    input.title,
    'Memory recall quiz generated from the conversation highlights.',
    input.quiz,
  );

  const resources: FhirConversationResource[] = [
    patient,
    organization,
    encounter,
    riskObservation,
    moodObservation,
    diagnosticReport,
    questionnaire,
    ...communications,
  ];

  return {
    resourceType: 'Bundle',
    id: `bundle-${input.recordId}`,
    type: 'collection',
    meta: {
      lastUpdated: toIso(input.updatedAt),
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
    },
    entry: resources.map((resource) => ({
      fullUrl: `urn:uuid:${resource.id ?? resource.resourceType}-${resource.resourceType}`,
      resource,
    })),
  };
}
