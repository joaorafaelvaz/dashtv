import { formatCurrency } from '@/lib/utils/format'
import type { TopBarbeiro } from '@/lib/types/dashboard'

interface Props {
  barbeiros: TopBarbeiro[]
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function TopBarbeiros({ barbeiros }: Props) {
  if (barbeiros.length === 0) {
    return (
      <section className="px-5 py-2 shrink-0">
        <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 p-4">
          <p className="text-[#FFD700] text-sm font-bold uppercase tracking-widest mb-2">
            ✂️ Top Barbeiros do Dia
          </p>
          <p className="text-gray-600 text-sm text-center py-2">Nenhum atendimento concluído ainda</p>
        </div>
      </section>
    )
  }

  return (
    <section className="px-5 py-2 shrink-0">
      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 p-4">
        <p className="text-[#FFD700] text-sm font-bold uppercase tracking-widest mb-3">
          ✂️ Top Barbeiros do Dia
        </p>
        <div className="space-y-2">
          {barbeiros.map((b, i) => {
            const partes = [b.unidade_estado, b.unidade_cidade, b.unidade_bairro].filter(Boolean)
            const unidade = partes.join(' - ')
            return (
              <div key={b.nome} className="flex items-center gap-3">
                <span className="text-2xl w-8 shrink-0">{MEDALS[i]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-white font-semibold text-base truncate max-w-[420px]">
                      {b.nome}
                      {unidade && (
                        <span className="text-gray-500 font-normal"> — {unidade}</span>
                      )}
                    </span>
                    <span className="text-[#D4AF37] font-bold text-base shrink-0 ml-2">
                      {formatCurrency(b.faturamento)}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">
                    {b.servicos} {b.servicos === 1 ? 'serviço' : 'serviços'} realizados
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
