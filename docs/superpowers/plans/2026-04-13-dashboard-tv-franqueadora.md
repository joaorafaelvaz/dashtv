# Dashboard TV — Franqueadora Barbearia VIP — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um dashboard Next.js para TV 50" portrait (9:16) exibindo em tempo real métricas consolidadas de todas as unidades da rede Barbearia VIP, com atualização automática a cada 5 minutos.

**Architecture:** Next.js 14 App Router com uma única API route (`/api/dashboard`) que executa todas as queries em paralelo no banco de produção `franquia_producao`. O frontend é um Client Component com canvas fixo em 1080×1920px, escalado via CSS transform para a resolução real da TV. Sem autenticação — display público interno.

**Tech Stack:** Next.js 14.1.4, TypeScript 5, Tailwind CSS 3.4.1, mysql2 3.9.2, Jest + ts-jest (testes de utilidades), Google Fonts (Inter).

---

## ⚠️ Pontos a Confirmar Antes/Durante Implementação

Antes de fazer deploy, verificar no banco de produção:

```sql
-- Valores válidos de vendas.status
SELECT DISTINCT status, COUNT(*) FROM vendas GROUP BY status;

-- Valores válidos de agendas.status (identificar cancelados)
SELECT DISTINCT status, COUNT(*) FROM agendas GROUP BY status;

-- Tipo das unidades (confirmar valor para excluir franqueadora)
SELECT DISTINCT tipo FROM unidades;
```

O plano usa: `vendas.status = 1` (válida), `agendas.status NOT IN (3, 4)` (cancelados), `unidades.tipo != 'FRANQUEADORA'`. Ajustar constantes em `src/lib/db/queries.ts` conforme necessário.

---

## File Map

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/types/dashboard.ts` | Interfaces TypeScript do domínio |
| `src/lib/db/mysql.ts` | Pool de conexão MySQL2 (singleton) |
| `src/lib/db/queries.ts` | Todas as queries SQL do dashboard |
| `src/lib/utils/dashboard.ts` | Funções puras: cálculo de slots, variação %, dia da semana |
| `src/lib/utils/format.ts` | Formatação de moeda e números |
| `src/lib/utils/__tests__/dashboard.test.ts` | Testes unitários das funções puras |
| `src/app/api/dashboard/route.ts` | GET /api/dashboard — orquestra queries e retorna JSON |
| `src/app/globals.css` | Tema Dark VIP (background, reset, overflow hidden) |
| `src/app/layout.tsx` | Root layout sem auth, sem navegação |
| `src/app/page.tsx` | Canvas TV + auto-refresh + composição dos componentes |
| `src/components/DashboardHeader.tsx` | Logo, título, relógio em tempo real (atualiza a cada 1s) |
| `src/components/FaturamentoHero.tsx` | Faturamento hoje em destaque + variação vs média |
| `src/components/KpiCard.tsx` | Card unitário de KPI (ícone + label + valor grande) |
| `src/components/KpiGrid.tsx` | Grade 2×2 dos 4 KPIs |
| `src/components/ProjecaoGrid.tsx` | Faturamento projetado + média 3 meses |
| `src/components/RankingSection.tsx` | Top 5 (verde) + Bottom 5 (vermelho) com barras |
| `src/components/StatusBar.tsx` | "Atualizado há X min" + indicador ao vivo |

---

## Chunk 1: Bootstrap + Camada de Dados

### Task 1: Bootstrap do Projeto Next.js

**Files:**
- Create: todo o projeto em `D:/Dev/joao/dashboardvip/dashtv/`

- [ ] **Step 1.1: Inicializar o projeto**

```bash
cd "D:/Dev/joao/dashboardvip"
# O diretório dashtv já existe e está vazio — usar ponto não funciona; mover depois
npx create-next-app@14.1.4 dashtv-init --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
# Copiar conteúdo para dashtv:
cp -r dashtv-init/. dashtv/
rm -rf dashtv-init
```

- [ ] **Step 1.2: Verificar estrutura gerada**

```bash
ls "D:/Dev/joao/dashboardvip/dashtv/src/app"
```
Esperado: `favicon.ico  globals.css  layout.tsx  page.tsx`

- [ ] **Step 1.3: Criar pastas de componentes e lib**

```bash
mkdir -p "D:/Dev/joao/dashboardvip/dashtv/src/components"
mkdir -p "D:/Dev/joao/dashboardvip/dashtv/src/lib/db"
mkdir -p "D:/Dev/joao/dashboardvip/dashtv/src/lib/types"
mkdir -p "D:/Dev/joao/dashboardvip/dashtv/src/lib/utils/__tests__"
mkdir -p "D:/Dev/joao/dashboardvip/dashtv/src/app/api/dashboard"
```

- [ ] **Step 1.4: Instalar dependências adicionais**

```bash
cd "D:/Dev/joao/dashboardvip/dashtv"
npm install mysql2@^3.9.2
npm install --save-dev jest @types/jest ts-jest
```

- [ ] **Step 1.5: Criar .env.local**

Criar o arquivo `D:/Dev/joao/dashboardvip/dashtv/.env.local`:
```env
DB_HOST=barbeariavip.cloud
DB_USER=PREENCHER
DB_PASSWORD=PREENCHER
DB_NAME=franquia_producao
DB_PORT=3306
```

- [ ] **Step 1.6: Configurar Jest**

Criar `D:/Dev/joao/dashboardvip/dashtv/jest.config.js`:
```js
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
})
```

Adicionar ao `package.json` (dentro de `"scripts"`):
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 1.7: Confirmar que testes rodam (sem testes ainda)**

```bash
cd "D:/Dev/joao/dashboardvip/dashtv"
npm test -- --passWithNoTests
```
Esperado: `Test Suites: 0 passed`

- [ ] **Step 1.8: Commit**

```bash
git init
git add .
git commit -m "feat: bootstrap Next.js 14 project for TV dashboard"
```

---

### Task 2: TypeScript Interfaces

**Files:**
- Create: `src/lib/types/dashboard.ts`

- [ ] **Step 2.1: Escrever as interfaces**

Criar `src/lib/types/dashboard.ts`:
```typescript
export interface BarberSchedule {
  id: number
  tempo_atendimento: number // minutos por atendimento
  abertura: string | null   // ex: "09:00:00"
  fechamento: string | null // ex: "18:00:00"
  almoco_inicio: string | null
  almoco_fim: string | null
}

