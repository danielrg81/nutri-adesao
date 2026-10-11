-- =====================================================================
-- Script para corrigir incompatibilidades no schema meal_plans
-- Execute este script no Supabase SQL Editor
-- =====================================================================

-- 1. Verificar estrutura atual da tabela meal_plans
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'meal_plans' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar foreign keys atuais
SELECT
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'meal_plans'
  AND tc.table_schema = 'public';

-- 3. Verificar se existe a tabela patients
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'patients' AND table_schema = 'public'
) AS patients_table_exists;

-- 4. Se a tabela patients existe, precisamos decidir:
--    OPÇÃO A: Modificar meal_plans para referenciar patients
--    OPÇÃO B: Manter referência a profiles e migrar dados

-- Para OPÇÃO A (recomendado): Alterar FK de meal_plans
-- CUIDADO: só execute se tiver certeza e backup dos dados

-- Primeiro, verificar se existem dados que seriam quebrados
SELECT 
  mp.id,
  mp.patient_id,
  mp.title,
  p.full_name as patient_name_profiles,
  pt.full_name as patient_name_patients
FROM meal_plans mp
LEFT JOIN profiles p ON mp.patient_id = p.id
LEFT JOIN patients pt ON mp.patient_id = pt.id
ORDER BY mp.created_at DESC
LIMIT 10;

-- 5. Adicionar coluna notes se não existe (algumas versões podem não ter)
ALTER TABLE public.meal_plans 
ADD COLUMN IF NOT EXISTS notes text;

-- 6. Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_meal_plans_patient_id ON public.meal_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_nutritionist_id ON public.meal_plans(nutritionist_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_dates ON public.meal_plans(start_date, end_date);