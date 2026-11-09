-- ============================================================================
-- CHAVEFLOW — MIGRAÇÃO INICIAL DO BANCO DE DADOS (PostgreSQL / Supabase)
-- Inclui: Entidades, Chaves Estrangeiras, Índices, Restrições de Consistência,
-- Controle de Concorrência, Row Level Security (RLS) e Políticas de Storage.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ORGANIZAÇÕES E UNIDADES
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX idx_branches_org ON branches(organization_id);

-- 2. PERFIS, FUNÇÕES, PERMISSÕES E VÍNCULOS (MEMBERSHIPS)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT,
  is_customer_only BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  roles TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, profile_id)
);

CREATE INDEX idx_memberships_org_profile ON memberships(organization_id, profile_id);

-- 3. VEÍCULOS E ESTOQUE
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  internal_code TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE,
  vin TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT NOT NULL,
  manufacturing_year INT NOT NULL,
  model_year INT NOT NULL,
  color TEXT NOT NULL,
  plate TEXT,
  condition TEXT NOT NULL CHECK (condition IN ('NEW', 'USED')),
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock_status TEXT NOT NULL CHECK (stock_status IN ('AVAILABLE', 'RESERVED', 'IN_PREPARATION', 'SOLD_DELIVERED', 'BLOCKED')),
  entry_date DATE NOT NULL,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, vin),
  UNIQUE (organization_id, internal_code)
);

CREATE INDEX idx_vehicles_org_stock ON vehicles(organization_id, stock_status);
CREATE INDEX idx_vehicles_qr_token ON vehicles(qr_token);

-- 4. CLIENTES (COMPRADORES)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  person_type TEXT NOT NULL CHECK (person_type IN ('PF', 'PJ')),
  document_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, document_number)
);

CREATE INDEX idx_customers_org ON customers(organization_id);

-- 5. MODELOS E VERSÕES DE PROCESSO (MOTOR DE PROCESSOS)
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_template_id, version_number)
);

-- 6. PROCEDIMENTOS E VERSÕES DE PROCEDIMENTO
CREATE TABLE procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  responsible_area TEXT NOT NULL,
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE procedure_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  title TEXT NOT NULL,
  responsible_area TEXT NOT NULL,
  content TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (procedure_id, version_number)
);

-- 7. TEMPLATES DE TAREFAS, DEPENDÊNCIAS E REQUISITOS DE DOCUMENTOS
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_required TEXT NOT NULL,
  guidance TEXT NOT NULL,
  stage_code TEXT NOT NULL,
  responsible_area TEXT NOT NULL,
  default_assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sla_hours INT NOT NULL DEFAULT 24,
  applicability_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_evidence_types TEXT[] NOT NULL DEFAULT '{}',
  requires_formal_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_role TEXT,
  blocks_billing BOOLEAN NOT NULL DEFAULT FALSE,
  blocks_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  procedure_code TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (workflow_version_id, code)
);

CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  task_code TEXT NOT NULL,
  depends_on_task_code TEXT NOT NULL,
  CHECK (task_code <> depends_on_task_code),
  UNIQUE (workflow_version_id, task_code, depends_on_task_code)
);

CREATE TABLE document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  why_required TEXT NOT NULL,
  responsible_area TEXT NOT NULL,
  linked_task_code TEXT NOT NULL,
  applicability_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocks_billing BOOLEAN NOT NULL DEFAULT FALSE,
  blocks_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  is_customer_visible BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (workflow_version_id, code)
);

-- 8. NEGOCIAÇÕES (PASSAPORTE DIGITAL) E USADO NA TROCA
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  deal_number TEXT NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN (
    'DRAFT',
    'ACTIVE',
    'ELIGIBLE_FOR_AUTHORIZATION',
    'DELIVERY_AUTHORIZED',
    'DELIVERED',
    'CANCELLED'
  )),
  current_stage TEXT NOT NULL,
  buyer_type TEXT NOT NULL CHECK (buyer_type IN ('PF', 'PJ')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'FINANCING', 'CONSORTIUM', 'LEASING')),
  has_financing BOOLEAN NOT NULL DEFAULT FALSE,
  financing_institution TEXT,
  has_trade_in BOOLEAN NOT NULL DEFAULT FALSE,
  has_power_of_attorney BOOLEAN NOT NULL DEFAULT FALSE,
  attorney_name TEXT,
  attorney_document TEXT,
  expected_delivery_date DATE,
  confirmed_delivery_date TIMESTAMPTZ,
  confirmed_delivery_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  billing_registered_at TIMESTAMPTZ,
  billing_registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invoice_number TEXT,
  notes TEXT,
  concurrency_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, deal_number)
);

-- Garantia no banco: um veículo NÃO pode ter mais de uma negociação ativa ao mesmo tempo
CREATE UNIQUE INDEX idx_unique_active_deal_per_vehicle
  ON deals(vehicle_id)
  WHERE status IN ('ACTIVE', 'ELIGIBLE_FOR_AUTHORIZATION', 'DELIVERY_AUTHORIZED');

CREATE INDEX idx_deals_org_status ON deals(organization_id, status);