export interface RankingUnidade {
  id: number
  nome: string | null
  cidade: string
  bairro: string
  faturamento_dia: number
}

export interface DashboardData {
  faturamento_hoje: number
  agendamentos_dia: number
  slots_livres: number
  em_atendimento: number
  servicos_realizados: number
  faturamento_projetado: number
  media_3meses: number
  variacao_media_pct: number   // % de variação vs média 3 meses
  ranking: RankingUnidade[]    // todas as unidades, ordem DESC por faturamento_dia
  ultima_atualizacao: string   // ISO timestamp
}
```

- [ ] **Step 2.2: Verificar compilação TypeScript**

```bash
cd "D:/Dev/joao/dashboardvip/dashtv"
npx tsc --noEmit
```
Esperado: nenhum erro.

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/types/dashboard.ts
git commit -m "feat: add TypeScript interfaces for dashboard domain"
```

---

### Task 3: Pool de Conexão MySQL

**Files:**
- Create: `src/lib/db/mysql.ts`

- [ ] **Step 3.1: Escrever o pool de conexão**

Criar `src/lib/db/mysql.ts`:
```typescript
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
})

export default pool
```

- [ ] **Step 3.2: Verificar compilação**

```bash
npx tsc --noEmit
```
Esperado: nenhum erro.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/db/mysql.ts
git commit -m "feat: add MySQL2 connection pool"
```

---

### Task 4: Funções Utilitárias + Testes

**Files:**
- Create: `src/lib/utils/dashboard.ts`
- Create: `src/lib/utils/format.ts`
- Create: `src/lib/utils/__tests__/dashboard.test.ts`

- [ ] **Step 4.1: Escrever os testes primeiro (TDD)**

Criar `src/lib/utils/__tests__/dashboard.test.ts`:
```typescript
import {
  getDayColumn,
  calcularVariacaoPct,
  timeToMinutes,
  calcularSlotsLivres,
} from '../dashboard'
import type { BarberSchedule } from '@/lib/types/dashboard'

describe('getDayColumn', () => {
  it('retorna faturamento_segunda para segunda-feira', () => {
    // 2026-04-13 é segunda-feira
    expect(getDayColumn(new Date('2026-04-13T12:00:00'))).toBe('faturamento_segunda')
  })

  it('retorna faturamento_domingo para domingo', () => {
    // 2026-04-12 é domingo
    expect(getDayColumn(new Date('2026-04-12T12:00:00'))).toBe('faturamento_domingo')
  })

  it('retorna faturamento_sabado para sábado', () => {
    // 2026-04-11 é sábado
    expect(getDayColumn(new Date('2026-04-11T12:00:00'))).toBe('faturamento_sabado')
  })

  it('mapeia todos os 7 dias corretamente', () => {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
    // getDay(): 0=Dom, 1=Seg, ..., 6=Sáb
    const base = new Date('2026-04-12T12:00:00') // domingo
    dias.forEach((dia, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      expect(getDayColumn(d)).toBe(`faturamento_${dia}`)
    })
  })
})

describe('calcularVariacaoPct', () => {
  it('retorna 0 quando referência é 0 (evita divisão por zero)', () => {
    expect(calcularVariacaoPct(1000, 0)).toBe(0)
  })

  it('retorna 100 quando atual é o dobro da referência', () => {
    expect(calcularVariacaoPct(200, 100)).toBe(100)
  })

  it('retorna -50 quando atual é metade da referência', () => {
    expect(calcularVariacaoPct(50, 100)).toBe(-50)
  })

  it('retorna 0 quando atual === referência', () => {
    expect(calcularVariacaoPct(100, 100)).toBe(0)
  })
})

describe('timeToMinutes', () => {
  it('converte 09:00:00 em 540 minutos', () => {
    expect(timeToMinutes('09:00:00')).toBe(540)
  })

  it('converte 18:30:00 em 1110 minutos', () => {
    expect(timeToMinutes('18:30:00')).toBe(1110)
  })

  it('converte 00:00:00 em 0', () => {
    expect(timeToMinutes('00:00:00')).toBe(0)
  })
})

