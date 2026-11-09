# ChaveFlow — Passaporte Digital de Faturamento e Liberação de Veículos

> **“Escaneou o carro. Entendeu o próximo passo. Acompanhou até a entrega.”**
>
> *Cenário piloto demonstrativo: **Pinauto BYD — Ceres/GO**.*
> *Aviso Legal: ChaveFlow é um software independente. A Pinauto BYD figura como concessionária demonstrativa piloto, sem indicar desenvolvimento ou homologação oficial pela BYD Auto.*

---

## 1. Visão Geral da Arquitetura

O sistema separa rigorosamente **5 camadas**:

1. **Domínio e Regras de Negócio (`src/domain/`)**:
   - [`types.ts`](./src/domain/types.ts): Entidades, enums de estado, rótulos operacionais e contratos de validação compartilhados com **Zod**.
   - [`permissions.ts`](./src/domain/permissions.ts): Matriz RBAC para os 9 perfis (com acúmulo de funções), guardas de autorização no servidor e isolamento multi-organização (`assertOrganizationAccess`, `assertPermission`, `assertInternalStaff`).
   - [`workflow-engine.ts`](./src/domain/workflow-engine.ts): Avaliador seguro de condições restritas (sem `eval`), validador de ciclos em grafos de dependência (`validateWorkflowDAG`), cálculo de elegibilidade para faturamento/liberação e recomendador determinístico de próxima ação por perfil.
   - [`contextual-assistant.ts`](./src/domain/contextual-assistant.ts): Assistente contextual que responde perguntas com base nos dados autorizados da negociação e nas versões **PUBLICADAS** dos procedimentos da organização, citando versão e seção e recusando qualquer comando de aprovação ou alteração de estado.
2. **Serviços de Aplicação (`src/application/`)**:
   - [`auth-service.ts`](./src/application/auth-service.ts): Login, recuperação de senha, convites de colaboradores sem escalonamento de privilégio, troca de persona demonstrativa restrita ao modo demo e sessão assinada por HMAC (`httpOnly`).
   - [`vehicle-service.ts`](./src/application/vehicle-service.ts): Cadastro de estoque, prevenção de duplicidade de chassi na organização, importação CSV com prévia/relatório de erros, geração de etiquetas QR opacas (`cf://v/<qrToken>`) e resolução de escaneamento.
   - [`deal-service.ts`](./src/application/deal-service.ts): Abertura guiada com rascunho e veículo usado na troca separado (`trade_in_vehicles`), Passaporte Digital, solicitação/upload/revisão/substituição de documentos privados com invalidação automática de aprovações e autorizações, registro de faturamento, autorização transacional de liberação e confirmação de entrega com imutabilidade pós-entrega e adendos.
   - [`customer-portal-service.ts`](./src/application/customer-portal-service.ts): Portal do Comprador com filtro de visibilidade estrito, token individual revogável e bloqueio de QR Code de veículo.
   - [`report-and-admin-service.ts`](./src/application/report-and-admin-service.ts): Painel gerencial calculado sobre o banco, publicação versionada de procedimentos e administração organizacional.
3. **Acesso a Dados e Persistência (`src/infrastructure/` e `supabase/migrations/`)**:
   - [`0001_chaveflow_schema.sql`](./supabase/migrations/0001_chaveflow_schema.sql): Migração PostgreSQL + Supabase completa para as 25 entidades, índice único parcial `idx_unique_active_deal_per_vehicle`, trigger de imutabilidade em `audit_events` e políticas Row Level Security (RLS).
   - [`database.ts`](./src/infrastructure/database.ts): Repositório persistente transacional com mutex lock e rollback (`.data/chaveflow-db.json`), armazenamento privado de arquivos (`.data/private-storage/`) com bloqueio de executáveis no servidor e links temporários assinados por HMAC.
   - [`seed-data.ts`](./src/infrastructure/seed-data.ts): Semente demonstrativa da Pinauto BYD Ceres/GO e segunda organização isolada (`Cerrado Motors`) para testes de isolamento multi-tenant.
4. **Adaptadores de Integrações (`src/infrastructure/adapters.ts`)**:
   - [`adapters.ts`](./src/infrastructure/adapters.ts): Adaptadores desacoplados para E-mail, WhatsApp e interface preparada para leitura futura de Código de Barras 1D e OCR de Chassi.
5. **Interface Web e Rotas de API (`src/app/` e `src/components/`)**:
   - Next.js 15 App Router + TypeScript + Tailwind CSS, responsiva para celular (pátio/showroom) e desktop (mesas financeira, documental, faturamento e liberação).

---

## 2. Instruções de Instalação e Execução

