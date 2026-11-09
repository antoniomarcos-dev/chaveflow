# ChaveFlow

Gestão de estoque, negociações, documentos, faturamento e entrega de veículos. Next.js, React, TypeScript e PostgreSQL.

O sistema inicia sem veículos, compradores, negociações ou documentos de exemplo. O primeiro administrador e a organização são criados por um comando local. Não há acesso por persona, senha padrão ou restauração pública de dados.

## Configuração inicial

1. Use Node.js 22 LTS e execute `npm ci`.
2. Copie `.env.example` para `.env.local`.
3. Configure `DATABASE_URL` com a conexão de um PostgreSQL. Para provedores gerenciados, use a conexão com pool e TLS conforme as instruções do provedor. A conta do banco deve ser proprietária das tabelas criadas pelo setup. Nunca exponha essa conexão ao navegador.
4. Gere um segredo aleatório: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Salve-o em `CHAVEFLOW_SESSION_SECRET`.
5. Preencha os campos `CHAVEFLOW_ORGANIZATION_*`, `CHAVEFLOW_BRANCH_*` e `CHAVEFLOW_ADMIN_*` com os dados reais. A senha do administrador deve ter de 12 a 128 caracteres.
6. Execute `npm run db:setup`. O comando aplica `database/migrations/0001_runtime.sql` e cria a organização, unidade, administrador e fluxo padrão. Reexecutá-lo não substitui dados existentes.
7. Remova `CHAVEFLOW_ADMIN_PASSWORD` de `.env.local` depois do setup. Os campos de inicialização não são necessários durante a execução da aplicação.
8. Execute `npm run dev` e entre em `/login` com a conta criada.

O fluxo padrão contém tarefas e requisitos documentais, sem responsáveis fictícios. Revise os responsáveis, SLAs e procedimentos em Configurações e Procedimentos antes de começar a operação. Os procedimentos de consulta começam vazios e devem ser publicados pela organização.

## E-mail

Recuperação de senha e convites de colaboradores enviam mensagens reais pela API do Resend. Configure:

- `RESEND_API_KEY`: chave criada na conta do provedor.
- `CHAVEFLOW_EMAIL_FROM`: remetente de um domínio verificado.
- `CHAVEFLOW_APP_URL`: endereço público completo, por exemplo `https://seu-dominio.com.br`.

O colaborador recebe um link para definir a própria senha. Links expiram em uma hora e só podem ser usados uma vez. Redefinir a senha invalida sessões anteriores. Sem configuração de e-mail, o sistema informa a indisponibilidade; não simula envio.

Notificações de tarefas e negociações ficam na central interna. Não há envio de WhatsApp nem serviço de OCR. O assistente contextual consulta os dados autorizados e os procedimentos publicados, sem depender de API de IA.

## Publicação na Vercel

1. Envie este repositório ao seu provedor Git e importe-o na Vercel.
2. Selecione o diretório que contém `package.json`, framework **Next.js** e Node.js **22.x**. O build é `npm run build`; o diretório de saída é detectado automaticamente.
3. Configure no ambiente **Production**: `DATABASE_URL`, `CHAVEFLOW_SESSION_SECRET`, `CHAVEFLOW_APP_URL`, `RESEND_API_KEY` e `CHAVEFLOW_EMAIL_FROM`.
4. Execute o setup local apontando para o banco de produção antes do primeiro uso. O build não cria contas, não altera o banco e não precisa de credenciais de inicialização.
5. Publique e confira login, cadastro de veículo, negociação e envio de documento com a sua conta. Configure no Resend o remetente e o domínio correspondentes.

Use outro banco e outro segredo em **Preview**, para que testes não alterem os dados de produção. Não cadastre a senha inicial do administrador na Vercel. Não envie `.env.local`, `.data/` ou `.vercel/` ao Git.

## Persistência e arquivos

O runtime usa as tabelas privadas `chaveflow_state`, `chaveflow_files` e `chaveflow_rate_limits`. O estado operacional é armazenado em JSONB; alterações usam transações PostgreSQL e bloqueio da linha para evitar gravações concorrentes perdidas entre instâncias. Os arquivos ficam em `bytea`, na mesma transação dos metadados, e são acessados por links assinados com expiração.

Essa implementação serializa as alterações do estado e atende operações de menor volume. Para maior concorrência ou grandes acervos, a evolução é normalizar as entidades e separar os arquivos em um serviço de armazenamento privado. Configure backups do PostgreSQL, incluindo os arquivos.

Uploads aceitam PDF, PNG, JPEG, WEBP e TXT de até **4 MB**. O limite considera o teto de 4,5 MB por requisição/resposta das [Vercel Functions](https://vercel.com/docs/functions/limitations). Arquivos ausentes não são substituídos por conteúdo fictício. A câmera exige HTTPS em produção e permissão do navegador.

As tabelas usam RLS e não concedem acesso público. O acesso do servidor depende da conta proprietária; as permissões de usuário e o isolamento entre organizações são aplicados pelos serviços da aplicação. Não exponha essas tabelas por uma API pública. O antigo arquivo JSON em `.data/` não é carregado nem importado automaticamente.

## Verificação

```sh
npm run lint
npm test
npm run build
```

A suíte cobre permissões, isolamento, dependências, documentos, liberação, entrega, concorrência, inicialização vazia e segurança de senhas. Dados fictícios usados pelos testes estão isolados em `src/tests/fixtures/` e não são importados pela aplicação.