CREATE TABLE trade_in_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  model_year INT NOT NULL,
  color TEXT NOT NULL,
  plate TEXT NOT NULL,
  vin TEXT NOT NULL,
  appraised_value NUMERIC(12, 2) NOT NULL,
  inspection_status TEXT NOT NULL CHECK (inspection_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. INSTÂNCIAS DE TAREFAS
CREATE TABLE task_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  task_template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_required TEXT NOT NULL,
  guidance TEXT NOT NULL,
  stage_code TEXT NOT NULL,
  responsible_area TEXT NOT NULL,
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  state TEXT NOT NULL CHECK (state IN (
    'WAITING_PREREQUISITE',
    'AVAILABLE',
    'IN_PROGRESS',
    'WAITING_INFO',
    'IN_REVIEW',
    'COMPLETED',
    'WAIVED_BY_RULE',
    'CANCELLED'
  )),
  pending_reason TEXT,
  waived_rule_description TEXT,
  depends_on_task_codes TEXT[] NOT NULL DEFAULT '{}',
  required_evidence_types TEXT[] NOT NULL DEFAULT '{}',
  requires_formal_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_role TEXT,
  approval_status TEXT NOT NULL CHECK (approval_status IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'OUTDATED')),
  blocks_billing BOOLEAN NOT NULL DEFAULT FALSE,
  blocks_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  procedure_code TEXT,
  due_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reopen_count INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deal_id, code)
);

CREATE INDEX idx_task_instances_deal ON task_instances(deal_id);
CREATE INDEX idx_task_instances_org_area_state ON task_instances(organization_id, responsible_area, state);

-- 10. DOCUMENTOS E VERSÕES DE DOCUMENTOS
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  task_code TEXT,
  requirement_code TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  why_required TEXT NOT NULL,
  responsible_area TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'REQUESTED',
    'UPLOADED_PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'CORRECTION_REQUESTED',
    'OUTDATED'
  )),
  current_version_number INT NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  blocks_billing BOOLEAN NOT NULL DEFAULT FALSE,
  blocks_delivery BOOLEAN NOT NULL DEFAULT TRUE,
  is_customer_visible BOOLEAN NOT NULL DEFAULT TRUE,
  requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_deal ON documents(deal_id);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  upload_notes TEXT,
  extracted_text_preview TEXT,
  ocr_review_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (ocr_review_status IN ('NOT_APPLICABLE', 'PENDING_HUMAN_REVIEW', 'REVIEWED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

-- 11. REGISTROS DE APROVAÇÃO, AUTORIZAÇÃO DE LIBERAÇÃO E ENTREGA
CREATE TABLE approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  task_id UUID REFERENCES task_instances(id) ON DELETE SET NULL,
  task_code TEXT NOT NULL,
  area TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role_used TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED', 'CORRECTION_REQUESTED')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'OUTDATED', 'SUPERSEDED')),
  justification TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  analyzed_data_version INT NOT NULL,
  invalidated_at TIMESTAMPTZ,
  invalidation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_records_deal ON approval_records(deal_id);

CREATE TABLE release_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  authorized_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role_used TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INVALIDATED', 'CONSUMED_BY_DELIVERY')),
  notes TEXT,
  analyzed_deal_version INT NOT NULL,
  requirements_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  invalidated_at TIMESTAMPTZ,
  invalidation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_release_auth_deal ON release_authorizations(deal_id);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  release_authorization_id UUID NOT NULL REFERENCES release_authorizations(id) ON DELETE RESTRICT,
  confirmed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role_used TEXT NOT NULL,
  confirmed_vin TEXT NOT NULL,
  confirmed_internal_code TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_document TEXT NOT NULL,
  delivery_notes TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  addendums JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 12. ACESSO DO CLIENTE, NOTIFICAÇÕES E AUDITORIA IMUTÁVEL
CREATE TABLE customer_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  dedup_key TEXT NOT NULL UNIQUE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_profile_id, is_read);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_org_deal ON audit_events(organization_id, deal_id, created_at DESC);

-- Impede UPDATE ou DELETE em audit_events por usuários comuns
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Eventos de auditoria são imutáveis e não podem ser editados ou removidos.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_audit_events
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — ISOLAMENTO POR ORGANIZAÇÃO E PERFIL
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_in_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar vínculo ativo na organização via Supabase auth.uid()
CREATE OR REPLACE FUNCTION user_has_org_membership(target_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = target_org_id
      AND m.profile_id = auth.uid()
      AND m.is_active = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Políticas de isolamento por organização para colaboradores internos
CREATE POLICY org_isolation_vehicles ON vehicles
  FOR ALL USING (user_has_org_membership(organization_id));

CREATE POLICY org_isolation_deals ON deals
  FOR ALL USING (
    user_has_org_membership(organization_id)
    OR EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = deals.customer_id
        AND c.profile_id = auth.uid()
    )
  );

CREATE POLICY org_isolation_tasks ON task_instances
  FOR ALL USING (user_has_org_membership(organization_id));

CREATE POLICY org_isolation_documents ON documents
  FOR SELECT USING (
    user_has_org_membership(organization_id)
    OR (
      is_customer_visible = TRUE
      AND EXISTS (
        SELECT 1 FROM deals d
        JOIN customers c ON c.id = d.customer_id
        WHERE d.id = documents.deal_id AND c.profile_id = auth.uid()
      )
    )
  );

CREATE POLICY org_isolation_audit_select ON audit_events
  FOR SELECT USING (user_has_org_membership(organization_id));

CREATE POLICY org_isolation_audit_insert ON audit_events
  FOR INSERT WITH CHECK (user_has_org_membership(organization_id));