### Pré-requisitos
- Node.js 20+ e npm.

### Passo a passo
```bash
# 1. Instalar dependências
npm install

# 2. (Opcional) Copiar variáveis de ambiente de exemplo
cp .env.example .env.local

# 3. Executar a suíte de testes prioritários (Vitest)
npm test

# 4. Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.
No modo demonstrativo local (`CHAVEFLOW_DEMO_MODE=true`), o banco transacional é inicializado automaticamente em `.data/chaveflow-db.json` com os veículos, colaboradores, procedimentos e negociações da **Pinauto BYD — Ceres/GO**, e uma barra superior permite alternar instantaneamente entre qualquer perfil (**Vendedor**, **Financeiro**, **Documental**, **Faturamento**, **Operação**, **Responsável pela Liberação**, **Gestor**, **Administrador** e **Cliente**), além de restaurar a demonstração ao estado inicial a qualquer momento.

---

## 3. Como Testar a Leitura de QR Code (`/app/escanear`)

1. Acesse **Escanear Veículo** (`/app/escanear`).
2. **Opção A — Câmera Real do Celular ou Webcam**:
   - Clique em **"Ativar Câmera Traseira"** (a câmera só é requisitada após ação explícita do usuário e é encerrada automaticamente ao sair da tela).
   - Aponte para qualquer QR Code impresso na seção **"Etiquetas QR Demonstrativas para Impressão / Leitura"** da própria página ou na ficha do veículo (`/app/veiculos/[id]`).
3. **Opção B — Simulador de Leitura Rápida**:
   - Na mesma tela `/app/escanear`, clique em qualquer etiqueta demonstrativa (ex.: `PIN-BYD-001` com negociação ativa `NEG-2026-0001`, ou `PIN-BYD-002` disponível em estoque sem negociação ativa) ou no botão **"Testar QR Desconhecido"**.
4. **Opção C — Busca Manual**:
   - Digite o código interno (`PIN-BYD-001`), placa (`SGO1A23`), chassi (`95ZP...`) ou modelo (`Song Plus`).

---

## 4. Regras Demonstrativas Configuradas (Sujeitas à Validação da Concessionária)

Todas as regras abaixo estão modeladas no motor versionado (`WF-PINAUTO-V1`) e marcadas como **demonstrativas e sujeitas à validação jurídica e operacional da concessionária**:

| Condição da Negociação | Regra Aplicada na Trilha |
|---|---|
| `hasFinancing = false` (À vista / recursos próprios) | As tarefas `TASK_CREDIT_ANALYSIS` (Aprovação de Crédito) e `TASK_CONTRACT_SIGNATURE` (Contrato de Financiamento) recebem automaticamente o estado **`WAIVED_BY_RULE` (Dispensada por regra)**, registrando a expressão exata (`hasFinancing == false`). |
| `hasTradeIn = true` (Com veículo usado na troca) | Habilita obrigatoriamente `TASK_TRADE_IN_EVAL` (Laudo de Vistoria e Avaliação do Usado) e `TASK_TRADE_IN_DEBT_CLEARANCE` (Quitação de Multas/Restrições do Usado), mantendo os dados do veículo recebido em `trade_in_vehicles` separados do veículo vendido. |
| `customerType = PJ` ou `hasPowerOfAttorney = true` | Habilita `TASK_PJ_POA_VALIDATION` (Conferência de Contrato Social / Procuração e Poderes de Representação). |
| **Requisitos para Faturar** | Exige conclusão e aprovação formal das tarefas e documentos que bloqueiam faturamento (`TASK_BUYER_ID`, `TASK_DOWN_PAYMENT`, `TASK_CREDIT_ANALYSIS`, `TASK_TRADE_IN_EVAL`, `TASK_DOSSIER_REVIEW`). |
| **Requisitos para Autorizar Liberação** | Exige faturamento registrado (`invoiceNumber`), tarefas e documentos de entrega aprovados, vistoria física (`TASK_PDI_INSPECTION`) e checklist de chaves (`TASK_DELIVERY_CHECKLIST`) concluídos. |
| **Substituição de Documento Aprovado** | Preserva a versão anterior no histórico, marca o documento e aprovações dependentes como **`OUTDATED` (Desatualizada)**, reabre as tarefas de conferência, invalida qualquer autorização de entrega ativa e exige justificativa auditável. |

---

## 5. Resumo dos Testes Automatizados Executados (`npm test`)

A suíte [`src/tests/chaveflow.test.ts`](./src/tests/chaveflow.test.ts) valida os **10 cenários prioritários obrigatórios**:

1. **Unicidade de negociação ativa por veículo**: impede criar segunda negociação ativa para o mesmo veículo.
2. **Geração correta de tarefas conforme condições**: valida dispensa por regra (`WAIVED_BY_RULE`) em venda à vista sem troca e ativação de tarefas em venda com financiamento, troca e PJ/procuração.
3. **Respeito às dependências**: impede concluir tarefas fora de ordem quando pré-requisitos não foram cumpridos.
4. **Permissões no servidor**: bloqueia vendedor tentando aprovar financeiro, autorizar entrega ou acessar outra organização.
5. **Isolamento entre organizações**: impede leitura de veículos ou passaportes entre `org-pinauto-byd` e `org-outra-concessionaria`.
6. **Isolamento entre clientes e bloqueio de QR Code do veículo no Portal do Comprador**: garante que um cliente não acesse outra negociação e que o QR Code do veículo retorne `403 VEHICLE_QR_FORBIDDEN_FOR_CUSTOMER_PORTAL`.
7. **Invalidação de aprovação após substituição de documento**: verifica preservação da v1, criação da v2, marcação de aprovações como `OUTDATED`, reabertura de tarefas e invalidação de autorização de entrega ativa.
8. **Bloqueio de liberação prematura**: retorna `422 RELEASE_PRECONDITIONS_BLOCKED` com a lista exata de requisitos pendentes.
9. **Separação entre `ELIGIBLE_FOR_AUTHORIZATION`, `DELIVERY_AUTHORIZED` e `DELIVERED`**: comprova as transições distintas e a exigência de reconfirmação do chassi/QR na entrega física.
10. **Registro de auditoria em ações críticas**: valida gravação rastreável de autor, função, data/hora e resumo.

---

## 6. Lista Objetiva: Implementado vs. Simulado / Pendente de Integração Externa

### Implementado de Ponta a Ponta
- Autenticação com sessão assinada no servidor, recuperação de senha, convite de colaboradores sem escalonamento de privilégio e controle multi-organização/unidade/acumulação de funções.
- Cadastro de veículos e estoque com prevenção de chassi duplicado, garantia de apenas uma negociação ativa por veículo, importação CSV com prévia e validação, e geração de etiquetas QR Code opacas imprimíveis.
- Tela de escaneamento mobile com câmera real (`jsqr`), preferência por câmera traseira, encerramento ao sair da tela, prevenção de leitura duplicada, busca manual e confirmação visual.
- Abertura guiada da negociação em 5 etapas com salvamento de rascunho e cadastro separado do veículo usado na troca.
- Motor de processos versionado com avaliador seguro de condições, validação de ciclos (DAG), tarefas paralelas e dispensa por regra auditável (`WAIVED_BY_RULE`).
- Passaporte Digital respondendo às 9 perguntas centrais, com indicadores financeiro/documental/operacional, lista de bloqueios, linha do tempo, tarefas, documentos, aprovações e histórico.
- Gestão de documentos com armazenamento privado fora de `public/`, validação de arquivo no servidor (bloqueio de executáveis), links temporários assinados e invalidação em cascata ao substituir documento aprovado.
- Fluxo transacional de faturamento, autorização de liberação e confirmação de entrega com imutabilidade pós-entrega e registro de adendos.
- Portal do Comprador seguro por conta ou token individual revogável.
- Assistente contextual determinístico baseado nos dados da negociação e nos procedimentos publicados (com citação de versão e seção).
- Painel gerencial com indicadores e gráficos reais calculados sobre o banco de dados.
- Administração de procedimentos versionados (`DRAFT`, `PUBLISHED`, `ARCHIVED`), SLAs e auditoria imutável.

### Simulado ou Preparado por Adaptador (Pendente de Credenciais Externas em Produção)
- **Envio externo de E-mail e WhatsApp (`src/infrastructure/adapters.ts`)**: Notificações internas funcionam integralmente no banco; o disparo externo por SMTP/WhatsApp opera em modo simulado auditável até configuração de provedor.
- **Provedor LLM externo para o Assistente Contextual**: Funciona integralmente em modo determinístico local citando os procedimentos publicados, sem depender de chave de API externa.
- **Leitura de Código de Barras 1D e OCR de Chassi (`src/infrastructure/adapters.ts`)**: Interface de integração preparada e documentada como evolução futura; a leitura ativa implementada utiliza QR Code 2D interno (`jsqr`) e busca manual.
- **Extração automática de texto/OCR de documentos enviados**: Campo e status de revisão humana (`PENDING_HUMAN_REVIEW`) estruturados no banco; em modo local gera prévia textual demonstrativa sujeita à conferência humana.
