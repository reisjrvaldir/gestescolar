# RPD — Registro de Processamento de Dados
### GestEscolar — Plataforma SaaS de Gestão Escolar
**Versão:** 1.0  
**Data:** 2026-05-28  
**Responsável:** DPO — dpo@gestescolar.com  
**Base Legal:** Art. 37 da Lei 13.709/2018 (LGPD)

---

## 1. Identificação do Controlador

| Campo | Valor |
|-------|-------|
| **Razão Social** | GestEscolar Tecnologia Ltda. |
| **CNPJ** | *(a definir)* |
| **Endereço** | *(a definir)* |
| **DPO / Encarregado** | dpo@gestescolar.com |
| **Setor responsável** | Tecnologia / Produto |

---

## 2. Descrição do Sistema

O **GestEscolar** é uma plataforma SaaS multi-tenant de gestão escolar voltada para escolas de educação básica no Brasil. A plataforma oferece:

- **Gestão acadêmica:** cadastro de turmas, alunos, professores, lançamento de notas e frequência.
- **Gestão financeira:** controle de mensalidades, geração de cobranças (PIX e cartão de crédito), acompanhamento de inadimplência.
- **Portal do responsável:** acesso a boletins, frequência e comunicados dos filhos.
- **Portal do professor:** lançamento de notas, chamada digital, registro de ponto.
- **Gestão administrativa:** calendário escolar, jornadas de trabalho, relatórios.
- **Conformidade LGPD:** portal do titular, exportação de dados, consentimento, direito ao esquecimento.

### 2.1 Arquitetura Técnica

| Componente | Tecnologia | Função |
|------------|-----------|--------|
| **Frontend** | HTML/CSS/JS (SPA) | Interface do usuário |
| **Backend/DB** | Supabase (PostgreSQL) | Armazenamento, autenticação, RLS |
| **Autenticação** | Supabase Auth (JWT) | Login, sessões, controle de acesso |
| **Pagamentos** | Asaas (API + Webhooks) | Cobranças PIX e cartão de crédito |
| **E-mail** | Resend | Notificações transacionais |
| **Hospedagem** | Vercel | Deploy do frontend e serverless functions |

### 2.2 Modelo Multi-Tenant

Cada escola é um tenant isolado. O isolamento é garantido por:
- **Row-Level Security (RLS)** no PostgreSQL/Supabase — cada registro possui `school_id`.
- **JWT claims** com `school_id` embarcado no token de autenticação.
- Nenhum usuário acessa dados de outra escola (exceto superadmin da plataforma).

---

## 3. Inventário de Dados Pessoais

### 3.1 Dados de Gestores / Administradores

| Dado | Tipo | Finalidade | Base Legal (LGPD) | Retenção |
|------|------|------------|-------------------|----------|
| Nome completo | Identificação | Cadastro e contato | Art. 7, V — Execução de contrato | Duração do contrato + 5 anos |
| E-mail | Contato | Login, comunicações | Art. 7, V — Execução de contrato | Duração do contrato + 5 anos |
| Telefone | Contato | Suporte, recuperação de conta | Art. 7, V — Execução de contrato | Duração do contrato + 5 anos |
| CPF | Identificação fiscal | Emissão de cobrança/NF | Art. 7, II — Obrigação legal | 5 anos (fiscal) |
| Senha (hash) | Segurança | Autenticação | Art. 7, V — Execução de contrato | Duração do contrato |
| IP de acesso | Log técnico | Segurança, auditoria | Art. 7, IX — Legítimo interesse | 6 meses |
| User-Agent | Log técnico | Segurança, auditoria | Art. 7, IX — Legítimo interesse | 6 meses |

### 3.2 Dados de Professores

| Dado | Tipo | Finalidade | Base Legal (LGPD) | Retenção |
|------|------|------------|-------------------|----------|
| Nome completo | Identificação | Cadastro funcional | Art. 7, V — Execução de contrato | Duração do vínculo + 5 anos |
| E-mail | Contato | Login, comunicações | Art. 7, V — Execução de contrato | Duração do vínculo + 5 anos |
| Telefone | Contato | Comunicação interna | Art. 7, V — Execução de contrato | Duração do vínculo + 5 anos |
| CPF | Identificação | Registro funcional | Art. 7, II — Obrigação legal | 5 anos |
| Registro de ponto | Trabalhista | Controle de jornada | Art. 7, II — Obrigação legal (CLT) | 5 anos (CLT Art. 11) |
| Disciplinas/turmas | Funcional | Atribuição acadêmica | Art. 7, V — Execução de contrato | Duração do vínculo |

### 3.3 Dados de Alunos (Crianças e Adolescentes)

