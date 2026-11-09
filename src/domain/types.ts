import { z } from "zod";

// ============================================================================
// 1. PAPÉIS (ROLES) E PERMISSÕES
// ============================================================================

export const RoleCodeSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "SELLER",
  "FINANCE",
  "DOCUMENTATION",
  "BILLING",
  "OPERATIONS",
  "RELEASE_OFFICER",
  "CUSTOMER",
]);

export type RoleCode = z.infer<typeof RoleCodeSchema>;

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  SELLER: "Vendedor",
  FINANCE: "Financeiro",
  DOCUMENTATION: "Documental",
  BILLING: "Faturamento",
  OPERATIONS: "Operação",
  RELEASE_OFFICER: "Responsável pela Liberação",
  CUSTOMER: "Cliente",
};

export const PermissionCodeSchema = z.enum([
  "deal:create",
  "deal:view",
  "task:assign",
  "task:execute",
  "document:request",
  "document:upload",
  "document:review",
  "approval:finance",
  "approval:documentation",
  "billing:register",
  "release:authorize",
  "delivery:confirm",
  "procedure:manage",
  "vehicle:manage",
  "user:manage",
  "report:view",
  "customer_portal:access",
]);

export type PermissionCode = z.infer<typeof PermissionCodeSchema>;

export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  "deal:create": "Abrir negociação",
  "deal:view": "Consultar negociação",
  "task:assign": "Atribuir responsável",
  "task:execute": "Executar tarefa operacional",
  "document:request": "Solicitar documento",
  "document:upload": "Enviar documento",
  "document:review": "Conferir documento",
  "approval:finance": "Aprovar etapa financeira",
  "approval:documentation": "Aprovar etapa documental",
  "billing:register": "Registrar faturamento",
  "release:authorize": "Autorizar entrega",
  "delivery:confirm": "Confirmar entrega física",
  "procedure:manage": "Administrar procedimentos e modelos",
  "vehicle:manage": "Gerenciar veículos e estoque",
  "user:manage": "Gerenciar usuários e funções",
  "report:view": "Visualizar painel gerencial e auditoria",
  "customer_portal:access": "Acessar área do cliente",
};

// ============================================================================
// 2. ÁREAS E ETAPAS DO PROCESSO
// ============================================================================

export const ResponsibleAreaSchema = z.enum([
  "COMMERCIAL",
  "FINANCE",
  "DOCUMENTATION",
  "BILLING",
  "OPERATIONS",
  "RELEASE",
  "MANAGEMENT",
]);

export type ResponsibleArea = z.infer<typeof ResponsibleAreaSchema>;

export const AREA_LABELS: Record<ResponsibleArea, string> = {
  COMMERCIAL: "Comercial / Vendas",
  FINANCE: "Financeiro",
  DOCUMENTATION: "Documentação",
  BILLING: "Faturamento",
  OPERATIONS: "Operação / Preparação",
  RELEASE: "Liberação",
  MANAGEMENT: "Gestão",
};

export const WorkflowStageCodeSchema = z.enum([
  "IDENTIFICATION",
  "REGISTRATION_DOCS",
  "FINANCIAL_REVIEW",
  "DOCUMENT_REVIEW",
  "BILLING",
  "PREPARATION",
  "AUTHORIZATION",
  "DELIVERY",
]);

export type WorkflowStageCode = z.infer<typeof WorkflowStageCodeSchema>;

export const WORKFLOW_STAGES: Array<{
  code: WorkflowStageCode;
  name: string;
  order: number;
  description: string;
}> = [
  {
    code: "IDENTIFICATION",
    name: "Identificação",
    order: 1,
    description: "Vinculação do veículo, comprador e condições comerciais.",
  },
  {
    code: "REGISTRATION_DOCS",
    name: "Cadastro e Documentos",
    order: 2,
    description:
      "Coleta de documentos do comprador, procuração e usado na troca.",
  },
  {
    code: "FINANCIAL_REVIEW",
    name: "Conferência Financeira",
    order: 3,
    description:
      "Validação de pagamento, contrato de financiamento e quitação.",
  },
  {
    code: "DOCUMENT_REVIEW",
    name: "Conferência Documental",
    order: 4,
    description:
      "Análise formal de dossiê, procurações e laudo do veículo na troca.",
  },
  {
    code: "BILLING",
    name: "Faturamento",
    order: 5,
    description:
      "Emissão e conferência da Nota Fiscal após requisitos financeiros e documentais.",
  },
  {
    code: "PREPARATION",
    name: "Preparação",
    order: 6,
    description:
      "Revisão de entrega (PDI), higienização, acessórios e carga de bateria.",
  },
  {
    code: "AUTHORIZATION",
    name: "Autorização",
    order: 7,
    description:
      "Conferência final de conformidade e emissão da autorização formal de liberação.",
  },
  {
    code: "DELIVERY",
    name: "Entrega",
    order: 8,
    description:
      "Reconfirmação física do chassi/QR Code e entrega das chaves ao comprador.",
  },
];

