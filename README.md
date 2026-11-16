# Finora — suas finanças em perspectiva

Dashboard de finanças pessoais em português do Brasil, construído com Next.js 16.4.6, React 19, TypeScript e Tailwind CSS. O site permanece público: qualquer pessoa pode abrir a tela de login, mas os dados financeiros só são acessíveis após autenticação Manus; a interface responsiva e a identidade visual existente foram preservadas.

## Recursos e dados

O Finora permite registrar receitas e despesas, separar categorias por tipo, acompanhar dívidas parceladas, metas financeiras, cartões, compras e faturas. Dívidas parceladas e faturas de cartão em aberto não reduzem o saldo total no cadastro; o saldo diminui quando a parcela ou a fatura é registrada como paga, uma única vez.

O acesso é feito com uma conta Manus. Depois do login, transações, categorias, dívidas, metas, cartões, compras, pagamentos e datas personalizadas ficam vinculados à conta e podem ser acessados em outros dispositivos. Cada leitura ou gravação compara a chave pseudônima do cache local com a identidade da sessão validada no servidor; se a conta ativa mudar, nenhum snapshot é lido ou enviado para outra conta. No primeiro acesso a partir do navegador que contém dados locais, se ainda não houver uma versão na nuvem e não houver indicação de que a cópia pertence a outra conta, o Finora importa os dados e só atualiza a cópia local depois da confirmação do servidor. Se já houver dados na nuvem ou uma marca de outra conta, o app preserva ambas as cópias e pede uma escolha antes de substituir ou importar.

Após um login bem-sucedido em um dispositivo, uma cópia separada por conta permite consultar e alterar os dados offline. Alterações feitas sem conexão aparecem como pendentes e são sincronizadas ao voltar a ficar online, somente após validar novamente que a conta ativa é a mesma. Se a sessão expirar ou uma conta diferente estiver ativa, os dados ficam no dispositivo e não são enviados; a sincronização exige reentrar com a conta correta. Se a nuvem e o dispositivo tiverem sido alterados ao mesmo tempo, o Finora pausa a sincronização e exige uma escolha explícita. O service worker mantém o shell e recursos estáticos da PWA, mas não armazena em cache endpoints de autenticação, APIs ou respostas financeiras.

Os dados são sincronizados apenas com a conta autenticada do Finora; o aplicativo não importa movimentações diretamente de bancos ou instituições financeiras. Não informe número completo de cartão, validade ou código de segurança. O app não precisa desses dados sensíveis.

## Tecnologias

- **Next.js 16.4.6** com App Router e saída standalone
- **React 19** e **TypeScript**
- **Tailwind CSS**
- **MySQL gerenciado** para sessão e snapshots financeiros isolados por conta
- **mysql2** para acesso server-side ao banco
- **Lucide React** para ícones
- **Service worker** para instalação PWA e shell offline sem cache de dados privados

## Desenvolvimento

Pré-requisitos: Node.js `22.23.4` e npm `10.9.9`.

```bash
npm ci
npm run db:migrate
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O ambiente local precisa das variáveis de OAuth Manus e de conexão ao MySQL fornecidas pelo ambiente autorizado; não grave credenciais em arquivos commitados.

`npm run db:migrate` aplica a migração versionada `001_finora_auth_and_finance.sql` de forma idempotente, criando as tabelas de usuários, sessões e snapshots quando ainda não existem. O banco gerenciado é compartilhado entre desenvolvimento, testes e produção: migrações e alterações nele persistem e afetam o ambiente publicado. A migração não apaga nem reseta dados.

Verificações disponíveis:

```bash
npm run lint
npm run typecheck
npm run build
```

`next dev` usa `.next-dev/`, separado de `.next/` usado pelo build de produção. Assim, rodar um build enquanto a prévia está aberta não apaga os arquivos CSS e módulos servidos por ela. O build produz uma aplicação Next.js standalone; o `Dockerfile` a executa em container na porta `3000` (ou na porta definida por `PORT`). `GET /api/health` verifica a conexão ao banco e não retorna informações de sessão.

O projeto usa o OAuth Manus para autenticação, cookies de sessão validados no servidor e `DATABASE_URL`/segredos apenas em runtime. O logout avisa quando o servidor não confirma a revogação da sessão. Nunca inclua variáveis privadas em código de navegador, builds ou commits. O service worker é gerado depois do build por `scripts/generate-pwa-service-worker.mjs`.

## Instalar o Finora

Em navegadores compatíveis, use **Instalar app** no menu do navegador. No iPhone ou iPad, abra no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. Entre pelo menos uma vez naquele aparelho para habilitar a cópia offline por conta. O app pode então abrir o shell sem conexão; alterações feitas offline permanecem pendentes até a sincronização ser confirmada.

## Interface

A rota `/` apresenta o dashboard Finora, com resumo do saldo, fluxo mensal, transações, despesas por categoria, dívidas, cartões e objetivos. A interface adapta-se a desktop e celular. A conta autenticada aparece no cabeçalho junto do estado de sincronização e da ação de sair.

Na seção **Categorias**, é possível criar e excluir categorias de receitas e despesas separadamente. Receitas e despesas podem ser excluídas individualmente pela lista de transações. Na seção **Dívidas parceladas**, é possível cadastrar valor, categoria, quantidade de parcelas e vencimentos mensais; a quantidade inicia vazia, e a prévia dos vencimentos aparece após informar um número inteiro de 1 a 60. Cada data pode ser editada antes ou depois de salvar. Na seção **Cartões**, é possível cadastrar cartões e limites, lançar compras à vista ou parceladas, consultar faturas por ciclo e registrar pagamentos. O dia de vencimento e as datas individuais das faturas abertas podem ser ajustados. O limite disponível considera as parcelas de faturas ainda abertas; o saldo total só é reduzido quando a fatura é paga e lançada como despesa. Na seção **Objetivos financeiros**, é possível criar metas e adicionar aportes; aportes atualizam o objetivo, mas não são lançados como receita.

## Estrutura principal

```text
app/
├── api/
│   ├── auth/                 # Início, callback, sessão e logout Manus
│   ├── finance/              # Leitura e gravação autenticadas do snapshot
│   └── health/               # Health check público do container
├── auth-shell.tsx            # Gate de login, importação local e escolha de conflitos
├── dashboard.tsx             # Dashboard e estados financeiros
├── credit-cards.tsx          # Cartões, compras e faturas
├── pwa-register.tsx          # Registro e atualização do service worker
└── page.tsx                  # Rota inicial protegida pelo gate de sessão
lib/
├── auth.ts                   # Sessões, OAuth e identidade Manus
├── db.ts                     # Pool MySQL server-only
├── finance-snapshot.ts       # Schema, validação e cache local isolado
└── use-finance-sync.ts       # Sync online/offline e conflitos entre dispositivos
migrations/
└── 001_finora_auth_and_finance.sql
scripts/
├── generate-pwa-service-worker.mjs
└── migrate-db.mjs
Dockerfile                    # Build e runtime standalone
public/
├── manifest.webmanifest
├── finora-icon-*.png
├── manus-routes.json
└── sw.js                      # Gerado durante o build
```
