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
