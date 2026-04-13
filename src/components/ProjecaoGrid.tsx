import { formatCurrency } from '@/lib/utils/format'

interface Props {
  faturamentoProjetado: number
  media3meses: number
}

export default function ProjecaoGrid({ faturamentoProjetado, media3meses }: Props) {
  return (
    <section className="grid grid-cols-2 gap-4 px-5 py-2 shrink-0">
      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center py-6 gap-2">
        <p className="text-gray-400 text-xs uppercase tracking-widest">
          🎯 Fat. Projetado
        </p>
        <p className="text-4xl font-bold text-[#FFD700] leading-none text-center">
          {formatCurrency(faturamentoProjetado)}
        </p>
      </div>

      <div className="bg-[#141414] rounded-2xl border border-[#D4AF37]/15 flex flex-col items-center justify-center py-6 gap-2">
        <p className="text-gray-400 text-xs uppercase tracking-widest">
          📊 Méd. 3 Meses
        </p>
        <p className="text-4xl font-bold text-white leading-none text-center">
          {formatCurrency(media3meses)}
        </p>
        <p className="text-gray-600 text-xs">mesmo dia da semana</p>
      </div>
    </section>
  )
}
