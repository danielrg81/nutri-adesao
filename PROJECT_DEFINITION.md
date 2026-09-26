# Definição do Projeto: Aplicativo de Acompanhamento Alimentar (Foco em Adesão)

## 1. Visão Geral e Proposta de Valor
- **Nome Provisório do Projeto:** NutriAdesão (ou similar)
- **Tipo de Aplicação:** Aplicativo Web Responsivo (Mobile-first para pacientes, Dashboard Administrativo para nutricionistas). Pode ser empacotado como PWA (Progressive Web App).
- **Modelo de Uso:** Relação estrita **Paciente ↔ Nutricionista** (não é para uso autônomo/independente).
- **Problema Resolvido:** Falta de adesão e abandono do plano alimentar ao longo do ciclo de 30 dias.
- **Abordagem Central:** Substituir a contagem obsessiva de calorias/macronutrientes por um registro diário baseado em **adesão ao plano prescrito**, rastreando a consistência e identificando barreiras (motivos de não cumprimento) para embasar a consulta de retorno.

---

## 2. Personas e Funcionalidades

### A. Paciente
- **Interface:** Mobile-first, limpa, intuitiva e sem atritos.
- **Fluxo Diário:**
  - Visualiza o dia atual do ciclo de 30 dias (ex: *Dia 8 de 30*).
  - Lista de refeições prescritas pela nutricionista (Café da manhã, Almoço, Jantar, Lanches, etc.).
  - Check-in rápido por refeição:
    - **[Consegui]** (Registrado como concluído com sucesso).
    - **[Não consegui]** (Abre um modal de seleção rápida de motivo: *Esqueci, Não tive tempo, Estava fora de casa, Não tinha os alimentos, Não estava com fome, Outro*).
- **Histórico e Progresso:**
  - Visualização de cards de fechamento semanal com indicador de consistência (🟢 Boa Adesão >=80%, 🟡 Adesão Parcial 65%-79%, 🔴 Ponto de Atenção <65%).
  - Tela de Relatório Final dos 30 dias.

### B. Nutricionista
- **Interface:** Dashboard Administrativo completo (desktop e tablet).
- **Gestão de Pacientes:** Cadastro de pacientes e vinculação aos ciclos de acompanhamento.
- **Criação de Planos:** Módulo para cadastrar e publicar o plano alimentar de 30 dias (refeições, horários e orientações).
- **Monitoramento em Tempo Real:**
  - Taxa de adesão percentual semanal e mensal.
  - Indicadores visuais de consistência por paciente.
  - Relatório consolidado de padrões e dificuldades (motivos mais frequentes de não cumprimento relatados pela paciente).
- **Feedback:** Campo para adicionar mensagens motivacionais/personalizadas no fechamento semanal de cada ciclo.

---

## 3. Dinâmica do Ciclo de 30 Desafios / Acompanhamento
- **Duração do Ciclo:** 30 dias corridos.
- **Feedback Automático:** Geração de mensagens empáticas semanais com base na porcentagem de adesão.
- **Objetivo da Consulta:** Embasar a consulta presencial/online de retorno com dados reais e estruturados sobre os gargalos comportamentais da paciente.

---

## 4. Requisitos de Acesso e Segurança
- **Para Pacientes (Fricção Zero):**
  - Autenticação sem senha complexa via **Magic Link** (por e-mail ou WhatsApp) ou código OTP por SMS/WhatsApp.
- **Para Nutricionistas:**
  - Autenticação tradicional segura por **E-mail e Senha**.
- **Privacidade e LGPD:**
  - Proteção estrita de dados de saúde e alimentares dos pacientes.

---

## 5. Pilha Tecnológica (Tech Stack Recomendada)
- **Frontend:** Next.js (React) com Tailwind CSS (totalmente responsivo, otimizado para PWA).
- **Backend & Banco de Dados:** Supabase (PostgreSQL, Autenticação nativa, Magic Links, Row Level Security - RLS para isolamento de dados entre pacientes e nutricionistas).
- **Hospedagem / Deploy:** Vercel.
- **Vantagens da Stack:** Baixo custo de manutenção, alta velocidade de desenvolvimento (MVP rápido), sem excesso de código de infraestrutura, escalável para futuras integrações de Inteligência Artificial.
