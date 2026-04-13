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
