import type { AgenteHoje } from '@/lib/types/dashboard'

const BASE_PADRAO = 'https://agente.franquiabv.com.br/api'
const TIMEOUT_MS = 10_000

/**
 * "Hoje" em Brasília como par from/to (to exclusivo), no formato que a API do
 * agente espera. Calculado com fuso explícito porque o servidor roda em UTC:
 * às 22h de Brasília o `new Date()` do servidor já está no dia seguinte.
 */
export function periodoHojeBrasilia(agora: Date): { from: string; to: string } {
  const dia = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
  const from = dia(agora)
  // Meio-dia UTC do dia `from` + 24h cai sempre no dia seguinte, em qualquer fuso
  const to = dia(new Date(Date.parse(`${from}T12:00:00Z`) + 24 * 60 * 60 * 1000))
  return { from, to }
}

interface StatsResposta {
  appointments_booked?: number
  appointments_cancelled?: number
  appointments_value?: number
}

/** Converte a resposta de /api/stats; devolve null se vier fora do formato. */
export function interpretarStats(json: unknown, dia: string): AgenteHoje | null {
  const s = json as StatsResposta | null
  if (!s || typeof s.appointments_booked !== 'number') return null
  return {
    dia,
    agendamentos: s.appointments_booked,
    cancelados: Number(s.appointments_cancelled ?? 0),
    valor: Number(s.appointments_value ?? 0),
  }
}

/**
 * Números de hoje do agente de agendamento (WhatsApp).
 * Devolve null se a chave não estiver configurada — o painel então esconde o
 * bloco. Erros de rede/HTTP são lançados para o cache decidir o que fazer.
 */
export async function getAgenteHoje(agora = new Date()): Promise<AgenteHoje | null> {
  const chave = process.env.AGENTE_API_KEY
  if (!chave) return null

  const base = (process.env.AGENTE_API_URL || BASE_PADRAO).replace(/\/+$/, '')
  const { from, to } = periodoHojeBrasilia(agora)

  const res = await fetch(`${base}/stats?from=${from}&to=${to}`, {
    headers: { 'X-API-Key': chave },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`API do agente respondeu HTTP ${res.status}`)

  const dados = interpretarStats(await res.json(), from)
  if (!dados) throw new Error('API do agente: resposta fora do formato esperado')
  return dados
}
