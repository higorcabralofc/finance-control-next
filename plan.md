# Plano: login e sincronização do Finora

## Direção aprovada

Adicionar login pela conta Manus e persistência financeira no banco gerenciado do projeto, para que a mesma conta acesse seus dados em diferentes dispositivos. Importar os registros que já existem no navegador do usuário quando ele entrar pela primeira vez, sem sobrescrever dados que já estejam na nuvem e sem misturar dados de contas diferentes. A hospedagem permanece Pública por escolha do usuário: qualquer pessoa pode abrir a tela de login, mas dados financeiros só ficam acessíveis após autenticação Manus.

A interface permanece em português do Brasil e conserva a identidade visual já existente do Finora. O login não será uma tela genérica separada do produto: usará o mesmo visual de painéis verdes, superfícies claras e textos curtos e tranquilizadores.

## Produto e funcionamento

- Exigir autenticação real antes de mostrar ou alterar dados financeiros. O login padrão é Manus OAuth; o mesmo usuário deve entrar com a mesma conta Manus nos outros dispositivos.
- Associar transações, categorias, dívidas e parcelas, metas, cartões, compras, pagamentos de faturas e vencimentos personalizados exclusivamente ao identificador Manus validado no servidor. A API nunca aceitará do navegador um identificador de usuário para escolher de quem são os dados.
- Ao autenticar no aparelho que contém os dados atuais, validar as coleções locais e importar uma única vez para a conta se ainda não houver um conjunto remoto, salvo se houver indicação de que os dados pertencem a outra conta; nesse caso, preservar ambas as cópias e pedir escolha explícita. Manter os dados locais até o servidor confirmar a gravação. Se a conta já tiver dados na nuvem, preservar as versões e pedir escolha antes de substituir qualquer uma.
- Sincronizar alterações financeiras após edição e consultar a versão remota ao entrar, voltar ao app ou recuperar a conexão. Em cada leitura e gravação, comparar a conta da sessão validada pelo servidor com a chave pseudônima da cópia local; nunca enviar o snapshot de uma conta sob a sessão de outra. Manter cache local isolado por conta; depois de um login bem-sucedido no aparelho, permitir leitura e edição offline com estado “pendente” e enviar as mudanças ao recuperar a rede. Mostrar estados claros de carregamento, sincronização, salvo, offline e conflito, evitando substituir silenciosamente uma versão alterada em outro dispositivo.
- Encerrar a sessão sem excluir os dados da conta. Manter cache local apenas para o funcionamento do aparelho; não tratá-lo como fonte de verdade quando o servidor estiver disponível. Se o servidor não confirmar a revogação, limpar o cookie local e informar que a revogação da sessão não foi confirmada, sem exibir sucesso.

## Autenticação, segurança e dados

- Implementar o fluxo oficial Manus OAuth no servidor: `state` e `nonce` de uso único, troca de código server-side, validação do usuário e redirecionamento apenas para uma rota interna fixa.
- Usar o cookie `webdev_app_session` com `HttpOnly`, `Secure` e `SameSite=None` para compatibilidade com o Preview HTTPS embutido. Validar no servidor as sessões da aplicação e a sessão JWT de Preview de acordo com o contrato da plataforma; logout invalida a sessão e avisa se a revogação não puder ser confirmada.
- Criar migrações SQL idempotentes e não destrutivas para usuários/sessões e um snapshot financeiro versionado por usuário, contendo todos os tipos de dados atuais. Conectar ao MySQL somente em runtime por `DATABASE_URL`; não expor credenciais nem conteúdo financeiro em logs.
- Validar e limitar no servidor o formato e o tamanho dos snapshots. Usar revisão/controle de concorrência para detectar gravações simultâneas, preservando uma cópia local pendente e exibindo orientação em caso de conflito.
- A ativação de servidor e banco é permanente no projeto; o banco de desenvolvimento e publicação é compartilhado. Essa infraestrutura só será alterada após a aprovação deste plano e a confirmação já dada para armazenamento em nuvem.

## Aplicação, publicação e PWA