// ============================================================================
// 3. VEÍCULOS E ESTOQUE
// ============================================================================

export const VehicleConditionSchema = z.enum(["NEW", "USED"]);
export type VehicleCondition = z.infer<typeof VehicleConditionSchema>;

export const VehicleStockStatusSchema = z.enum([
  "AVAILABLE",
  "RESERVED",
  "IN_PREPARATION",
  "SOLD_DELIVERED",
  "BLOCKED",
]);
export type VehicleStockStatus = z.infer<typeof VehicleStockStatusSchema>;

export const VEHICLE_STOCK_STATUS_LABELS: Record<VehicleStockStatus, string> = {
  AVAILABLE: "Disponível no estoque",
  RESERVED: "Reservado em negociação",
  IN_PREPARATION: "Em preparação física",
  SOLD_DELIVERED: "Vendido e entregue",
  BLOCKED: "Bloqueado / Indisponível",
};

export const VehicleInputSchema = z.object({
  internalCode: z.string().trim().min(3, "Informe o identificador interno"),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .min(11, "O chassi (VIN) deve ter entre 11 e 17 caracteres")
    .max(17, "O chassi (VIN) deve ter no máximo 17 caracteres"),
  brand: z.string().trim().min(2, "Informe a marca"),
  model: z.string().trim().min(2, "Informe o modelo"),
  trim: z.string().trim().min(1, "Informe a versão"),
  manufacturingYear: z.coerce.number().int().min(1990).max(2030),
  modelYear: z.coerce.number().int().min(1990).max(2031),
  color: z.string().trim().min(2, "Informe a cor"),
  plate: z.string().trim().toUpperCase().optional().nullable(),
  condition: VehicleConditionSchema,
  branchId: z.string().min(1, "Selecione a unidade"),
  photos: z.array(z.string()).default([]),
  stockStatus: VehicleStockStatusSchema.default("AVAILABLE"),
  entryDate: z.string().min(10, "Informe a data de entrada"),
  internalNotes: z.string().optional().nullable(),
});