describe('calcularSlotsLivres', () => {
  const barbeiro: BarberSchedule = {
    id: 1,
    tempo_atendimento: 30,
    abertura: '09:00:00',    // 540 min
    fechamento: '18:00:00',  // 1080 min → 540 min disponíveis → 18 slots
    almoco_inicio: null,
    almoco_fim: null,
  }

  it('calcula 18 slots para 9h de trabalho com atendimento de 30min', () => {
    expect(calcularSlotsLivres([barbeiro], 0)).toBe(18)
  })

  it('subtrai os slots já ocupados', () => {
    expect(calcularSlotsLivres([barbeiro], 5)).toBe(13)
  })

  it('desconta intervalo de almoço de 1h (16 slots)', () => {
    const comAlmoco: BarberSchedule = {
      ...barbeiro,
      almoco_inicio: '12:00:00',
      almoco_fim: '13:00:00',
    }
    // 9h - 1h almoço = 8h = 480 min / 30 = 16 slots
    expect(calcularSlotsLivres([comAlmoco], 0)).toBe(16)
  })

  it('soma slots de múltiplos barbeiros', () => {
    expect(calcularSlotsLivres([barbeiro, barbeiro], 0)).toBe(36)
  })

  it('nunca retorna valor negativo', () => {
    expect(calcularSlotsLivres([barbeiro], 100)).toBe(0)
  })

  it('ignora barbeiros sem horário definido', () => {
    const semHorario: BarberSchedule = {
      ...barbeiro,
      abertura: null,
      fechamento: null,
    }
    expect(calcularSlotsLivres([semHorario], 0)).toBe(0)
  })

  it('ignora barbeiros com tempo_atendimento zero', () => {
    const semTempo: BarberSchedule = { ...barbeiro, tempo_atendimento: 0 }
    expect(calcularSlotsLivres([semTempo], 0)).toBe(0)
  })

  it('retorna 0 para lista vazia de barbeiros', () => {
    expect(calcularSlotsLivres([], 0)).toBe(0)
  })
})
```

- [ ] **Step 4.2: Rodar os testes — confirmar que falham**

```bash
npm test
```
Esperado: FAIL — `Cannot find module '../dashboard'`

- [ ] **Step 4.3: Implementar as funções utilitárias**

Criar `src/lib/utils/dashboard.ts`:
```typescript
import type { BarberSchedule } from '@/lib/types/dashboard'

/**
 * Mapeia um Date para o nome da coluna correspondente em dashboard_movimentos.
 * getDay(): 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
 */
export function getDayColumn(date: Date): string {
  const columns = [
    'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado',
  ]
  return `faturamento_${columns[date.getDay()]}`
}

/**
 * Calcula variação percentual entre o valor atual e a referência.
 * Retorna 0 se referência for 0 para evitar divisão por zero.
 */
export function calcularVariacaoPct(atual: number, referencia: number): number {
  if (referencia === 0) return 0
  return ((atual - referencia) / referencia) * 100
}

/**
 * Converte string "HH:MM:SS" em total de minutos desde meia-noite.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Calcula slots livres de agendamento para hoje.
 * @param barbers - Agenda dos barbeiros para o dia atual (vinda do banco)
 * @param slotsOcupados - Número de agendamentos já marcados hoje
 */
export function calcularSlotsLivres(
  barbers: BarberSchedule[],
  slotsOcupados: number,
): number {
  let totalSlots = 0

  for (const b of barbers) {
    if (!b.abertura || !b.fechamento || !b.tempo_atendimento) continue

    let minutosDisponiveis =
      timeToMinutes(b.fechamento) - timeToMinutes(b.abertura)

    if (b.almoco_inicio && b.almoco_fim) {
      minutosDisponiveis -=
        timeToMinutes(b.almoco_fim) - timeToMinutes(b.almoco_inicio)
    }

    if (minutosDisponiveis > 0 && b.tempo_atendimento > 0) {
      totalSlots += Math.floor(minutosDisponiveis / b.tempo_atendimento)
    }
  }

  return Math.max(0, totalSlots - slotsOcupados)
}
```

Criar `src/lib/utils/format.ts`:
```typescript
/**
 * Formata um número como moeda BRL.
 * Ex: 142350.5 → "R$ 142.350,50"
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

/**
 * Formata um número inteiro com separador de milhar.
 * Ex: 1234 → "1.234"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}
```

- [ ] **Step 4.4: Rodar os testes — confirmar que passam**

```bash
npm test
```
Esperado:
```
PASS  src/lib/utils/__tests__/dashboard.test.ts
  getDayColumn ✓ (4 tests)
  calcularVariacaoPct ✓ (4 tests)
  timeToMinutes ✓ (3 tests)
  calcularSlotsLivres ✓ (8 tests)

Test Suites: 1 passed
Tests:       19 passed
```

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/utils/
git commit -m "feat: add pure utility functions with unit tests"
```

---

### Task 5: Queries SQL

**Files:**
- Create: `src/lib/db/queries.ts`

> **Nota:** As constantes `VENDAS_STATUS_VALIDA` e `AGENDAS_STATUS_CANCELADO` devem ser verificadas contra o banco de produção (ver seção de pontos a confirmar no topo do documento).

- [ ] **Step 5.1: Escrever todas as queries**

Criar `src/lib/db/queries.ts`:
```typescript
import pool from './mysql'
import type { BarberSchedule, RankingUnidade } from '@/lib/types/dashboard'

// ⚠️ Confirmar estes valores contra produção antes de fazer deploy
const VENDAS_STATUS_VALIDA = 1
const AGENDAS_STATUS_CANCELADO = [3, 4]
const canceladosPlaceholder = AGENDAS_STATUS_CANCELADO.join(',')

/** Faturamento total de vendas finalizadas hoje (todas as unidades) */
export async function getFaturamentoHoje(): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COALESCE(SUM(v.valor_total), 0) AS total
     FROM vendas v
     INNER JOIN usuarios u ON v.usuario = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(v.data_criacao) = CURDATE()
       AND v.comanda_temp = 0
       AND v.status = ?
       AND un.status = 1`,
    [VENDAS_STATUS_VALIDA],
  )
  return Number((rows as any[])[0]?.total ?? 0)
}

/** Total de agendamentos marcados para hoje (excluindo cancelados e unidades inativas) */
export async function getAgendamentosDia(): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(a.data) = CURDATE()
       AND a.status NOT IN (${canceladosPlaceholder})
       AND un.status = 1`,
  )
  return Number((rows as any[])[0]?.total ?? 0)
}