- Converter o Next.js de exportação estática para aplicação servida por container, mantendo o App Router e a porta de runtime existente. Adicionar endpoints de OAuth, sessão, sincronização e uma rota de health não autenticada.
- Remover a declaração de build e as rotas que dependem de saída estática somente quando o deploy de servidor estiver preparado; adicionar Dockerfile que instala pelo lockfile, compila e inicia o Next.js em produção.
- Preservar manifesto, ícones, instalação e uso offline do PWA. Atualizar o service worker para cachear somente shell/recursos públicos e nunca cachear `/api`, OAuth, sessão ou respostas com dados financeiros. As alterações offline ficam apenas no cache local da conta com indicação de pendência; ao reconectar, usar o controle de revisão e pedir uma escolha explícita se outro dispositivo tiver alterado os mesmos dados.
- Manter os dados da conta em uma linha/snapshot separado por usuário, com revisão e data de atualização; a aplicação controla sessões e acessos no backend. A visibilidade Pública do domínio foi mantida por escolha do usuário; isso não altera a exigência de autenticação nem expõe snapshots financeiros.

## Estrutura principal prevista

- `app/page.tsx`, `app/auth-shell.tsx`, `app/dashboard.tsx`, `app/credit-cards.tsx`, `app/sync-conflict-dialog.tsx`: gate de sessão, painel autenticado, estados da conta e escolhas explícitas de versão.
- `app/api/auth/login/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/session/route.ts`, `app/api/auth/logout/route.ts`: início e retorno do OAuth, sessão e logout.
- `app/api/finance/route.ts` e `app/api/health/route.ts`: leitura/gravação autenticada do snapshot e prontidão pública do container.
- `lib/auth.ts`, `lib/db.ts`, `lib/finance-snapshot.ts`, `lib/use-finance-sync.ts`: validação OAuth/sessão, acesso MySQL, snapshot/cache offline por conta e controle de revisão.
- `migrations/`, `scripts/migrate-db.mjs`: histórico versionado de schema e executor idempotente de migrações não destrutivas.
- `Dockerfile`, `next.config.js`, `package.json`: runtime Next.js servidor e dependências necessárias, incluindo driver MySQL.
- `scripts/generate-pwa-service-worker.mjs`, `public/`: service worker e fallback offline compatíveis com os recursos compilados do servidor.

## Atualização de segurança aprovada

A auditoria da árvore de produção reportou uma vulnerabilidade crítica no Next.js 14.2.35 e três vulnerabilidades altas em dependências de produção. A correção indicada para o framework é Next.js 16.4.6. Foi aprovada a migração para essa versão e dependências compatíveis antes de publicar autenticação ou dados financeiros.

O guia oficial do Next.js 16 indica Node.js 20.9 ou superior; o ambiente atual usa Node.js 22.23.4. A atualização também torna Turbopack o padrão de build e remove `next lint`; revisar configurações, tipos e scripts do app ao atualizar. Usar React 19 e os tipos correspondentes, depois executar os checks existentes e reavaliar a auditoria sem aplicar correções major automaticamente. ([guia de upgrade do Next.js 16](https://nextjs.org/docs/app/guides/upgrading/version-16), [guia de lint](https://nextjs.org/docs/app/api-reference/config/eslint), [upgrade do React 19](https://react.dev/blog/2024/04/25/react-19-upgrade-guide), [notas do Next.js 16.4](https://nextjs.org/blog/next-16-4))

## Design

- **Movimento:** fintech editorial calma, reaproveitando o design já entregue do Finora.
- **Princípios:** privacidade visível, linguagem simples, sincronização previsível e nenhuma mudança silenciosa de dados.
- **Cores e layout:** manter verde profundo de marca, superfícies claras e dashboard móvel já existente; integrar login e estados de sincronização nos componentes atuais, sem redesenho amplo.
- **Fontes consultadas:** guia oficial de upgrade do Next.js 16, documentação oficial do ESLint no Next.js, guia oficial do React 19 e notas oficiais do Next.js 16.4, ligados acima.
- **Elementos e interação:** preservar cartões arredondados e o painel verde de saldo; dar feedback textual claro a cada estado de sessão/sync, com animação discreta apenas para carregamento.
- **Tipografia e marca:** reutilizar as fontes, logotipo, ícones e microcopy atuais em português do Brasil.
- **Voz:** objetiva e tranquilizadora; exemplos: “Entre com sua conta Manus para acessar suas finanças.” e “Sincronizado — seus dados estão atualizados neste dispositivo.”
