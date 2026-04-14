import KpiCard from './KpiCard'
import { formatNumber } from '@/lib/utils/format'

function formatPercent(v: number): string {
  return `${(v ?? 0).toFixed(1)}%`
}

function formatMinutes(v: number): string {
  return `${v ?? 0}min`
}

interface Props {
  agendamentos: number
  slotsLivres: number
  emAtendimento: number
  servicosRealizados: number
  taxaOcupacao: number
  taxaCancelamento: number
  taxaNoShow: number
  tempoMedioAtendimento: number
  produtosVendidos: number
}

export default function KpiGrid({
  agendamentos,
  slotsLivres,
  emAtendimento,
  servicosRealizados,
  taxaOcupacao,
  taxaCancelamento,
  taxaNoShow,
  tempoMedioAtendimento,
  produtosVendidos,
}: Props) {
  return (
    <section className="grid grid-cols-3 gap-3 px-5 py-3 shrink-0">
      <KpiCard compact icon="📅" label="Agendamentos"      value={agendamentos}           formatFn={formatNumber} />
      <KpiCard compact icon="🔓" label="Slots Livres"      value={slotsLivres}            formatFn={formatNumber} />
      <KpiCard compact icon="📊" label="Tx. Ocupação"      value={taxaOcupacao}           formatFn={formatPercent} />

      <KpiCard compact icon="✂️" label="Em Atendimento"   value={emAtendimento}          formatFn={formatNumber} />
      <KpiCard compact icon="✅" label="Serv. Realizados"  value={servicosRealizados}     formatFn={formatNumber} />
      <KpiCard compact icon="💈" label="Atendimentos"      value={produtosVendidos}       formatFn={formatNumber} />

      <KpiCard compact icon="👻" label="No-Show"           value={taxaNoShow}             formatFn={formatPercent} />
      <KpiCard compact icon="⏱️" label="Tempo Médio"       value={tempoMedioAtendimento}  formatFn={formatMinutes} />
      <KpiCard compact icon="❌" label="Cancelamentos"     value={taxaCancelamento}       formatFn={formatPercent} />
    </section>
  )
}
