# ChaveFlow

Gestão de estoque, negociações, documentos, faturamento e entrega de veículos. Next.js, React, TypeScript e PostgreSQL no Supabase, com conexão por HTTPS.

O sistema inicia sem veículos, compradores, negociações ou documentos de exemplo. O primeiro administrador e a organização são criados por um comando local. Não há acesso por persona, senha padrão ou restauração pública de dados.

## Configuração inicial

1. Use Node.js 22 LTS e execute `npm ci`.
2. Copie `.env.example` para `.env.local`.
3. Crie um projeto no Supabase. Copie a URL do projeto para `SUPABASE_URL` e uma chave secreta (`sb_secret_...`) para `SUPABASE_SECRET_KEY`. Esses valores são usados somente no servidor. Não utilize `NEXT_PUBLIC_` para a chave secreta. Não é necessária uma conexão PostgreSQL nas portas 5432 ou 6543.
4. Gere um segredo aleatório: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Salve-o em `CHAVEFLOW_SESSION_SECRET`.
5. Preencha os campos `CHAVEFLOW_ORGANIZATION_*`, `CHAVEFLOW_BRANCH_*` e `CHAVEFLOW_ADMIN_*` com os dados reais. A senha do administrador deve ter de 12 a 128 caracteres.
6. No SQL Editor do Supabase, execute `supabase/migrations/20261109225557_chaveflow_https.sql` uma vez. A migração cria as tabelas privadas e as funções de acesso. No projeto ChaveFlow já configurado nesta sessão, essa etapa já foi concluída.
7. Execute `npm run db:setup`. O comando se conecta por HTTPS e cria a organização, unidade, administrador e fluxo padrão. Reexecutá-lo não substitui dados existentes.
8. Guarde a senha em um gerenciador e remova `CHAVEFLOW_ADMIN_PASSWORD` de `.env.local` depois do setup. Os campos de inicialização não são necessários durante a execução da aplicação.
9. Execute `npm run dev` e entre em `/login` com a conta criada.

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
3. Configure no ambiente **Production**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CHAVEFLOW_SESSION_SECRET`, `CHAVEFLOW_APP_URL`, `RESEND_API_KEY` e `CHAVEFLOW_EMAIL_FROM`. A URL do aplicativo deve ser o domínio HTTPS publicado.
4. Aplique a migração e execute o setup local apontando para o projeto de produção antes do primeiro uso. O build não cria contas, não altera o banco e não precisa de credenciais de inicialização.
5. Publique e confira login, cadastro de veículo, negociação e envio de documento com a sua conta. Configure no Resend o remetente e o domínio correspondentes.

Use outro projeto Supabase e outro segredo de sessão em **Preview**, para que testes não alterem os dados de produção. Não cadastre a senha inicial do administrador na Vercel. Não envie `.env.local`, `.data/` ou `.vercel/` ao Git.

## Persistência e arquivos

O runtime usa funções RPC por HTTPS para acessar o schema privado `chaveflow_private`. O estado operacional é armazenado em JSONB com uma revisão. A confirmação verifica essa revisão no banco: se outra instância já alterou os dados, a gravação é recusada e a interface orienta atualizar a página. Os arquivos ficam em `bytea` e são gravados na mesma transação PostgreSQL dos metadados. Uma falha desfaz a operação inteira. Downloads usam links assinados com expiração.

Essa implementação usa uma revisão para todo o estado e atende operações de menor volume. Para maior concorrência ou grandes acervos, a evolução é normalizar as entidades e separar os arquivos em um serviço de armazenamento privado. Configure backups do PostgreSQL, incluindo os arquivos.

Uploads aceitam PDF, PNG, JPEG, WEBP e TXT de até **4 MB**. O limite considera o teto de 4,5 MB por requisição/resposta das [Vercel Functions](https://vercel.com/docs/functions/limitations). Arquivos ausentes não são substituídos por conteúdo fictício. A câmera exige HTTPS em produção e permissão do navegador.

As tabelas usam RLS e ficam fora do schema público da Data API. As funções usam `SECURITY INVOKER`; somente `service_role` tem permissão para executá-las. As funções recusam `anon` e `authenticated`. Não há políticas de acesso de navegador nas tabelas privadas: isso é intencional. A chave secreta do servidor usa o papel administrativo, enquanto os serviços da aplicação verificam o usuário e o isolamento entre organizações. O login existente do ChaveFlow foi preservado; não usa Supabase Auth. O antigo arquivo JSON em `.data/` não é carregado nem importado automaticamente.

## Verificação

```sh
npm run lint
npm test
npm run build
```

A suíte cobre permissões, isolamento, dependências, documentos, liberação, entrega, concorrência, inicialização vazia e segurança de senhas. Dados fictícios usados pelos testes estão isolados em `src/tests/fixtures/` e não são importados pela aplicação.
