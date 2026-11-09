import {
  ApprovalRecord,
  AuditEvent,
  Branch,
  Customer,
  CustomerAccessGrant,
  Deal,
  DealDocument,
  DeliveryRecord,
  DocumentRequirement,
  DocumentVersion,
  Membership,
  NotificationItem,
  Organization,
  Procedure,
  ProcedureVersion,
  ReleaseAuthorization,
  TaskInstance,
  TaskTemplate,
  TradeInVehicle,
  UserProfile,
  Vehicle,
  WorkflowTemplate,
  WorkflowVersion,
} from "@/domain/types";
export interface DatabaseState {
  passwordResetTokens?: Array<{
    hash: string;
    profileId: string;
    expiresAt: number;
  }>;
  organizations: Organization[];
  branches: Branch[];
  profiles: UserProfile[];
  memberships: Membership[];
  vehicles: Vehicle[];
  customers: Customer[];
  workflowTemplates: WorkflowTemplate[];
  workflowVersions: WorkflowVersion[];
  taskTemplates: TaskTemplate[];
  documentRequirements: DocumentRequirement[];
  procedures: Procedure[];
  procedureVersions: ProcedureVersion[];
  deals: Deal[];
  tradeInVehicles: TradeInVehicle[];
  taskInstances: TaskInstance[];
  documents: DealDocument[];
  documentVersions: DocumentVersion[];
  approvalRecords: ApprovalRecord[];
  releaseAuthorizations: ReleaseAuthorization[];
  deliveries: DeliveryRecord[];
  customerAccessGrants: CustomerAccessGrant[];
  notifications: NotificationItem[];
  auditEvents: AuditEvent[];
  idempotencyKeys: string[];
}