/**
 * Retorna a grade de horários de todos os barbeiros ativos hoje.
 * Usa CASE DAYOFWEEK para selecionar dinamicamente a coluna do dia.
 */
export async function getSlotsBarbeiros(): Promise<BarberSchedule[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       u.id,
       u.tempo_atendimento,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_abertura
         WHEN 2 THEN u.segunda_abertura
         WHEN 3 THEN u.terca_abertura
         WHEN 4 THEN u.quarta_abertura
         WHEN 5 THEN u.quinta_abertura
         WHEN 6 THEN u.sexta_abertura
         WHEN 7 THEN u.sabado_abertura
       END AS abertura,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_fechamento
         WHEN 2 THEN u.segunda_fechamento
         WHEN 3 THEN u.terca_fechamento
         WHEN 4 THEN u.quarta_fechamento
         WHEN 5 THEN u.quinta_fechamento
         WHEN 6 THEN u.sexta_fechamento
         WHEN 7 THEN u.sabado_fechamento
       END AS fechamento,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_almoco_inicio
         WHEN 2 THEN u.segunda_almoco_inicio
         WHEN 3 THEN u.terca_almoco_inicio
         WHEN 4 THEN u.quarta_almoco_inicio
         WHEN 5 THEN u.quinta_almoco_inicio
         WHEN 6 THEN u.sexta_almoco_inicio
         WHEN 7 THEN u.sabado_almoco_inicio
       END AS almoco_inicio,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_almoco_fim
         WHEN 2 THEN u.segunda_almoco_fim
         WHEN 3 THEN u.terca_almoco_fim
         WHEN 4 THEN u.quarta_almoco_fim
         WHEN 5 THEN u.quinta_almoco_fim
         WHEN 6 THEN u.sexta_almoco_fim
         WHEN 7 THEN u.sabado_almoco_fim
       END AS almoco_fim
     FROM usuarios u
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE u.status = 1
       AND un.status = 1
       AND u.tempo_atendimento IS NOT NULL
       AND u.tempo_atendimento > 0`,
  )
  return rows as BarberSchedule[]
}

/** Total de agendamentos ocupados hoje (mesmo filtro dos agendamentos do dia) */
export async function getSlotsOcupados(): Promise<number> {
  return getAgendamentosDia()
}

/** Clientes com check-in aberto e sem checkout (em atendimento agora) */
export async function getEmAtendimento(): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     WHERE DATE(a.data) = CURDATE()
       AND a.checkin = 1
       AND a.checkout = 0`,
  )
  return Number((rows as any[])[0]?.total ?? 0)
}

/** Total de atendimentos concluídos hoje (checkout realizado) */
export async function getServicosRealizados(): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     WHERE DATE(a.data) = CURDATE()
       AND a.checkout = 1`,
  )
  return Number((rows as any[])[0]?.total ?? 0)
}

/**
 * Valor projetado dos agendamentos ainda não realizados hoje.
 * Soma o valor_venda do serviço agendado para slots não iniciados.
 * Filtra unidades inativas para consistência com os demais indicadores.
 */
export async function getFaturamentoPendente(): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COALESCE(SUM(p.valor_venda), 0) AS total
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     INNER JOIN produtos p ON a.produto = p.id
     WHERE DATE(a.data) = CURDATE()
       AND a.checkout = 0
       AND a.checkin = 0
       AND a.produto IS NOT NULL
       AND a.status NOT IN (${canceladosPlaceholder})
       AND un.status = 1`,
  )
  return Number((rows as any[])[0]?.total ?? 0)
}

/**
 * Média do faturamento consolidado (todas as unidades) para o mesmo dia
 * da semana, calculada sobre os últimos 3 meses completos.
 * Usa a tabela dashboard_movimentos que já agrega faturamento semanal por unidade.
 */
