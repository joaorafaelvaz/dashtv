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

/** Remove o prefixo "Brasil - ", constante em toda unidade e que só rouba espaço. */
function nomeCurto(u: RankingUnidade): { local: string; uf: string } {
  const bruto = u.nome ?? `${u.cidade} — ${u.bairro}`
  const partes = bruto.split(' - ').filter((p) => p.trim() !== 'Brasil')
  const uf = partes.length > 2 && partes[0].length === 2 ? partes[0] : ''
  const local = (uf ? partes.slice(1) : partes).join(' — ')
  return { local, uf }
}

function RankingRow({ pos, unidade, maxFaturamento, variant }: RowProps) {
  const pct = maxFaturamento > 0
    ? Math.max(4, (unidade.faturamento_dia / maxFaturamento) * 100)
    : 4
  const isTop = variant === 'top'
  const { local, uf } = nomeCurto(unidade)

  return (
    <div className="grid grid-cols-[24px_1fr_132px] items-center gap-4">
      <span className="text-[15px] font-semibold text-fg-dim text-right">{pos}</span>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[17px] font-medium tracking-[-0.01em] truncate">{local}</span>
          {uf && (
            <span className="text-xs font-semibold tracking-[0.08em] text-fg-dim shrink-0">
              {uf}
            </span>
          )}
        </div>
        <div className="h-[5px] rounded-full bg-surface2 mt-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-[1300ms] ease-out ${
              isTop ? 'bg-gold' : 'bg-neg'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <span
        className={`text-xl font-semibold tracking-[-0.025em] text-right ${
          isTop ? 'text-fg' : 'text-neg'
        }`}
      >
        {formatCurrency(unidade.faturamento_dia)}
      </span>
    </div>
  )
}

export default function RankingSection({ ranking }: Props) {
  const top5 = ranking.slice(0, 5)
  // Bottom 5: menores faturamentos com valor > 0 (unidades zeradas aparecem
  // na cobertura da rede, não aqui)
  const bottom5 = ranking.filter((u) => u.faturamento_dia > 0).slice(-5).reverse()

  // bottom5 está em ordem crescente: o máximo é o último, não o primeiro
  const maxTop = top5[0]?.faturamento_dia ?? 1
  const maxBottom = bottom5.length > 0
    ? Math.max(...bottom5.map((u) => u.faturamento_dia))
    : 1

  return (
    <section className="flex-1 min-h-0 overflow-hidden px-[60px] flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-4 mb-5 rise" style={{ animationDelay: '0.46s' }}>
          <span className="text-sm font-medium uppercase tracking-[0.14em] text-fg-muted">
            Maiores faturamentos
          </span>
          <span className="flex-1 h-px bg-white/[0.07]" />
        </div>
        <div className="flex flex-col gap-3 rise" style={{ animationDelay: '0.46s' }}>
          {top5.map((u, i) => (
            <RankingRow key={u.id} pos={i + 1} unidade={u} maxFaturamento={maxTop} variant="top" />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-4 mb-5 rise" style={{ animationDelay: '0.52s' }}>
          <span className="text-sm font-medium uppercase tracking-[0.14em] text-neg">
            Requerem atenção
          </span>
          <span className="flex-1 h-px bg-white/[0.07]" />
        </div>
        <div className="flex flex-col gap-3 rise" style={{ animationDelay: '0.52s' }}>
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
    </section>
  )
}
