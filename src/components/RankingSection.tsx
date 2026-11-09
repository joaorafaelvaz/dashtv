import { formatCurrency, nomeUnidadeCurto } from '@/lib/utils/format'
import { useContagem } from '@/lib/hooks/useVendasAoVivo'
import type { RankingUnidade } from '@/lib/types/dashboard'

interface Props {
  ranking: RankingUnidade[]
  /** Unidades da venda sendo anunciada agora — a linha delas pisca em dourado */
  destaque?: { vendaId: number; unidades: number[] } | null
}

interface RowProps {
  pos: number
  unidade: RankingUnidade
  maxFaturamento: number
  variant: 'top' | 'bottom'
  flashKey?: number
}

function nomeCurto(u: RankingUnidade): { local: string; uf: string } {
  return nomeUnidadeCurto(u.nome ?? `${u.cidade} - ${u.bairro}`)
}

function RankingRow({ pos, unidade, maxFaturamento, variant, flashKey }: RowProps) {
  const valor = useContagem(Number(unidade.faturamento_dia))
  const pct = maxFaturamento > 0
    ? Math.max(4, (unidade.faturamento_dia / maxFaturamento) * 100)
    : 4
  const isTop = variant === 'top'
  const { local, uf } = nomeCurto(unidade)

  return (
    <div
      // flashKey muda a cada venda: remonta só o brilho, não a linha
      className="relative grid grid-cols-[24px_1fr_132px] items-center gap-4"
    >
      {flashKey !== undefined && (
        <span key={flashKey} className="row-flash pointer-events-none absolute -inset-x-4 -inset-y-1.5 rounded-xl" />
      )}
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
        {formatCurrency(valor)}
      </span>
    </div>
  )
}

export default function RankingSection({ ranking, destaque }: Props) {
  const flash = (id: number) =>
    destaque && destaque.unidades.includes(id) ? destaque.vendaId : undefined
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
            <RankingRow
              key={u.id}
              pos={i + 1}
              unidade={u}
              maxFaturamento={maxTop}
              variant="top"
              flashKey={flash(u.id)}
            />
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
              flashKey={flash(u.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
