-- =============================================
--  GESTESCOLAR SaaS – SCHEMA DO BANCO DE DADOS
--  Supabase (PostgreSQL)
-- =============================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ESCOLAS
-- =============================================
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  plan_id TEXT NOT NULL DEFAULT 'free',
  billing TEXT DEFAULT 'mensal',
  pix_key TEXT,
  logo_url TEXT,
  upgraded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. USUÁRIOS (auth gerenciado pelo Supabase Auth)
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  username TEXT,
  cpf TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'gestor', 'administrativo', 'financeiro', 'professor', 'pai')),
  active BOOLEAN DEFAULT TRUE,
  student_id UUID,
  matricula TEXT,
  is_demo_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);

-- =============================================
-- 3. TURMAS
-- =============================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INT NOT NULL,
  shift TEXT,
  level TEXT,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classes_school ON classes(school_id);

-- =============================================
-- 4. ALUNOS
-- =============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT,
  birth_date DATE,
  gender TEXT,
  address TEXT,
  matricula TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  due_day INT DEFAULT 10,
  responsaveis JSONB DEFAULT '[]'::jsonb,
  parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  parent_name TEXT,
  parent_email TEXT,
  active_since TIMESTAMPTZ,
  inactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_matricula ON students(matricula);

-- =============================================
-- 5. BOLETOS / MENSALIDADES
-- =============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  student_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  asaas_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_school ON invoices(school_id);
CREATE INDEX idx_invoices_student ON invoices(student_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);

-- =============================================
-- 6. CONTAS A PAGAR (DESPESAS)
-- =============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  tipo TEXT DEFAULT 'fixa' CHECK (tipo IN ('fixa', 'variavel')),
  category TEXT,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  paid_at TIMESTAMPTZ,
  parcelado BOOLEAN DEFAULT FALSE,
  parcelas INT DEFAULT 1,
  parcela_num INT DEFAULT 1,
  parcela_grupo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_school ON expenses(school_id);
CREATE INDEX idx_expenses_status ON expenses(status);

-- =============================================
-- 7. TRANSAÇÕES FINANCEIRAS
-- =============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_school ON transactions(school_id);

-- =============================================
-- 8. MENSAGENS
-- =============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  from_name TEXT,
  to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  student_name TEXT,
  matricula TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject TEXT,
  text TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_school ON messages(school_id);
CREATE INDEX idx_messages_to ON messages(to_user_id);
CREATE INDEX idx_messages_from ON messages(from_user_id);

-- =============================================
-- 9. LOG DE AUDITORIA
-- =============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_school ON audit_log(school_id);

-- =============================================
-- 10. AVALIAÇÕES / NOTAS
-- =============================================
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade_type TEXT,
  grade_value NUMERIC(5,2),
  max_value NUMERIC(5,2) DEFAULT 10,
  period TEXT,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grades_school ON grades(school_id);
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_grades_class ON grades(class_id);

-- =============================================
-- 11. CHAMADA / PRESENÇA
-- =============================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('presente', 'ausente', 'justificado')),
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendance_school ON attendance(school_id);
CREATE INDEX idx_attendance_class ON attendance(class_id);
CREATE INDEX idx_attendance_date ON attendance(date);

-- =============================================
-- 12. ROW LEVEL SECURITY (RLS)
-- Cada escola só vê seus próprios dados
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Função para obter school_id do usuário logado
CREATE OR REPLACE FUNCTION get_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Políticas RLS: cada escola vê apenas seus dados
-- Schools
CREATE POLICY "schools_select" ON schools FOR SELECT USING (
  id = get_user_school_id() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'superadmin')
);
CREATE POLICY "schools_insert" ON schools FOR INSERT WITH CHECK (true);
CREATE POLICY "schools_update" ON schools FOR UPDATE USING (
  id = get_user_school_id() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'superadmin')
);

-- Users
CREATE POLICY "users_select" ON users FOR SELECT USING (
  school_id = get_user_school_id() OR auth_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'superadmin')
);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (
  school_id = get_user_school_id() OR auth_id = auth.uid()
);

-- Macro para tabelas com school_id
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['classes','students','invoices','expenses','transactions','messages','audit_log','grades','attendance'])
  LOOP
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (school_id = get_user_school_id() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = ''superadmin''))', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (school_id = get_user_school_id() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = ''superadmin''))', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (school_id = get_user_school_id() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = ''superadmin''))', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (school_id = get_user_school_id() OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = ''superadmin''))', tbl, tbl);
  END LOOP;
END;
$$;

-- =============================================
-- 13. TRIGGERS para updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