> **ATENÇÃO:** Tratamento de dados de menores requer consentimento de pelo menos um responsável legal (Art. 14, §1 LGPD).

| Dado | Tipo | Finalidade | Base Legal (LGPD) | Retenção |
|------|------|------------|-------------------|----------|
| Nome completo | Identificação | Matrícula, diário de classe | Art. 14 — Melhor interesse da criança | Duração da matrícula + 5 anos |
| Data de nascimento | Identificação | Classificação etária | Art. 14 — Melhor interesse da criança | Duração da matrícula + 5 anos |
| Turma/série | Acadêmico | Organização escolar | Art. 14 — Melhor interesse da criança | Duração da matrícula + 5 anos |
| Notas/conceitos | Acadêmico | Avaliação de desempenho | Art. 14 — Melhor interesse da criança | Permanente (histórico escolar) |
| Frequência | Acadêmico | Controle de presença | Art. 14 — Melhor interesse da criança | Duração da matrícula + 5 anos |
| Observações pedagógicas | Acadêmico | Acompanhamento individual | Art. 14 — Melhor interesse da criança | Duração da matrícula + 2 anos |

### 3.4 Dados de Responsáveis (Pais/Tutores)

| Dado | Tipo | Finalidade | Base Legal (LGPD) | Retenção |
|------|------|------------|-------------------|----------|
| Nome completo | Identificação | Vínculo com aluno | Art. 7, V — Execução de contrato | Duração da matrícula + 5 anos |
| E-mail | Contato | Login, comunicações | Art. 7, V — Execução de contrato | Duração da matrícula + 5 anos |
| Telefone | Contato | Comunicação escola-família | Art. 7, V — Execução de contrato | Duração da matrícula + 5 anos |
| CPF | Identificação fiscal | Cobrança de mensalidade | Art. 7, II — Obrigação legal | 5 anos (fiscal) |

### 3.5 Dados Financeiros / Transacionais

| Dado | Tipo | Finalidade | Base Legal (LGPD) | Retenção |
|------|------|------------|-------------------|----------|
| Faturas (valor, vencimento, status) | Financeiro | Gestão de cobranças | Art. 7, II — Obrigação legal | 5 anos (fiscal) |
| Método de pagamento (tipo) | Financeiro | Processamento | Art. 7, V — Execução de contrato | 5 anos |
| ID da transação Asaas | Referência | Conciliação financeira | Art. 7, II — Obrigação legal | 5 anos |
| Dados do cartão de crédito | **NÃO armazenados** | — | — | — |

> **Nota:** Dados sensíveis de cartão de crédito (número, CVV, validade) **nunca** são armazenados pelo GestEscolar. O processamento é feito inteiramente pelo Asaas (PCI DSS Level 1).

---

## 4. Fluxos de Dados e Compartilhamento

### 4.1 Operadores (Processadores de Dados)

| Operador | Dados Compartilhados | Finalidade | Base Legal | País |
|----------|---------------------|------------|------------|------|
| **Supabase** (PostgreSQL) | Todos os dados do sistema | Armazenamento e autenticação | Art. 7, V — Contrato | EUA (cláusulas contratuais padrão) |
| **Asaas** | Nome, CPF, e-mail, valores de cobrança | Processamento de pagamentos | Art. 7, V — Contrato | Brasil |
| **Resend** | E-mail do destinatário, conteúdo da mensagem | Envio de e-mails transacionais | Art. 7, V — Contrato | EUA (cláusulas contratuais padrão) |
| **Vercel** | Logs de acesso (IP, User-Agent) | Hospedagem do sistema | Art. 7, V — Contrato | EUA (cláusulas contratuais padrão) |

### 4.2 Transferência Internacional

Dados podem ser processados nos EUA (Supabase, Resend, Vercel). A transferência é amparada por:
- Cláusulas contratuais padrão (Art. 33, II, b LGPD)
- Compromissos dos operadores com práticas adequadas de proteção de dados

### 4.3 Diagrama de Fluxo

```
┌─────────────┐     HTTPS/JWT      ┌──────────────┐
│   Usuário    │ ◄────────────────► │   Vercel     │
│  (Browser)   │                    │  (Frontend)  │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │          Supabase SDK             │
       │◄─────────────────────────────────►│
       │                                   │
       ▼                                   ▼
┌──────────────┐                   ┌──────────────┐
│  Supabase    │                   │   Vercel     │
│  (DB + Auth) │                   │ (Serverless) │
│  PostgreSQL  │                   │  Functions   │
│  + RLS       │                   └──────┬───────┘
└──────────────┘                          │
                                          │ API REST
                              ┌───────────┴───────────┐
                              │                       │
                        ┌─────▼─────┐          ┌──────▼─────┐
                        │   Asaas   │          │   Resend   │
                        │(Pagamento)│          │  (E-mail)  │
                        └───────────┘          └────────────┘
```