export async function getMedia3Meses(): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COALESCE(AVG(monthly_total), 0) AS media
     FROM (
       SELECT SUM(
         CASE DAYOFWEEK(CURDATE())
           WHEN 1 THEN dm.faturamento_domingo
           WHEN 2 THEN dm.faturamento_segunda
           WHEN 3 THEN dm.faturamento_terca
           WHEN 4 THEN dm.faturamento_quarta
           WHEN 5 THEN dm.faturamento_quinta
           WHEN 6 THEN dm.faturamento_sexta
           WHEN 7 THEN dm.faturamento_sabado
         END
       ) AS monthly_total
       FROM dashboard_movimentos dm
       WHERE (dm.ano * 100 + dm.mes) >=
               (YEAR(DATE_SUB(CURDATE(), INTERVAL 3 MONTH)) * 100
                + MONTH(DATE_SUB(CURDATE(), INTERVAL 3 MONTH)))
         AND (dm.ano * 100 + dm.mes) <
               (YEAR(CURDATE()) * 100 + MONTH(CURDATE()))
       GROUP BY dm.ano, dm.mes
     ) AS monthly_sums`,
  )
  return Number((rows as any[])[0]?.media ?? 0)
}

/**
 * Ranking de todas as unidades ativas por faturamento hoje.
 * Retorna ordenado DESC — use slice(0,5) para top5 e slice(-5) para bottom5.
 */
export async function getRankingUnidades(): Promise<RankingUnidade[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       un.id,
       un.nome,
       un.cidade,
       un.bairro,
       COALESCE(SUM(v.valor_total), 0) AS faturamento_dia
     FROM unidades un
     LEFT JOIN usuarios us ON us.unidade = un.id AND us.status = 1
     LEFT JOIN vendas v
       ON v.usuario = us.id
       AND DATE(v.data_criacao) = CURDATE()
       AND v.comanda_temp = 0
       AND v.status = ?
     WHERE un.status = 1
       AND un.tipo != 'FRANQUEADORA'
     GROUP BY un.id, un.nome, un.cidade, un.bairro
     ORDER BY faturamento_dia DESC`,
    [VENDAS_STATUS_VALIDA],
  )
  return rows as RankingUnidade[]
}
```

- [ ] **Step 5.2: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```
Esperado: nenhum erro.

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/db/queries.ts
git commit -m "feat: add all dashboard SQL queries"
```

---

## Chunk 2: API Route

### Task 6: GET /api/dashboard

**Files:**
- Create: `src/app/api/dashboard/route.ts`

- [ ] **Step 6.1: Escrever a API route**

Criar `src/app/api/dashboard/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import {
  getFaturamentoHoje,
  getAgendamentosDia,
  getSlotsBarbeiros,
  getSlotsOcupados,
  getEmAtendimento,
  getServicosRealizados,
  getFaturamentoPendente,
  getMedia3Meses,
  getRankingUnidades,
} from '@/lib/db/queries'
import { calcularSlotsLivres, calcularVariacaoPct } from '@/lib/utils/dashboard'
import type { DashboardData } from '@/lib/types/dashboard'

// Forçar execução dinâmica — nunca cachear
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Executar todas as queries em paralelo para minimizar latência
    const [
      faturamentoHoje,
      agendamentosDia,
      barbers,
      slotsOcupados,
      emAtendimento,
      servicosRealizados,
      faturamentoPendente,
      media3Meses,
      ranking,
    ] = await Promise.all([
      getFaturamentoHoje(),
      getAgendamentosDia(),
      getSlotsBarbeiros(),
      getSlotsOcupados(),
      getEmAtendimento(),
      getServicosRealizados(),
      getFaturamentoPendente(),
      getMedia3Meses(),
      getRankingUnidades(),
    ])

    const slotsLivres = calcularSlotsLivres(barbers, slotsOcupados)
    const faturamentoProjetado = faturamentoHoje + faturamentoPendente
    const variacaoMediaPct = calcularVariacaoPct(faturamentoHoje, media3Meses)

    const data: DashboardData = {
      faturamento_hoje: faturamentoHoje,
      agendamentos_dia: agendamentosDia,
      slots_livres: slotsLivres,
      em_atendimento: emAtendimento,
      servicos_realizados: servicosRealizados,
      faturamento_projetado: faturamentoProjetado,
      media_3meses: media3Meses,
      variacao_media_pct: variacaoMediaPct,
      ranking,
      ultima_atualizacao: new Date().toISOString(),
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Dashboard API] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno ao carregar dados do dashboard' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 6.2: Verificar compilação**

```bash
npx tsc --noEmit
```
Esperado: nenhum erro.

- [ ] **Step 6.3: Testar a API manualmente**

```bash
npm run dev
# Em outro terminal:
curl http://localhost:3000/api/dashboard | head -c 500
```
Esperado: JSON com os campos definidos em `DashboardData`. Se retornar `500`, verificar logs do servidor e confirmar credenciais do `.env.local`.

- [ ] **Step 6.4: Verificar cada valor retornado**

Comparar cada campo com queries diretas no banco:
```sql
-- Faturamento hoje
SELECT SUM(valor_total) FROM vendas WHERE DATE(data_criacao) = CURDATE() AND comanda_temp = 0 AND status = 1;

-- Agendamentos
SELECT COUNT(*) FROM agendas WHERE DATE(data) = CURDATE() AND status NOT IN (3,4);

-- Em atendimento
SELECT COUNT(*) FROM agendas WHERE DATE(data) = CURDATE() AND checkin = 1 AND checkout = 0;

-- Serviços realizados
SELECT COUNT(*) FROM agendas WHERE DATE(data) = CURDATE() AND checkout = 1;
```

- [ ] **Step 6.5: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: add GET /api/dashboard route"
```

---

## Chunk 3: Componentes de UI

### Task 7: Tema Global + Layout Raiz

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `tailwind.config.ts`

- [ ] **Step 7.1: Atualizar globals.css com tema Dark VIP**

Substituir o conteúdo de `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0a0a0a;
  color: #ffffff;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scroll suave para animações */
@media (prefers-reduced-motion: no-preference) {
  * {
    scroll-behavior: smooth;
  }
}
```

- [ ] **Step 7.2: Atualizar tailwind.config.ts com cores do tema**

Substituir `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          bright: '#FFD700',
          dark: '#B8860B',
          muted: 'rgba(212,175,55,0.15)',
        },
        card: '#141414',
        canvas: '#0A0A0A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 7.3: Atualizar layout.tsx**

Substituir `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dashboard TV — Barbearia VIP',
  description: 'Painel franqueadora para TV portrait',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7.4: Compilar e verificar sem erros**

```bash
npx tsc --noEmit
```

- [ ] **Step 7.5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts
git commit -m "feat: configure Dark VIP Gold theme and root layout"
```

---

### Task 8: DashboardHeader

**Files:**
- Create: `src/components/DashboardHeader.tsx`

