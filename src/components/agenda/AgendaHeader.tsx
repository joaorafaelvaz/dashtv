interface Props {
  unidade: string
  data: string // "YYYY-MM-DD"
  agora: Date | null
  total: number
  naCadeira: number
  finalizados: number
  offline: boolean
}

/** "2026-10-05" → "Segunda-feira, 5 de outubro" (sem depender do fuso do navegador). */
function dataPorExtenso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const texto = new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return texto.replace(/^./, (c) => c.toUpperCase())
}

function Numero({ rotulo, valor, cor = 'text-fg' }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[0.72em] font-medium uppercase tracking-[0.14em] text-fg-dim">{rotulo}</span>
      <span className={`text-[1.6em] font-bold leading-none tracking-[-0.03em] mt-[0.2em] ${cor}`}>{valor}</span>
    </div>
  )
}

export default function AgendaHeader({ unidade, data, agora, total, naCadeira, finalizados, offline }: Props) {
  const hora = agora
    ? agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-[1.6em] pt-[1.1em] pb-[1em] shrink-0">
      <div className="flex items-baseline gap-[0.8em]">
        <span className="text-[2em] font-semibold tracking-[-0.02em]">{hora}</span>
        <span className="text-[1.05em] font-medium text-fg-muted">{dataPorExtenso(data)}</span>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-[1.25em] font-bold uppercase tracking-[0.28em] text-gold">Barbearia VIP</span>
        <span className="text-[0.8em] font-medium uppercase tracking-[0.2em] text-fg-dim mt-[0.35em]">
          {unidade} · Agenda do dia
        </span>
      </div>

      <div className="flex items-center justify-end gap-[1.6em]">
        <Numero rotulo="Agendamentos" valor={total} />
        <Numero rotulo="Na cadeira" valor={naCadeira} cor="text-pos" />
        <Numero rotulo="Finalizados" valor={finalizados} cor="text-fg-muted" />
        <span
          className={`flex items-center gap-[0.5em] rounded-full bg-surface px-[0.9em] py-[0.45em]
                      text-[0.72em] font-medium uppercase tracking-[0.13em]
                      shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]
                      ${offline ? 'text-neg' : 'text-fg-muted'}`}
        >
          <span className={`h-[0.55em] w-[0.55em] rounded-full ${offline ? 'bg-neg' : 'bg-pos animate-pulse'}`} />
          {offline ? 'Sem conexão' : 'Ao vivo'}
        </span>
      </div>
    </header>
  )
}