---

## 5. Medidas de Segurança

### 5.1 Segurança Técnica

| Medida | Implementação |
|--------|---------------|
| **Criptografia em trânsito** | HTTPS/TLS em todas as comunicações |
| **Criptografia em repouso** | Supabase PostgreSQL com criptografia AES-256 |
| **Autenticação** | JWT com expiração, Supabase Auth |
| **Isolamento de dados** | Row-Level Security (RLS) por `school_id` |
| **Controle de sessão** | Idle timer automático (logout por inatividade) |
| **Senhas** | Hash bcrypt via Supabase Auth (nunca em texto plano) |
| **Logs de auditoria** | Tabela `audit_log` com ações críticas (login, logout, alterações) |
| **Validação de webhooks** | Verificação de assinatura + idempotência via chave única |
| **Cache** | Desabilitado (no-store, no-cache) — dados sempre em tempo real |

### 5.2 Segurança Organizacional

| Medida | Descrição |
|--------|-----------|
| **Princípio do menor privilégio** | Papéis (gestor, administrativo, financeiro, professor, pai) com permissões restritas |
| **DPO designado** | dpo@gestescolar.com — resposta em até 15 dias úteis |
| **Plano de Incidentes** | Documento INCIDENT_RESPONSE.md com classificação P0-P3 e fluxo de notificação ANPD (72h) |
| **Controle de acesso ao código** | GitHub com branch protection e CI/CD automatizado |
| **Revisão de segurança** | Verificação automática de credenciais hardcoded em CI |

---

## 6. Direitos do Titular (Art. 18 LGPD)

| Direito | Como Exercer | Prazo |
|---------|-------------|-------|
| **Confirmação e acesso** (Art. 18, I-II) | Portal LGPD (`/lgpd-portal`) — botão "Baixar meus dados" | Imediato (download JSON) |
| **Correção** (Art. 18, III) | Menu Configurações do sistema | Imediato (self-service) |
| **Anonimização/bloqueio** (Art. 18, IV) | Solicitação via dpo@gestescolar.com | 15 dias úteis |
| **Portabilidade** (Art. 18, V) | Portal LGPD — exportação JSON completa | Imediato (download JSON) |
| **Eliminação** (Art. 18, VI) | Portal LGPD — botão "Solicitar Exclusão" | 15 dias úteis |
| **Informação sobre compartilhamento** (Art. 18, VII) | Política de Privacidade (`/privacy`) | Disponível 24/7 |
| **Revogação de consentimento** (Art. 18, IX) | Banner de cookies + Portal LGPD | Imediato |

---

## 7. Atividades de Tratamento Detalhadas

### AT-01: Cadastro e Autenticação de Usuários

| Campo | Valor |
|-------|-------|
| **Finalidade** | Criar conta, autenticar e controlar acesso ao sistema |
| **Categorias de dados** | Nome, e-mail, senha (hash), CPF, telefone |
| **Categorias de titulares** | Gestores, administrativos, financeiros, professores, pais |
| **Base legal** | Art. 7, V — Execução de contrato |
| **Retenção** | Duração do contrato + 5 anos |
| **Operador** | Supabase (autenticação e armazenamento) |

### AT-02: Gestão Acadêmica (Alunos)

| Campo | Valor |
|-------|-------|
| **Finalidade** | Matrícula, registro de notas, frequência e acompanhamento pedagógico |
| **Categorias de dados** | Nome, data de nascimento, turma, notas, frequência, observações |
| **Categorias de titulares** | Alunos (crianças e adolescentes) |
| **Base legal** | Art. 14 — Melhor interesse da criança + consentimento do responsável |
| **Retenção** | Notas: permanente (histórico escolar). Demais: matrícula + 5 anos |
| **Operador** | Supabase (armazenamento) |

### AT-03: Cobrança e Pagamentos

| Campo | Valor |
|-------|-------|
| **Finalidade** | Gerar e processar cobranças de mensalidades escolares |
| **Categorias de dados** | Nome, CPF, e-mail, valores, vencimentos, status de pagamento |
| **Categorias de titulares** | Responsáveis financeiros (pais/gestores) |
| **Base legal** | Art. 7, V — Execução de contrato + Art. 7, II — Obrigação legal (fiscal) |
| **Retenção** | 5 anos (obrigação fiscal) |
| **Operadores** | Supabase (armazenamento), Asaas (processamento de pagamento) |

