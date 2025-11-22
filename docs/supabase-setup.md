# Supabase setup

Heama는 기본적으로 로컬 SQLite로 데이터를 저장하지만, 인증과 사진 노트 업로드용으로 Supabase도 호출합니다. 아래 절차만 준비하면 추가 코드 변경 없이 Supabase를 사용할 수 있습니다.

## 1) 프로젝트 / 환경변수

1. Supabase 프로젝트를 하나 생성합니다.
2. 프로젝트 설정 → API에서 다음 값 확인 후 `.env`(또는 Expo에 맞는 환경 변수)로 넣습니다.
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. `app.config.ts`는 위 변수를 그대로 읽으므로 별도 수정이 필요 없습니다. 값이 없으면 앱은 자동으로 Supabase 호출을 건너뜁니다.

## 2) DB 스키마 (`photo_notes` 테이블)

사진 노트 동기화만 Supabase 테이블을 사용합니다. SQL Editor에 아래를 실행하세요.

```sql
create table if not exists public.photo_notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'photo', -- photo | script
  image_id text not null,
  description text not null,
  transcript text,
  metrics jsonb,
  risk_score numeric,
  script_prompt text,
  script_match_count integer,
  script_total_count integer,
  recorded_at timestamptz not null,
  updated_at timestamptz not null
);

-- RLS는 필요에 따라 설정하세요.
-- 익명/클라이언트 쓰기를 허용하려면 RLS를 켜고 모두 허용하거나(보안 낮음) 서비스 키로만 호출하도록 합니다.
-- 예: 모든 인증된 사용자 허용 (권한 모델이 필요 없다면 아래처럼 열어둡니다)
alter table public.photo_notes enable row level security;
create policy "Allow owner" on public.photo_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 앱에서 생성하는 ID는 UUID 형식이 아니므로 text 타입이 필요합니다.
alter table public.photo_notes
  alter column id type text using id::text;

-- 기존 데이터가 있다면 user_id 기본값을 채워야 RLS가 통과합니다.
-- 예시: 모든 행에 임시 사용자 ID를 넣는 식의 데이터를 정리하세요.
```

> 참고: 코드에서는 `id`, `image_id`, `description`, `transcript`, `metrics`, `recorded_at`, `updated_at`만 사용합니다. 외래키/사용자 식별이 필요하면 컬럼을 추가한 뒤 정책을 조정하세요.

## 3) 사용자 프로필/보호자 연동 스키마

회원가입 후 사용자 정보를 저장하고, 보호자 이메일 연동을 Supabase로 처리합니다. 아래 SQL을 추가로 실행하세요.

```sql
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  guardian_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  guardian_email text not null,
  status text not null default 'sent',
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
alter table public.guardian_links enable row level security;

create policy "Allow self access" on public.user_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Allow self access guardian_links" on public.guardian_links
  for all
  using (auth.uid() = patient_id)
  with check (auth.uid() = patient_id);
```

> `guardian_links`는 연동 요청 로그 용도입니다. 단일 보호자만 필요하면 `guardian_email`만 사용해도 됩니다.

## 3) 확인

- 로컬에서 `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 설정한 상태로 앱을 실행하면 `photo_notes`에 `upsert`가 시도됩니다.
- 환경 변수가 없거나 테이블이 없을 때는 콘솔 경고만 나오고 동작은 계속됩니다(개발 모드 한정 로그).