- [ ] **Step 8.1: Criar o componente**

Criar `src/components/DashboardHeader.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'

export default function DashboardHeader() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Inicializar no cliente para evitar hydration mismatch
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const time = now
    ? now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  const date = now
    ? now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <header className="flex flex-col items-center py-6 border-b border-[#D4AF37]/40 shrink-0">
      <h1 className="text-5xl font-bold tracking-widest uppercase text-[#FFD700]">
        Barbearia VIP
      </h1>
      <p className="text-gray-400 text-xl mt-1 tracking-wider">
        Dashboard Franqueadora
      </p>
      <div className="flex items-center gap-3 mt-3 text-gray-300">
        <span className="text-3xl font-mono font-semibold">{time}</span>
        <span className="text-[#D4AF37] text-2xl">•</span>
        <span className="text-lg capitalize">{date}</span>
      </div>
    </header>
  )
}
```

- [ ] **Step 8.2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 8.3: Commit**

```bash
git add src/components/DashboardHeader.tsx
git commit -m "feat: add DashboardHeader with live clock"
```

---

### Task 9: FaturamentoHero

**Files:**
- Create: `src/components/FaturamentoHero.tsx`

- [ ] **Step 9.1: Criar o componente**

Criar `src/components/FaturamentoHero.tsx`:
```typescript
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  faturamento: number
  variacaoPct: number
  media3meses: number
}

export default function FaturamentoHero({ faturamento, variacaoPct, media3meses }: Props) {
  const isPositive = variacaoPct >= 0
  const arrow = isPositive ? '▲' : '▼'
  const variacaoColor = isPositive ? 'text-green-500' : 'text-red-500'
  const variacaoFormatada = `${Math.abs(variacaoPct).toFixed(1)}%`

  return (
    <section className="flex flex-col items-center py-8 border-b border-[#D4AF37]/20 bg-[#141414] shrink-0">
      <p className="text-gray-400 text-sm uppercase tracking-widest mb-3">
        💰 Faturamento Hoje
      </p>
      <p className="text-8xl font-bold text-[#FFD700] leading-none">
        {formatCurrency(faturamento)}
      </p>
      <p className={`text-2xl mt-4 font-semibold ${variacaoColor}`}>
        {arrow} {variacaoFormatada} vs média 3 meses
      </p>
      <p className="text-gray-500 text-base mt-2">
        Média: {formatCurrency(media3meses)}
      </p>
    </section>
  )
}
```

- [ ] **Step 9.2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 9.3: Commit**

```bash
git add src/components/FaturamentoHero.tsx
git commit -m "feat: add FaturamentoHero card with delta vs 3-month avg"
```

---

### Task 10: KpiCard + KpiGrid

**Files:**
- Create: `src/components/KpiCard.tsx`
- Create: `src/components/KpiGrid.tsx`

- [ ] **Step 10.1: Criar KpiCard**

Criar `src/components/KpiCard.tsx`:
```typescript
interface Props {
  icon: string
  label: string
  value: number
  formatFn?: (v: number) => string
}

export default function KpiCard({ icon, label, value, formatFn }: Props) {
  const displayValue = formatFn ? formatFn(value) : String(value)

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center py-8 px-4 gap-2">
      <span className="text-4xl">{icon}</span>
      <p className="text-gray-400 text-xs uppercase tracking-widest text-center">
        {label}
      </p>
      <p className="text-6xl font-bold text-white leading-none">{displayValue}</p>
    </div>
  )
}
```

- [ ] **Step 10.2: Criar KpiGrid**

Criar `src/components/KpiGrid.tsx`:
```typescript
import KpiCard from './KpiCard'
import { formatNumber } from '@/lib/utils/format'

interface Props {
  agendamentos: number
  slotsLivres: number
  emAtendimento: number
  servicosRealizados: number
}

export default function KpiGrid({
  agendamentos,
  slotsLivres,
  emAtendimento,
  servicosRealizados,
}: Props) {
  return (
    <section className="grid grid-cols-2 gap-4 px-5 py-4 shrink-0">
      <KpiCard
        icon="📅"
        label="Agendamentos"
        value={agendamentos}
        formatFn={formatNumber}
      />
      <KpiCard
        icon="🔓"
        label="Slots Livres"
        value={slotsLivres}
        formatFn={formatNumber}
      />
      <KpiCard
        icon="✂️"
        label="Em Atendimento"
        value={emAtendimento}
        formatFn={formatNumber}
      />
      <KpiCard
        icon="✅"
        label="Serviços Realizados"
        value={servicosRealizados}
        formatFn={formatNumber}
      />
    </section>
  )
}
```

- [ ] **Step 10.3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 10.4: Commit**

```bash
git add src/components/KpiCard.tsx src/components/KpiGrid.tsx
git commit -m "feat: add KpiCard and KpiGrid components"
```

---

### Task 11: ProjecaoGrid

**Files:**
- Create: `src/components/ProjecaoGrid.tsx`

- [ ] **Step 11.1: Criar o componente**

