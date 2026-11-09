import type { DashboardData, RankingUnidade, VendaNova } from '@/lib/types/dashboard'

/** Máximo de notificações por refresh. Acima disso (ex.: volta de uma queda),
 *  as vendas excedentes entram direto no total, sem notificação. */
export const MAX_NOTIFICACOES_POR_REFRESH = 120

/** Por quanto tempo uma venda nova continua na resposta da API. Maior que o
 *  intervalo de leitura da TV, para uma TV fora de sincronia não perder vendas. */
export const JANELA_RETENCAO_MS = 20 * 60 * 1000

interface VendaBase {
  id: number
  valor: number
  unidade_id: number | null
  unidade_nome: string | null
}

interface ItemVenda {
  venda: number
  valor: number
  produto: string | null
  colaborador: string | null
  unidade_colaborador: number | null
}

/**
 * Ids presentes agora e ausentes no refresh anterior.
 * Sem refresh anterior (primeira leitura do processo), nada é novo: senão o
 * painel notificaria o dia inteiro de uma vez.
 */
export function detectarNovas<T extends { id: number }>(
  atuais: T[],
  idsAnteriores: ReadonlySet<number> | null,
): T[] {
  if (!idsAnteriores) return []
  return atuais.filter((v) => !idsAnteriores.has(v.id))
}

/** Primeiro nome: cabe na notificação e é como a equipe se chama. */
function primeiroNome(nome: string | null): string | null {
  const n = nome?.trim().split(/\s+/)[0]
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : null
}

/** Junta a venda com seus itens no formato que o painel consome. */
export function montarVendaNova(
  venda: VendaBase,
  itens: ItemVenda[],
  detectadaEm: string,
): VendaNova {
  const daVenda = itens.filter((i) => i.venda === venda.id)
  const principal = [...daVenda].sort((a, b) => Number(b.valor) - Number(a.valor))[0]

  const porUnidade: Record<string, number> = {}
  for (const i of daVenda) {
    if (i.unidade_colaborador == null) continue
    const k = String(i.unidade_colaborador)
    porUnidade[k] = round2((porUnidade[k] ?? 0) + Number(i.valor))
  }

  const nomes = Array.from(
    new Set(daVenda.map((i) => i.produto?.trim()).filter((p): p is string => !!p)),
  )

  return {
    id: venda.id,
    valor: round2(Number(venda.valor)),
    unidade_id: venda.unidade_id,
    unidade_nome: venda.unidade_nome,
    barbeiro: primeiroNome(principal?.colaborador ?? null),
    itens: nomes,
    por_unidade: porUnidade,
    detectada_em: detectadaEm,
  }
}

/** Mantém só as vendas detectadas dentro da janela de retenção. */
export function podarAntigas(vendas: VendaNova[], agora: number): VendaNova[] {
  return vendas.filter((v) => agora - new Date(v.detectada_em).getTime() <= JANELA_RETENCAO_MS)
}

// ---------------------------------------------------------------------------
// Lado da TV
// ---------------------------------------------------------------------------

export interface VendaAgendada extends VendaNova {
  exibirEm: number // epoch ms
}

/**
 * Distribui a fila igualmente pela janela: a 1ª sai já, as demais em
 * intervalos iguais. Com 10 vendas em 5 min, uma a cada 30 s.
 */
export function agendarFila(
  fila: VendaNova[],
  agora: number,
  janelaMs: number,
): VendaAgendada[] {
  if (fila.length === 0) return []
  const passo = janelaMs / fila.length
  return fila.map((v, i) => ({ ...v, exibirEm: agora + Math.round(i * passo) }))
}

/**
 * Tira dos números do servidor o que ainda não foi anunciado. O servidor já
 * soma todas as vendas; o painel mostra o total sem as pendentes e devolve
 * cada uma quando a notificação dela aparece.
 */
export function aplicarPendentes(
  data: DashboardData,
  pendentes: VendaNova[],
): DashboardData {
  if (pendentes.length === 0) return data

  const total = pendentes.reduce((s, v) => s + v.valor, 0)
  const porUnidade = new Map<number, number>()
  for (const v of pendentes) {
    for (const [k, valor] of Object.entries(v.por_unidade)) {
      porUnidade.set(Number(k), (porUnidade.get(Number(k)) ?? 0) + valor)
    }
  }

  const ranking = data.ranking
    .map((u) => {
      const menos = porUnidade.get(u.id)
      return menos
        ? { ...u, faturamento_dia: Math.max(0, round2(Number(u.faturamento_dia) - menos)) }
        : u
    })
    .sort((a, b) => b.faturamento_dia - a.faturamento_dia) as RankingUnidade[]

  return {
    ...data,
    faturamento_hoje: Math.max(0, round2(data.faturamento_hoje - total)),
    faturamento_projetado: Math.max(0, round2(data.faturamento_projetado - total)),
    unidades_faturando: ranking.filter((u) => u.faturamento_dia > 0).length,
    ranking,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
