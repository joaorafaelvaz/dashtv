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
