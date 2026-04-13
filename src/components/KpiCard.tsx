interface Props {
  icon: string
  label: string
  value: number
  formatFn?: (v: number) => string
}

export default function KpiCard({ icon, label, value, formatFn }: Props) {
  const displayValue = formatFn ? formatFn(value) : String(value)

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center py-8 px-4 gap-2">
      <span className="text-4xl">{icon}</span>
      <p className="text-gray-400 text-xs uppercase tracking-widest text-center">
        {label}
      </p>
      <p className="text-6xl font-bold text-white leading-none">{displayValue}</p>
    </div>
  )
}
