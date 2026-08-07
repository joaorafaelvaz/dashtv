import type { KpiTone } from '@/lib/utils/dashboard'

interface Props {
  icon: string
  label: string
  value: number
  formatFn?: (v: number) => string
  compact?: boolean
  /** Faixa de avaliação — colore o valor. 'neutral' (padrão) para contagens sem bom/ruim. */
  tone?: KpiTone
}

/** Cor do valor por faixa. Contagens puras ficam brancas para não poluir a tela. */
const TONE_COLOR: Record<KpiTone, string> = {
  neutral: 'text-white',
  good: 'text-green-400',
  warn: 'text-amber-400',
  bad: 'text-red-500',
}

export default function KpiCard({ icon, label, value, formatFn, compact, tone = 'neutral' }: Props) {
  const displayValue = formatFn ? formatFn(value) : String(value)

  return (
    <div className={`bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center px-3 gap-1 ${compact ? 'py-5' : 'py-8'}`}>
      <span className={compact ? 'text-3xl' : 'text-4xl'}>{icon}</span>
      <p className="text-gray-400 text-sm uppercase tracking-widest text-center leading-tight">
        {label}
      </p>
      <p className={`font-bold leading-none ${TONE_COLOR[tone]} ${compact ? 'text-4xl' : 'text-6xl'}`}>
        {displayValue}
      </p>
    </div>
  )
}
