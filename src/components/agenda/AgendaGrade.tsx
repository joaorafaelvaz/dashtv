import type { CSSProperties } from 'react'
import type { AgendaItem, AgendaStatus, AgendaUnidade, BarbeiroAgenda } from '@/lib/types/agenda'
import { hhmm, statusAgendamento, toMin } from '@/lib/utils/agenda'

interface Props {
  agenda: AgendaUnidade
  /** minuto do dia agora; null antes do primeiro render no cliente */
  agoraMin: number | null
}

/** Hachura para fora do expediente, almoço e bloqueios. */
const HACHURA: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 10px)',
}

/** Atendimentos curtos usam layout de 2 linhas: horário + serviço, depois o cliente. */
const LIMITE_COMPACTO_MIN = 45

const CARD: Record<AgendaStatus, string> = {
  agendado: 'bg-surface2 border-l-gold',
  em_atendimento: 'bg-pos/[0.13] border-l-pos',
  finalizado: 'bg-surface2 border-l-fg-dim opacity-50',
  atrasado: 'bg-surface2 border-l-neg',
  no_show: 'bg-neg/[0.07] border-l-neg opacity-60',
}

const TAG_STATUS: Partial<Record<AgendaStatus, { texto: string; classe: string }>> = {
  em_atendimento: { texto: 'Na cadeira', classe: 'bg-pos text-ink' },
  finalizado: { texto: 'Finalizado', classe: 'bg-white/10 text-fg-muted' },
  atrasado: { texto: 'Atrasado', classe: 'bg-neg/20 text-neg' },
  no_show: { texto: 'Não veio', classe: 'bg-neg text-ink' },
}

const TAG_ORIGEM: Record<AgendaItem['origem'], { texto: string; classe: string }> = {
  app: { texto: 'App', classe: 'bg-gold text-ink' },
  web: { texto: 'Web', classe: 'bg-fg text-ink' },
  balcao: { texto: 'Balcão', classe: 'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] text-fg-muted' },
}

function Tag({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className={`rounded-[3px] px-[0.45em] py-[0.12em] text-[0.6em] font-bold uppercase tracking-[0.08em] ${classe}`}>
      {texto}
    </span>
  )
}

function Card({ item, status, topo, altura }: { item: AgendaItem; status: AgendaStatus; topo: number; altura: number }) {
  const compacto = item.duracao < LIMITE_COMPACTO_MIN
  const tagStatus = TAG_STATUS[status]
  const origem = TAG_ORIGEM[item.origem]

  return (
    <div
      className={`absolute left-[4px] right-[4px] z-10 overflow-hidden rounded-md border-l-[3px] px-[0.55em] py-[0.28em] ${CARD[status]}`}
      style={{ top: `calc(${topo}% + 1px)`, height: `calc(${altura}% - 2px)` }}
    >
      <div className="flex items-center gap-[0.4em] whitespace-nowrap leading-tight">
        <span className="text-[0.8em] font-semibold text-fg-muted">
          {item.inicio}–{item.fim}
        </span>
        {compacto && <span className="min-w-0 truncate text-[0.8em] text-fg-muted">· {item.servico ?? '—'}</span>}
        <span className="ml-auto flex shrink-0 gap-[0.25em]">
          <Tag {...origem} />
          {tagStatus && <Tag {...tagStatus} />}
        </span>
      </div>

      <div className="mt-[0.1em] flex items-center gap-[0.35em] leading-tight">
        <span
          className={`truncate text-[1em] font-semibold ${
            status === 'no_show' ? 'line-through decoration-neg/60' : ''
          }`}
        >
          {item.cliente ?? 'Cliente não identificado'}
        </span>
        {item.convenio && (
          <span
            title="Tem convênio"
            className="shrink-0 rounded-[3px] px-[0.3em] text-[0.6em] font-bold text-fg-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
          >
            C
          </span>
        )}
        {item.primeiraVisita && (
          <span title="Primeira visita" className="h-[0.42em] w-[0.42em] shrink-0 rounded-full bg-gold" />
        )}
      </div>

      {!compacto && (
        <div className="mt-[0.1em] truncate text-[0.85em] leading-tight text-fg-muted">
          {item.servico ?? 'Serviço não informado'} · {item.duracao} min
        </div>
      )}
    </div>
  )
}

/** Faixa hachurada (fora do expediente, almoço, bloqueio) com rótulo opcional. */
function Faixa({ topo, altura, rotulo, centro }: { topo: number; altura: number; rotulo?: string; centro?: boolean }) {
  if (altura <= 0) return null
  return (
    <div className="absolute inset-x-0" style={{ top: `${topo}%`, height: `${altura}%`, ...HACHURA }}>
      {rotulo && (
        <span
          className={`absolute px-[0.7em] text-[0.8em] font-medium text-fg-dim ${
            centro ? 'inset-x-0 pt-[1.2em] text-center' : 'left-0 top-0 pt-[0.5em]'
          }`}
        >
          {rotulo}
        </span>
      )}
    </div>
  )
}

