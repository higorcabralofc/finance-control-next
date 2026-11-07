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

A rota `/` apresenta o dashboard Finora, com resumo do saldo, indicadores, fluxo mensal, transações recentes, orçamento por categoria e progresso de uma meta. A interface se adapta a desktop e celular.

Os valores são **dados demonstrativos**, sem conexão com banco ou instituição financeira. Filtros, ocultação de valores, exportação CSV e o formulário de nova transação funcionam no navegador, mas os dados adicionados existem apenas na sessão atual e são redefinidos ao recarregar a página. Não use a versão atual para registrar ou armazenar dados financeiros reais.

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
