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
import { instantiateDealWorkflow, recalculateTaskStates } from "@/domain/workflow-engine";

export interface DatabaseState {
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

export const DEMO_ORG_ID = "org-pinauto-demo";
export const DEMO_BRANCH_ID = "branch-ceres-go";
export const OTHER_ORG_ID = "org-cerrado-isolated";
export const OTHER_BRANCH_ID = "branch-anapolis-go";
export const DEMO_WORKFLOW_TEMPLATE_ID = "wf-tpl-pinauto-01";
export const DEMO_WORKFLOW_VERSION_ID = "wf-ver-pinauto-v1";

export function createInitialSeedState(): DatabaseState {
  const baseNow = "2026-11-09T12:00:00.000Z";
  const twoDaysAgo = "2026-11-07T11:30:00.000Z";
  const yesterday = "2026-11-08T14:20:00.000Z";
  const threeHoursAgo = "2026-11-09T09:00:00.000Z";
  const oneHourAgo = "2026-11-09T11:00:00.000Z";

  // 1. Organizações e Unidades
  const organizations: Organization[] = [
    {
      id: DEMO_ORG_ID,
      name: "Pinauto BYD — Ceres/GO (Concessionária Demonstrativa)",
      slug: "pinauto-byd-ceres-demo",
      cnpj: "00.000.000/0001-91",
      isDemo: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: OTHER_ORG_ID,
      name: "Cerrado Motors — Anápolis/GO (Organização Isolada Teste)",
      slug: "cerrado-motors-demo",
      cnpj: "99.999.999/0001-19",
      isDemo: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
  ];

  const branches: Branch[] = [
    {
      id: DEMO_BRANCH_ID,
      organizationId: DEMO_ORG_ID,
      name: "Unidade Ceres — Av. Brasil (Piloto Demonstrativo)",
      code: "CERES-01",
      city: "Ceres",
      state: "GO",
      address: "Av. Brasil, Setor Central — Ceres/GO (Endereço Fictício Demonstrativo)",
      phone: "(62) 3307-0000",
      isActive: true,
      createdAt: twoDaysAgo,
    },
    {
      id: "branch-uruacu-go",
      organizationId: DEMO_ORG_ID,
      name: "Ponto Avançado Uruaçu/GO (Demonstrativo)",
      code: "URUACU-02",
      city: "Uruaçu",
      state: "GO",
      address: "Av. Tocantins, Centro — Uruaçu/GO (Endereço Fictício)",
      phone: "(62) 3357-0000",
      isActive: true,
      createdAt: twoDaysAgo,
    },
    {
      id: OTHER_BRANCH_ID,
      organizationId: OTHER_ORG_ID,
      name: "Matriz Anápolis",
      code: "ANP-01",
      city: "Anápolis",
      state: "GO",
      address: "Av. Brasil Sul — Anápolis/GO",
      phone: "(62) 3311-0000",
      isActive: true,
      createdAt: twoDaysAgo,
    },
  ];

  // 2. Perfis de Usuários Demonstrativos por Função
  const profiles: UserProfile[] = [
    {
      id: "user-admin",
      email: "admin@pinauto.demo",
      fullName: "Carlos Eduardo (Administrador)",
      phone: "(62) 99100-0001",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-gestor",
      email: "gestor@pinauto.demo",
      fullName: "Fernanda Alves (Gestora Geral)",
      phone: "(62) 99100-0002",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-vendedor",
      email: "vendedor@pinauto.demo",
      fullName: "Lucas Rezende (Vendedor)",
      phone: "(62) 99100-0003",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-documental",
      email: "documental@pinauto.demo",
      fullName: "Patrícia Gomes (Documental)",
      phone: "(62) 99100-0004",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-financeiro",
      email: "financeiro@pinauto.demo",
      fullName: "Roberto Mendes (Financeiro)",
      phone: "(62) 99100-0005",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-faturamento",
      email: "faturamento@pinauto.demo",
      fullName: "Juliana Costa (Faturamento)",
      phone: "(62) 99100-0006",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-liberacao",
      email: "liberacao@pinauto.demo",
      fullName: "Marcos Vinícius (Responsável pela Liberação)",
      phone: "(62) 99100-0007",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-operacao",
      email: "operacao@pinauto.demo",
      fullName: "Diego Ribeiro (Operação e Entrega)",
      phone: "(62) 99100-0008",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-cliente-helena",
      email: "helena.martins@cliente.demo",
      fullName: "Helena Martins (Cliente Compradora)",
      phone: "(62) 99811-2233",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: true,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-cliente-agro",
      email: "contato@agrovalesp.cliente.demo",
      fullName: "Agropecuária Vale do São Patrício Ltda (Cliente PJ)",
      phone: "(62) 99822-3344",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: true,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "user-other-org",
      email: "ricardo@cerradomotors.demo",
      fullName: "Ricardo Brito (Gestor Outra Organização)",
      phone: "(62) 99200-0099",
      passwordHash: "demo:chaveflow123",
      isCustomerOnly: false,
      isActive: true,
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
  ];

  const memberships: Membership[] = [
    {
      id: "memb-admin",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-admin",
      roles: ["ADMIN"],
      isActive: true,
      invitedBy: null,
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-gestor",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-gestor",
      roles: ["MANAGER", "RELEASE_OFFICER"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-vendedor",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-vendedor",
      roles: ["SELLER"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-documental",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-documental",
      roles: ["DOCUMENTATION"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-financeiro",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-financeiro",
      roles: ["FINANCE"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-faturamento",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-faturamento",
      roles: ["BILLING"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-liberacao",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-liberacao",
      roles: ["RELEASE_OFFICER"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-operacao",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-operacao",
      roles: ["OPERATIONS"],
      isActive: true,
      invitedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-cliente-helena",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-cliente-helena",
      roles: ["CUSTOMER"],
      isActive: true,
      invitedBy: "user-vendedor",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-cliente-agro",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      profileId: "user-cliente-agro",
      roles: ["CUSTOMER"],
      isActive: true,
      invitedBy: "user-vendedor",
      createdAt: twoDaysAgo,
    },
    {
      id: "memb-other-org",
      organizationId: OTHER_ORG_ID,
      branchId: OTHER_BRANCH_ID,
      profileId: "user-other-org",
      roles: ["MANAGER", "ADMIN"],
      isActive: true,
      invitedBy: null,
      createdAt: twoDaysAgo,
    },
  ];

  // 3. Veículos Fictícios (6 na Pinauto BYD Ceres/GO + 1 na Cerrado Motors para teste de isolamento)
  const vehicles: Vehicle[] = [
    {
      id: "veh-001",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      internalCode: "PIN-BYD-001",
      qrToken: "qr-pin-byd-001-songplus",
      vin: "9BWSU19F08B301001",
      brand: "BYD",
      model: "Song Plus DM-i",
      trim: "1.5 Plug-in Hybrid 235cv",
      manufacturingYear: 2025,
      modelYear: 2026,
      color: "Azul Time",
      plate: null,
      condition: "NEW",
      photos: ["/vehicles/song-plus.svg"],
      stockStatus: "RESERVED",
      entryDate: "2026-10-20",
      internalNotes: "Veículo em pátio coberto Ceres — vinculado à negociação principal de demonstração (NEG-2026-0001).",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "veh-002",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      internalCode: "PIN-BYD-002",
      qrToken: "qr-pin-byd-002-dolphinmini",
      vin: "9BWDM10E09B302002",
      brand: "BYD",
      model: "Dolphin Mini",
      trim: "EV 5 Lugares 38kWh",
      manufacturingYear: 2025,
      modelYear: 2026,
      color: "Verde Sprout",
      plate: null,
      condition: "NEW",
      photos: ["/vehicles/dolphin-mini.svg"],
      stockStatus: "RESERVED",
      entryDate: "2026-10-22",
      internalNotes: "Venda corporativa PJ com representação por procuração.",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "veh-003",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      internalCode: "PIN-BYD-003",
      qrToken: "qr-pin-byd-003-king",
      vin: "9BWKG22H07B303003",
      brand: "BYD",
      model: "King GS DM-i",
      trim: "1.5 Plug-in Hybrid GS",
      manufacturingYear: 2025,
      modelYear: 2025,
      color: "Branco Crystal",
      plate: null,
      condition: "NEW",
      photos: ["/vehicles/king-gs.svg"],
      stockStatus: "IN_PREPARATION",
      entryDate: "2026-10-18",
      internalNotes: "Todos os requisitos concluídos e PDI finalizado. Pronto para autorização de entrega.",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "veh-004",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      internalCode: "PIN-BYD-004",
      qrToken: "qr-pin-byd-004-shark",
      vin: "9BWSH88K01B304004",
      brand: "BYD",
      model: "Shark GS DM-o",
      trim: "Picape Híbrida 4x4 437cv",
      manufacturingYear: 2025,
      modelYear: 2026,
      color: "Cinza Atlantis",
      plate: "SGO4A99",
      condition: "NEW",
      photos: ["/vehicles/shark-dmo.svg"],
      stockStatus: "SOLD_DELIVERED",
      entryDate: "2026-10-10",
      internalNotes: "Veículo faturado, autorizado e entregue. Histórico preservado.",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "veh-005",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      internalCode: "PIN-BYD-005",
      qrToken: "qr-pin-byd-005-seal",
      vin: "9BWSL77P02B305005",
      brand: "BYD",
      model: "Seal AWD",
      trim: "Performance 531cv Elétrico",
      manufacturingYear: 2025,
      modelYear: 2025,
      color: "Preto Cosmos",
      plate: null,
      condition: "NEW",
      photos: ["/vehicles/seal-awd.svg"],
      stockStatus: "AVAILABLE",
      entryDate: "2026-11-01",
      internalNotes: "Disponível no showroom de Ceres para abertura de nova negociação.",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "veh-006",
      organizationId: DEMO_ORG_ID,
      branchId: DEMO_BRANCH_ID,
      internalCode: "PIN-BYD-006",
      qrToken: "qr-pin-byd-006-yuanpro",
      vin: "9BWYP55M04B306006",
      brand: "BYD",
      model: "Yuan Pro EV",
      trim: "SUV Compacto Elétrico",
      manufacturingYear: 2024,
      modelYear: 2025,
      color: "Cinza Urbano",
      plate: "SGO8H44",
      condition: "USED",
      photos: ["/vehicles/yuan-pro.svg"],
      stockStatus: "AVAILABLE",
      entryDate: "2026-11-03",
      internalNotes: "Seminovo revisado da concessionária — disponível para venda imediata.",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "veh-other-01",
      organizationId: OTHER_ORG_ID,
      branchId: OTHER_BRANCH_ID,
      internalCode: "CER-MOT-999",
      qrToken: "qr-cerrado-isolated-999",
      vin: "9BWZZZ99988877766",
      brand: "Cerrado",
      model: "Sedan Isolado",
      trim: "2.0 Turbo",
      manufacturingYear: 2025,
      modelYear: 2025,
      color: "Prata",
      plate: null,
      condition: "NEW",
      photos: [],
      stockStatus: "AVAILABLE",
      entryDate: "2026-11-01",
      internalNotes: "Veículo de outra organização para validar isolamento multi-tenant.",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
  ];

  // 4. Clientes Fictícios
  const customers: Customer[] = [
    {
      id: "cust-helena",
      organizationId: DEMO_ORG_ID,
      profileId: "user-cliente-helena",
      personType: "PF",
      documentNumber: "123.456.789-00",
      fullName: "Helena Martins",
      email: "helena.martins@cliente.demo",
      phone: "(62) 99811-2233",
      address: "Rua 14, Qd. 08, Lt. 12, Setor Central — Ceres/GO (Dados Fictícios)",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "cust-agro",
      organizationId: DEMO_ORG_ID,
      profileId: "user-cliente-agro",
      personType: "PJ",
      documentNumber: "12.345.678/0001-90",
      fullName: "Agropecuária Vale do São Patrício Ltda",
      email: "contato@agrovalesp.cliente.demo",
      phone: "(62) 99822-3344",
      address: "Rodovia GO-154, Km 18, Zona Rural — Ceres/GO (Dados Fictícios)",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "cust-marcelo",
      organizationId: DEMO_ORG_ID,
      profileId: null,
      personType: "PF",
      documentNumber: "456.789.123-11",
      fullName: "Dr. Marcelo Cavalcante",
      email: "marcelo.cavalcante@cliente.demo",
      phone: "(62) 99833-4455",
      address: "Av. Goiás, 510, Centro — Rialma/GO (Dados Fictícios)",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "cust-claudia",
      organizationId: DEMO_ORG_ID,
      profileId: null,
      personType: "PF",
      documentNumber: "789.123.456-22",
      fullName: "Cláudia Teixeira",
      email: "claudia.teixeira@cliente.demo",
      phone: "(62) 99844-5566",
      address: "Rua das Palmeiras, 88 — Goianésia/GO (Dados Fictícios)",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
  ];

  // 5. Procedimentos Operacionais (Regras de exemplo explicitamente identificadas como demonstrativas)
  const procedures: Procedure[] = [
    {
      id: "proc-doc-01",
      organizationId: DEMO_ORG_ID,
      code: "PROC-DOC-01",
      title: "Conferência Documental, Procurações e Troca (Regra Demonstrativa)",
      responsibleArea: "DOCUMENTATION",
      activeVersionId: "proc-ver-doc-01-v2",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "proc-fin-01",
      organizationId: DEMO_ORG_ID,
      code: "PROC-FIN-01",
      title: "Conferência Financeira, Financiamento e Quitação (Regra Demonstrativa)",
      responsibleArea: "FINANCE",
      activeVersionId: "proc-ver-fin-01-v1",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
    {
      id: "proc-lib-01",
      organizationId: DEMO_ORG_ID,
      code: "PROC-LIB-01",
      title: "Faturamento, Preparação (PDI), Autorização e Entrega Segura (Regra Demonstrativa)",
      responsibleArea: "RELEASE",
      activeVersionId: "proc-ver-lib-01-v1",
      createdAt: twoDaysAgo,
      updatedAt: baseNow,
    },
  ];

  const procedureVersions: ProcedureVersion[] = [
    {
      id: "proc-ver-doc-01-v2",
      organizationId: DEMO_ORG_ID,
      procedureId: "proc-doc-01",
      versionNumber: 2,
      status: "PUBLISHED",
      title: "Conferência Documental, Procurações e Troca (Regra Demonstrativa)",
      responsibleArea: "DOCUMENTATION",
      content:
        "Procedimento demonstrativo interno da Pinauto BYD Ceres/GO, sujeito à validação jurídica da concessionária. Define os critérios de aceite para documentos de identificação, representação por procuração e veículo usado na troca.",
      sections: [
        {
          sectionNumber: "1.1",
          heading: "Identificação do Comprador (PF e PJ)",
          body: "Toda negociação exige documento de identificação legível e comprovante de endereço. Para pessoa jurídica (PJ), anexar ato constitutivo atualizado.",
        },
        {
          sectionNumber: "1.2",
          heading: "Representação por Procuração",
          body: "Quando a condição 'Representante por procuração' estiver ativa na negociação, é obrigatório anexar o instrumento de procuração e documento do procurador antes da conferência documental.",
        },
        {
          sectionNumber: "1.3",
          heading: "Veículo Usado na Troca",
          body: "Se houver veículo usado na troca, os dados do usado são registrados separadamente do veículo vendido e exigem Termo/Laudo de Vistoria aprovado pela área Documental antes do faturamento.",
        },
        {
          sectionNumber: "1.4",
          heading: "Substituição de Documento Aprovado",
          body: "Qualquer substituição de arquivo em um documento já aprovado invalida automaticamente aprovações dependentes e reabre a verificação correspondente.",
        },
      ],
      authorId: "user-admin",
      publishedAt: yesterday,
      createdAt: yesterday,
    },
    {
      id: "proc-ver-doc-01-v3-draft",
      organizationId: DEMO_ORG_ID,
      procedureId: "proc-doc-01",
      versionNumber: 3,
      status: "DRAFT",
      title: "Conferência Documental v3 (Rascunho Não Publicado)",
      responsibleArea: "DOCUMENTATION",
      content: "Rascunho em elaboração — não deve alimentar orientações oficiais enquanto não publicado.",
      sections: [
        {
          sectionNumber: "2.1",
          heading: "Proposta futura em rascunho",
          body: "Este conteúdo está em rascunho e é ignorado pelo assistente contextual.",
        },
      ],
      authorId: "user-documental",
      publishedAt: null,
      createdAt: baseNow,
    },
    {
      id: "proc-ver-fin-01-v1",
      organizationId: DEMO_ORG_ID,
      procedureId: "proc-fin-01",
      versionNumber: 1,
      status: "PUBLISHED",
      title: "Conferência Financeira, Financiamento e Quitação (Regra Demonstrativa)",
      responsibleArea: "FINANCE",
      content:
        "Procedimento demonstrativo sujeito à validação da concessionária para liberação financeira de faturamento e entrega.",
      sections: [
        {
          sectionNumber: "2.1",
          heading: "Comprovação de Pagamento / Entrada",
          body: "A área Financeira deve conferir a liquidação dos recursos próprios (PIX/TED) e registrar aprovação formal vinculando evidência.",
        },
        {
          sectionNumber: "2.2",
          heading: "Vendas com Financiamento",
          body: "Quando houver financiamento, o contrato assinado com a instituição financeira é requisito impeditivo para o faturamento e para a entrega.",
        },
      ],
      authorId: "user-admin",
      publishedAt: twoDaysAgo,
      createdAt: twoDaysAgo,
    },
    {
      id: "proc-ver-lib-01-v1",
      organizationId: DEMO_ORG_ID,
      procedureId: "proc-lib-01",
      versionNumber: 1,
      status: "PUBLISHED",
      title: "Faturamento, Preparação (PDI), Autorização e Entrega Segura (Regra Demonstrativa)",
      responsibleArea: "RELEASE",
      content:
        "Procedimento demonstrativo que separa estritamente a conclusão técnica de tarefas, a autorização formal de liberação e o registro físico da entrega das chaves.",
      sections: [
        {
          sectionNumber: "3.1",
          heading: "Preparação em Paralelo (PDI)",
          body: "A revisão de entrega (PDI), higienização e recarga da bateria podem avançar em paralelo às conferências financeira e documental.",
        },
        {
          sectionNumber: "3.2",
          heading: "Separação entre Elegibilidade, Autorização e Entrega",
          body: "A conclusão de todas as tarefas torna a negociação 'Elegível para Autorização', mas nunca autoriza nem registra a entrega automaticamente. O Responsável pela Liberação emite a autorização e a Operação reconfirma o veículo na entrega.",
        },
      ],
      authorId: "user-admin",
      publishedAt: twoDaysAgo,
      createdAt: twoDaysAgo,
    },
  ];

  // 6. Modelo e Versão do Processo (8 Etapas Demonstrativas)
  const workflowTemplates: WorkflowTemplate[] = [
    {
      id: DEMO_WORKFLOW_TEMPLATE_ID,
      organizationId: DEMO_ORG_ID,
      code: "WF-PINAUTO-PADRAO",
      name: "Fluxo Padrão de Faturamento e Liberação (Demonstrativo)",
      description:
        "Modelo configurável versionado com 8 etapas, suporte a paralelismo e condições para financiamento, usado na troca e procuração.",
      activeVersionId: DEMO_WORKFLOW_VERSION_ID,
      createdAt: twoDaysAgo,
    },
  ];

  const workflowVersions: WorkflowVersion[] = [
    {
      id: DEMO_WORKFLOW_VERSION_ID,
      organizationId: DEMO_ORG_ID,
      workflowTemplateId: DEMO_WORKFLOW_TEMPLATE_ID,
      versionNumber: 1,
      status: "PUBLISHED",
      publishedAt: twoDaysAgo,
      publishedBy: "user-admin",
      createdAt: twoDaysAgo,
    },
  ];

  const taskTemplates: TaskTemplate[] = [
    {
      id: "tt-01-ident",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_VEHICLE_IDENTIFICATION",
      title: "Identificação do Veículo e Abertura do Passaporte",
      description: "Confirmação do chassi/QR Code, vínculo do comprador e registro das condições comerciais.",
      whyRequired: "Garante que o chassi correto está reservado para uma única negociação ativa.",
      guidance: "Confira chassi, cor, ano/modelo e condições negociadas.",
      stageCode: "IDENTIFICATION",
      responsibleArea: "COMMERCIAL",
      defaultAssigneeId: "user-vendedor",
      slaHours: 4,
      applicabilityConditions: [],
      dependsOnTaskCodes: [],
      requiredEvidenceTypes: [],
      requiresFormalApproval: false,
      approvalRole: null,
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-DOC-01",
      sortOrder: 1,
    },
    {
      id: "tt-02-buyer-docs",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_BUYER_DOCS",
      title: "Coleta de Identificação e Comprovante do Comprador",
      description: "Anexar CNH/RG ou Contrato Social e comprovante de endereço atualizado.",
      whyRequired: "Obrigatório para cadastro fiscal e emissão da Nota Fiscal.",
      guidance: "Verifique a legibilidade do documento antes de enviar para conferência documental.",
      stageCode: "REGISTRATION_DOCS",
      responsibleArea: "COMMERCIAL",
      defaultAssigneeId: "user-vendedor",
      slaHours: 12,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: ["DOC_BUYER_ID"],
      requiresFormalApproval: false,
      approvalRole: null,
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-DOC-01",
      sortOrder: 2,
    },
    {
      id: "tt-03-poa-docs",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_POA_DOCS",
      title: "Coleta e Validação de Procuração do Representante",
      description: "Anexar procuração com poderes específicos e identificação do procurador.",
      whyRequired: "Exigido quando a compra ou retirada é assinada por representante legal por procuração.",
      guidance: "Confirme a validade da procuração conforme PROC-DOC-01 seção 1.2.",
      stageCode: "REGISTRATION_DOCS",
      responsibleArea: "DOCUMENTATION",
      defaultAssigneeId: "user-documental",
      slaHours: 16,
      applicabilityConditions: [
        {
          field: "hasPowerOfAttorney",
          operator: "IS_TRUE",
          humanExplanation: "Aplicável somente quando há representante por procuração na negociação",
        },
      ],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: ["DOC_POA_PUBLIC"],
      requiresFormalApproval: true,
      approvalRole: "DOCUMENTATION",
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-DOC-01",
      sortOrder: 3,
    },
    {
      id: "tt-04-tradein",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_TRADE_IN_EVAL",
      title: "Laudo de Vistoria e Documentação do Veículo Usado na Troca",
      description: "Anexar e aprovar o Termo/Laudo de Vistoria Cautelar e situação documental do usado recebido na troca.",
      whyRequired: "Quando há usado na troca, ele compõe o pagamento e precisa estar desembaraçado antes do faturamento.",
      guidance: "O vendedor ou avaliador anexa o laudo e a área Documental confere e aprova.",
      stageCode: "REGISTRATION_DOCS",
      responsibleArea: "DOCUMENTATION",
      defaultAssigneeId: "user-documental",
      slaHours: 18,
      applicabilityConditions: [
        {
          field: "hasTradeIn",
          operator: "IS_TRUE",
          humanExplanation: "Aplicável somente quando há veículo usado na troca",
        },
      ],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: ["DOC_TRADE_IN_LAUDO"],
      requiresFormalApproval: true,
      approvalRole: "DOCUMENTATION",
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-DOC-01",
      sortOrder: 4,
    },
    {
      id: "tt-05-payment",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_PAYMENT_PROOF",
      title: "Conferência Financeira de Pagamento / Entrada",
      description: "Confirmar conciliação bancária do pagamento à vista ou da entrada da negociação.",
      whyRequired: "Impede faturamento e liberação sem confirmação efetiva dos recursos financeiros.",
      guidance: "Confira o extrato bancário, vincule o comprovante e registre aprovação formal do Financeiro.",
      stageCode: "FINANCIAL_REVIEW",
      responsibleArea: "FINANCE",
      defaultAssigneeId: "user-financeiro",
      slaHours: 12,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: ["DOC_PAYMENT_RECEIPT"],
      requiresFormalApproval: true,
      approvalRole: "FINANCE",
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-FIN-01",
      sortOrder: 5,
    },
    {
      id: "tt-06-financing",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_FINANCING_CONTRACT",
      title: "Conferência de Contrato de Financiamento Assinado",
      description: "Validar assinatura da CCB/Contrato de financiamento e autorização de pagamento pelo banco.",
      whyRequired: "Exigido em vendas financiadas para garantir repasse da instituição financeira e gravame correto.",
      guidance: "Confira os dados do chassi e valor financiado no contrato antes de aprovar.",
      stageCode: "FINANCIAL_REVIEW",
      responsibleArea: "FINANCE",
      defaultAssigneeId: "user-financeiro",
      slaHours: 18,
      applicabilityConditions: [
        {
          field: "hasFinancing",
          operator: "IS_TRUE",
          humanExplanation: "Aplicável somente quando a negociação possui financiamento",
        },
      ],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: ["DOC_FINANCING_CONTRACT"],
      requiresFormalApproval: true,
      approvalRole: "FINANCE",
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-FIN-01",
      sortOrder: 6,
    },
    {
      id: "tt-07-dossier",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_DOSSIER_REVIEW",
      title: "Aprovação Final do Dossiê Documental",
      description: "Conferência consolidada de todos os documentos exigidos pelas condições da negociação.",
      whyRequired: "Libera o dossiê para emissão da Nota Fiscal sem risco de retrabalho ou erro cadastral.",
      guidance: "Verifique se todos os documentos aplicáveis estão aprovados e registre o aceite documental.",
      stageCode: "DOCUMENT_REVIEW",
      responsibleArea: "DOCUMENTATION",
      defaultAssigneeId: "user-documental",
      slaHours: 12,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_BUYER_DOCS", "TASK_POA_DOCS", "TASK_TRADE_IN_EVAL"],
      requiredEvidenceTypes: [],
      requiresFormalApproval: true,
      approvalRole: "DOCUMENTATION",
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-DOC-01",
      sortOrder: 7,
    },
    {
      id: "tt-08-billing",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_BILLING_INVOICE",
      title: "Emissão e Registro de Faturamento (Nota Fiscal)",
      description: "Emitir a Nota Fiscal do veículo e registrar seu número no Passaporte Digital.",
      whyRequired: "Requisito fiscal obrigatório antes da autorização de entrega do veículo.",
      guidance: "Somente disponível após conclusão das conferências financeira e documental.",
      stageCode: "BILLING",
      responsibleArea: "BILLING",
      defaultAssigneeId: "user-faturamento",
      slaHours: 8,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_DOSSIER_REVIEW", "TASK_PAYMENT_PROOF", "TASK_FINANCING_CONTRACT"],
      requiredEvidenceTypes: [],
      requiresFormalApproval: false,
      approvalRole: "BILLING",
      blocksBilling: false,
      blocksDelivery: true,
      procedureCode: "PROC-LIB-01",
      sortOrder: 8,
    },
    {
      id: "tt-09-pdi",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_PDI_PREPARATION",
      title: "Preparação Física (PDI), Higienização e Recarga 100%",
      description: "Executar checklist técnico de pré-entrega (PDI), estética automotiva e carga da bateria.",
      whyRequired: "Garante que o veículo está fisicamente revisado e pronto para entrega imediata quando autorizado.",
      guidance: "Pode ser executada em paralelo às etapas financeiras e documentais.",
      stageCode: "PREPARATION",
      responsibleArea: "OPERATIONS",
      defaultAssigneeId: "user-operacao",
      slaHours: 24,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: [],
      requiresFormalApproval: false,
      approvalRole: null,
      blocksBilling: false,
      blocksDelivery: true,
      procedureCode: "PROC-LIB-01",
      sortOrder: 9,
    },
    {
      id: "tt-10-auth",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_RELEASE_AUTH",
      title: "Autorização Formal de Liberação do Veículo",
      description: "Validação final e emissão da autorização formal para entrega das chaves.",
      whyRequired: "Nenhuma entrega física pode ocorrer sem autorização formal ativa emitida pelo Responsável pela Liberação.",
      guidance: "O servidor verifica todos os requisitos em transação antes de permitir a autorização.",
      stageCode: "AUTHORIZATION",
      responsibleArea: "RELEASE",
      defaultAssigneeId: "user-liberacao",
      slaHours: 4,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_BILLING_INVOICE", "TASK_PDI_PREPARATION"],
      requiredEvidenceTypes: [],
      requiresFormalApproval: true,
      approvalRole: "RELEASE_OFFICER",
      blocksBilling: false,
      blocksDelivery: false,
      procedureCode: "PROC-LIB-01",
      sortOrder: 10,
    },
    {
      id: "tt-11-delivery",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "TASK_CONFIRM_DELIVERY",
      title: "Reconfirmação do Veículo e Entrega das Chaves",
      description: "Reconfirmar chassi/código interno com autorização válida e registrar entrega ao comprador.",
      whyRequired: "Registra formalmente a saída do veículo e encerra o passaporte com rastreabilidade completa.",
      guidance: "Confirme a identificação do veículo e os dados do recebedor no ato da entrega.",
      stageCode: "DELIVERY",
      responsibleArea: "OPERATIONS",
      defaultAssigneeId: "user-operacao",
      slaHours: 4,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_RELEASE_AUTH"],
      requiredEvidenceTypes: [],
      requiresFormalApproval: false,
      approvalRole: "OPERATIONS",
      blocksBilling: false,
      blocksDelivery: false,
      procedureCode: "PROC-LIB-01",
      sortOrder: 11,
    },
  ];

  const documentRequirements: DocumentRequirement[] = [
    {
      id: "doc-req-01",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "DOC_BUYER_ID",
      title: "Documento de Identificação e Comprovante de Endereço do Comprador",
      category: "IDENTIFICATION",
      description: "CNH/RG (PF) ou Contrato Social + Cartão CNPJ (PJ) e comprovante de residência.",
      whyRequired: "Exigência cadastral e fiscal obrigatória para emissão da Nota Fiscal.",
      responsibleArea: "DOCUMENTATION",
      linkedTaskCode: "TASK_BUYER_DOCS",
      applicabilityConditions: [],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
    {
      id: "doc-req-02",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "DOC_PAYMENT_RECEIPT",
      title: "Comprovante de Pagamento / Entrada (TED ou PIX)",
      category: "FINANCIAL",
      description: "Comprovante de transferência bancária referente ao valor à vista ou entrada.",
      whyRequired: "Necessário para conciliação financeira antes do faturamento.",
      responsibleArea: "FINANCE",
      linkedTaskCode: "TASK_PAYMENT_PROOF",
      applicabilityConditions: [],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
    {
      id: "doc-req-03",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "DOC_FINANCING_CONTRACT",
      title: "Contrato de Financiamento Assinado (CCB)",
      category: "FINANCIAL",
      description: "Cédula de Crédito Bancário assinada digitalmente com a instituição financeira.",
      whyRequired: "Condição da negociação: venda financiada exige contrato formalizado antes do faturamento.",
      responsibleArea: "FINANCE",
      linkedTaskCode: "TASK_FINANCING_CONTRACT",
      applicabilityConditions: [
        {
          field: "hasFinancing",
          operator: "IS_TRUE",
          humanExplanation: "Exigido apenas quando há financiamento",
        },
      ],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
    {
      id: "doc-req-04",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "DOC_TRADE_IN_LAUDO",
      title: "Laudo de Vistoria e CRLV do Veículo Usado na Troca",
      category: "TRADE_IN",
      description: "Laudo de avaliação/vistoria cautelar e CRLV do veículo usado recebido como parte de pagamento.",
      whyRequired: "Condição da negociação: existência de veículo usado na troca exige aprovação documental do usado.",
      responsibleArea: "DOCUMENTATION",
      linkedTaskCode: "TASK_TRADE_IN_EVAL",
      applicabilityConditions: [
        {
          field: "hasTradeIn",
          operator: "IS_TRUE",
          humanExplanation: "Exigido apenas quando há veículo usado na troca",
        },
      ],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: false,
    },
    {
      id: "doc-req-05",
      organizationId: DEMO_ORG_ID,
      workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
      code: "DOC_POA_PUBLIC",
      title: "Procuração Pública e Documento do Representante Legal",
      category: "LEGAL",
      description: "Instrumento de procuração com poderes para aquisição/retirada do veículo e CNH do procurador.",
      whyRequired: "Condição da negociação: representação por procuração exige validação formal do instrumento.",
      responsibleArea: "DOCUMENTATION",
      linkedTaskCode: "TASK_POA_DOCS",
      applicabilityConditions: [
        {
          field: "hasPowerOfAttorney",
          operator: "IS_TRUE",
          humanExplanation: "Exigido apenas quando há representante por procuração",
        },
      ],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
  ];

  // ============================================================================
  // 7. NEGOCIAÇÕES DEMONSTRATIVAS (4 NEGOCIAÇÕES EM ESTÁGIOS DISTINTOS)
  // ============================================================================
  let seqCounter = 100;
  const nextSeedId = (prefix: string) => `${prefix}-${++seqCounter}`;

  // ----------------------------------------------------------------------------
  // NEGOCIAÇÃO 1 (NEG-2026-0001): ROTEIRO DEMONSTRATIVO PRINCIPAL
  // Veículo: PIN-BYD-001 (BYD Song Plus DM-i Azul Time)
  // Cenário: Venda financiada + veículo usado na troca (Toyota Corolla XEi 2021).
  // Estado inicial para o roteiro de 15 passos:
  // - Identificação, Coleta do Comprador, Contrato de Financiamento e PDI já concluídos!
  // - Pendência Documental: Falta enviar e aprovar "DOC_TRADE_IN_LAUDO" (Laudo e CRLV do Usado na Troca) -> Tarefa TASK_TRADE_IN_EVAL e TASK_DOSSIER_REVIEW.
  // - Pendência Financeira: Comprovante de Entrada já enviado, aguardando aprovação formal do Financeiro (TASK_PAYMENT_PROOF).
  // Assim, ao escanear o QR Code de PIN-BYD-001, o avaliador pode seguir exatamente os 15 passos!
  // ----------------------------------------------------------------------------
  const deal1: Deal = {
    id: "deal-001",
    organizationId: DEMO_ORG_ID,
    branchId: DEMO_BRANCH_ID,
    dealNumber: "NEG-2026-0001",
    vehicleId: "veh-001",
    customerId: "cust-helena",
    sellerId: "user-vendedor",
    workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
    status: "ACTIVE",
    currentStage: "REGISTRATION_DOCS",
    buyerType: "PF",
    paymentMethod: "FINANCING",
    hasFinancing: true,
    financingInstitution: "Banco Santander Financiamentos (Demonstrativo)",
    hasTradeIn: true,
    hasPowerOfAttorney: false,
    attorneyName: null,
    attorneyDocument: null,
    expectedDeliveryDate: "2026-11-12",
    confirmedDeliveryDate: null,
    confirmedDeliveryBy: null,
    billingRegisteredAt: null,
    billingRegisteredBy: null,
    invoiceNumber: null,
    notes: "Negociação principal do Roteiro Demonstrativo: Venda financiada com usado na troca (Corolla 2021).",
    concurrencyVersion: 1,
    createdAt: yesterday,
    updatedAt: oneHourAgo,
  };

  const tradeIn1: TradeInVehicle = {
    id: "tradein-001",
    organizationId: DEMO_ORG_ID,
    dealId: "deal-001",
    brand: "Toyota",
    model: "Corolla XEi 2.0 Flex",
    modelYear: 2021,
    color: "Prata Supernova",
    plate: "RBM4E21",
    vin: "9BRB29BE0M0112233",
    appraisedValue: 108000,
    inspectionStatus: "PENDING",
    notes: "Veículo recebido como parte da entrada. Aguardando upload do laudo de vistoria cautelar.",
    createdAt: yesterday,
  };

  const wf1 = instantiateDealWorkflow({
    deal: deal1,
    vehicleCondition: "NEW",
    taskTemplates,
    documentRequirements,
    nowIso: yesterday,
    generateId: () => nextSeedId("d1"),
  });

  const documentVersions: DocumentVersion[] = [];
  const approvalRecords: ApprovalRecord[] = [];

  // Ajustar estado de deal1 para o ponto exato do roteiro demonstrativo:
  for (const doc of wf1.documents) {
    if (doc.requirementCode === "DOC_BUYER_ID") {
      doc.status = "APPROVED";
      doc.currentVersionNumber = 1;
      doc.reviewedBy = "user-documental";
      doc.reviewedAt = threeHoursAgo;
      documentVersions.push({
        id: "docver-d1-buyer-v1",
        organizationId: DEMO_ORG_ID,
        documentId: doc.id,
        versionNumber: 1,
        storageKey: "demo-seed/d1-cnh-helena-v1.txt",
        originalFilename: "CNH_e_Comprovante_Helena_Martins_DEMO.txt",
        mimeType: "text/plain",
        sizeBytes: 1240,
        checksumSha256: "seed-sha256-d1-buyer-v1",
        uploadedBy: "user-vendedor",
        uploadNotes: "Documento de identificação e endereço conferidos pelo vendedor.",
        extractedTextPreview: "[DOCUMENTO DEMONSTRATIVO FICTÍCIO] CNH Helena Martins - CPF 123.456.789-00",
        ocrReviewStatus: "REVIEWED",
        createdAt: yesterday,
      });
    } else if (doc.requirementCode === "DOC_FINANCING_CONTRACT") {
      doc.status = "APPROVED";
      doc.currentVersionNumber = 1;
      doc.reviewedBy = "user-financeiro";
      doc.reviewedAt = threeHoursAgo;
      documentVersions.push({
        id: "docver-d1-fin-v1",
        organizationId: DEMO_ORG_ID,
        documentId: doc.id,
        versionNumber: 1,
        storageKey: "demo-seed/d1-ccb-santander-v1.txt",
        originalFilename: "CCB_Santander_Assinada_Helena_DEMO.txt",
        mimeType: "text/plain",
        sizeBytes: 2180,
        checksumSha256: "seed-sha256-d1-fin-v1",
        uploadedBy: "user-vendedor",
        uploadNotes: "CCB assinada digitalmente.",
        extractedTextPreview: "[DOCUMENTO DEMONSTRATIVO FICTÍCIO] CCB Financiamento Chassi 9BWSU19F08B301001",
        ocrReviewStatus: "REVIEWED",
        createdAt: yesterday,
      });
    } else if (doc.requirementCode === "DOC_PAYMENT_RECEIPT") {
      doc.status = "APPROVED";
      doc.currentVersionNumber = 1;
      doc.reviewedBy = "user-financeiro";
      doc.reviewedAt = threeHoursAgo;
      documentVersions.push({
        id: "docver-d1-pay-v1",
        organizationId: DEMO_ORG_ID,
        documentId: doc.id,
        versionNumber: 1,
        storageKey: "demo-seed/d1-pix-entrada-v1.txt",
        originalFilename: "Comprovante_PIX_Entrada_Helena_DEMO.txt",
        mimeType: "text/plain",
        sizeBytes: 980,
        checksumSha256: "seed-sha256-d1-pay-v1",
        uploadedBy: "user-vendedor",
        uploadNotes: "Comprovante PIX da entrada complementar.",
        extractedTextPreview: "[DOCUMENTO DEMONSTRATIVO FICTÍCIO] PIX R$ 42.000,00 - Pinauto BYD Ceres",
        ocrReviewStatus: "REVIEWED",
        createdAt: yesterday,
      });
    } else if (doc.requirementCode === "DOC_TRADE_IN_LAUDO") {
      // Permanece REQUESTED para que o Vendedor envie no Passo 5 do Roteiro Demonstrativo!
      doc.status = "REQUESTED";
      doc.currentVersionNumber = 0;
    }
  }

  for (const t of wf1.tasks) {
    if (t.code === "TASK_BUYER_DOCS") {
      t.state = "COMPLETED";
      t.completedAt = threeHoursAgo;
      t.completedBy = "user-vendedor";
    } else if (t.code === "TASK_FINANCING_CONTRACT") {
      t.state = "COMPLETED";
      t.approvalStatus = "APPROVED";
      t.completedAt = threeHoursAgo;
      t.completedBy = "user-financeiro";
      approvalRecords.push({
        id: "appr-d1-financing",
        organizationId: DEMO_ORG_ID,
        dealId: deal1.id,
        taskId: t.id,
        taskCode: t.code,
        area: "FINANCE",
        authorId: "user-financeiro",
        roleUsed: "FINANCE",
        decision: "APPROVED",
        status: "ACTIVE",
        justification: "Contrato de financiamento CCB conferido e validado junto ao banco demonstrativo.",
        evidenceRefs: [
          {
            documentId: wf1.documents.find((d) => d.requirementCode === "DOC_FINANCING_CONTRACT")!.id,
            documentTitle: "Contrato de Financiamento Assinado (CCB)",
            versionNumber: 1,
          },
        ],
        analyzedDataVersion: 1,
        invalidatedAt: null,
        invalidationReason: null,
        createdAt: threeHoursAgo,
      });
    } else if (t.code === "TASK_PDI_PREPARATION") {
      // PDI já adiantado em paralelo pela Operação!
      t.state = "COMPLETED";
      t.completedAt = oneHourAgo;
      t.completedBy = "user-operacao";
    } else if (t.code === "TASK_PAYMENT_PROOF") {
      // Fica IN_REVIEW aguardando a aprovação formal do Financeiro (Passo 9 e 10 do Roteiro!)
      t.state = "IN_REVIEW";
      t.approvalStatus = "PENDING";
      t.startedAt = threeHoursAgo;
    } else if (t.code === "TASK_TRADE_IN_EVAL") {
      // Aguardando envio do documento DOC_TRADE_IN_LAUDO pelo Vendedor e conferência do Documental (Passos 4 a 7)
      t.state = "WAITING_INFO";
      t.approvalStatus = "PENDING";
      t.startedAt = yesterday;
    }
  }
  wf1.tasks = recalculateTaskStates(wf1.tasks, wf1.documents);

  // ----------------------------------------------------------------------------
  // NEGOCIAÇÃO 2 (NEG-2026-0002): REPRESENTAÇÃO POR PROCURAÇÃO (PJ)
  // Veículo: PIN-BYD-002 (BYD Dolphin Mini Verde Sprout)
  // ----------------------------------------------------------------------------
  const deal2: Deal = {
    id: "deal-002",
    organizationId: DEMO_ORG_ID,
    branchId: DEMO_BRANCH_ID,
    dealNumber: "NEG-2026-0002",
    vehicleId: "veh-002",
    customerId: "cust-agro",
    sellerId: "user-vendedor",
    workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
    status: "ACTIVE",
    currentStage: "REGISTRATION_DOCS",
    buyerType: "PJ",
    paymentMethod: "CASH",
    hasFinancing: false,
    financingInstitution: null,
    hasTradeIn: false,
    hasPowerOfAttorney: true,
    attorneyName: "Dr. Henrique Vasconcelos (Procurador Fictício)",
    attorneyDocument: "987.654.321-99",
    expectedDeliveryDate: "2026-11-14",
    confirmedDeliveryDate: null,
    confirmedDeliveryBy: null,
    billingRegisteredAt: null,
    billingRegisteredBy: null,
    invoiceNumber: null,
    notes: "Aquisição de frota PJ representada por procurador constituído.",
    concurrencyVersion: 1,
    createdAt: yesterday,
    updatedAt: threeHoursAgo,
  };

  const wf2 = instantiateDealWorkflow({
    deal: deal2,
    vehicleCondition: "NEW",
    taskTemplates,
    documentRequirements,
    nowIso: yesterday,
    generateId: () => nextSeedId("d2"),
  });

  // Em deal2, o documento de procuração já foi enviado e está aguardando revisão do Documental
  for (const doc of wf2.documents) {
    if (doc.requirementCode === "DOC_POA_PUBLIC") {
      doc.status = "UPLOADED_PENDING_REVIEW";
      doc.currentVersionNumber = 1;
      documentVersions.push({
        id: "docver-d2-poa-v1",
        organizationId: DEMO_ORG_ID,
        documentId: doc.id,
        versionNumber: 1,
        storageKey: "demo-seed/d2-procuracao-pj-v1.txt",
        originalFilename: "Procuracao_Publica_AgroVale_DEMO.txt",
        mimeType: "text/plain",
        sizeBytes: 1850,
        checksumSha256: "seed-sha256-d2-poa-v1",
        uploadedBy: "user-vendedor",
        uploadNotes: "Procuração pública lavrada em cartório demonstrativo.",
        extractedTextPreview: "[DOCUMENTO DEMONSTRATIVO FICTÍCIO] Procuração Pública - Outorgado Dr. Henrique Vasconcelos",
        ocrReviewStatus: "PENDING_HUMAN_REVIEW",
        createdAt: threeHoursAgo,
      });
    }
  }
  // Definir tarefa de coleta de procuração com prazo vencido para demonstrar indicador de "Tarefas atrasadas" no Painel Gerencial
  for (const t of wf2.tasks) {
    if (t.code === "TASK_POA_DOCS") {
      t.state = "IN_REVIEW";
      t.dueAt = "2026-11-08T18:00:00.000Z";
    }
  }
  wf2.tasks = recalculateTaskStates(wf2.tasks, wf2.documents);

  // ----------------------------------------------------------------------------
  // NEGOCIAÇÃO 3 (NEG-2026-0003): PRONTA / ELEGÍVEL PARA AUTORIZAÇÃO
  // Veículo: PIN-BYD-003 (BYD King GS DM-i Branco Crystal)
  // ----------------------------------------------------------------------------
  const deal3: Deal = {
    id: "deal-003",
    organizationId: DEMO_ORG_ID,
    branchId: DEMO_BRANCH_ID,
    dealNumber: "NEG-2026-0003",
    vehicleId: "veh-003",
    customerId: "cust-marcelo",
    sellerId: "user-vendedor",
    workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
    status: "ELIGIBLE_FOR_AUTHORIZATION",
    currentStage: "AUTHORIZATION",
    buyerType: "PF",
    paymentMethod: "CASH",
    hasFinancing: false,
    financingInstitution: null,
    hasTradeIn: false,
    hasPowerOfAttorney: false,
    attorneyName: null,
    attorneyDocument: null,
    expectedDeliveryDate: "2026-11-10",
    confirmedDeliveryDate: "2026-11-10T14:00:00.000Z",
    confirmedDeliveryBy: "user-liberacao",
    billingRegisteredAt: threeHoursAgo,
    billingRegisteredBy: "user-faturamento",
    invoiceNumber: "NF-e 000.482.910 (Série 1 - Demo)",
    notes: "Todos os requisitos financeiros, documentais, faturamento e preparação concluídos. Pronta para autorização de liberação.",
    concurrencyVersion: 2,
    createdAt: twoDaysAgo,
    updatedAt: oneHourAgo,
  };

  const wf3 = instantiateDealWorkflow({
    deal: deal3,
    vehicleCondition: "NEW",
    taskTemplates,
    documentRequirements,
    nowIso: twoDaysAgo,
    generateId: () => nextSeedId("d3"),
  });

  for (const doc of wf3.documents) {
    doc.status = "APPROVED";
    doc.currentVersionNumber = 1;
    doc.reviewedBy = doc.responsibleArea === "FINANCE" ? "user-financeiro" : "user-documental";
    doc.reviewedAt = yesterday;
    documentVersions.push({
      id: `docver-d3-${doc.id}`,
      organizationId: DEMO_ORG_ID,
      documentId: doc.id,
      versionNumber: 1,
      storageKey: `demo-seed/d3-${doc.id}-v1.txt`,
      originalFilename: `${doc.requirementCode}_Marcelo_DEMO.txt`,
      mimeType: "text/plain",
      sizeBytes: 1120,
      checksumSha256: `seed-sha256-d3-${doc.id}`,
      uploadedBy: "user-vendedor",
      uploadNotes: "Documento validado.",
      extractedTextPreview: `[DOCUMENTO DEMONSTRATIVO FICTÍCIO] ${doc.title}`,
      ocrReviewStatus: "REVIEWED",
      createdAt: twoDaysAgo,
    });
  }

  for (const t of wf3.tasks) {
    if (t.state === "WAIVED_BY_RULE") continue;
    if (t.code === "TASK_RELEASE_AUTH") {
      t.state = "AVAILABLE";
      t.approvalStatus = "PENDING";
    } else if (t.code === "TASK_CONFIRM_DELIVERY") {
      t.state = "WAITING_PREREQUISITE";
    } else {
      t.state = "COMPLETED";
      t.completedAt = threeHoursAgo;
      t.completedBy = "user-gestor";
      if (t.requiresFormalApproval) {
        t.approvalStatus = "APPROVED";
        approvalRecords.push({
          id: `appr-d3-${t.code}`,
          organizationId: DEMO_ORG_ID,
          dealId: deal3.id,
          taskId: t.id,
          taskCode: t.code,
          area: t.responsibleArea,
          authorId: t.responsibleArea === "FINANCE" ? "user-financeiro" : "user-documental",
          roleUsed: t.responsibleArea === "FINANCE" ? "FINANCE" : "DOCUMENTATION",
          decision: "APPROVED",
          status: "ACTIVE",
          justification: "Requisitos conferidos e aprovados conforme procedimento publicado.",
          evidenceRefs: [],
          analyzedDataVersion: 1,
          invalidatedAt: null,
          invalidationReason: null,
          createdAt: yesterday,
        });
      }
    }
  }
  wf3.tasks = recalculateTaskStates(wf3.tasks, wf3.documents);

  // ----------------------------------------------------------------------------
  // NEGOCIAÇÃO 4 (NEG-2026-0004): ENTREGA CONCLUÍDA
  // Veículo: PIN-BYD-004 (BYD Shark GS DM-o Cinza Atlantis)
  // ----------------------------------------------------------------------------
  const deal4: Deal = {
    id: "deal-004",
    organizationId: DEMO_ORG_ID,
    branchId: DEMO_BRANCH_ID,
    dealNumber: "NEG-2026-0004",
    vehicleId: "veh-004",
    customerId: "cust-claudia",
    sellerId: "user-vendedor",
    workflowVersionId: DEMO_WORKFLOW_VERSION_ID,
    status: "DELIVERED",
    currentStage: "DELIVERY",
    buyerType: "PF",
    paymentMethod: "CASH",
    hasFinancing: false,
    financingInstitution: null,
    hasTradeIn: false,
    hasPowerOfAttorney: false,
    attorneyName: null,
    attorneyDocument: null,
    expectedDeliveryDate: "2026-11-08",
    confirmedDeliveryDate: "2026-11-08T16:00:00.000Z",
    confirmedDeliveryBy: "user-liberacao",
    billingRegisteredAt: yesterday,
    billingRegisteredBy: "user-faturamento",
    invoiceNumber: "NF-e 000.481.105 (Série 1 - Demo)",
    notes: "Negociação concluída com entrega física auditada.",
    concurrencyVersion: 4,
    createdAt: twoDaysAgo,
    updatedAt: yesterday,
  };

  const wf4 = instantiateDealWorkflow({
    deal: deal4,
    vehicleCondition: "NEW",
    taskTemplates,
    documentRequirements,
    nowIso: twoDaysAgo,
    generateId: () => nextSeedId("d4"),
  });

  for (const doc of wf4.documents) {
    doc.status = "APPROVED";
    doc.currentVersionNumber = 1;
    doc.reviewedBy = "user-documental";
    doc.reviewedAt = yesterday;
    documentVersions.push({
      id: `docver-d4-${doc.id}`,
      organizationId: DEMO_ORG_ID,
      documentId: doc.id,
      versionNumber: 1,
      storageKey: `demo-seed/d4-${doc.id}-v1.txt`,
      originalFilename: `${doc.requirementCode}_Claudia_DEMO.txt`,
      mimeType: "text/plain",
      sizeBytes: 1050,
      checksumSha256: `seed-sha256-d4-${doc.id}`,
      uploadedBy: "user-vendedor",
      uploadNotes: "Conferido.",
      extractedTextPreview: `[DOCUMENTO DEMONSTRATIVO FICTÍCIO] ${doc.title}`,
      ocrReviewStatus: "REVIEWED",
      createdAt: twoDaysAgo,
    });
  }

  for (const t of wf4.tasks) {
    if (t.state === "WAIVED_BY_RULE") continue;
    t.state = "COMPLETED";
    t.completedAt = yesterday;
    t.completedBy = "user-operacao";
    if (t.requiresFormalApproval) {
      t.approvalStatus = "APPROVED";
    }
  }

  const releaseAuthorizations: ReleaseAuthorization[] = [
    {
      id: "rel-auth-004",
      organizationId: DEMO_ORG_ID,
      dealId: deal4.id,
      authorizedBy: "user-liberacao",
      roleUsed: "RELEASE_OFFICER",
      status: "CONSUMED_BY_DELIVERY",
      notes: "Autorização emitida após conferência integral do dossiê e PDI.",
      analyzedDealVersion: 3,
      requirementsSnapshot: {
        completedTaskCodes: wf4.tasks.filter((t) => t.state === "COMPLETED").map((t) => t.code),
        approvedDocumentIds: wf4.documents.map((d) => ({ id: d.id, version: 1 })),
        invoiceNumber: deal4.invoiceNumber,
      },
      invalidatedAt: null,
      invalidationReason: null,
      createdAt: "2026-11-08T15:30:00.000Z",
    },
  ];

  const deliveries: DeliveryRecord[] = [
    {
      id: "deliv-004",
      organizationId: DEMO_ORG_ID,
      dealId: deal4.id,
      vehicleId: "veh-004",
      releaseAuthorizationId: "rel-auth-004",
      confirmedBy: "user-operacao",
      roleUsed: "OPERATIONS",
      confirmedVin: "9BWSH88K01B304004",
      confirmedInternalCode: "PIN-BYD-004",
      recipientName: "Cláudia Teixeira",
      recipientDocument: "789.123.456-22",
      deliveryNotes: "Chaves principais, chave reserva e kit carregador portátil entregues no showroom de Ceres.",
      deliveredAt: "2026-11-08T16:45:00.000Z",
      addendums: [],
    },
  ];

  const customerAccessGrants: CustomerAccessGrant[] = [
    {
      id: "grant-helena-d1",
      organizationId: DEMO_ORG_ID,
      dealId: deal1.id,
      customerId: "cust-helena",
      accessToken: "tok-cliente-helena-neg0001",
      expiresAt: "2026-12-31T23:59:59.000Z",
      revokedAt: null,
      createdBy: "user-vendedor",
      createdAt: yesterday,
    },
    {
      id: "grant-agro-d2",
      organizationId: DEMO_ORG_ID,
      dealId: deal2.id,
      customerId: "cust-agro",
      accessToken: "tok-cliente-agro-neg0002",
      expiresAt: "2026-12-31T23:59:59.000Z",
      revokedAt: null,
      createdBy: "user-vendedor",
      createdAt: yesterday,
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: "notif-01",
      organizationId: DEMO_ORG_ID,
      recipientProfileId: "user-vendedor",
      dealId: deal1.id,
      eventType: "DOCUMENT_REQUESTED",
      title: "Documento pendente em NEG-2026-0001",
      message: "Envie o 'Laudo de Vistoria e CRLV do Veículo Usado na Troca' para liberar a conferência documental do BYD Song Plus DM-i.",
      dedupKey: "seed-notif-01",
      isRead: false,
      readAt: null,
      createdAt: oneHourAgo,
    },
    {
      id: "notif-02",
      organizationId: DEMO_ORG_ID,
      recipientProfileId: "user-documental",
      dealId: deal2.id,
      eventType: "DOCUMENT_RECEIVED",
      title: "Procuração recebida em NEG-2026-0002",
      message: "A Procuração Pública PJ da Agropecuária Vale do São Patrício foi anexada e aguarda sua conferência.",
      dedupKey: "seed-notif-02",
      isRead: false,
      readAt: null,
      createdAt: threeHoursAgo,
    },
    {
      id: "notif-03",
      organizationId: DEMO_ORG_ID,
      recipientProfileId: "user-financeiro",
      dealId: deal1.id,
      eventType: "NEXT_TASK_AVAILABLE",
      title: "Aprovação financeira aguardando em NEG-2026-0001",
      message: "O comprovante de entrada PIX de Helena Martins está disponível para conferência e aprovação formal.",
      dedupKey: "seed-notif-03",
      isRead: false,
      readAt: null,
      createdAt: threeHoursAgo,
    },
    {
      id: "notif-04",
      organizationId: DEMO_ORG_ID,
      recipientProfileId: "user-liberacao",
      dealId: deal3.id,
      eventType: "NEXT_TASK_AVAILABLE",
      title: "NEG-2026-0003 elegível para autorização de entrega",
      message: "O BYD King GS DM-i (PIN-BYD-003) cumpriu todos os requisitos e aguarda emissão da autorização de entrega.",
      dedupKey: "seed-notif-04",
      isRead: false,
      readAt: null,
      createdAt: oneHourAgo,
    },
  ];

  const auditEvents: AuditEvent[] = [
    {
      id: "aud-01",
      organizationId: DEMO_ORG_ID,
      dealId: deal1.id,
      vehicleId: "veh-001",
      actorId: "user-vendedor",
      actorName: "Lucas Rezende (Vendedor)",
      actorRole: "SELLER",
      action: "DEAL_CREATED",
      entityType: "DEAL",
      entityId: deal1.id,
      summary: "Passaporte Digital NEG-2026-0001 aberto para o veículo BYD Song Plus DM-i (PIN-BYD-001) — Venda financiada com usado na troca.",
      metadata: {
        buyerType: "PF",
        hasFinancing: true,
        hasTradeIn: true,
        hasPowerOfAttorney: false,
      },
      isCustomerVisible: true,
      createdAt: yesterday,
    },
    {
      id: "aud-02",
      organizationId: DEMO_ORG_ID,
      dealId: deal1.id,
      vehicleId: "veh-001",
      actorId: "user-financeiro",
      actorName: "Roberto Mendes (Financeiro)",
      actorRole: "FINANCE",
      action: "APPROVAL_RECORDED",
      entityType: "TASK",
      entityId: "TASK_FINANCING_CONTRACT",
      summary: "Contrato de financiamento CCB conferido e aprovado formalmente pelo Financeiro.",
      metadata: { decision: "APPROVED" },
      isCustomerVisible: true,
      createdAt: threeHoursAgo,
    },
    {
      id: "aud-03",
      organizationId: DEMO_ORG_ID,
      dealId: deal1.id,
      vehicleId: "veh-001",
      actorId: "user-operacao",
      actorName: "Diego Ribeiro (Operação e Entrega)",
      actorRole: "OPERATIONS",
      action: "TASK_COMPLETED",
      entityType: "TASK",
      entityId: "TASK_PDI_PREPARATION",
      summary: "Preparação física (PDI), higienização e recarga 100% concluídas em paralelo.",
      metadata: {},
      isCustomerVisible: true,
      createdAt: oneHourAgo,
    },
    {
      id: "aud-04",
      organizationId: DEMO_ORG_ID,
      dealId: deal4.id,
      vehicleId: "veh-004",
      actorId: "user-liberacao",
      actorName: "Marcos Vinícius (Responsável pela Liberação)",
      actorRole: "RELEASE_OFFICER",
      action: "RELEASE_AUTHORIZED",
      entityType: "RELEASE_AUTHORIZATION",
      entityId: "rel-auth-004",
      summary: "Autorização formal de entrega emitida para NEG-2026-0004 (BYD Shark GS DM-o).",
      metadata: {},
      isCustomerVisible: true,
      createdAt: "2026-11-08T15:30:00.000Z",
    },
    {
      id: "aud-05",
      organizationId: DEMO_ORG_ID,
      dealId: deal4.id,
      vehicleId: "veh-004",
      actorId: "user-operacao",
      actorName: "Diego Ribeiro (Operação e Entrega)",
      actorRole: "OPERATIONS",
      action: "DELIVERY_CONFIRMED",
      entityType: "DELIVERY",
      entityId: "deliv-004",
      summary: "Entrega física das chaves registrada após reconfirmação do chassi 9BWSH88K01B304004.",
      metadata: {},
      isCustomerVisible: true,
      createdAt: "2026-11-08T16:45:00.000Z",
    },
  ];

  return {
    organizations,
    branches,
    profiles,
    memberships,
    vehicles,
    customers,
    workflowTemplates,
    workflowVersions,
    taskTemplates,
    documentRequirements,
    procedures,
    procedureVersions,
    deals: [deal1, deal2, deal3, deal4],
    tradeInVehicles: [tradeIn1],
    taskInstances: [...wf1.tasks, ...wf2.tasks, ...wf3.tasks, ...wf4.tasks],
    documents: [...wf1.documents, ...wf2.documents, ...wf3.documents, ...wf4.documents],
    documentVersions,
    approvalRecords,
    releaseAuthorizations,
    deliveries,
    customerAccessGrants,
    notifications,
    auditEvents,
    idempotencyKeys: [],
  };
}
