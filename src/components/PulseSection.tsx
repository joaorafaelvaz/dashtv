import { Fragment } from 'react'
import { formatNumber } from '@/lib/utils/format'
import { toneLowerIsBetter, toneHigherIsBetter, type KpiTone } from '@/lib/utils/dashboard'

interface Props {
  agendamentos: number
  slotsLivres: number
  emAtendimento: number
  atendimentos: number
  servicosRealizados: number
  walkIns: number
  taxaOcupacao: number
  taxaNoShow: number
  taxaCancelamento: number
  unidadesFaturando: number
  unidadesTotal: number
}

/**
 * Semântica em duas cores: o âmbar é a cor da marca, então o estado
 * intermediário fica neutro em vez de amarelo — senão competiria com o accent.
 */
const TONE: Record<KpiTone, string> = {
  neutral: 'text-fg',
  good: 'text-pos',
  warn: 'text-fg',
  bad: 'text-neg',
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-[26px]">
      <span className="text-sm font-medium uppercase tracking-[0.14em] text-fg-muted">
        {children}
      </span>
      <span className="flex-1 h-px bg-white/[0.07]" />
    </div>
  )
}

export default function PulseSection({
  agendamentos,
  slotsLivres,
  emAtendimento,
  atendimentos,
  servicosRealizados,
  walkIns,
  taxaOcupacao,
  taxaNoShow,
  taxaCancelamento,
  unidadesFaturando,
  unidadesTotal,
}: Props) {
  const semVenda = Math.max(0, unidadesTotal - unidadesFaturando)

  const etapas = [
    {
      k: 'Agendados',
      v: formatNumber(agendamentos),
      s: `${formatNumber(slotsLivres)} slots livres`,
      c: 'text-fg',
    },
    {
      k: 'Em atendimento',
      v: formatNumber(emAtendimento),
      s: 'agora nas cadeiras',
      c: 'text-gold',
    },
    {
      k: 'Atendimentos',
      v: formatNumber(atendimentos),
      s: `${formatNumber(servicosRealizados)} via agenda · ${formatNumber(walkIns)} walk-in`,
      c: 'text-fg',
    },
  ]

  const vitais = [
    { k: 'Ocupação', v: `${taxaOcupacao}`, u: '%', tone: toneHigherIsBetter(taxaOcupacao, 50, 30) },
    { k: 'No-show', v: `${taxaNoShow.toFixed(1)}`, u: '%', tone: toneLowerIsBetter(taxaNoShow, 5, 10) },
    { k: 'Cancelamento', v: `${taxaCancelamento.toFixed(1)}`, u: '%', tone: toneLowerIsBetter(taxaCancelamento, 5, 10) },
    { k: 'Walk-in', v: formatNumber(walkIns), u: '', tone: 'neutral' as KpiTone },
  ]

  return (
    <section className="px-[60px] mb-5 shrink-0">
      <div className="rise" style={{ animationDelay: '0.28s' }}>
        <SectionTitle>O pulso</SectionTitle>
      </div>

      {/* --- funil: dá relação causal aos números --- */}
      <div
        className="grid grid-cols-[1fr_40px_1fr_40px_1fr] items-center mb-[30px] rise"
        style={{ animationDelay: '0.28s' }}
      >
        {etapas.map((e, i) => (
          <Fragment key={e.k}>
            {i > 0 && <div className="text-center text-fg-dim text-[22px]">→</div>}
            <div className="text-center">
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-fg-dim">
                {e.k}
              </p>
              <p className={`text-[62px] font-bold leading-none tracking-[-0.04em] mt-3 ${e.c}`}>
                {e.v}
              </p>
              <p className="text-[13px] font-medium text-fg-dim mt-[11px]">{e.s}</p>
            </div>
          </Fragment>
        ))}
      </div>

      {/* --- vitais: superfície única dividida por fios --- */}
      <div
        className="grid grid-cols-4 rounded-2xl bg-surface overflow-hidden rise"
        style={{ animationDelay: '0.34s' }}
      >
        {vitais.map((v, i) => (
          <div
            key={v.k}
            className={`px-[18px] py-6 text-center ${
              i > 0 ? 'shadow-[inset_1px_0_0_rgba(255,255,255,0.07)]' : ''
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-dim">{v.k}</p>
            <p className={`text-[40px] font-bold leading-none tracking-[-0.035em] mt-3 ${TONE[v.tone]}`}>
              {v.v}
              {v.u && <span className="text-xl font-semibold text-fg-dim ml-px">{v.u}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* --- cobertura da rede: onde as unidades zeradas ficam visíveis --- */}
      <div
        className="mt-[22px] grid grid-cols-[auto_1fr_auto] gap-[30px] items-center
                   rounded-2xl bg-surface px-[26px] py-6 rise"
        style={{ animationDelay: '0.34s' }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-dim">
            Unidades faturando
          </p>
          <p className="text-[38px] font-bold leading-none tracking-[-0.035em] mt-2.5">
            {unidadesFaturando}
            <span className="text-[22px] font-semibold text-fg-dim"> / {unidadesTotal}</span>
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-[7px]">
          {Array.from({ length: unidadesTotal }, (_, i) => (
            <span
              key={i}
              className={`h-[11px] w-[11px] rounded-full ${
                i < unidadesFaturando
                  ? 'bg-gold'
                  : 'shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.14)]'
              }`}
            />
          ))}
        </div>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-dim">Sem venda</p>
          <p
            className={`text-[38px] font-bold leading-none tracking-[-0.035em] mt-2.5 ${
              semVenda > 0 ? 'text-neg' : 'text-fg'
            }`}
          >
            {semVenda}
          </p>
        </div>
      </div>
    </section>
  )
}