### AT-04: Comunicações por E-mail

| Campo | Valor |
|-------|-------|
| **Finalidade** | Notificações transacionais (cobrança, recuperação de senha, avisos) |
| **Categorias de dados** | E-mail, nome, conteúdo da mensagem |
| **Categorias de titulares** | Todos os usuários |
| **Base legal** | Art. 7, V — Execução de contrato |
| **Retenção** | Logs do Resend: 30 dias |
| **Operador** | Resend (envio de e-mail) |

### AT-05: Registro de Ponto (Professores)

| Campo | Valor |
|-------|-------|
| **Finalidade** | Controle de jornada de trabalho dos professores |
| **Categorias de dados** | Nome, horários de entrada/saída, justificativas |
| **Categorias de titulares** | Professores |
| **Base legal** | Art. 7, II — Obrigação legal (CLT Art. 74, §2) |
| **Retenção** | 5 anos (CLT Art. 11) |
| **Operador** | Supabase (armazenamento) |

### AT-06: Logs de Auditoria e Segurança

| Campo | Valor |
|-------|-------|
| **Finalidade** | Rastreabilidade, detecção de fraudes, conformidade LGPD |
| **Categorias de dados** | E-mail, IP, User-Agent, ação realizada, timestamp |
| **Categorias de titulares** | Todos os usuários |
| **Base legal** | Art. 7, IX — Legítimo interesse + Art. 7, II — Obrigação legal |
| **Retenção** | 6 meses (segurança) a 5 anos (fiscal) |
| **Operador** | Supabase (armazenamento) |

### AT-07: Cookies e Consentimento

| Campo | Valor |
|-------|-------|
| **Finalidade** | Funcionamento do sistema e preferências do usuário |
| **Categorias de dados** | Consentimento (nível, data, versão), preferências de cookie |
| **Categorias de titulares** | Todos os visitantes e usuários |
| **Base legal** | Art. 7, I — Consentimento (marketing) + Art. 7, IX — Legítimo interesse (essenciais) |
| **Retenção** | localStorage do navegador (controlado pelo titular) |
| **Operador** | Nenhum (dados locais no navegador) |

---

## 8. Avaliação de Impacto (RIPD Simplificado)

### 8.1 Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Vazamento de dados de menores | Baixa | Alto | RLS, isolamento por school_id, autenticação JWT |
| Acesso indevido entre escolas | Baixa | Alto | Row-Level Security obrigatório em todas as tabelas |
| Interceptação de dados em trânsito | Muito baixa | Alto | HTTPS/TLS obrigatório |
| Perda de dados | Baixa | Médio | Backups automáticos Supabase (point-in-time recovery) |
| Uso indevido por operador (Asaas) | Baixa | Médio | Contrato com cláusulas de proteção de dados |
| Phishing contra usuários | Média | Médio | Autenticação robusta, logs de login com User-Agent |

### 8.2 Dados Sensíveis

O sistema **não** coleta dados sensíveis definidos no Art. 11 da LGPD (origem racial, opinião política, saúde, biometria, orientação sexual). Porém, dados de **crianças e adolescentes** (Art. 14) recebem proteção especial conforme descrito nas atividades de tratamento.

---

## 9. Consentimento e Marketing

| Tipo | Mecanismo | Obrigatório |
|------|-----------|-------------|
| **Termos de Uso** | Checkbox no cadastro (aceite obrigatório) | Sim |
| **Política de Privacidade** | Checkbox no cadastro (aceite obrigatório) | Sim |
| **Cookies essenciais** | Banner com opção "Apenas essenciais" | Não (legítimo interesse) |
| **Marketing / Analytics** | Checkbox opt-in no cadastro + banner "Aceitar todos" | Opt-in voluntário |

Registros de consentimento armazenados:
- `termsAcceptedAt` — data/hora do aceite dos termos
- `privacyAcceptedAt` — data/hora do aceite da política de privacidade
- `marketingOptIn` — booleano (true/false)
- `marketingOptInAt` — data/hora do opt-in de marketing
- `ges_cookie_consent` — nível de consentimento de cookies (localStorage)

---

## 10. Contato e Revisão

| Item | Detalhe |
|------|---------|
| **DPO / Encarregado** | dpo@gestescolar.com |
| **Prazo de resposta ao titular** | 15 dias úteis |
| **Autoridade competente** | ANPD — Autoridade Nacional de Proteção de Dados (www.gov.br/anpd) |
| **Próxima revisão deste documento** | 2026-11-28 (semestral) |
| **Versão** | 1.0 |

---

*Este documento é revisado semestralmente ou sempre que houver alteração significativa nas atividades de tratamento de dados do GestEscolar.*
