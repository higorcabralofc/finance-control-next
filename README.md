# Finance Control 💚

Dashboard de finanças pessoais premium com Next.js 14, React, TypeScript e Tailwind CSS.

## Tecnologias

- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Recharts** — gráficos interativos
- **Lucide React** — ícones
- **Framer Motion** — animações

## Como rodar

### 1. Pré-requisito: instalar Node.js

Acesse [nodejs.org](https://nodejs.org) e instale a versão **LTS**.

Confirme a instalação:
```bash
node -v
npm -v
```

### 2. Instalar as dependências

Na pasta do projeto:
```bash
npm install
```

### 3. Rodar em modo desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

### 4. Build para produção

```bash
npm run build
npm start
```

---

## Estrutura do projeto

```
finance-control/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← Layout com sidebar
│   │   ├── page.tsx            ← Dashboard principal
│   │   ├── receitas/page.tsx
│   │   ├── despesas/page.tsx
│   │   ├── cartoes/page.tsx
│   │   ├── metas/page.tsx
│   │   ├── investimentos/page.tsx
│   │   ├── relatorios/page.tsx
│   │   └── configuracoes/page.tsx
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── ui/
│   │   ├── KpiCard.tsx
│   │   ├── ChartCard.tsx
│   │   ├── Badge.tsx
│   │   └── ProgressBar.tsx
│   └── charts/
│       ├── RevenueChart.tsx
│       ├── CategoryPieChart.tsx
│       ├── PatrimonioChart.tsx
│       ├── ReceitaAreaChart.tsx
│       └── CustomTooltip.tsx
├── lib/
│   └── data.ts                 ← Dados mockados + helpers
├── types/
│   └── index.ts                ← Tipos TypeScript
└── README.md
```

## Páginas disponíveis

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard principal com KPIs, gráficos e alertas |
| `/receitas` | Gestão de receitas com histórico e formulário |
| `/despesas` | Controle de gastos por categoria |
| `/cartoes` | Cartões de crédito com limite e fatura |
| `/metas` | Metas financeiras com progresso |
| `/investimentos` | Carteira de investimentos e patrimônio |
| `/relatorios` | Relatórios comparativos mensais/anuais |
| `/configuracoes` | Perfil, preferências e segurança |
