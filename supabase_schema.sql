-- =====================================================================
-- Esquema do Banco de Dados para o NutriAdesão (Supabase / PostgreSQL)
-- =====================================================================

-- 1. Tabela de Perfis (Vinculada aos usuários do Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  role text not null check (role in ('nutritionist', 'patient')),
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar segurança por linha (RLS)
alter table public.profiles enable row level security;

-- Políticas de acesso para profiles
create policy "Usuários podem ver seus próprios perfis." on public.profiles
  for select using (auth.uid() = id);

create policy "Nutricionistas podem ver perfis de pacientes." on public.profiles
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'nutritionist'
    )
  );


-- 2. Tabela de Planos Alimentares (Cadastrados pela Nutricionista para a Paciente)
create table public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.profiles(id) on delete cascade not null,
  nutritionist_id uuid references public.profiles(id) on delete cascade not null,
  title text not null default 'Plano de 30 Dias',
  start_date date not null,
  end_date date not null,
  meals_json jsonb not null default '[]'::jsonb, -- Estrutura das refeições do dia
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.meal_plans enable row level security;

create policy "Nutricionistas gerenciam planos alimentares." on public.meal_plans
  for all using (auth.uid() = nutritionist_id);

create policy "Pacientes veem seus próprios planos alimentares." on public.meal_plans
  for select using (auth.uid() = patient_id);


-- 3. Tabela de Check-ins Diários (Registros de adesão da Paciente)
create table public.daily_checkins (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.profiles(id) on delete cascade not null,
  meal_plan_id uuid references public.meal_plans(id) on delete cascade not null,
  date date not null,
  meal_key text not null, -- Ex: 'almoco', 'cafe_da_manha'
  status text not null check (status in ('success', 'failed')),
  reason text, -- Ex: 'esqueci', 'nao_tive_tempo', 'fora_de_casa', etc.
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(patient_id, meal_plan_id, date, meal_key)
);

alter table public.daily_checkins enable row level security;

create policy "Pacientes gerenciam seus próprios check-ins." on public.daily_checkins
  for all using (auth.uid() = patient_id);

create policy "Nutricionistas veem check-ins de suas pacientes." on public.daily_checkins
  for select using (
    exists (
      select 1 from public.meal_plans
      where id = daily_checkins.meal_plan_id and nutritionist_id = auth.uid()
    )
  );


-- =====================================================================
-- Gatilho automático para criar perfil ao cadastrar usuário
-- =====================================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'patient'),
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for row execute procedure public.handle_new_user();
