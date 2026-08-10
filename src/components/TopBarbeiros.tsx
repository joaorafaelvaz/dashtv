import { formatCurrency } from '@/lib/utils/format'
import type { TopBarbeiro } from '@/lib/types/dashboard'

interface Props {
  barbeiros: TopBarbeiro[]
}

export default function TopBarbeiros({ barbeiros }: Props) {
  return (
    <section className="px-[60px] mb-4 shrink-0">
      <div className="flex items-center gap-4 mb-[26px] rise" style={{ animationDelay: '0.40s' }}>
        <span className="text-sm font-medium uppercase tracking-[0.14em] text-fg-muted">
          Destaques do dia
        </span>
        <span className="flex-1 h-px bg-white/[0.07]" />
      </div>

      {barbeiros.length === 0 ? (
        <p className="text-[15px] text-fg-dim py-4">Nenhum atendimento concluído ainda.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3.5 rise" style={{ animationDelay: '0.40s' }}>
          {barbeiros.map((b, i) => {
            const unidade = [b.unidade_estado, b.unidade_cidade, b.unidade_bairro]
              .filter(Boolean)
              .join(' · ')
            const first = i === 0

            return (
              <div
                key={b.nome}
                className={`rounded-2xl bg-surface px-[22px] pt-[22px] pb-5 ${
                  first
                    ? 'bg-gradient-to-b from-gold-faint to-transparent shadow-[inset_0_0_0_1px_rgba(217,180,55,0.20)]'
                    : ''
                }`}
              >
                <p
                  className={`text-[13px] font-bold tracking-[0.10em] ${
                    first ? 'text-gold' : 'text-fg-dim'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-xl font-semibold tracking-[-0.015em] mt-3.5 truncate">
                  {b.nome}
                </p>
                <p className="text-[13px] font-medium text-fg-dim mt-1.5 truncate">{unidade}</p>

                <div className="flex items-baseline justify-between mt-[18px] pt-3.5 border-t border-white/[0.07]">
                  <span className="text-[26px] font-bold tracking-[-0.03em] text-gold">
                    {formatCurrency(b.faturamento)}
                  </span>
                  <span className="text-[13px] font-medium text-fg-dim">{b.servicos} serv.</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
