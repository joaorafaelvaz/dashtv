import type { BarberSchedule } from '@/lib/types/dashboard'

/**
 * Mapeia um Date para o nome da coluna correspondente em dashboard_movimentos.
 * getDay(): 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
 *
 * Nota: a query getMedia3Meses usa CASE DAYOFWEEK(CURDATE()) diretamente no SQL.
 * Esta função está disponível para lógica de análise em JS se necessário no futuro.
 */
export function getDayColumn(date: Date): string {
  if (isNaN(date.getTime())) throw new Error(`getDayColumn: invalid Date`)
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
 * Posições da barra de ritmo do dia, em % da largura.
 *
 * A escala é o maior entre realizado, projetado e média, com 15% de folga —
 * assim nenhum dos três encosta na borda e a barra se ajusta sozinha ao longo
 * do dia. `pctDaMedia` é o texto de apoio ("projeção alcança X% da média").
 */
export function calcularRitmo(
  faturamento: number,
  projetado: number,
  media: number,
): { realPct: number; projPct: number; tickPct: number; pctDaMedia: number } {
  const escala = Math.max(faturamento, projetado, media) * 1.15
  if (escala <= 0) return { realPct: 0, projPct: 0, tickPct: 0, pctDaMedia: 0 }
  return {
    realPct: (faturamento / escala) * 100,
    projPct: (projetado / escala) * 100,
    tickPct: (media / escala) * 100,
    pctDaMedia: media > 0 ? (projetado / media) * 100 : 0,
  }
}

/** Faixa de avaliação de um KPI, usada para colorir o valor no painel. */
export type KpiTone = 'neutral' | 'good' | 'warn' | 'bad'

/**
 * Avalia métrica em que MENOR é melhor (no-show, cancelamento).
 * @param warnAt - a partir deste valor (inclusive) vira atenção
 * @param badAt  - a partir deste valor (inclusive) vira crítico
 */
export function toneLowerIsBetter(value: number, warnAt: number, badAt: number): KpiTone {
  if (value >= badAt) return 'bad'
  if (value >= warnAt) return 'warn'
  return 'good'
}

/**
 * Avalia métrica em que MAIOR é melhor (taxa de ocupação).
 * @param warnBelow - até este valor (inclusive) vira atenção
 * @param badBelow  - até este valor (inclusive) vira crítico
 */
export function toneHigherIsBetter(value: number, warnBelow: number, badBelow: number): KpiTone {
  if (value <= badBelow) return 'bad'
  if (value <= warnBelow) return 'warn'
  return 'good'
}

/**
 * Converte string "HH:MM:SS" em total de minutos desde meia-noite.
 */
export function timeToMinutes(time: string): number {
  const [h, m, s = 0] = time.split(':').map(Number)
  return h * 60 + m + Math.round(s / 60)
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