export interface Vehicle {
  id: string;
  organizationId: string;
  branchId: string;
  internalCode: string;
  qrToken: string;
  vin: string;
  brand: string;
  model: string;
  trim: string;
  manufacturingYear: number;
  modelYear: number;
  color: string;
  plate: string | null;
  condition: VehicleCondition;
  photos: string[];
  stockStatus: VehicleStockStatus;
  entryDate: string;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 4. CONDIÇÕES RESTRITAS E SEGURAS DO MOTOR DE PROCESSOS
// ============================================================================

export const ConditionFieldSchema = z.enum([
  "buyerType",
  "paymentMethod",
  "hasFinancing",
  "hasTradeIn",
  "hasPowerOfAttorney",
  "vehicleCondition",
]);

export type ConditionField = z.infer<typeof ConditionFieldSchema>;

export const ConditionOperatorSchema = z.enum([
  "EQUALS",
  "NOT_EQUALS",
  "IN",
  "IS_TRUE",
  "IS_FALSE",
]);

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const ApplicabilityConditionSchema = z.object({
  field: ConditionFieldSchema,
  operator: ConditionOperatorSchema,
  value: z.union([z.string(), z.boolean(), z.array(z.string())]).optional(),
  humanExplanation: z.string().min(3),
});

export type ApplicabilityCondition = z.infer<
  typeof ApplicabilityConditionSchema
>;

export interface DealConditionContext {
  buyerType: "PF" | "PJ";
  paymentMethod: "CASH" | "FINANCING" | "CONSORTIUM" | "LEASING";
  hasFinancing: boolean;
  hasTradeIn: boolean;
  hasPowerOfAttorney: boolean;
  vehicleCondition: "NEW" | "USED";
}

// ============================================================================
// 5. TAREFAS, DOCUMENTOS, APROVAÇÕES E NEGOCIAÇÃO
// ============================================================================

export const TaskStateSchema = z.enum([
  "WAITING_PREREQUISITE",
  "AVAILABLE",
  "IN_PROGRESS",
  "WAITING_INFO",
  "IN_REVIEW",
  "COMPLETED",
  "WAIVED_BY_RULE",
  "CANCELLED",
]);

export type TaskState = z.infer<typeof TaskStateSchema>;

export const TASK_STATE_LABELS: Record<TaskState, string> = {
  WAITING_PREREQUISITE: "Aguardando pré-requisito",
  AVAILABLE: "Disponível",
  IN_PROGRESS: "Em andamento",
  WAITING_INFO: "Aguardando informação",
  IN_REVIEW: "Em revisão",
  COMPLETED: "Concluída",
  WAIVED_BY_RULE: "Dispensada por regra",
  CANCELLED: "Cancelada",
};

export const TaskApprovalStatusSchema = z.enum([
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "OUTDATED",
]);

export type TaskApprovalStatus = z.infer<typeof TaskApprovalStatusSchema>;

export const TASK_APPROVAL_STATUS_LABELS: Record<TaskApprovalStatus, string> = {
  NOT_REQUIRED: "Não exige aprovação formal",
  PENDING: "Aguardando aprovação",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada / Correção exigida",
  OUTDATED: "Aprovação desatualizada (requer nova revisão)",
};

export interface TaskTemplate {
  id: string;
  organizationId: string;
  workflowVersionId: string;
  code: string;
  title: string;
  description: string;
  whyRequired: string;
  guidance: string;
  stageCode: WorkflowStageCode;
  responsibleArea: ResponsibleArea;
  defaultAssigneeId: string | null;
  slaHours: number;
  applicabilityConditions: ApplicabilityCondition[];
  dependsOnTaskCodes: string[];
  requiredEvidenceTypes: string[];
  requiresFormalApproval: boolean;
  approvalRole: RoleCode | null;
  blocksBilling: boolean;
  blocksDelivery: boolean;
  procedureCode: string | null;
  sortOrder: number;
}

export interface TaskInstance {
  id: string;
  organizationId: string;
  dealId: string;
  taskTemplateId: string;
  code: string;
  title: string;
  description: string;
  whyRequired: string;
  guidance: string;
  stageCode: WorkflowStageCode;
  responsibleArea: ResponsibleArea;
  assigneeId: string | null;
  state: TaskState;
  pendingReason: string | null;
  waivedRuleDescription: string | null;
  dependsOnTaskCodes: string[];
  requiredEvidenceTypes: string[];
  requiresFormalApproval: boolean;
  approvalRole: RoleCode | null;
  approvalStatus: TaskApprovalStatus;
  blocksBilling: boolean;
  blocksDelivery: boolean;
  procedureCode: string | null;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  reopenCount: number;
  sortOrder: number;
  updatedAt: string;
}

export const DocumentStatusSchema = z.enum([
  "REQUESTED",
  "UPLOADED_PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "CORRECTION_REQUESTED",
  "OUTDATED",
]);

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  REQUESTED: "Solicitado (Pendente de envio)",
  UPLOADED_PENDING_REVIEW: "Enviado (Aguardando conferência)",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CORRECTION_REQUESTED: "Correção solicitada",
  OUTDATED: "Versão substituída / Em reanálise",
};

export interface DocumentRequirement {
  id: string;
  organizationId: string;
  workflowVersionId: string;
  code: string;
  title: string;
  category: string;
  description: string;
  whyRequired: string;
  responsibleArea: ResponsibleArea;
  linkedTaskCode: string;
  applicabilityConditions: ApplicabilityCondition[];
  blocksBilling: boolean;
  blocksDelivery: boolean;
  isCustomerVisible: boolean;
}

export interface DocumentVersion {
  id: string;
  organizationId: string;
  documentId: string;
  versionNumber: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedBy: string;
  uploadNotes: string | null;
  extractedTextPreview: string | null;
  ocrReviewStatus: "NOT_APPLICABLE" | "PENDING_HUMAN_REVIEW" | "REVIEWED";
  createdAt: string;
}