Criar `src/components/ProjecaoGrid.tsx`:
```typescript
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  faturamentoProjetado: number
  media3meses: number
}

export default function ProjecaoGrid({ faturamentoProjetado, media3meses }: Props) {
  return (
    <section className="grid grid-cols-2 gap-4 px-5 py-2 shrink-0">
      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center py-6 gap-2">
        <p className="text-gray-400 text-xs uppercase tracking-widest">
          🎯 Fat. Projetado
        </p>
        <p className="text-4xl font-bold text-[#FFD700] leading-none text-center">
          {formatCurrency(faturamentoProjetado)}
        </p>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center py-6 gap-2">
        <p className="text-gray-400 text-xs uppercase tracking-widest">
          📊 Méd. 3 Meses
        </p>
        <p className="text-4xl font-bold text-white leading-none text-center">
          {formatCurrency(media3meses)}
        </p>
        <p className="text-gray-600 text-xs">mesmo dia da semana</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 11.2: Compilar e commitar**

```bash
npx tsc --noEmit
git add src/components/ProjecaoGrid.tsx
git commit -m "feat: add ProjecaoGrid component"
```

---

### Task 12: RankingSection

**Files:**
- Create: `src/components/RankingSection.tsx`

- [ ] **Step 12.1: Criar o componente**

Criar `src/components/RankingSection.tsx`:
```typescript
import { formatCurrency } from '@/lib/utils/format'
import type { RankingUnidade } from '@/lib/types/dashboard'

interface Props {
  ranking: RankingUnidade[]
}

interface RowProps {
  pos: number
  unidade: RankingUnidade
  maxFaturamento: number
  variant: 'top' | 'bottom'
}

