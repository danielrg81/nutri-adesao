-- =====================================================================
-- Migration: Suporte a cadastro de pacientes pela nutricionista
-- Execute no Supabase SQL Editor antes de usar o formulário de pacientes
-- =====================================================================

-- 1. Adicionar colunas extras à tabela profiles
--    (IF NOT EXISTS evita erro se já existirem)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS objective    text,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS nutritionist_id uuid references public.profiles(id) on delete set null;

-- 2. Índice para facilitar busca de pacientes por nutricionista
CREATE INDEX IF NOT EXISTS idx_profiles_nutritionist_id
  ON public.profiles(nutritionist_id);

-- 3. Política: nutricionistas podem INSERIR pacientes (sem auth.users)
--    A chave primária (id) será um UUID gerado pelo cliente.
--    ATENÇÃO: como não há registo em auth.users, a FK para auth.users
--    precisa ser removida ou tornada opcional. Veja a nota abaixo.
--
--    OPÇÃO A (recomendada): tornar a FK opcional via trigger diferido
--    OPÇÃO B (mais simples): criar tabela separada 'patients'
--
--    Por ora, adicionamos a política de insert para profiles
--    (funciona se a FK auth.users for removida ou para utilizadores reais).
CREATE POLICY IF NOT EXISTS "Nutricionistas podem cadastrar pacientes."
  ON public.profiles FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'nutritionist'
    )
  );

-- 4. Política: nutricionistas podem actualizar pacientes seus
CREATE POLICY IF NOT EXISTS "Nutricionistas podem actualizar os seus pacientes."
  ON public.profiles FOR UPDATE
  USING (
    nutritionist_id = auth.uid()
    OR id = auth.uid()
  );

-- =====================================================================
-- ALTERNATIVA: tabela 'patients' independente (sem FK para auth.users)
-- Use esta opção se preferir não modificar profiles.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nutritionist_id  uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  full_name        text NOT NULL,
  email            text,
  phone            text,
  objective        text,
  notes            text,
  created_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Nutricionistas gerem as suas pacientes."
  ON public.patients FOR ALL
  USING (nutritionist_id = auth.uid());
