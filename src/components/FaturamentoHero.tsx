import { splitCurrency, formatCurrencyShort, formatCurrency } from '@/lib/utils/format'
import { calcularRitmo } from '@/lib/utils/dashboard'

interface Props {
  faturamento: number
  media3meses: number
  faturamentoProjetado: number
  atendimentos: number
}

export default function FaturamentoHero({
  faturamento,
  media3meses,
  faturamentoProjetado,
  atendimentos,
}: Props) {
  const { inteiro, centavos } = splitCurrency(faturamento)
  const ticketMedio = atendimentos > 0 ? faturamento / atendimentos : 0
  const ritmo = calcularRitmo(faturamento, faturamentoProjetado, media3meses)

  return (
    <section className="px-[60px] pt-6 pb-8 shrink-0">
      <div className="grid grid-cols-[1fr_264px] gap-14 items-end">
        {/* --- número-herói --- */}
        <div className="rise" style={{ animationDelay: '0.10s' }}>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-fg-dim mb-4">
            Faturamento do dia
          </p>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[38px] font-semibold text-gold tracking-[-0.02em]">R$</span>
            <span className="text-[132px] font-bold leading-[0.88] tracking-[-0.045em]">
              {inteiro}
            </span>
            <span className="text-[44px] font-semibold text-fg-dim tracking-[-0.02em]">
              ,{centavos}
            </span>
          </div>
        </div>

        {/* --- apoio: hierarquia claramente menor --- */}
        <div className="flex flex-col rise" style={{ animationDelay: '0.16s' }}>
          {[
            { t: 'Projeção', v: formatCurrencyShort(faturamentoProjetado) },
            { t: 'Média · mesmo dia', v: formatCurrencyShort(media3meses) },
            { t: 'Ticket médio', v: formatCurrency(ticketMedio).replace('R$', '').trim() },
          ].map((s, i) => (
            <div
              key={s.t}
              className={`flex items-baseline justify-between py-[15px] ${
                i === 0 ? 'pt-0' : 'border-t border-white/[0.07]'
              }`}
            >
              <span className="text-[13px] font-medium uppercase tracking-[0.10em] text-fg-dim">
                {s.t}
              </span>
              <span className="text-[26px] font-semibold tracking-[-0.025em]">{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- ritmo do dia: contexto, não julgamento --- */}
      <div className="mt-10 rise" style={{ animationDelay: '0.22s' }}>
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-sm font-medium uppercase tracking-[0.14em] text-fg-dim">
            Ritmo do dia
          </span>
          <span className="text-[17px] font-medium text-fg-muted">
            projeção alcança{' '}
            <b className="font-bold text-gold">{Math.round(ritmo.pctDaMedia)}%</b> da média
          </span>
        </div>

        <div className="relative h-2 rounded-full bg-surface2">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gold-dim transition-[width] duration-[1500ms] ease-out"
            style={{ width: `${ritmo.projPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gold transition-[width] duration-[1700ms] ease-out"
            style={{ width: `${ritmo.realPct}%` }}
          />
          <div
            className="absolute -top-[7px] -bottom-[7px] w-0.5 rounded-sm bg-fg-muted opacity-65"
            style={{ left: `${ritmo.tickPct}%` }}
          />
        </div>

        <div className="flex gap-7 mt-[18px] text-[13px] font-medium text-fg-dim">
          <span className="flex items-center gap-2.5">
            <i className="h-1 w-3.5 rounded-sm bg-gold" />
            Realizado
          </span>
          <span className="flex items-center gap-2.5">
            <i className="h-1 w-3.5 rounded-sm bg-gold-dim" />
            Projetado
          </span>
          <span className="flex items-center gap-2.5">
            <i className="h-3 w-0.5 rounded-sm bg-fg-muted opacity-65" />
            Média do dia
          </span>
        </div>
      </div>
    </section>
  )
}
