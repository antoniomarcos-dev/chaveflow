import type {
  DocumentRequirement,
  TaskTemplate,
  WorkflowTemplate,
  WorkflowVersion,
} from "@/domain/types";
import type { DatabaseState } from "./database-state";
export function createEmptyState(): DatabaseState {
  return {
    organizations: [],
    branches: [],
    profiles: [],
    memberships: [],
    vehicles: [],
    customers: [],
    workflowTemplates: [],
    workflowVersions: [],
    taskTemplates: [],
    documentRequirements: [],
    procedures: [],
    procedureVersions: [],
    deals: [],
    tradeInVehicles: [],
    taskInstances: [],
    documents: [],
    documentVersions: [],
    approvalRecords: [],
    releaseAuthorizations: [],
    deliveries: [],
    customerAccessGrants: [],
    notifications: [],
    auditEvents: [],
    idempotencyKeys: [],
  };
}
export function createOrganizationWorkflow(
  organizationId: string,
  adminId: string,
) {
  const twoDaysAgo = new Date().toISOString();
  const orgId = organizationId;
  const templateId = "wf-" + organizationId;
  const versionId = "wfv-" + organizationId;
  const workflowTemplates: WorkflowTemplate[] = [
    {
      id: templateId,
      organizationId: orgId,
      code: "WF-PADRAO",
      name: "Fluxo Padrão de Faturamento e Liberação",
      description:
        "Modelo configurável versionado com 8 etapas, suporte a paralelismo e condições para financiamento, usado na troca e procuração.",
      activeVersionId: versionId,
      createdAt: twoDaysAgo,
    },
  ];

  const workflowVersions: WorkflowVersion[] = [
    {
      id: versionId,
      organizationId: orgId,
      workflowTemplateId: templateId,
      versionNumber: 1,
      status: "PUBLISHED",
      publishedAt: twoDaysAgo,
      publishedBy: adminId,
      createdAt: twoDaysAgo,
    },
  ];

  const taskTemplates: TaskTemplate[] = [
    {
      id: "tt-01-ident",
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_VEHICLE_IDENTIFICATION",
      title: "Identificação do Veículo e Abertura do Passaporte",
      description:
        "Confirmação do chassi/QR Code, vínculo do comprador e registro das condições comerciais.",
      whyRequired:
        "Garante que o chassi correto está reservado para uma única negociação ativa.",
      guidance: "Confira chassi, cor, ano/modelo e condições negociadas.",
      stageCode: "IDENTIFICATION",
      responsibleArea: "COMMERCIAL",
      defaultAssigneeId: null,
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_BUYER_DOCS",
      title: "Coleta de Identificação e Comprovante do Comprador",
      description:
        "Anexar CNH/RG ou Contrato Social e comprovante de endereço atualizado.",
      whyRequired: "Obrigatório para cadastro fiscal e emissão da Nota Fiscal.",
      guidance:
        "Verifique a legibilidade do documento antes de enviar para conferência documental.",
      stageCode: "REGISTRATION_DOCS",
      responsibleArea: "COMMERCIAL",
      defaultAssigneeId: null,
      slaHours: 12,
      applicabilityConditions: [],
      dependsOnTaskCodes: ["TASK_VEHICLE_IDENTIFICATION"],
      requiredEvidenceTypes: ["DOC_BUYER_ID", "DOC_BUYER_ADDRESS"],
      requiresFormalApproval: false,
      approvalRole: null,
      blocksBilling: true,
      blocksDelivery: true,
      procedureCode: "PROC-DOC-01",
      sortOrder: 2,
    },
    {
      id: "tt-03-poa-docs",
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_POA_DOCS",
      title: "Coleta e Validação de Procuração do Representante",
      description:
        "Anexar procuração com poderes específicos e identificação do procurador.",
      whyRequired:
        "Exigido quando a compra ou retirada é assinada por representante legal por procuração.",
      guidance:
        "Confirme a validade da procuração conforme PROC-DOC-01 seção 1.2.",
      stageCode: "REGISTRATION_DOCS",
      responsibleArea: "DOCUMENTATION",
      defaultAssigneeId: null,
      slaHours: 16,
      applicabilityConditions: [
        {
          field: "hasPowerOfAttorney",
          operator: "IS_TRUE",
          humanExplanation:
            "Aplicável somente quando há representante por procuração na negociação",
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_TRADE_IN_EVAL",
      title: "Laudo de Vistoria e Documentação do Veículo Usado na Troca",
      description:
        "Anexar e aprovar o Termo/Laudo de Vistoria Cautelar e situação documental do usado recebido na troca.",
      whyRequired:
        "Quando há usado na troca, ele compõe o pagamento e precisa estar desembaraçado antes do faturamento.",
      guidance:
        "O vendedor ou avaliador anexa o laudo e a área Documental confere e aprova.",
      stageCode: "REGISTRATION_DOCS",
      responsibleArea: "DOCUMENTATION",
      defaultAssigneeId: null,
      slaHours: 18,
      applicabilityConditions: [
        {
          field: "hasTradeIn",
          operator: "IS_TRUE",
          humanExplanation:
            "Aplicável somente quando há veículo usado na troca",
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_PAYMENT_PROOF",
      title: "Conferência Financeira de Pagamento / Entrada",
      description:
        "Confirmar conciliação bancária do pagamento à vista ou da entrada da negociação.",
      whyRequired:
        "Impede faturamento e liberação sem confirmação efetiva dos recursos financeiros.",
      guidance:
        "Confira o extrato bancário, vincule o comprovante e registre aprovação formal do Financeiro.",
      stageCode: "FINANCIAL_REVIEW",
      responsibleArea: "FINANCE",
      defaultAssigneeId: null,
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_FINANCING_CONTRACT",
      title: "Conferência de Contrato de Financiamento Assinado",
      description:
        "Validar assinatura da CCB/Contrato de financiamento e autorização de pagamento pelo banco.",
      whyRequired:
        "Exigido em vendas financiadas para garantir repasse da instituição financeira e gravame correto.",
      guidance:
        "Confira os dados do chassi e valor financiado no contrato antes de aprovar.",
      stageCode: "FINANCIAL_REVIEW",
      responsibleArea: "FINANCE",
      defaultAssigneeId: null,
      slaHours: 18,
      applicabilityConditions: [
        {
          field: "hasFinancing",
          operator: "IS_TRUE",
          humanExplanation:
            "Aplicável somente quando a negociação possui financiamento",
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_DOSSIER_REVIEW",
      title: "Aprovação Final do Dossiê Documental",
      description:
        "Conferência consolidada de todos os documentos exigidos pelas condições da negociação.",
      whyRequired:
        "Libera o dossiê para emissão da Nota Fiscal sem risco de retrabalho ou erro cadastral.",
      guidance:
        "Verifique se todos os documentos aplicáveis estão aprovados e registre o aceite documental.",
      stageCode: "DOCUMENT_REVIEW",
      responsibleArea: "DOCUMENTATION",
      defaultAssigneeId: null,
      slaHours: 12,
      applicabilityConditions: [],
      dependsOnTaskCodes: [
        "TASK_BUYER_DOCS",
        "TASK_POA_DOCS",
        "TASK_TRADE_IN_EVAL",
      ],
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_BILLING_INVOICE",
      title: "Emissão e Registro de Faturamento (Nota Fiscal)",
      description:
        "Emitir a Nota Fiscal do veículo e registrar seu número no Passaporte Digital.",
      whyRequired:
        "Requisito fiscal obrigatório antes da autorização de entrega do veículo.",
      guidance:
        "Somente disponível após conclusão das conferências financeira e documental.",
      stageCode: "BILLING",
      responsibleArea: "BILLING",
      defaultAssigneeId: null,
      slaHours: 8,
      applicabilityConditions: [],
      dependsOnTaskCodes: [
        "TASK_DOSSIER_REVIEW",
        "TASK_PAYMENT_PROOF",
        "TASK_FINANCING_CONTRACT",
      ],
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_PDI_PREPARATION",
      title: "Preparação Física (PDI), Higienização e Recarga 100%",
      description:
        "Executar checklist técnico de pré-entrega (PDI), estética automotiva e carga da bateria.",
      whyRequired:
        "Garante que o veículo está fisicamente revisado e pronto para entrega imediata quando autorizado.",
      guidance:
        "Pode ser executada em paralelo às etapas financeiras e documentais.",
      stageCode: "PREPARATION",
      responsibleArea: "OPERATIONS",
      defaultAssigneeId: null,
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_RELEASE_AUTH",
      title: "Autorização Formal de Liberação do Veículo",
      description:
        "Validação final e emissão da autorização formal para entrega das chaves.",
      whyRequired:
        "Nenhuma entrega física pode ocorrer sem autorização formal ativa emitida pelo Responsável pela Liberação.",
      guidance:
        "O servidor verifica todos os requisitos em transação antes de permitir a autorização.",
      stageCode: "AUTHORIZATION",
      responsibleArea: "RELEASE",
      defaultAssigneeId: null,
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "TASK_CONFIRM_DELIVERY",
      title: "Reconfirmação do Veículo e Entrega das Chaves",
      description:
        "Reconfirmar chassi/código interno com autorização válida e registrar entrega ao comprador.",
      whyRequired:
        "Registra formalmente a saída do veículo e encerra o passaporte com rastreabilidade completa.",
      guidance:
        "Confirme a identificação do veículo e os dados do recebedor no ato da entrega.",
      stageCode: "DELIVERY",
      responsibleArea: "OPERATIONS",
      defaultAssigneeId: null,
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "DOC_BUYER_ID",
      title: "Documento de Identificação do Comprador (CNH, RG ou Contrato Social)",
      category: "IDENTIFICATION",
      description:
        "CNH ou RG válido (Pessoa Física) ou Contrato Social + Cartão CNPJ (Pessoa Jurídica).",
      whyRequired:
        "Exigência cadastral e fiscal obrigatória para identificação do titular na Nota Fiscal.",
      responsibleArea: "DOCUMENTATION",
      linkedTaskCode: "TASK_BUYER_DOCS",
      applicabilityConditions: [],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
    {
      id: "doc-req-01b",
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "DOC_BUYER_ADDRESS",
      title: "Comprovante de Endereço Atualizado do Comprador",
      category: "IDENTIFICATION",
      description:
        "Comprovante de residência ou sede atualizado (emitido nos últimos 90 dias).",
      whyRequired:
        "Obrigatório para validação do endereço fiscal na emissão da Nota Fiscal e emplacamento.",
      responsibleArea: "DOCUMENTATION",
      linkedTaskCode: "TASK_BUYER_DOCS",
      applicabilityConditions: [],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
    {
      id: "doc-req-02",
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "DOC_PAYMENT_RECEIPT",
      title: "Comprovante de Pagamento / Entrada (TED ou PIX)",
      category: "FINANCIAL",
      description:
        "Comprovante de transferência bancária referente ao valor à vista ou entrada.",
      whyRequired:
        "Necessário para conciliação financeira antes do faturamento.",
      responsibleArea: "FINANCE",
      linkedTaskCode: "TASK_PAYMENT_PROOF",
      applicabilityConditions: [],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
    {
      id: "doc-req-03",
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "DOC_FINANCING_CONTRACT",
      title: "Contrato de Financiamento Assinado (CCB)",
      category: "FINANCIAL",
      description:
        "Cédula de Crédito Bancário assinada digitalmente com a instituição financeira.",
      whyRequired:
        "Condição da negociação: venda financiada exige contrato formalizado antes do faturamento.",
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "DOC_TRADE_IN_LAUDO",
      title: "Laudo de Vistoria e CRLV do Veículo Usado na Troca",
      category: "TRADE_IN",
      description:
        "Laudo de avaliação/vistoria cautelar e CRLV do veículo usado recebido como parte de pagamento.",
      whyRequired:
        "Condição da negociação: existência de veículo usado na troca exige aprovação documental do usado.",
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
      organizationId: orgId,
      workflowVersionId: versionId,
      code: "DOC_POA_PUBLIC",
      title: "Procuração Pública e Documento do Representante Legal",
      category: "LEGAL",
      description:
        "Instrumento de procuração com poderes para aquisição/retirada do veículo e CNH do procurador.",
      whyRequired:
        "Condição da negociação: representação por procuração exige validação formal do instrumento.",
      responsibleArea: "DOCUMENTATION",
      linkedTaskCode: "TASK_POA_DOCS",
      applicabilityConditions: [
        {
          field: "hasPowerOfAttorney",
          operator: "IS_TRUE",
          humanExplanation:
            "Exigido apenas quando há representante por procuração",
        },
      ],
      blocksBilling: true,
      blocksDelivery: true,
      isCustomerVisible: true,
    },
  ];

  // ============================================================================
  // ============================================================================

  for (const t of taskTemplates) {
    t.id = organizationId + "-" + t.id;
    t.defaultAssigneeId = null;
  }
  for (const d of documentRequirements) d.id = organizationId + "-" + d.id;
  workflowVersions[0].publishedBy = adminId;
  return {
    workflowTemplates,
    workflowVersions,
    taskTemplates,
    documentRequirements,
  };
}
