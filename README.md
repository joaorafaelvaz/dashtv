# Dashboard TV — Barbearia VIP Franqueadora

Painel em tempo real para TV 50" portrait (9:16) exibido na sede da franqueadora **Barbearia VIP**. Consolida métricas de todas as unidades da rede a partir do banco de produção, com atualização automática a cada 5 minutos.

![Next.js](https://img.shields.io/badge/Next.js-14.1.4-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![MySQL](https://img.shields.io/badge/MySQL2-3.9-4479A1?logo=mysql)
![Jest](https://img.shields.io/badge/Tests-21%20passing-green?logo=jest)

---

## Funcionalidades

| Métrica | Descrição |
|---|---|
| 💰 Faturamento Hoje | Soma de vendas finalizadas no dia (todas as unidades) |
| 📅 Agendamentos | Total de agendamentos não cancelados para hoje |
| 🔓 Slots Livres | Vagas abertas calculadas pela grade de horários dos barbeiros |
| ✂️ Em Atendimento | Clientes com check-in aberto e sem checkout |
| ✅ Serviços Realizados | Atendimentos concluídos (checkout efetuado) |
| 🎯 Fat. Projetado | Faturamento atual + valor dos agendamentos pendentes |
| 📊 Média 3 Meses | Média do mesmo dia da semana nos últimos 3 meses |
| 🏆 Top 5 / 📉 Bottom 5 | Ranking das unidades por faturamento do dia |

---

## Layout da TV

Canvas fixo **1080 × 1920 px** (portrait 9:16) escalado via CSS `transform: scale()` para qualquer resolução de tela, sem scroll.

```
┌─────────────────────────────┐
│   BARBEARIA VIP  •  10:30   │  ← Header + relógio ao vivo
├─────────────────────────────┤
│                             │
│    R$ 142.350,00  ▲ 12.3%   │  ← Faturamento Hero
│    Média: R$ 126.890,00     │
├──────────┬──────────────────┤
│  📅 247  │  🔓 83           │  ← KPI Grid 2×2
│  ✂️  18  │  ✅ 229          │
├──────────┴──────────────────┤
│  🎯 R$ 148k  │  📊 R$ 126k  │  ← Projeção + Média
├─────────────────────────────┤
│  🏆 Top 5 Unidades          │
│  📉 Bottom 5 Unidades       │  ← Ranking com barras
├─────────────────────────────┤
│  ⟳ Atualizado há 2 min  🟢  │  ← Status Bar
└─────────────────────────────┘
```

---

## Tecnologias

- **[Next.js 14](https://nextjs.org/)** — App Router, Server Components, API Routes
- **[TypeScript 5](https://www.typescriptlang.org/)** — Tipagem completa, sem `any`
- **[Tailwind CSS 3](https://tailwindcss.com/)** — Tema Dark VIP Gold customizado
- **[mysql2](https://github.com/sidorares/node-mysql2)** — Pool de conexões com `RowDataPacket` tipado
- **[Jest + ts-jest](https://jestjs.io/)** — 21 testes unitários nas funções puras

---

## Estrutura do Projeto

```
src/
├── app/
│   ├── api/dashboard/route.ts   # GET /api/dashboard (force-dynamic)
│   ├── globals.css              # Tema Dark VIP
│   ├── layout.tsx               # Root layout (Inter + pt-BR)
│   └── page.tsx                 # Canvas TV + auto-refresh 5min
├── components/
│   ├── DashboardHeader.tsx      # Logo + relógio ao vivo (1s tick)
│   ├── FaturamentoHero.tsx      # Faturamento do dia em destaque
│   ├── KpiCard.tsx              # Card unitário de KPI
│   ├── KpiGrid.tsx              # Grade 2×2 dos 4 KPIs
│   ├── ProjecaoGrid.tsx         # Faturamento projetado + média
│   ├── RankingSection.tsx       # Top 5 (verde) + Bottom 5 (vermelho)
│   └── StatusBar.tsx            # Tempo desde última atualização
└── lib/
    ├── db/
    │   ├── mysql.ts             # Pool MySQL2 (singleton)
    │   └── queries.ts           # 8 queries SQL paralelas
    ├── types/
    │   └── dashboard.ts         # Interfaces TypeScript do domínio
    └── utils/
        ├── dashboard.ts         # Funções puras (slots, variação, etc.)
        ├── format.ts            # formatCurrency, formatNumber (pt-BR)
        └── __tests__/
            └── dashboard.test.ts  # 21 testes unitários
```

---

## Configuração e Deploy

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd dashtv
npm install
```

### 2. Configurar variáveis de ambiente

Criar o arquivo `.env.local` na raiz do projeto:

```env
DB_HOST=barbeariavip.cloud
DB_USER=SEU_USUARIO_MYSQL
DB_PASSWORD=SUA_SENHA_MYSQL
DB_NAME=franquia_producao
DB_PORT=3306
```

### 3. Rodar em desenvolvimento

```bash
npm run dev   # http://localhost:3031
```

### 4. Build e produção

```bash
npm run build
npm start     # http://localhost:3031
```

### 5. Deploy na TV (modo kiosk)

```bash
# Instalar PM2 globalmente (se não tiver)
npm install -g pm2

# Build e start com PM2
npm run build
pm2 start npm --name "dashtv" -- start
pm2 save
pm2 startup

# Abrir Chrome em modo kiosk
chrome --kiosk http://localhost:3031
```

> **Importante:** A TV deve estar configurada em orientação **portrait (vertical)** no sistema operacional antes de abrir o browser.

---

## Testes

```bash
npm test            # Rodar uma vez
npm run test:watch  # Modo watch
```

21 testes unitários cobrindo:
- `getDayColumn` — mapeamento dos 7 dias da semana + guard de Date inválido
- `calcularVariacaoPct` — variação percentual, divisão por zero
- `timeToMinutes` — conversão HH:MM:SS → minutos (incluindo segundos)
- `calcularSlotsLivres` — cálculo de vagas com almoço, múltiplos barbeiros, edge cases

---

## Pontos a Confirmar no Banco de Produção

Antes do primeiro deploy, verificar os valores de status nas tabelas:

```sql
-- Status válido de vendas (padrão usado: 1)
SELECT DISTINCT status, COUNT(*) FROM vendas GROUP BY status;

-- Status de cancelamento de agendas (padrão usado: 3, 4)
SELECT DISTINCT status, COUNT(*) FROM agendas GROUP BY status;

-- Tipo da unidade franqueadora (padrão usado: 'FRANQUEADORA')
SELECT DISTINCT tipo FROM unidades;
```

Ajustar as constantes em `src/lib/db/queries.ts` se necessário:

```typescript
const VENDAS_STATUS_VALIDA = 1          // ← confirmar
const AGENDAS_STATUS_CANCELADO = [3, 4] // ← confirmar
// ... WHERE un.tipo != 'FRANQUEADORA'   // ← confirmar
```

---

## Tema de Cores

| Token | Valor | Uso |
|---|---|---|
| `gold` / `#D4AF37` | Dourado clássico | Bordas, separadores |
| `gold-bright` / `#FFD700` | Dourado vivo | Títulos, valores principais |
| `gold-dark` / `#B8860B` | Dourado escuro | Hover states |
| `canvas` / `#0A0A0A` | Preto profundo | Background principal |
| `card` / `#141414` | Cinza muito escuro | Cards e seções |

---

## Licença

Uso interno — Barbearia VIP Franqueadora.