function Coluna({
  barbeiro,
  pct,
  inicioDia,
  fimDia,
  horas,
  agoraMin,
}: {
  barbeiro: BarbeiroAgenda
  pct: (min: number) => number
  inicioDia: number
  fimDia: number
  horas: number[]
  agoraMin: number | null
}) {
  const faixa = (de: number, ate: number) => {
    const a = Math.max(de, inicioDia)
    const b = Math.min(ate, fimDia)
    return { topo: pct(a), altura: pct(b) - pct(a) }
  }

  const semExpediente = !barbeiro.abertura || !barbeiro.fechamento
  // Bloqueio que cobre todo o expediente = agenda fechada no dia (férias, folga…)
  const bloqueioDoDia = semExpediente
    ? undefined
    : barbeiro.bloqueios.find(
        (bl) => toMin(bl.inicio) <= toMin(barbeiro.abertura!) && toMin(bl.fim) >= toMin(barbeiro.fechamento!),
      )
  const rotuloDia = bloqueioDoDia
    ? ['Agenda fechada', bloqueioDoDia.motivo, bloqueioDoDia.ate && `até ${bloqueioDoDia.ate}`]
        .filter(Boolean)
        .join(' · ')
    : semExpediente && barbeiro.agendamentos.length === 0
      ? 'Sem expediente hoje'
      : undefined

  const agoraVisivel = agoraMin != null && agoraMin >= inicioDia && agoraMin <= fimDia

  return (
    <div className="relative min-h-0 overflow-hidden rounded-xl bg-surface">
      {horas.map((h) => (
        <div key={h} className="absolute inset-x-0 h-px bg-white/[0.05]" style={{ top: `${pct(h)}%` }} />
      ))}

      {semExpediente || bloqueioDoDia ? (
        <Faixa topo={0} altura={100} rotulo={rotuloDia} centro />
      ) : (
        <>
          <Faixa {...faixa(inicioDia, toMin(barbeiro.abertura!))} />
          <Faixa {...faixa(toMin(barbeiro.fechamento!), fimDia)} />
          {barbeiro.almocoInicio && barbeiro.almocoFim && (
            <Faixa {...faixa(toMin(barbeiro.almocoInicio), toMin(barbeiro.almocoFim))} rotulo="Almoço" />
          )}
          {barbeiro.bloqueios.map((bl, i) => (
            <Faixa key={i} {...faixa(toMin(bl.inicio), toMin(bl.fim))} rotulo={bl.motivo ?? 'Bloqueado'} />
          ))}
        </>
      )}

      {barbeiro.agendamentos.map((item) => {
        const { topo, altura } = faixa(toMin(item.inicio), toMin(item.fim))
        if (altura <= 0) return null
        const status = agoraMin == null ? 'agendado' : statusAgendamento(item, agoraMin)
        return <Card key={item.id} item={item} status={status} topo={topo} altura={altura} />
      })}

      {agoraVisivel && (
        <div
          className="absolute inset-x-0 z-20 h-[2px] bg-gold shadow-[0_0_8px_rgba(217,180,55,0.6)]"
          style={{ top: `${pct(agoraMin!)}%` }}
        />
      )}
    </div>
  )
}

export default function AgendaGrade({ agenda, agoraMin }: Props) {
  const inicioDia = toMin(agenda.inicioDia)
  const fimDia = toMin(agenda.fimDia)
  const total = Math.max(1, fimDia - inicioDia)
  const pct = (min: number) => ((min - inicioDia) / total) * 100

  const horas: number[] = []
  for (let h = Math.ceil(inicioDia / 60) * 60; h < fimDia; h += 60) horas.push(h)

  if (agenda.barbeiros.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-[1.2em] text-fg-dim">
        Nenhum barbeiro ativo nesta unidade.
      </div>
    )
  }

  const agoraVisivel = agoraMin != null && agoraMin >= inicioDia && agoraMin <= fimDia

  return (
    <div
      className="grid min-h-0 flex-1 gap-x-[0.5em] px-[1.6em] pb-[1.2em]"
      style={{
        gridTemplateColumns: `3.4em repeat(${agenda.barbeiros.length}, minmax(0, 1fr))`,
        gridTemplateRows: 'auto minmax(0, 1fr)',
      }}
    >
      {/* ---- cabeçalhos ---- */}
      <div />
      {agenda.barbeiros.map((b) => (
        <div key={b.id} className="min-w-0 pb-[0.65em]">
          <div className="flex items-baseline justify-between gap-[0.5em]">
            <span className="truncate text-[1.1em] font-semibold">{b.nome}</span>
            <span className="shrink-0 text-[0.85em] font-semibold text-gold">
              {b.ocupacao == null ? '—' : `${b.ocupacao}%`}
            </span>
          </div>
          <div className="mt-[0.45em] h-[3px] overflow-hidden rounded-full bg-surface2">
            <div className="h-full rounded-full bg-gold" style={{ width: `${b.ocupacao ?? 0}%` }} />
          </div>
        </div>
      ))}

      {/* ---- régua de horas ---- */}
      <div className="relative min-h-0">
        {horas.map((h, i) => (
          <span
            key={h}
            className={`absolute right-[0.6em] text-[0.78em] font-medium text-fg-dim ${
              i === 0 && h === inicioDia ? '' : '-translate-y-1/2'
            }`}
            style={{ top: `${pct(h)}%` }}
          >
            {hhmm(h)}
          </span>
        ))}
        {agoraVisivel && (
          <span
            className="absolute right-0 z-20 -translate-y-1/2 rounded-[4px] bg-gold px-[0.35em] py-[0.05em] text-[0.75em] font-bold text-ink"
            style={{ top: `${pct(agoraMin!)}%` }}
          >
            {hhmm(Math.floor(agoraMin!))}
          </span>
        )}
      </div>

      {/* ---- colunas ---- */}
      {agenda.barbeiros.map((b) => (
        <Coluna
          key={b.id}
          barbeiro={b}
          pct={pct}
          inicioDia={inicioDia}
          fimDia={fimDia}
          horas={horas}
          agoraMin={agoraMin}
        />
      ))}
    </div>
  )
}
