interface Props {
  icon: string
  label: string
  value: number
  formatFn?: (v: number) => string
  compact?: boolean
}

export default function KpiCard({ icon, label, value, formatFn, compact }: Props) {
  const displayValue = formatFn ? formatFn(value) : String(value)

  return (
    <div className={`bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center px-3 gap-1 ${compact ? 'py-5' : 'py-8'}`}>
      <span className={compact ? 'text-3xl' : 'text-4xl'}>{icon}</span>
      <p className="text-gray-400 text-xs uppercase tracking-widest text-center leading-tight">
        {label}
      </p>
      <p className={`font-bold text-white leading-none ${compact ? 'text-4xl' : 'text-6xl'}`}>
        {displayValue}
      </p>
    </div>
  )
}
