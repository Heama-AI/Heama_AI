import { supabase } from '@/lib/supabase';

export type SupabaseProfile = {
  userId: string;
  email: string | null;
  name: string | null;
  guardianEmail: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  guardian_email: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type GuardianLinkRow = {
  id: string;
  patient_id: string;
  guardian_email: string;
  status: string;
  created_at?: string;
};

function requireSupabaseClient() {
  if (!supabase?.from) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

function mapProfileRow(row: ProfileRow): SupabaseProfile {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    guardianEmail: row.guardian_email,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function upsertUserProfile(input: {
  userId: string;
  email: string | null;
  name: string | null;
  guardianEmail?: string | null;
}) {
  const client = requireSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('user_profiles')
    .upsert(
      {
        user_id: input.userId,
        email: input.email,
        name: input.name,
        guardian_email: input.guardianEmail ?? null,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfileRow(data as ProfileRow);
}

export async function fetchUserProfile(userId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProfileRow(data as ProfileRow) : null;
}

export async function getCurrentUserProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  }
  return fetchUserProfile(data.user.id);
}

export async function linkGuardianEmail(guardianEmail: string) {
  const client = requireSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
  }
  const user = data.user;
  const userName = (user.user_metadata as { name?: string } | null)?.name ?? null;
  const profile = await upsertUserProfile({
    userId: user.id,
    email: user.email ?? null,
    name: userName,
    guardianEmail,
  });

  await insertGuardianLink({
    patientId: user.id,
    guardianEmail,
  });

  return profile;
}

async function insertGuardianLink(input: { patientId: string; guardianEmail: string }) {
  const client = requireSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await client.from('guardian_links').insert({
    patient_id: input.patientId,
    guardian_email: input.guardianEmail,
    status: 'sent',
    created_at: now,
  } satisfies Partial<GuardianLinkRow>);

  if (error) {
    // 정책/테이블 준비 안 된 경우를 명확히 알리기 위해 그대로 throw합니다.
    throw new Error(error.message);
  }
}