function RankingRow({ pos, unidade, maxFaturamento, variant }: RowProps) {
  const pct = maxFaturamento > 0
    ? Math.max(4, (unidade.faturamento_dia / maxFaturamento) * 100)
    : 4

  const isTop = variant === 'top'
  const posColor = isTop ? 'text-green-400' : 'text-red-400'
  const barColor = isTop ? 'bg-green-500' : 'bg-red-600'

  const unitLabel = unidade.nome ?? `${unidade.cidade} — ${unidade.bairro}`

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-bold w-5 shrink-0 ${posColor}`}>{pos}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-white text-sm font-medium truncate max-w-[240px]">
            {unitLabel}
          </span>
          <span className="text-gray-300 text-sm shrink-0 ml-2">
            {formatCurrency(unidade.faturamento_dia)}
          </span>
        </div>
        <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function RankingSection({ ranking }: Props) {
  // Top 5: maiores faturamentos (início do array já ordenado DESC)
  const top5 = ranking.slice(0, 5)
  // Bottom 5: menores faturamentos (fim do array), do pior para o menos pior
  const bottom5 = ranking.slice(-5).reverse()

  // Cada grupo tem seu próprio máximo para escalar barras de forma legível.
  // Usar o máximo global tornaria as barras do Bottom 5 quase invisíveis.
  const maxTop = top5[0]?.faturamento_dia ?? 1
  const maxBottom = bottom5[0]?.faturamento_dia ?? 1

  return (
    <section className="flex-1 px-5 py-3 min-h-0 overflow-hidden">
      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 p-5 h-full flex flex-col gap-4">

        {/* TOP 5 */}
        <div>
          <p className="text-[#FFD700] text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            🏆 Top 5 Unidades
          </p>
          <div className="space-y-3">
            {top5.map((u, i) => (
              <RankingRow
                key={u.id}
                pos={i + 1}
                unidade={u}
                maxFaturamento={maxTop}
                variant="top"
              />
            ))}
          </div>
        </div>

        {/* DIVISOR */}
        <div className="border-t border-[#D4AF37]/20" />

        {/* BOTTOM 5 */}
        <div>
          <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            📉 Bottom 5 Unidades
          </p>
          <div className="space-y-3">
            {bottom5.map((u, i) => (
              <RankingRow
                key={u.id}
                pos={i + 1}
                unidade={u}
                maxFaturamento={maxBottom}
                variant="bottom"
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
```

- [ ] **Step 12.2: Compilar e commitar**

```bash
npx tsc --noEmit
git add src/components/RankingSection.tsx
git commit -m "feat: add RankingSection with top5 and bottom5 with progress bars"
```

---

### Task 13: StatusBar

**Files:**
- Create: `src/components/StatusBar.tsx`

- [ ] **Step 13.1: Criar o componente**

Criar `src/components/StatusBar.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'

interface Props {
  ultimaAtualizacao: string // ISO timestamp
}

export default function StatusBar({ ultimaAtualizacao }: Props) {
  // Re-renderiza a cada 60s para manter o contador de elapsed atualizado
  const [, tick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const elapsed = Math.floor(
    (Date.now() - new Date(ultimaAtualizacao).getTime()) / 60_000,
  )

  const elapsedLabel =
    elapsed === 0 ? 'agora mesmo' : `há ${elapsed} min`

  return (
    <footer className="flex items-center justify-between px-6 py-3 border-t border-[#D4AF37]/20 shrink-0">
      <span className="text-gray-500 text-sm">
        ⟳ Atualizado {elapsedLabel}
      </span>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-gray-500 text-sm">Ao vivo · atualiza em 5 min</span>
      </div>
    </footer>
  )
}
```

- [ ] **Step 13.2: Compilar e commitar**

```bash
npx tsc --noEmit
git add src/components/StatusBar.tsx
git commit -m "feat: add StatusBar with live indicator"
```

---

## Chunk 4: Página Principal + TV Scaling + Verificação

### Task 14: page.tsx — Canvas TV + Auto-refresh

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 14.1: Escrever a página principal**

Substituir `src/app/page.tsx`:
```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardData } from '@/lib/types/dashboard'
import DashboardHeader from '@/components/DashboardHeader'
import FaturamentoHero from '@/components/FaturamentoHero'
import KpiGrid from '@/components/KpiGrid'
import ProjecaoGrid from '@/components/ProjecaoGrid'
import RankingSection from '@/components/RankingSection'
import StatusBar from '@/components/StatusBar'

/** Intervalo de atualização em milissegundos (5 minutos) */
const REFRESH_MS = 5 * 60 * 1000

/** Dimensões fixas do canvas portrait para TV 50" (1080p portrait = 1080×1920) */
const CANVAS_W = 1080
const CANVAS_H = 1920

export default function DashboardTV() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [hasError, setHasError] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  // ---------- Escalonamento do canvas para a TV ----------
  useEffect(() => {
    function scale() {
      if (!canvasRef.current) return
      const s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
      canvasRef.current.style.transform = `scale(${s})`
      canvasRef.current.style.transformOrigin = 'top left'
      // Ajustar o wrapper para que não crie scroll
      document.body.style.width = `${CANVAS_W * s}px`
      document.body.style.height = `${CANVAS_H * s}px`
    }
    scale()
    window.addEventListener('resize', scale)
    return () => window.removeEventListener('resize', scale)
  }, [])

  // ---------- Busca de dados ----------
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: DashboardData = await res.json()
      setData(json)
      setHasError(false)
    } catch (err) {
      console.error('[DashboardTV] Erro ao buscar dados:', err)
      setHasError(true)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(timer)
  }, [fetchData])

  // ---------- Estados de carregamento e erro ----------
  if (hasError && !data) {
    return (
      <div className="w-screen h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
        <p className="text-red-500 text-3xl font-bold">⚠ Erro de conexão</p>
        <p className="text-gray-500 text-xl">Tentando reconectar automaticamente...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-screen h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-[#D4AF37] text-3xl font-bold animate-pulse">
          Carregando dashboard...
        </p>
      </div>
    )
  }

  // ---------- Dashboard principal ----------
  return (
    <div className="w-screen h-screen bg-[#0A0A0A] overflow-hidden">
      <div
        ref={canvasRef}
        className="bg-[#0A0A0A] flex flex-col"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        <DashboardHeader />

        <FaturamentoHero
          faturamento={data.faturamento_hoje}
          variacaoPct={data.variacao_media_pct}
          media3meses={data.media_3meses}
        />

        <KpiGrid
          agendamentos={data.agendamentos_dia}
          slotsLivres={data.slots_livres}
          emAtendimento={data.em_atendimento}
          servicosRealizados={data.servicos_realizados}
        />

        <ProjecaoGrid
          faturamentoProjetado={data.faturamento_projetado}
          media3meses={data.media_3meses}
        />

        <RankingSection ranking={data.ranking} />

        <StatusBar ultimaAtualizacao={data.ultima_atualizacao} />
      </div>
    </div>
  )
}
```

- [ ] **Step 14.2: Compilar — confirmar sem erros**

```bash
npx tsc --noEmit
```
Esperado: nenhum erro.

- [ ] **Step 14.3: Rodar todos os testes**

```bash
npm test
```
Esperado: 19 testes passando, 0 falhando.

- [ ] **Step 14.4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add main TV dashboard page with auto-refresh and canvas scaling"
```

---

### Task 15: Verificação End-to-End

- [ ] **Step 15.1: Build de produção**

```bash
npm run build
```
Esperado: `✓ Compiled successfully`. Nenhum erro de TypeScript ou lint.

- [ ] **Step 15.2: Start em modo produção**

```bash
npm start
```
Abrir `http://localhost:3000` no navegador.

- [ ] **Step 15.3: Simular TV portrait no DevTools**

No Chrome:
1. F12 → Toggle Device Toolbar
2. Definir resolução: `1080 × 1920`
3. Verificar que o layout preenche a tela sem scroll

- [ ] **Step 15.4: Conferir cada KPI visualmente**

| Métrica | Query de verificação |
|---|---|
| Faturamento hoje | `SELECT SUM(valor_total) FROM vendas WHERE DATE(data_criacao)=CURDATE() AND comanda_temp=0 AND status=1` |
| Agendamentos | `SELECT COUNT(*) FROM agendas WHERE DATE(data)=CURDATE() AND status NOT IN(3,4)` |
| Em atendimento | `SELECT COUNT(*) FROM agendas WHERE DATE(data)=CURDATE() AND checkin=1 AND checkout=0` |
| Serviços realizados | `SELECT COUNT(*) FROM agendas WHERE DATE(data)=CURDATE() AND checkout=1` |
| Ranking (top) | `SELECT un.nome, SUM(v.valor_total) FROM vendas v JOIN usuarios u ON v.usuario=u.id JOIN unidades un ON u.unidade=un.id WHERE DATE(v.data_criacao)=CURDATE() AND v.comanda_temp=0 AND v.status=1 GROUP BY un.id ORDER BY 2 DESC LIMIT 5` |

- [ ] **Step 15.5: Testar auto-refresh**

Temporariamente alterar `REFRESH_MS` em `page.tsx` para `10_000` (10s). Aguardar a atualização. Verificar que o timestamp "Atualizado há X min" muda. Restaurar para `5 * 60 * 1000`.

- [ ] **Step 15.6: Commit final**

```bash
git add .
git commit -m "feat: dashboard TV franqueadora — complete implementation"
```

---

## Notas de Deploy

Para rodar em produção na TV:

```bash
npm run build
npm start
# Ou com PM2:
pm2 start npm --name "dashtv" -- start
pm2 save
```

Abrir o navegador em modo kiosk apontando para `http://localhost:3000`:
```bash
# Chrome em modo kiosk (Windows)
chrome --kiosk http://localhost:3000
```

A TV deve estar configurada em **orientação portrait (vertical)** no sistema operacional antes de abrir o browser.
