import KpiCard from './KpiCard'
import { formatNumber } from '@/lib/utils/format'
import { toneLowerIsBetter, toneHigherIsBetter } from '@/lib/utils/dashboard'

function formatPercent(v: number): string {
  return `${(v ?? 0).toFixed(1)}%`
}

interface Props {
  agendamentos: number
  slotsLivres: number
  emAtendimento: number
  servicosRealizados: number
  taxaOcupacao: number
  taxaCancelamento: number
  taxaNoShow: number
  atendimentos: number
  walkIns: number
}

export default function KpiGrid({
  agendamentos,
  slotsLivres,
  emAtendimento,
  servicosRealizados,
  taxaOcupacao,
  taxaCancelamento,
  taxaNoShow,
  atendimentos,
  walkIns,
}: Props) {
  // Só métricas com "bom/ruim" intrínseco recebem cor. Contagens ficam neutras.
  const toneOcupacao = toneHigherIsBetter(taxaOcupacao, 50, 30)
  const toneNoShow = toneLowerIsBetter(taxaNoShow, 5, 10)
  const toneCancelamento = toneLowerIsBetter(taxaCancelamento, 5, 10)

  return (
    <section className="grid grid-cols-3 gap-3 px-5 py-3 shrink-0">
      <KpiCard compact icon="📅" label="Agendamentos"      value={agendamentos}           formatFn={formatNumber} />
      <KpiCard compact icon="🔓" label="Slots Livres"      value={slotsLivres}            formatFn={formatNumber} />
      <KpiCard compact icon="📊" label="Tx. Ocupação"      value={taxaOcupacao}           formatFn={formatPercent} tone={toneOcupacao} />

      <KpiCard compact icon="✂️" label="Em Atendimento"   value={emAtendimento}          formatFn={formatNumber} />
      <KpiCard compact icon="💈" label="Atendimentos"      value={atendimentos}           formatFn={formatNumber} />
      <KpiCard compact icon="✅" label="Via Agenda"        value={servicosRealizados}     formatFn={formatNumber} />

      <KpiCard compact icon="👻" label="No-Show"           value={taxaNoShow}             formatFn={formatPercent} tone={toneNoShow} />
      <KpiCard compact icon="🚶" label="Walk-in"           value={walkIns}                formatFn={formatNumber} />
      <KpiCard compact icon="❌" label="Cancelamentos"     value={taxaCancelamento}       formatFn={formatPercent} tone={toneCancelamento} />
    </section>
  )
}