export interface DealDocument {
  id: string;
  organizationId: string;
  dealId: string;
  taskCode: string | null;
  requirementCode: string | null;
  title: string;
  category: string;
  whyRequired: string;
  responsibleArea: ResponsibleArea;
  status: DocumentStatus;
  currentVersionNumber: number;
  rejectionReason: string | null;
  blocksBilling: boolean;
  blocksDelivery: boolean;
  isCustomerVisible: boolean;
  requestedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  organizationId: string;
  dealId: string;
  taskId: string | null;
  taskCode: string;
  area: ResponsibleArea;
  authorId: string;
  roleUsed: RoleCode;
  decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUESTED";
  status: "ACTIVE" | "OUTDATED" | "SUPERSEDED";
  justification: string;
  evidenceRefs: Array<{
    documentId: string;
    documentTitle: string;
    versionNumber: number;
  }>;
  analyzedDataVersion: number;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  createdAt: string;
}

export interface ReleaseAuthorization {
  id: string;
  organizationId: string;
  dealId: string;
  authorizedBy: string;
  roleUsed: RoleCode;
  status: "ACTIVE" | "INVALIDATED" | "CONSUMED_BY_DELIVERY";
  notes: string | null;
  analyzedDealVersion: number;
  requirementsSnapshot: {
    completedTaskCodes: string[];
    approvedDocumentIds: Array<{ id: string; version: number }>;
    invoiceNumber: string | null;
  };
  invalidatedAt: string | null;
  invalidationReason: string | null;
  createdAt: string;
}

export interface DeliveryRecord {
  id: string;
  organizationId: string;
  dealId: string;
  vehicleId: string;
  releaseAuthorizationId: string;
  confirmedBy: string;
  roleUsed: RoleCode;
  confirmedVin: string;
  confirmedInternalCode: string;
  recipientName: string;
  recipientDocument: string;
  deliveryNotes: string | null;
  deliveredAt: string;
  addendums: Array<{
    id: string;
    authorId: string;
    authorName: string;
    note: string;
    createdAt: string;
  }>;
}

export const DealStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "ELIGIBLE_FOR_AUTHORIZATION",
  "DELIVERY_AUTHORIZED",
  "DELIVERED",
  "CANCELLED",
]);

export type DealStatus = z.infer<typeof DealStatusSchema>;

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  DRAFT: "Rascunho (Em abertura)",
  ACTIVE: "Em andamento",
  ELIGIBLE_FOR_AUTHORIZATION: "Elegível para autorização de entrega",
  DELIVERY_AUTHORIZED: "Entrega autorizada (Aguardando entrega física)",
  DELIVERED: "Entrega realizada",
  CANCELLED: "Cancelada",
};

export interface TradeInVehicle {
  id: string;
  organizationId: string;
  dealId: string;
  brand: string;
  model: string;
  modelYear: number;
  color: string;
  plate: string;
  vin: string;
  appraisedValue: number;
  inspectionStatus: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  createdAt: string;
}

export interface Deal {
  id: string;
  organizationId: string;
  branchId: string;
  dealNumber: string;
  vehicleId: string;
  customerId: string;
  sellerId: string;
  workflowVersionId: string;
  status: DealStatus;
  currentStage: WorkflowStageCode;
  buyerType: "PF" | "PJ";
  paymentMethod: "CASH" | "FINANCING" | "CONSORTIUM" | "LEASING";
  hasFinancing: boolean;
  financingInstitution: string | null;
  hasTradeIn: boolean;
  hasPowerOfAttorney: boolean;
  attorneyName: string | null;
  attorneyDocument: string | null;
  expectedDeliveryDate: string | null;
  confirmedDeliveryDate: string | null;
  confirmedDeliveryBy: string | null;
  billingRegisteredAt: string | null;
  billingRegisteredBy: string | null;
  invoiceNumber: string | null;
  notes: string | null;
  concurrencyVersion: number;
  createdAt: string;
  updatedAt: string;
}

