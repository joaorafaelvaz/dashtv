import { formatCurrency } from '@/lib/utils/format'
import type { RankingUnidade } from '@/lib/types/dashboard'

interface Props {
  ranking: RankingUnidade[]
}

interface RowProps {
  pos: number
  unidade: RankingUnidade
  maxFaturamento: number
  variant: 'top' | 'bottom'
}

function RankingRow({ pos, unidade, maxFaturamento, variant }: RowProps) {
  const pct = maxFaturamento > 0
    ? Math.max(4, (unidade.faturamento_dia / maxFaturamento) * 100)
    : 4

  const isTop = variant === 'top'
  const posColor = isTop ? 'text-green-400' : 'text-red-400'
  const barColor = isTop ? 'bg-green-500' : 'bg-red-600'

  const unitLabel = unidade.nome ?? `${unidade.cidade} — ${unidade.bairro}`

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-bold w-5 shrink-0 ${posColor}`}>{pos}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-white text-sm font-medium truncate max-w-[240px]">
            {unitLabel}
          </span>
          <span className="text-gray-300 text-sm shrink-0 ml-2">
            {formatCurrency(unidade.faturamento_dia)}
          </span>
        </div>
        <div className="h-2 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function RankingSection({ ranking }: Props) {
  // Top 5: maiores faturamentos (início do array já ordenado DESC)
  const top5 = ranking.slice(0, 5)
  // Bottom 5: menores faturamentos (fim do array), do pior para o menos pior
  const bottom5 = ranking.slice(-5).reverse()

  // Cada grupo tem seu próprio máximo para escalar barras de forma legível.
  // Usar o máximo global tornaria as barras do Bottom 5 quase invisíveis.
  const maxTop = top5[0]?.faturamento_dia ?? 1
  const maxBottom = bottom5[0]?.faturamento_dia ?? 1

  return (
    <section className="flex-1 px-5 py-3 min-h-0 overflow-hidden">
      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 p-5 h-full flex flex-col gap-4">

        {/* TOP 5 */}
        <div>
          <p className="text-[#FFD700] text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            🏆 Top 5 Unidades
          </p>
          <div className="space-y-3">
            {top5.map((u, i) => (
              <RankingRow
                key={u.id}
                pos={i + 1}
                unidade={u}
                maxFaturamento={maxTop}
                variant="top"
              />
            ))}
          </div>
        </div>

        {/* DIVISOR */}
        <div className="border-t border-[#D4AF37]/20" />

        {/* BOTTOM 5 */}
        <div>
          <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            📉 Bottom 5 Unidades
          </p>
          <div className="space-y-3">
            {bottom5.map((u, i) => (
              <RankingRow
                key={u.id}
                pos={i + 1}
                unidade={u}
                maxFaturamento={maxBottom}
                variant="bottom"
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
