import { formatCurrency } from '@/lib/utils/format'

interface Props {
  faturamento: number
  variacaoPct: number
  media3meses: number
}

export default function FaturamentoHero({ faturamento, variacaoPct, media3meses }: Props) {
  const isPositive = variacaoPct >= 0
  const arrow = isPositive ? '▲' : '▼'
  const variacaoColor = isPositive ? 'text-green-500' : 'text-red-500'
  const variacaoFormatada = `${Math.abs(variacaoPct).toFixed(1)}%`

  return (
    <section className="flex flex-col items-center py-8 border-b border-[#D4AF37]/20 bg-[#141414] shrink-0">
      <p className="text-gray-400 text-sm uppercase tracking-widest mb-3">
        💰 Faturamento Hoje
      </p>
      <p className="text-8xl font-bold text-[#FFD700] leading-none">
        {formatCurrency(faturamento)}
      </p>
      <p className={`text-2xl mt-4 font-semibold ${variacaoColor}`}>
        {arrow} {variacaoFormatada} vs média 3 meses
      </p>
      <p className="text-gray-500 text-base mt-2">
        Média: {formatCurrency(media3meses)}
      </p>
    </section>
  )
}