export const GuidedDealInputSchema = z
  .object({
    vehicleId: z.string().min(1, "Selecione o veículo"),
    branchId: z.string().min(1, "Selecione a unidade"),
    sellerId: z.string().min(1, "Selecione o vendedor responsável"),
    customerMode: z.enum(["EXISTING", "NEW"]),
    customerId: z.string().optional(),
    newCustomer: z
      .object({
        personType: z.enum(["PF", "PJ"]),
        documentNumber: z.string().trim().min(11, "Informe CPF ou CNPJ válido"),
        fullName: z
          .string()
          .trim()
          .min(3, "Informe o nome completo ou razão social"),
        email: z.string().trim().email("Informe um e-mail válido"),
        phone: z.string().trim().min(8, "Informe o telefone"),
        address: z.string().optional(),
      })
      .optional(),
    buyerType: z.enum(["PF", "PJ"]),
    paymentMethod: z.enum(["CASH", "FINANCING", "CONSORTIUM", "LEASING"]),
    hasFinancing: z.boolean(),
    financingInstitution: z.string().optional().nullable(),
    hasTradeIn: z.boolean(),
    tradeIn: z
      .object({
        brand: z.string().trim().min(2, "Informe a marca do usado"),
        model: z.string().trim().min(2, "Informe o modelo do usado"),
        modelYear: z.coerce.number().int().min(1990).max(2030),
        color: z.string().trim().min(2, "Informe a cor do usado"),
        plate: z.string().trim().min(7, "Informe a placa do usado"),
        vin: z.string().trim().min(11, "Informe o chassi do usado"),
        appraisedValue: z.coerce
          .number()
          .positive("Informe o valor de avaliação"),
        notes: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    hasPowerOfAttorney: z.boolean(),
    attorneyName: z.string().optional().nullable(),
    attorneyDocument: z.string().optional().nullable(),
    expectedDeliveryDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    saveAsDraft: z.boolean().default(false),
    draftDealId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.saveAsDraft) {
      if (data.customerMode === "EXISTING" && !data.customerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customerId"],
          message: "Selecione o comprador existente",
        });
      }
      if (data.customerMode === "NEW" && !data.newCustomer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newCustomer"],
          message: "Preencha os dados do novo comprador",
        });
      }
      if (
        data.hasFinancing &&
        (!data.financingInstitution ||
          data.financingInstitution.trim().length < 2)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["financingInstitution"],
          message: "Informe a instituição financeira do financiamento",
        });
      }
      if (data.hasTradeIn && !data.tradeIn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tradeIn"],
          message: "Preencha os dados do veículo usado recebido na troca",
        });
      }
      if (
        data.hasPowerOfAttorney &&
        (!data.attorneyName || !data.attorneyDocument)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attorneyName"],
          message: "Informe o nome e documento do representante por procuração",
        });
      }
    }
  });

export type GuidedDealInput = z.infer<typeof GuidedDealInputSchema>;

// ============================================================================
// 6. ORGANIZAÇÕES, PERFIS, PROCEDIMENTOS, NOTIFICAÇÕES E AUDITORIA
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  cnpj: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserProfile {
  passwordChangedAt?: string;
  id: string;
  email: string;
  fullName: string;
  phone: string;
  passwordHash: string;
  isCustomerOnly: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  organizationId: string;
  branchId: string | null;
  profileId: string;
  roles: RoleCode[];
  isActive: boolean;
  invitedBy: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  profileId: string | null;
  personType: "PF" | "PJ";
  documentNumber: string;
  fullName: string;
  email: string;
  phone: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplate {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string;
  activeVersionId: string;
  createdAt: string;
}

export interface WorkflowVersion {
  id: string;
  organizationId: string;
  workflowTemplateId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
}

export interface ProcedureSection {
  sectionNumber: string;
  heading: string;
  body: string;
}

export interface Procedure {
  id: string;
  organizationId: string;
  code: string;
  title: string;
  responsibleArea: ResponsibleArea;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcedureVersion {
  id: string;
  organizationId: string;
  procedureId: string;
  versionNumber: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  responsibleArea: ResponsibleArea;
  content: string;
  sections: ProcedureSection[];
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  recipientProfileId: string;
  dealId: string | null;
  eventType:
    | "TASK_ASSIGNED"
    | "DOCUMENT_REQUESTED"
    | "DOCUMENT_RECEIVED"
    | "CORRECTION_REQUESTED"
    | "APPROVAL_RECORDED"
    | "NEXT_TASK_AVAILABLE"
    | "DEADLINE_EXCEEDED"
    | "DELIVERY_AUTHORIZED";
  title: string;
  message: string;
  dedupKey: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface CustomerAccessGrant {
  id: string;
  organizationId: string;
  dealId: string;
  customerId: string;
  accessToken: string;
  expiresAt: string;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  dealId: string | null;
  vehicleId: string | null;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown>;
  isCustomerVisible: boolean;
  createdAt: string;
}

export interface AuthenticatedContext {
  profile: UserProfile;
  organization: Organization;
  branch: Branch | null;
  membership: Membership | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
  customerRecordId?: string | null;
}
