# 🔧 GESTESCOLAR — Guia de Construção por Fases

**Objetivo:** Reconstruir o sistema do zero com tecnologias modernas Claude + Anthropic SDK  
**Data:** Maio de 2026  
**Versão:** 1.0

---

## 📋 Índice de Fases

1. [Fase 0: Setup Inicial](#fase-0-setup-inicial)
2. [Fase 1: Backend com Claude API](#fase-1-backend-com-claude-api)
3. [Fase 2: Frontend SPA Moderno](#fase-2-frontend-spa-moderno)
4. [Fase 3: Autenticação Multi-Tenant](#fase-3-autenticação-multi-tenant)
5. [Fase 4: Gestão Acadêmica](#fase-4-gestão-acadêmica)
6. [Fase 5: Sistema Financeiro](#fase-5-sistema-financeiro)
7. [Fase 6: LGPD + Conformidade](#fase-6-lgpd--conformidade)
8. [Fase 7: Deploy + CI/CD](#fase-7-deploy--cicd)

---

## ⚠️ PRÉ-REQUISITOS

Antes de começar, certifique-se que você tem:

```bash
✅ Node.js 18+ instalado
✅ Git configurado
✅ Conta Anthropic com API key
✅ Conta Supabase criada
✅ Editor de código (VS Code recomendado)
✅ Terminal/PowerShell disponível
```

**Estrutura de pastas inicial:**

```
gestescolar-v2/
├── backend/
│   ├── src/
│   │   ├── agents/          # Agents Claude para lógica
│   │   ├── api/             # Endpoints REST
│   │   └── db/              # Schemas Supabase
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── styles/
│   └── package.json
└── README.md
```

---

## FASE 0: Setup Inicial

### 0.1 Criar Repositório

```bash
mkdir gestescolar-v2
cd gestescolar-v2
git init
git config user.name "seu-nome"
git config user.email "seu-email@exemplo.com"
```

### 0.2 Setup Backend

```bash
mkdir backend
cd backend
npm init -y
npm install anthropic supabase dotenv express cors
npm install --save-dev typescript @types/node ts-node nodemon
```

**Criar `backend/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 0.3 Setup Frontend

```bash
cd ..
mkdir frontend
cd frontend
npm create vite@latest . -- --template vanilla-ts
npm install axios zustand
```

### 0.4 Variáveis de Ambiente

**`backend/.env.example`:**
```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://...supabase.co
SUPABASE_KEY=eyJhbGc...
DATABASE_URL=postgresql://...
JWT_SECRET=sua-chave-secreta
NODE_ENV=development
```

**Copiar para `.env` e preencher seus valores**

---

## FASE 1: Backend com Claude API

### 📝 O que construir:
- Agents Claude para lógica de negócio
- Endpoints REST básicos
- Integração com Supabase
- Type safety completo

### ✅ Checklist:
- [ ] Agent de autenticação criado
- [ ] Agent de gestão acadêmica criado
- [ ] Agent de pagamentos criado
- [ ] Endpoints testados com Postman/Thunder Client
- [ ] Tipos TypeScript definidos

### 🔵 PROMPT PARA PHASE 1.1 - Agent de Autenticação

```
Criar um Agent Claude especializado em autenticação para o GestEscolar.

CONTEXTO:
- Plataforma SaaS de gestão escolar multi-tenant
- Usando Supabase Auth + JWT
- Papéis: gestor, administrativo, financeiro, professor, pai, superadmin
- Dados de escola isolados por Row-Level Security (RLS)

TAREFA:
Criar arquivo `backend/src/agents/AuthAgent.ts` com:

1. Class AuthAgent extends Anthropic.Agent:
   - Métodos: login(), register(), validateToken(), logout()
   - Valida credenciais contra Supabase
   - Gera JWT com claims: user_id, school_id, role, email
   - Retorna { token, user, school } ou erro estruturado

2. Validações:
   - Email válido e único por tenant
   - Senha mín 8 char + maiúscula + número + símbolo
   - Matricula (para professor/pai) resolvida para email
   - Taxa de limite de login (5 tentativas / 5 min)

3. Integração Supabase:
   - Usar Supabase.auth.signInWithPassword()
   - Buscar dados de user, school de tabelas public
   - RLS garante isolamento automático

4. Testes:
   - Teste login válido
   - Teste login inválido
   - Teste token JWT decodificável
   - Teste expiracao de sessão

TECNOLOGIAS:
- @anthropic-ai/sdk com tool_use para chamar Supabase
- Type-safe com TypeScript interfaces
- Logs estruturados com console/winston

ENTREGA:
- Arquivo .ts compilável
- TSDoc comentado
- Arquivo de testes .test.ts
- Exemplo de uso no README
```

### 🔵 PROMPT PARA PHASE 1.2 - Agent de Gestão Acadêmica

```
Criar Agent Claude para gestão acadêmica no GestEscolar.

CONTEXTO:
- Multi-tenant: cada escola tem seus alunos/turmas/notas
- RLS em Supabase garante isolamento
- Papéis: admin, professor, pai (visualização restrita)

TAREFA:
Criar `backend/src/agents/AcademicAgent.ts` com:

1. Funcionalidades:
   - Cadastrar/listar/editar alunos
   - Criar turmas e vincular professores
   - Lançar notas por período/disciplina
   - Registrar frequência (presença/falta)
   - Gerar boletim do aluno
   - Validar limites do plano (ex: max 100 alunos em plano gestao_100)

2. Métodos principais:
   - createStudent(schoolId, data) → Student
   - createClass(schoolId, data) → Class
   - recordGrade(classId, studentId, grade, period) → Grade
   - recordAttendance(classId, date, records[]) → Attendance[]
   - getStudentReport(schoolId, studentId, period) → Report

3. Validações:
   - Aluno já existe? Retornar erro
   - Professor vinculado à turma? Verificar RLS
   - Nota válida (0-10 ou conceito A-D)? Validar schema
   - Limite de plano atingido? Bloquear com mensagem clara

4. Integração com Plans:
   - Chamar Plans.checkLimit() antes de criar
   - Mensagem de erro: "Plano permite até 100 alunos"

5. Testes:
   - CRUD alunos
   - CRUD turmas
   - Lançamento de notas
   - Validação de limites
   - Isolamento RLS (escola A não vê escola B)

TECNOLOGIAS:
- Supabase RLS automático
- Transações para operações críticas
- Cache local com Zustand (frontend)

ENTREGA:
- Arquivo .ts tipado
- Testes completos
- Documentação de schemas
```

### 🔵 PROMPT PARA PHASE 1.3 - Agent de Pagamentos

```
Criar Agent Claude para gestão de pagamentos do GestEscolar.

CONTEXTO:
- Integração Asaas para PIX + Cartão
- Webhooks bidireccionais
- Trial de 7 dias antes de cobrar
- Bloqueio de escola se inadimplente

TAREFA:
Criar `backend/src/agents/PaymentAgent.ts` com:

1. Funcionalidades:
   - Gerar cobrança (individual ou em lote)
   - Processar pagamento via PIX (gerar QR Code)
   - Processar pagamento via Cartão
   - Conciliar webhook do Asaas
   - Aplicar bloqueio se vencido

2. Métodos:
   - generateInvoice(schoolId, studentId, amount, dueDate) → Invoice
   - createPixPayment(invoiceId) → {qrCode, brCode, amount}
   - processCardPayment(invoiceId, cardToken) → {status, transactionId}
   - handleAsaasWebhook(payload) → void (atualiza status)
   - checkSchoolBlock(schoolId) → boolean

3. Validações:
   - Escola em trial? Não cobrar antes de 7 dias
   - Fatura já paga? Retornar erro
   - Valor válido (>0)? Validar
   - School bloqueada por inadimplência? Usar soft block

4. Webhook Handler:
   - Chamar de /api/webhooks/asaas
   - Validar assinatura
   - Atualizar status de faturas
   - Registrar em audit_log

5. Testes:
   - Gerar fatura
   - PIX com QR Code válido
   - Webhook de pagamento confirmado
   - Bloqueio automático ao vencer

TECNOLOGIAS:
- Asaas SDK/REST
- Idempotência via chave única
- Transações ACID

ENTREGA:
- Arquivo .ts
- Testes com mocks Asaas
- Documentação de webhook
```

### 🔵 PROMPT PARA PHASE 1.4 - API REST com Express

```
Criar endpoints REST para o GestEscolar com Express.

CONTEXTO:
- Backend minimalista com Agent Claude fazendo lógica
- Endpoints para frontend consumir
- JWT middleware para autenticação
- Rate limiting e CORS configurado

TAREFA:
Criar `backend/src/api/server.ts` e rotas:

1. Estrutura:
   - Express.js com TypeScript
   - Middleware: CORS, rate-limit, JWT
   - Rotas separadas por domínio (auth, academic, payment, admin)

2. Endpoints (mínimo):
   
   AUTH:
   - POST /api/auth/login
   - POST /api/auth/register
   - POST /api/auth/logout
   - GET  /api/auth/me (verificar JWT)
   
   ACADEMIC:
   - GET  /api/students (listar da escola)
   - POST /api/students (criar)
   - PUT  /api/students/:id (editar)
   - GET  /api/grades/:studentId
   - POST /api/grades (lançar nota)
   - POST /api/attendance (registrar presença)
   
   PAYMENT:
   - GET  /api/invoices
   - POST /api/invoices (gerar)
   - POST /api/payments/pix
   - POST /api/payments/card
   - POST /api/webhooks/asaas (não autenticado, validar sig)
   
   ADMIN:
   - GET  /api/admin/schools (superadmin only)
   - GET  /api/school/settings
   - PUT  /api/school/settings

3. Middleware:
   - JWT: verificar token, extrair school_id, role
   - RLS: passar school_id para queries Supabase
   - Rate Limit: 100 req/min por IP, 1000/min global
   - Error Handler: formato consistente {error, code, message}

4. Response Pattern:
   ```typescript
   Success: { ok: true, data: {...}, timestamp }
   Error: { ok: false, error: "CODE", message: "...", code: 400 }
   ```

5. Testes:
   - Todos endpoints 2xx
   - Auth sem token → 401
   - Acesso a outro tenant → 403
   - Rate limit trigger → 429

TECNOLOGIAS:
- Express 4.x
- express-jwt para middleware
- express-rate-limit
- cors

ENTREGA:
- server.ts iniciável
- Rotas tipadas
- Postman collection com exemplos
- Tests com Jest
```

### 🔵 PROMPT PARA PHASE 1.5 - Schemas Supabase

```
Criar e provisionar schemas PostgreSQL no Supabase para GestEscolar.

CONTEXTO:
- Multi-tenant com isolamento RLS
- Soft delete com deleted_at (para LGPD)
- Audit log para conformidade
- Timestamps automáticos

TAREFA:
Criar `backend/src/db/migrations.sql` com:

1. Tabelas (ordem correta para FK):

   schools:
   - id (UUID PK)
   - name, cnpj, email, phone, address
   - plan_id (free|gestao_100|gestao_250|gestao_unlimited|piloto)
   - plan_expires_at (timestamp, NULL = nunca vence)
   - school_status (ativa|bloqueada)
   - created_at, updated_at, deleted_at
   
   users:
   - id (UUID PK)
   - auth_id (FK para supabase.auth.users)
   - school_id (FK, NULL = superadmin)
   - email, name, cpf, phone
   - role (gestor|administrativo|financeiro|professor|pai|superadmin)
   - created_at, updated_at, deleted_at
   
   students:
   - id (UUID PK)
   - school_id (FK)
   - name, birth_date, cpf, matricula
   - monthly_fee, due_day
   - status (ativa|inativa|transferido)
   - created_at, updated_at, deleted_at
   
   classes:
   - id (UUID PK)
   - school_id (FK)
   - name, year, level, shift
   - teacher_id (FK users)
   - created_at, updated_at
   
   grades:
   - id (UUID PK)
   - school_id (FK)
   - class_id (FK), student_id (FK)
   - subject, grade_value (0-10), period
   - created_at, updated_at
   
   attendance:
   - id (UUID PK)
   - school_id (FK)
   - class_id (FK), student_id (FK)
   - date, status (presente|falta|justificado)
   - created_at, updated_at
   
   invoices:
   - id (UUID PK)
   - school_id (FK)
   - student_id (FK)
   - amount, due_date, status (pendente|pago|vencido)
   - asaas_id (ref para transação)
   - paid_at, paid_amount
   - created_at, updated_at
   
   audit_log:
   - id (UUID PK)
   - school_id (FK, NULL = sistema)
   - user_id (FK, NULL = sistema)
   - action (USER_LOGIN|PAYMENT|BLOCK|etc)
   - details (JSON)
   - created_at

2. Índices para performance:
   - school_id em todas as tabelas
   - email em users
   - student_id em grades, attendance, invoices
   - due_date em invoices

3. RLS Policy (Row-Level Security):
   - INSERT: user.school_id = school_id (ou superadmin)
   - SELECT: user.school_id = school_id (ou superadmin)
   - UPDATE: user.school_id = school_id (ou superadmin)
   - DELETE: user.school_id = school_id (ou superadmin)
   - Superadmin bypassa tudo via service_role_key

4. Functions para segurança:
   - get_current_school_id() → UUID
   - is_superadmin() → boolean
   - check_plan_limit(school_id, resource_type) → boolean

5. Testes:
   - Criar user na escola A
   - Verificar que NÃO vê dados escola B
   - Superadmin vê tudo
   - Soft delete remove de SELECT

TECNOLOGIAS:
- PostgreSQL 15+
- Supabase RLS engine
- Migrations com Supabase CLI ou SQL puro

ENTREGA:
- migrations.sql executável
- Schema diagrama (draw.io ou similar)
- RLS policies documentadas
- Testes de isolamento
```

---

## FASE 2: Frontend SPA Moderno

### 📝 O que construir:
- Interface responsiva com Vite + TypeScript
- Componentes reutilizáveis
- Gerenciamento de estado com Zustand
- Comunicação com backend

### ✅ Checklist:
- [ ] Layout base criado
- [ ] Páginas de autenticação
- [ ] Dashboard por papel de usuário
- [ ] Formulários acadêmicos
- [ ] Integração com API REST

### 🔵 PROMPT PARA PHASE 2.1 - Estrutura Frontend

```
Criar estrutura moderna de frontend SPA para GestEscolar.

CONTEXTO:
- Vite + TypeScript + Vanilla JS (sem React/Vue)
- Responsive mobile-first
- Single Page Application com router customizado
- Estado global com Zustand

TAREFA:
Criar `frontend/src/` com:

1. Estrutura de pastas:
   src/
   ├── components/      (componentes reutilizáveis)
   ├── pages/           (páginas/rotas)
   ├── stores/          (Zustand stores)
   ├── services/        (API calls)
   ├── styles/          (CSS global + componentes)
   ├── types/           (TypeScript interfaces)
   ├── utils/           (helpers)
   ├── router.ts        (SPA router customizado)
   └── main.ts          (entry point)

2. Router SPA:
   - Sem dependência de react-router
   - Hash-based routing (#/login, #/dashboard)
   - Guard: redireciona para login se sem JWT
   - Suporta: /login, /register, /dashboard, /profile, /settings

3. Store Zustand:
   ```typescript
   - auth (user, token, logout)
   - school (currentSchool, settings)
   - ui (sidebarOpen, theme)
   ```

4. Services:
   - api.ts: axios instance com JWT
   - auth.ts: login, register, logout
   - students.ts: CRUD alunos
   - grades.ts: lançamento de notas
   - payments.ts: pagamentos

5. CSS:
   - CSS Grid para layout
   - CSS Custom Properties para tema
   - Mobile-first (320px+)
   - Dark mode support

6. Testes:
   - Componentes renderizam
   - Router navega
   - Store atualiza
   - API calls funcionam (mock)

TECNOLOGIAS:
- Vite 5.x
- TypeScript strict mode
- Zustand para estado
- Axios para HTTP
- CSS puro (Tailwind opcional)

ENTREGA:
- Estrutura completa pronta
- README com setup
- Exemplo de novo componente
```

### 🔵 PROMPT PARA PHASE 2.2 - Autenticação Frontend

```
Criar fluxo completo de autenticação no frontend GestEscolar.

CONTEXTO:
- Login/Register/Logout
- JWT armazenado em localStorage
- Redirecionar se expirou
- Suporte a múltiplos papéis (gestor, professor, pai)

TAREFA:
Criar:
1. `frontend/src/pages/LoginPage.ts`
2. `frontend/src/pages/RegisterPage.ts`
3. `frontend/src/services/auth.ts`

1. LoginPage:
   - Campos: email (ou matricula), senha
   - Validação cliente
   - Loader durante submissão
   - Erro exibido
   - Link para "Esqueceu senha?"
   - Redireciona para dashboard após sucesso

2. RegisterPage:
   - Campos: email, nome, senha, confirmar senha
   - Checkbox: "Li e aceito Termos" (obrigatório)
   - Checkbox: "Marketing opt-in" (opcional)
   - Validação de força de senha
   - Redireciona para login após sucesso

3. auth.ts service:
   - login(email, password) → JWT + user data
   - register(data) → account created
   - logout() → delete JWT
   - getMe() → user profile (usa JWT)
   - refreshToken() se expirou
   - Armazena JWT em localStorage

4. JWT Middleware:
   - Detecta token expirado
   - Redireciona para /login
   - Auto-logout após 30 min inatividade

5. Testes:
   - Login com credenciais válidas
   - Login com senha errada
   - Registro novo usuário
   - Token persiste refresh
   - Logout limpa localStorage

TECNOLOGIAS:
- Fetch ou Axios
- localStorage para persistência
- Modal/toast para feedback

ENTREGA:
- Páginas funcionais
- Integração com backend testada
- Fluxo sem erros
```

### 🔵 PROMPT PARA PHASE 2.3 - Dashboard Adaptativo

```
Criar dashboard responsivo que se adapta por papel de usuário.

CONTEXTO:
- Cada papel (gestor, professor, pai) vê interface diferente
- Dashboard com cards de resumo
- Menu lateral colapsável
- Mobile-first

TAREFA:
Criar `frontend/src/pages/DashboardPage.ts` com:

1. Estrutura:
   - Header com logo, user menu, notificações
   - Sidebar com menu por papel
   - Main content area
   - Footer (opcional)

2. Menu por papel:
   
   GESTOR:
   - Dashboard
   - Alunos
   - Turmas
   - Notas
   - Frequência
   - Financeiro
   - Relatórios
   - Configurações
   - Meus Dados (LGPD)
   
   PROFESSOR:
   - Dashboard
   - Minhas Turmas
   - Lançar Notas
   - Chamada
   - Registro de Ponto
   - Mensagens
   - Meus Dados (LGPD)
   
   PAI:
   - Dashboard
   - Meu Filho (boletim, frequência)
   - Faturas
   - Mensagens
   - Meus Dados (LGPD)
   
   SUPERADMIN:
   - Dashboard
   - Escolas
   - Usuários
   - Relatórios
   - Configurações

3. Cards de resumo (customizados por papel):
   - Total de alunos (gestor)
   - Turmas sob minha responsabilidade (professor)
   - Boletim do meu filho (pai)
   - Faturas pendentes (gestor)

4. Responsividade:
   - Desktop: sidebar sempre visível
   - Tablet: sidebar colapsável
   - Mobile: sidebar hamburger

5. Testes:
   - Carrega dashboard correto por papel
   - Menu exibe opções certas
   - Cards mostram dados relevantes
   - Sidebar collapse/expand funciona

TECNOLOGIAS:
- CSS Grid/Flexbox
- Media queries
- Zustand para role

ENTREGA:
- Dashboard funcional
- 3 variações (gestor, professor, pai)
- Mobile responsivo
```

---

## FASE 3: Autenticação Multi-Tenant

### 📝 O que construir:
- Isolamento de dados por tenant
- JWT com claims de school_id
- RLS no Supabase
- Controle de acesso por papel

### ✅ Checklist:
- [ ] RLS policies ativadas
- [ ] JWT contém school_id
- [ ] Middleware valida school_id
- [ ] Testes de isolamento

### 🔵 PROMPT PARA PHASE 3.1 - RLS e Isolamento

```
Implementar Row-Level Security (RLS) completo no Supabase para multi-tenant.

CONTEXTO:
- Cada escola é um tenant isolado
- Usuários veem apenas dados da sua escola
- Superadmin vê tudo
- RLS garante isolamento em nível de banco de dados

TAREFA:
Criar `backend/src/db/rls-policies.sql` com:

1. Enable RLS em todas as tabelas:
   ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE students ENABLE ROW LEVEL SECURITY;
   [... todas as outras]

2. Policies por tabela:

   SCHOOLS:
   - SELECT: public (permitir buscar dados da escola sem auth)
   - INSERT: superadmin only
   - UPDATE: superadmin only
   - DELETE: superadmin only

   USERS:
   - SELECT: school_id = current_school_id() OR is_superadmin()
   - INSERT: school_id = current_school_id() OR is_superadmin()
   - UPDATE: school_id = current_school_id() OR is_superadmin()
   - DELETE: superadmin only

   STUDENTS:
   - SELECT: school_id = current_school_id()
   - INSERT: school_id = current_school_id()
   - UPDATE: school_id = current_school_id()
   - DELETE: soft_delete (deleted_at)

   [... idem para grades, attendance, invoices, etc]

3. Functions auxiliares:
   ```sql
   CREATE FUNCTION current_school_id() RETURNS UUID AS $$
     SELECT (auth.jwt() ->> 'school_id')::uuid
   $$ LANGUAGE SQL STABLE;

   CREATE FUNCTION is_superadmin() RETURNS BOOLEAN AS $$
     SELECT (auth.jwt() ->> 'role') = 'superadmin'
   $$ LANGUAGE SQL STABLE;
   ```

4. Testes de isolamento:
   - Login como user escola A
   - SELECT students → vê só alunos da A
   - Tentar UPDATE aluno da B → bloqueado
   - Logar como superadmin → vê tudo

5. Documentação:
   - Como adicionar nova tabela com RLS
   - Checklist de policies
   - Troubleshooting de blocked queries

TECNOLOGIAS:
- Supabase RLS
- PostgreSQL functions
- JWT claims

ENTREGA:
- SQL completo executável
- Testes de segurança
- Documento "Como adicionar tabela"
```

### 🔵 PROMPT PARA PHASE 3.2 - JWT Claims e Middleware

```
Implementar JWT com school_id/role claims e middleware de autorização.

CONTEXTO:
- Supabase Auth gera JWT
- Adicionar claims customizados: school_id, role
- Backend valida JWT em cada request
- Frontend armazena e envia JWT

TAREFA:
Criar:
1. `backend/src/middleware/auth.ts`
2. `backend/src/middleware/authorize.ts`
3. Supabase JWT hook

1. Supabase JWT Hook:
   - Ao fazer login via Supabase Auth
   - Chamar trigger para adicionar claims
   - JWT resultante: {sub, email, school_id, role}

2. auth.ts Middleware:
   ```typescript
   export function authMiddleware(req, res, next) {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) return res.status(401).json({...});
     
     try {
       const decoded = jwt.verify(token, JWT_SECRET);
       req.user = { id: decoded.sub, email: decoded.email, schoolId: decoded.school_id, role: decoded.role };
       next();
     } catch (e) {
       res.status(401).json({...});
     }
   }
   ```

3. authorize.ts Middleware:
   ```typescript
   export function authorize(...roles) {
     return (req, res, next) => {
       if (!roles.includes(req.user.role)) {
         return res.status(403).json({...});
       }
       next();
     };
   }
   ```

4. Uso nas rotas:
   ```typescript
   app.post('/api/students', authMiddleware, authorize('gestor', 'administrativo'), handler);
   ```

5. Testes:
   - Request sem token → 401
   - Request com token inválido → 401
   - Token expirado → 401
   - Papel insuficiente → 403
   - Papel correto → 200

TECNOLOGIAS:
- jsonwebtoken
- Supabase triggers

ENTREGA:
- Middleware funcional
- Integração com rotas
- Testes completos
```

---

## FASE 4: Gestão Acadêmica

### 📝 O que construir:
- CRUD de alunos, turmas, notas
- Lançamento de frequência
- Validação de limites de plano
- Boletim para responsáveis

### ✅ Checklist:
- [ ] Alunos: criar, editar, deletar
- [ ] Turmas: criar, vincular professor
- [ ] Notas: lançar, editar, calcular média
- [ ] Frequência: marcar presença/falta
- [ ] Boletim: visualizar notas e frequência

### 🔵 PROMPT PARA PHASE 4.1 - API de Alunos

```
Implementar endpoints REST completos para gestão de alunos.

CONTEXTO:
- CRUD alunos por tenant
- Validar limites de plano (free: 5 alunos, gestao_100: 100)
- Criar responsável automaticamente
- RLS isola por school_id

TAREFA:
Criar `backend/src/api/routes/students.ts`:

Endpoints:
GET  /api/students
- Query: ?page=1&limit=20&search=nome
- Retorna: {data: Student[], total, page, limit}
- Acesso: gestor, administrativo

GET  /api/students/:id
- Retorna: Student (com notas e frequência)
- Acesso: gestor, administrativo, professor, pai (filho dele)

POST /api/students
- Body: {name, birthDate, cpf, monthlyFee, dueDay}
- Validações: 
  - Limite de plano não atingido?
  - CPF válido?
  - Dados completos?
- Retorna: Student criado
- Acesso: gestor, administrativo

PUT  /api/students/:id
- Body: {name, birthDate, monthlyFee, ...}
- Retorna: Student atualizado
- Acesso: gestor, administrativo

DELETE /api/students/:id
- Soft delete: apenas marca deleted_at
- Retorna: 200 OK
- Acesso: gestor

Handlers (usar AuthAgent):
1. GET listStudents:
   - Chamar Students.list(schoolId, filters)
   - Filtrar por deleted_at IS NULL
   - Paginar

2. POST createStudent:
   - Chamar Plans.checkLimit(school.planId, 'students', count+1)
   - Se OK: criar student
   - Chamar createResponsible() automaticamente
   - Log em audit_log

3. PUT updateStudent:
   - Validar campos
   - Atualizar
   - Log de mudanças

4. DELETE deleteStudent:
   - Soft delete: UPDATE students SET deleted_at = NOW()

Testes:
- Criar aluno nova escola
- Listar alunos (RLS)
- Atualizar aluno
- Atingir limite → erro
- Deletar aluno

TECNOLOGIAS:
- Express middleware
- Supabase client
- Joi/Zod para validação

ENTREGA:
- Rotas funcionais
- Validações completas
- Testes passando
- Documentação Swagger/OpenAPI
```

### 🔵 PROMPT PARA PHASE 4.2 - Lançamento de Notas

```
Implementar lançamento de notas com cálculo automático de média.

CONTEXTO:
- Professor lança notas por período/disciplina
- Sistema calcula média automática
- Responsável vê boletim em tempo real
- Histórico completo de notas

TAREFA:
Criar `backend/src/api/routes/grades.ts`:

Endpoints:
GET  /api/grades/:studentId
- Query: ?period=2026-S1&subject=Português
- Retorna: Grade[] com cálculos
- Acesso: gestor, professor (turma), pai

POST /api/grades
- Body: {classId, studentId, subject, gradeValue, period}
- Validações:
  - Professor leciona nessa turma?
  - Aluno está na turma?
  - Nota válida (0-10)?
- Calcula média: (sum of grades) / count
- Retorna: Grade criado
- Acesso: professor

PUT  /api/grades/:id
- Atualiza nota lançada
- Recalcula média
- Acesso: professor

DELETE /api/grades/:id
- Soft delete
- Recalcula média
- Acesso: professor

Handlers:
1. POST createGrade:
   - Validar professor está na turma
   - Validar aluno está na turma
   - Criar grade
   - Chamar calculateStudentAverage(studentId, subject, period)
   - Retornar média atualizada

2. calculateStudentAverage():
   - SELECT AVG(grade_value) FROM grades WHERE student_id = ? AND subject = ? AND period = ?
   - UPDATE grades_summary SET average = ? WHERE ...
   - Retornar resultado

3. Boletim:
   - Agrupas grades por período, disciplina
   - Exibir notas + média + frequência

Testes:
- Lançar nota válida
- Nota inválida (15) → erro
- Nota de outro professor → bloqueado
- Média recalcula
- Pai vê boletim

TECNOLOGIAS:
- PostgreSQL para agregar (AVG)
- Cache do boletim (Redis opcional)

ENTREGA:
- Endpoints funcionais
- Cálculo de média testado
- Boletim visual
```

---

## FASE 5: Sistema Financeiro

### 📝 O que construir:
- Geração de faturas
- PIX integrado (Asaas)
- Pagamento por cartão
- Webhook de conciliação
- Bloqueio por inadimplência

### ✅ Checklist:
- [ ] Fatura gerada automaticamente
- [ ] PIX com QR Code funcionando
- [ ] Pagamento via cartão funcionando
- [ ] Webhook recebendo e conciliando
- [ ] Bloqueio automático aplicado

### 🔵 PROMPT PARA PHASE 5.1 - Geração de Faturas

```
Implementar geração automática de faturas e agendamento.

CONTEXTO:
- Fatura gerada mensalmente para cada aluno
- Data vencimento: due_day configurado no aluno
- Status: pendente, pago, vencido
- Trial: primeiros 7 dias sem cobrar

TAREFA:
Criar:
1. `backend/src/api/routes/invoices.ts`
2. `backend/src/jobs/generateInvoices.ts` (cron job)

1. Endpoints:

GET  /api/invoices
- Query: ?status=pendente&studentId=123
- Retorna: Invoice[] filtradas
- Acesso: gestor, pai (sua fatura)

GET  /api/invoices/:id
- Retorna: Invoice detalhada
- Acesso: gestor, pai

POST /api/invoices/manual
- Gerar fatura manual (aluno específico)
- Body: {studentId, amount, dueDate}
- Acesso: gestor, financeiro

GET  /api/financial/summary
- Cards: total pendente, vencido, pago este mês
- Gráfico: receita últimos 6 meses
- Acesso: gestor, financeiro

2. Cron Job (generateInvoices):
   - Rodar todo dia 1º do mês às 02:00
   - Para cada aluno ativo:
     - Calcular se trial expirou (7 dias)
     - Se expirou e não tem fatura este mês: criar
     - Vencimento = due_day deste mês (ou próximo se já passou)
   - Log: 500 faturas criadas

3. Handler createInvoice():
   - Validar: aluno existe, school_id match
   - Calcular: valor mensal (aluno.monthly_fee)
   - Criar registro com status = 'pendente'
   - Enviar e-mail ao responsável

4. Validações:
   - Fatura já existe este mês? Não criar duplicada
   - Aluno em trial? Não cobrar
   - Valor > 0? Sim

Testes:
- Cron cria faturas
- Não duplica
- Trial não cobrado
- E-mail enviado

TECNOLOGIAS:
- node-cron para job
- Resend para e-mail
- Supabase queries

ENTREGA:
- Geração funcionando
- Cron job testado
- E-mails enviados
```

### 🔵 PROMPT PARA PHASE 5.2 - PIX e Asaas

```
Integrar pagamento via PIX com Asaas.

CONTEXTO:
- Cliente gera QR Code dinâmico
- Usuário escaneia + paga
- Webhook retorna confirmação
- Fatura é marcada como paga

TAREFA:
Criar `backend/src/agents/PaymentAgent.ts` com:

1. Métodos Asaas:

POST /api/payments/pix/:invoiceId
- Chamar Asaas.createPayment({
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    description: `Fatura ${invoiceId}`,
    billingType: 'PIX'
  })
- Retorna: {qrCode, brCode, asaasId}
- Armazena asaas_id na invoice

2. Frontend:
   - Exibir QR Code
   - Botão "Copiar código" (brCode)
   - Spinner até confirmação
   - Webhook confirma automaticamente

3. Webhook Handler:
   POST /api/webhooks/asaas (sem JWT)
   - Recebe: {object: 'payment', id, status, ...}
   - Validar assinatura Asaas
   - Se status = CONFIRMED:
     - Buscar invoice por asaas_id
     - UPDATE invoice SET status='pago', paid_at=NOW(), paid_amount=amount
     - Log em audit_log
     - Enviar e-mail de confirmação
   - Retorna: 200 OK (idempotente)

4. Validações:
   - Assinatura Asaas válida
   - Invoice existe e está pendente
   - Valor conferido (amount == invoice.amount)
   - Não processar 2x mesmo webhook (usar webhook_id como chave única)

5. Testes:
   - Criar QR Code válido
   - Webhook recebe pagamento
   - Invoice muda pra pago
   - E-mail confirmação
   - Reenviar webhook → idempotente

TECNOLOGIAS:
- Asaas SDK/REST
- Crypto para validar sig
- Webhook handler

ENTREGA:
- QR Code gerado
- Webhook processando
- Invoice atualizada
- Testes end-to-end
```

### 🔵 PROMPT PARA PHASE 5.3 - Cartão de Crédito

```
Implementar pagamento por cartão com tokenização Asaas.

CONTEXTO:
- Usuário preenche dados cartão na tela
- Asaas tokeniza (nunca toca no servidor)
- Charge automática
- Retry em caso de falha

TAREFA:
Criar frontend + backend para pagamento cartão:

1. Frontend Form:
   `frontend/src/components/CardPaymentForm.ts`
   - Campos: nome, número, vencimento, CVV
   - Máscara: 1234 5678 9012 3456
   - Validação cliente: Luhn check, expiração futura
   - Botão "Pagar": POST /api/payments/card/{invoiceId}
   - Loader durante processamento

2. Backend Handler:
   POST /api/payments/card/:invoiceId
   - Body: {cardNumber, expiryMonth, expiryYear, cvv, holderName}
   - Chamar Asaas.createPayment({
       customer: school.asaas_customer_id,
       amount,
       description,
       billingType: 'CREDIT_CARD',
       creditCard: {number, expiryMonth, expiryYear, cvv, holders: [{name}]},
       remoteIp: req.ip
     })
   - Se OK: atualizar invoice (status='pago', asaas_id=paymentId)
   - Se erro: retornar mensagem clara (cartão recusado, etc)

3. Validações:
   - Número de cartão: 13-19 dígitos
   - Expiração: futuro
   - CVV: 3-4 dígitos
   - Holder: não vazio

4. Segurança:
   - NUNCA armazenar dados brutos do cartão
   - NUNCA logar número do cartão
   - Usar tokenização Asaas

5. Testes:
   - Cartão válido de teste Asaas
   - Cartão inválido → erro
   - Validação cliente funciona
   - Soft block se falhar

TECNOLOGIAS:
- Mask.js para input masking
- Asaas SDK

ENTREGA:
- Form funcionando
- Pagamento processado
- Segurança validada
```

---

## FASE 6: LGPD + Conformidade

### 📝 O que construir:
- Banner de cookies
- Portal do titular (exportação de dados)
- Soft delete (deleted_at)
- Audit log completo
- Política de privacidade + Termos

### ✅ Checklist:
- [ ] Banner cookies mostrado
- [ ] Portal LGPD criado
- [ ] Exportação JSON funcionando
- [ ] Soft delete em todas as tabelas
- [ ] Documentos legais publicados

### 🔵 PROMPT PARA PHASE 6.1 - Banner de Cookies LGPD

```
Implementar banner de cookies com consentimento explícito.

CONTEXTO:
- Cookie banner no rodapé/superior
- 2 opções: "Apenas essenciais" (padrão) ou "Aceitar todos" (marketing)
- Armazenar consentimento em localStorage
- Não reaparecer após escolha

TAREFA:
Criar `frontend/src/components/CookieBanner.ts`:

1. HTML:
   - Fixed no bottom, full width
   - BG azul (#1a73e8), texto branco
   - Explicação: "Usamos cookies essenciais..."
   - 2 botões: "Apenas essenciais" (outline) | "Aceitar todos" (preenchido)
   - Link para Política de Privacidade

2. Lógica:
   - Verificar localStorage.ges_cookie_consent
   - Se não existe: mostrar
   - Clicar botão: salvar em localStorage com timestamp
   - Não reaparecer essa sessão
   - Limpar localStorage manualmente para reaparecer

3. Dados salvos:
   ```json
   {
     "level": "essential" | "all",
     "acceptedAt": "2026-05-28T10:30:00Z",
     "version": "1.0"
   }
   ```

4. Integração analytics:
   - Se level = 'all': ativar Google Analytics, Hotjar, etc
   - Se level = 'essential': apenas cookies de session

5. Testes:
   - Banner aparece primeira vez
   - Desaparece após clicar
   - localStorage preenchido
   - Reload página: não aparece
   - Limpar localStorage: aparece novamente

TECNOLOGIAS:
- Vanilla JS
- localStorage
- CSS animations

ENTREGA:
- Banner funcional
- Conforme LGPD Art. 7, I
```

### 🔵 PROMPT PARA PHASE 6.2 - Portal do Titular (LGPD)

```
Criar portal do titular com direitos do Art. 18 LGPD.

CONTEXTO:
- Usuário acessa /lgpd-portal após login
- 4 ações: Exportar dados, Ver Política, Ver Termos, Deletar conta
- Conforme Art. 18, I-VI LGPD

TAREFA:
Criar `frontend/src/pages/LgpdPortalPage.ts`:

1. Layout:
   - Card grande com 4 sub-cards
   - Ícones + descrição para cada ação
   - Responsivo em mobile

2. Card 1: Exportar Dados (Art. 18, V)
   - Botão: "Baixar JSON"
   - Chamar GET /api/lgpd/export
   - Download automático: meus-dados-YYYY-MM-DD.json
   - Contém: personal data, school, students (se pai), invoices, audit_log

3. Card 2: Política de Privacidade
   - Botão: "Ver Política" (abre /privacy em nova aba)

4. Card 3: Termos de Uso
   - Botão: "Ver Termos" (abre /terms em nova aba)

5. Card 4: Solicitar Exclusão (Art. 18, VI)
   - Botão: "Solicitar Exclusão"
   - Modal com:
     - Aviso: "Processado em até 15 dias úteis"
     - TextArea: "Motivo (opcional)"
     - Checkbox: "Confirmo que desejo excluir"
   - Botão: "Enviar Solicitação"
   - POST /api/lgpd/delete-request
   - Resposta: Modal de confirmação com DPO info

6. Info adicionais na página:
   - DPO contact: dpo@gestescolar.com
   - Retenção de dados
   - Como corrigir dados (em Configurações)
   - Link para ANPD (autoridade)

Backend:
GET  /api/lgpd/export
- Chamar AuthAgent.exportData(userId)
- Retorna JSON com todos os dados do usuário
- Log em audit_log: LGPD_DATA_EXPORT

POST /api/lgpd/delete-request
- Body: {reason}
- Criar registro em audit_log: LGPD_DELETION_REQUEST
- Enviar e-mail ao DPO
- Resposta: {status: 'success', message}

Testes:
- Export JSON válido
- Deletar envia e-mail
- Modal funciona
- Links abrem

TECNOLOGIAS:
- Modal customizado
- File download JS
- Fetch para API

ENTREGA:
- Portal funcional
- Conforme Art. 18 LGPD
- Integração DPO
```

### 🔵 PROMPT PARA PHASE 6.3 - Soft Delete e Audit Log

```
Implementar soft delete e audit log completo.

CONTEXTO:
- Soft delete: adicionar deleted_at em vez de excluir
- Audit log: registrar TODA ação crítica
- Conformidade com obrigações legais de rastreabilidade

TAREFA:
Criar:
1. `backend/src/db/soft-delete-migration.sql`
2. `backend/src/utils/auditLog.ts`

1. Migration: adicionar deleted_at em todas as tabelas
   ```sql
   ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
   ALTER TABLE students ADD COLUMN deleted_at TIMESTAMP NULL;
   [... etc todas]
   
   CREATE INDEX idx_users_deleted ON users(deleted_at);
   [... índices para performance]
   ```

2. auditLog.ts helper:
   ```typescript
   export async function logAction(
     schoolId: string,
     userId: string,
     action: string,
     details: object
   ) {
     await supabase.from('audit_log').insert({
       school_id: schoolId,
       user_id: userId,
       action,
       details,
       created_at: new Date()
     });
   }
   ```

3. Ações críticas a logar:
   - USER_LOGIN: {email, ip, userAgent}
   - USER_LOGOUT: {email}
   - STUDENT_CREATED: {student_id, name}
   - STUDENT_DELETED: {student_id, name} (soft delete)
   - GRADE_RECORDED: {grade_id, student_id, value}
   - PAYMENT_RECEIVED: {invoice_id, amount, method}
   - PAYMENT_FAILED: {invoice_id, error}
   - SCHOOL_BLOCKED: {school_id, reason: 'trial_expired' | 'overdue'}
   - LGPD_DATA_EXPORT: {user_email}
   - LGPD_DELETION_REQUEST: {user_email, reason}

4. Soft Delete Pattern:
   - INSERT: normal
   - UPDATE: normal
   - DELETE: UPDATE table SET deleted_at = NOW() WHERE id = ?
   - SELECT: sempre adicionar WHERE deleted_at IS NULL
   - Criar view pública para facilitar

5. Queries sempre filtram deleted:
   ```typescript
   const users = await supabase
     .from('users')
     .select()
     .eq('school_id', schoolId)
     .is('deleted_at', null);  // ← chave!
   ```

6. Testes:
   - DELETE aluno → soft delete
   - SELECT não mostra deletados
   - Audit log registra
   - Querys filtram automaticamente

TECNOLOGIAS:
- PostgreSQL timestamps
- Supabase .is() filter
- Winston para logs estruturados

ENTREGA:
- Soft delete completo
- Audit log estruturado
- Querys ajustadas
```

### 🔵 PROMPT PARA PHASE 6.4 - Documentos Legais

```
Criar páginas Política de Privacidade e Termos de Uso conforme LGPD.

CONTEXTO:
- Conforme Lei 13.709/2018 (LGPD)
- Transparência: o que coletamos, por quê, por quanto tempo
- Direitos do titular: como exercer
- Termos de Uso: como usar o serviço

TAREFA:
Criar:
1. `frontend/src/pages/PrivacyPage.ts`
2. `frontend/src/pages/TermsPage.ts`

1. Privacy Page (/privacy):
   Seções:
   - O que coletamos (dados pessoais, acadêmicos, financeiros)
   - Por que coletamos (execução contrato, obrigação legal)
   - Base legal (Art. 7 LGPD com articles)
   - Por quanto tempo (retenção: 5 anos fiscal, permanente histórico)
   - Seus direitos (Art. 18: confirmação, acesso, correção, eliminação, portabilidade)
   - Compartilhamento (Supabase, Asaas, Resend, Vercel com cláusulas padrão)
   - Segurança (RLS, TLS, auditoria)
   - DPO contact
   - ANPD link para reclamação

   Tabelas:
   - Categorias de dados (pessoal, acadêmico, financeiro)
   - Cada uma com: coleta, finalidade, base legal, retenção
   
   Exemplo:
   | Categoria | Dados | Finalidade | Base Legal | Retenção |
   | Pessoal | Nome, e-mail, CPF | Cadastro | Art. 7, V | Contrato + 5 anos |
   | Acadêmico | Notas, frequência | Educação | Art. 14 | Permanente |
   | Financeiro | Faturas, pagtos | Cobrança | Art. 7, II | 5 anos |

2. Terms Page (/terms):
   Seções:
   - Descrição do serviço (o que é GestEscolar)
   - Planos e preços (grátis 7 dias, depois R$ 149+)
   - Contas de usuário (responsabilidade de senha)
   - Proibições (uso indevido, acesso não autorizado)
   - Propriedade intelectual (nossos direitos)
   - Limitação de responsabilidade (liability cap)
   - Cancelamento (como cancelar, reembolso)
   - Alterações aos termos (com notificação)
   - Lei aplicável (Brasil, português)
   - Contato: suporte@gestescolar.com

3. Checkbox Aceitar:
   - No formulário de registro: "Li e aceito Termos e Política"
   - Obrigatório para continuar
   - Timestamps: termsAcceptedAt, privacyAcceptedAt
   - Armazenar em tabela users

4. Testes:
   - Páginas carregam sem erros
   - Links internos funcionam
   - Mobile responsivo
   - Checkbox no registro funciona

TECNOLOGIAS:
- HTML semântico
- Markdown to HTML (opcional)
- CSS responsivo

ENTREGA:
- 2 páginas legais completas
- Conforme LGPD
- Checkbox funcionando
```

---

## FASE 7: Deploy + CI/CD

### 📝 O que construir:
- GitHub Actions para testes
- Build frontend com Vite
- Deploy backend em Vercel
- Deploy frontend em Vercel
- Monitoramento

### ✅ Checklist:
- [ ] GitHub Actions configura
- [ ] Tests passam em CI
- [ ] Frontend builda
- [ ] Backend deploya
- [ ] Env vars configuradas

### 🔵 PROMPT PARA PHASE 7.1 - GitHub Actions

```
Configurar CI/CD com GitHub Actions.

CONTEXTO:
- Tests rodando em cada PR
- Lint de código
- Build checado
- Deploy automático em main

TAREFA:
Criar `.github/workflows/`:

1. `lint.yml`:
   - Roda em: pull_request, push main
   - ESLint frontend
   - TypeScript strict check
   - Prettier format

2. `test.yml`:
   - Roda em: pull_request, push main
   - Jest tests backend
   - Vitest tests frontend
   - Coverage report

3. `build.yml`:
   - Frontend: vite build (output: dist/)
   - Backend: npm run build (output: dist/)
   - Verificar bundle size

4. `deploy.yml` (main branch only):
   - Deploy backend para Vercel
   - Deploy frontend para Vercel
   - Rodar migrations DB
   - Sanity check: health check endpoints

Exemplo workflow:
```yaml
name: CI/CD
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build

  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@v4
```

Testes:
- PR faz lint/test automaticamente
- Merge em main faz deploy

ENTREGA:
- Workflows completos
- Deploy funcionando
```

---

## 📊 Resumo Geral

| Fase | Tempo Estimado | Prioridade |
|------|---|---|
| 0. Setup | 2h | ⭐⭐⭐ |
| 1. Backend | 2 semanas | ⭐⭐⭐ |
| 2. Frontend | 2 semanas | ⭐⭐⭐ |
| 3. Auth | 1 semana | ⭐⭐⭐ |
| 4. Acadêmica | 2 semanas | ⭐⭐⭐ |
| 5. Financeira | 2 semanas | ⭐⭐⭐ |
| 6. LGPD | 1 semana | ⭐⭐⭐ |
| 7. Deploy | 1 semana | ⭐⭐⭐ |
| **TOTAL** | **≈ 12 semanas** | — |

---

## 🚀 Como Usar Este Documento

1. **Abra uma seção** (Fase X.Y)
2. **Copie o PROMPT** integralmente
3. **Colar no Claude** (ou use em chat.anthropic.com)
4. **Aguarde a resposta** (pode ser longa)
5. **Salve o código** gerado
6. **Teste localmente**
7. **Marque como ✅** na checklist quando completar
8. **Passe para próxima fase**

---

## 💡 Dicas Importantes

### Alternância de Modelo
Se precisar de:
- **Código rápido** → Claude 3.5 Sonnet
- **Análise profunda** → Claude 3 Opus
- **Prototipagem** → Claude 3.5 Sonnet

### Iteração
Se a resposta não atender:
1. Copiar e colar a resposta em novo chat
2. Chamar: "Refine este código adicionando [requisito]"
3. Aguardar iteração

### Testes
Sempre rodar após gerar:
```bash
npm test
npm run build
npm run type-check
```

### Commits
Ao completar uma fase:
```bash
git add .
git commit -m "feat(phase-X): descrição"
git push origin main
```

---

## 📞 Suporte

Se ficar preso:
1. Verificar erro exato
2. Copiar stack trace completo
3. Criar chat novo com Claude
4. Colar erro + contexto + fase

---

**Boa sorte na construção do GestEscolar 2.0! 🚀**
