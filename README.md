# Finora — Finance Control

Dashboard de finanças pessoais construído com Next.js 14, React, TypeScript e Tailwind CSS.

## Tecnologias

- **Next.js 14** com App Router
- **React 18** e **TypeScript**
- **Tailwind CSS**
- **Recharts** — gráficos (dependência disponível no projeto)
- **Lucide React** — ícones
- **Framer Motion** — animações (dependência disponível no projeto)

## Rodar localmente

Pré-requisitos: Node.js LTS e npm.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Para gerar e iniciar a versão de produção:

```bash
npm run build
npm start
```

## Interface atual

A rota `/` apresenta o dashboard Finora, com resumo do saldo, indicadores, fluxo mensal, transações recentes, despesas por categoria, cartões e objetivos. A interface se adapta a desktop e celular. O dashboard inicia com valores zerados e sem movimentações financeiras de exemplo. O saldo total desconta as despesas não vinculadas a dívidas e as parcelas ainda em aberto. Ao usar **Registrar pagamento**, a parcela fica no histórico como despesa e sai do total em aberto; o cálculo do saldo não desconta esse pagamento uma segunda vez.

Na seção **Categorias**, é possível criar e excluir categorias de receitas e de despesas separadamente. Receitas e despesas podem ser excluídas individualmente pela lista de transações. Na seção **Dívidas parceladas**, é possível cadastrar o valor, a categoria, o número de parcelas e os vencimentos mensais; cada data pode ser editada antes ou depois de salvar. Na seção **Cartões**, é possível cadastrar cartões, limites e dias de fechamento/vencimento, lançar compras à vista ou parceladas, consultar as faturas geradas por ciclo e registrar seu pagamento. O vencimento previsto de cada fatura aberta pode ser ajustado com uma data específica; esse ajuste vale apenas para aquele ciclo, enquanto o dia padrão do cartão continua valendo para novas faturas. O limite disponível considera as parcelas de todas as faturas ainda abertas. Faturas abertas também são descontadas do saldo total; registrar o pagamento cria uma despesa vinculada, libera o limite e evita dupla contagem no saldo. Somente os quatro últimos dígitos são opcionais; números completos, validade e código de segurança não devem ser informados. Na seção **Objetivos financeiros**, é possível criar metas e adicionar aportes para acompanhar seu progresso; aportes atualizam o objetivo e não são lançados como receita.

Categorias, transações, dívidas, cartões, compras/faturas e objetivos ficam salvos no armazenamento local do navegador em uso e são restaurados ao recarregar a página. Esses dados não são enviados a um servidor, sincronizados entre dispositivos ou incluídos em backup; limpar os dados do navegador pode apagá-los.

Os valores iniciais são zero e não há conexão com banco ou instituição financeira. Filtros, ocultação de valores, exportação CSV e o formulário de nova transação funcionam no navegador. Não use a versão atual como único local para registrar ou guardar dados financeiros importantes.

## Estrutura

```text
app/
├── dashboard.tsx       # Interface e interações do dashboard
├── globals.css         # Tokens visuais e estilos responsivos
├── layout.tsx          # Layout raiz e metadados
└── page.tsx            # Rota inicial
public/
└── manus-routes.json   # Manifesto da rota disponível
```
