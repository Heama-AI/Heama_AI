export type FhirCoding = {
  system?: string;
  code?: string;
  display?: string;
};

export type FhirCodeableConcept = {
  coding?: FhirCoding[];
  text?: string;
};

export type FhirMeta = {
  profile?: string[];
  lastUpdated?: string;
};

export type FhirNarrativeStatus = 'generated' | 'extensions' | 'additional' | 'empty';

export type FhirNarrative = {
  status: FhirNarrativeStatus;
  div: string;
};

export type FhirReference = {
  reference: string;
  type?: string;
  display?: string;
};

export type FhirIdentifier = {
  system?: string;
  value: string;
};

export type FhirAnnotation = {
  authorString?: string;
  time?: string;
  text: string;
};

export type FhirQuantity = {
  value: number;
  unit?: string;
  system?: string;
  code?: string;
};

export type FhirPeriod = {
  start?: string;
  end?: string;
};

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
  text?: FhirNarrative;
}

export type FhirBundleLink = {
  relation: string;
  url: string;
};

export type FhirBundleEntry<Resource extends FhirResource = FhirResource> = {
  fullUrl: string;
  resource: Resource;
};

export interface FhirBundle<Resource extends FhirResource = FhirResource> extends FhirResource {
  resourceType: 'Bundle';
  type: 'collection' | 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response';
  link?: FhirBundleLink[];
  entry: FhirBundleEntry<Resource>[];
}

export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  identifier?: FhirIdentifier[];
  name?: Array<{
    text?: string;
    family?: string;
    given?: string[];
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface FhirOrganization extends FhirResource {
  resourceType: 'Organization';
  name?: string;
  identifier?: FhirIdentifier[];
}

export interface FhirEncounter extends FhirResource {
  resourceType: 'Encounter';
  status: 'planned' | 'in-progress' | 'finished' | 'cancelled';
  class: {
    system?: string;
    code: string;
    display?: string;
  };
  subject: FhirReference;
  period?: FhirPeriod;
  serviceType?: FhirCodeableConcept;
}

export type FhirCommunicationPayload = {
  contentString?: string;
};

export interface FhirCommunication extends FhirResource {
  resourceType: 'Communication';
  status: 'in-progress' | 'completed' | 'suspended' | 'rejected' | 'failed';
  category?: FhirCodeableConcept[];
  subject?: FhirReference;
  encounter?: FhirReference;
  sender?: FhirReference;
  recipient?: FhirReference[];
  sent?: string;
  received?: string;
  payload?: FhirCommunicationPayload[];
  note?: FhirAnnotation[];
}

export interface FhirObservation extends FhirResource {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  interpretation?: FhirCodeableConcept[];
  note?: FhirAnnotation[];
}

export interface FhirDiagnosticReport extends FhirResource {
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  conclusion?: string;
  result?: FhirReference[];
  presentedForm?: Array<{
    contentType: string;
    data: string;
    title?: string;
  }>;
  note?: FhirAnnotation[];
}

export type FhirQuestionnaireItemType =
  | 'group'
  | 'display'
  | 'boolean'
  | 'decimal'
  | 'integer'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'string'
  | 'text'
  | 'url'
  | 'choice'
  | 'open-choice'
  | 'attachment'
  | 'reference'
  | 'quantity';

export type FhirQuestionnaireEnableWhen = {
  question: string;
  operator:
    | 'exists'
    | '='
    | '!='
    | '>'
    | '<'
    | '>='
    | '<='
    | 'contains'
    | 'not contains';
  answerBoolean?: boolean;
  answerDecimal?: number;
  answerInteger?: number;
  answerDate?: string;
  answerDateTime?: string;
  answerTime?: string;
  answerString?: string;
  answerCoding?: FhirCoding;
  answerQuantity?: FhirQuantity;
  answerReference?: FhirReference;
};

export type FhirQuestionnaireAnswerOption = {
  valueString?: string;
  initialSelected?: boolean;
};

export type FhirQuestionnaireItem = {
  linkId: string;
  text?: string;
  type: FhirQuestionnaireItemType;
  required?: boolean;
  repeats?: boolean;
  answerOption?: FhirQuestionnaireAnswerOption[];
  enableWhen?: FhirQuestionnaireEnableWhen[];
  item?: FhirQuestionnaireItem[];
};

export interface FhirQuestionnaire extends FhirResource {
  resourceType: 'Questionnaire';
  status: 'draft' | 'active' | 'retired' | 'unknown';
  title?: string;
  description?: string;
  subjectType?: string[];
  item?: FhirQuestionnaireItem[];
}

export type FhirConversationResource =
  | FhirPatient
  | FhirOrganization
  | FhirEncounter
  | FhirCommunication
  | FhirObservation
  | FhirDiagnosticReport
  | FhirQuestionnaire;

export type FhirConversationBundle = FhirBundle<FhirConversationResource>;
