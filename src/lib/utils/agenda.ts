import type {
  AgendaItem,
  AgendaOrigem,
  AgendaRow,
  AgendaStatus,
  AgendaUnidade,
  BarbeiroAgenda,
  BarbeiroRow,
  Bloqueio,
  BloqueioRow,
} from '@/lib/types/agenda'

/** Slot usado quando o barbeiro não tem tempo_atendimento configurado. */
const SLOT_PADRAO_MIN = 30

/** "09:30" ou "09:30:00" → 570 */
export function toMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 570 → "09:30". Limitado a 00:00–24:00. */
export function hhmm(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function curto(hora: string | null): string | null {
  return hora ? hhmm(toMin(hora)) : null
}

function sobreposicao(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function slotDe(tempo: number | null): number {
  return tempo && tempo > 0 ? tempo : SLOT_PADRAO_MIN
}

/**
 * agendas.origem → tag exibida. 'app' é o único valor gravado literalmente
 * pelo sistema; os demais chegam por formulário. Sem valor conhecido = balcão.
 */
export function normalizarOrigem(origem: string | null): AgendaOrigem {
  const v = (origem ?? '').trim().toLowerCase()
  if (v === 'app') return 'app'
  if (v === 'web' || v === 'site') return 'web'
  return 'balcao'
}

/**
 * Agrupa as linhas de um barbeiro em agendamentos.
 *
 * O sistema grava um agendamento como uma linha por slot: a primeira é a
 * "pai" (id_pai NULL) e as demais apontam para ela. Todas têm o mesmo
 * serviço e cliente, então o agendamento vai do primeiro slot até o fim do
 * último. Linhas com `fechamento` são bloqueios de agenda, não atendimentos.
 */
export function agruparAgendamentos(linhas: AgendaRow[]): AgendaItem[] {
  const grupos = new Map<number, AgendaRow[]>()
  for (const l of linhas) {
    if (l.fechamento != null) continue
    const chave = l.id_pai ?? l.id
    const g = grupos.get(chave)
    if (g) g.push(l)
    else grupos.set(chave, [l])
  }

  const itens: AgendaItem[] = []
  for (const [id, g] of Array.from(grupos)) {
    const pai = g.find((l) => l.id === id) ?? g[0]
    const inicios = g.map((l) => toMin(l.hora))
    const ini = Math.min(...inicios)
    const fim = Math.max(...inicios) + slotDe(pai.tempo_atendimento)

    itens.push({
      id,
      inicio: hhmm(ini),
      fim: hhmm(fim),
      duracao: fim - ini,
      cliente: pai.cliente_nome,
      servico: pai.servico_nome,
      origem: normalizarOrigem(pai.origem),
      checkin: g.some((l) => !!l.checkin),
      checkout: g.some((l) => !!l.checkout),
      noShowMarcado: g.some((l) => l.status === 3),
      teveVenda: !!pai.teve_venda,
      convenio: !!pai.convenio,
      primeiraVisita: pai.cliente_id != null && !!pai.primeira_visita,
    })
  }
  return itens.sort((a, b) => toMin(a.inicio) - toMin(b.inicio))
}

/**
 * Bloqueios montados a partir das próprias linhas de agenda com `fechamento`.
 * Usado quando `agendas_fechamentos` não pode ser lida: perde o motivo, mas
 * os horários bloqueados continuam aparecendo. Slots contíguos viram um bloco.
 */
export function bloqueiosDeLinhas(linhas: AgendaRow[], slot: number): Bloqueio[] {
  const inicios = linhas
    .filter((l) => l.fechamento != null)
    .map((l) => toMin(l.hora))
    .sort((a, b) => a - b)

  const blocos: Bloqueio[] = []
  for (const m of inicios) {
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && toMin(ultimo.fim) >= m) {
      ultimo.fim = hhmm(Math.max(toMin(ultimo.fim), m + slot))
    } else {
      blocos.push({ inicio: hhmm(m), fim: hhmm(m + slot), motivo: null, ate: null })
    }
  }
  return blocos
}

/**
 * % do expediente ocupado por atendimentos. Almoço e bloqueios saem do
 * tempo disponível. null quando não há expediente hoje.
 */
export function calcularOcupacao(
  b: Pick<BarbeiroAgenda, 'abertura' | 'fechamento' | 'almocoInicio' | 'almocoFim'>,
  itens: AgendaItem[],
  bloqueios: Bloqueio[],
): number | null {
  if (!b.abertura || !b.fechamento) return null
  const a0 = toMin(b.abertura)
  const a1 = toMin(b.fechamento)

  let disponivel = a1 - a0
  if (b.almocoInicio && b.almocoFim) {
    disponivel -= sobreposicao(a0, a1, toMin(b.almocoInicio), toMin(b.almocoFim))
  }
  for (const bl of bloqueios) disponivel -= sobreposicao(a0, a1, toMin(bl.inicio), toMin(bl.fim))
  if (disponivel <= 0) return null

  const ocupado = itens.reduce((s, i) => s + sobreposicao(a0, a1, toMin(i.inicio), toMin(i.fim)), 0)
  return Math.min(100, Math.round((ocupado / disponivel) * 100))
}

/**
 * Faixa de horário do eixo vertical: do primeiro expediente/atendimento ao
 * último, arredondada para horas cheias. 08:00–20:00 quando não há nada.
 */
export function calcularEixo(barbeiros: BarbeiroAgenda[]): { inicio: string; fim: string } {
  let ini = Infinity
  let fim = -Infinity
  for (const b of barbeiros) {
    if (b.abertura) ini = Math.min(ini, toMin(b.abertura))
    if (b.fechamento) fim = Math.max(fim, toMin(b.fechamento))
    for (const i of b.agendamentos) {
      ini = Math.min(ini, toMin(i.inicio))
      fim = Math.max(fim, toMin(i.fim))
    }
  }
  if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) {
    return { inicio: '08:00', fim: '20:00' }
  }
  return {
    inicio: hhmm(Math.floor(ini / 60) * 60),
    fim: hhmm(Math.min(24 * 60, Math.ceil(fim / 60) * 60)),
  }
}

/**
 * Situação de um agendamento num dado minuto do dia.
 *
 * No-show segue a regra da operação: o horário passou, o cliente não fez
 * check-in nem checkout e não tem venda hoje. Venda hoje conta como
 * comparecimento só depois que o horário começou — antes disso pode ser de
 * outra visita do mesmo cliente no dia.
 */
export function statusAgendamento(item: AgendaItem, agoraMin: number): AgendaStatus {
  if (item.checkout) return 'finalizado'
  if (item.checkin) return 'em_atendimento'
  if (item.noShowMarcado) return 'no_show'
  if (agoraMin <= toMin(item.inicio)) return 'agendado'
  if (item.teveVenda) return 'finalizado'
  if (agoraMin >= toMin(item.fim)) return 'no_show'
  return 'atrasado'
}

/** Monta a agenda da unidade a partir das três consultas. */
export function montarAgenda(params: {
  unidade: { id: number; nome: string }
  data: string
  barbeiros: BarbeiroRow[]
  linhas: AgendaRow[]
  /** null quando agendas_fechamentos não pôde ser lida */
  bloqueios: BloqueioRow[] | null
}): Omit<AgendaUnidade, 'ultima_atualizacao'> {
  const { unidade, data, barbeiros, linhas, bloqueios } = params

  const linhasPorBarbeiro = new Map<number, AgendaRow[]>()
  for (const l of linhas) {
    const g = linhasPorBarbeiro.get(l.colaborador)
    if (g) g.push(l)
    else linhasPorBarbeiro.set(l.colaborador, [l])
  }

  // Barbeiros ativos da unidade + quem tem agenda hoje mesmo sem cadastro de
  // expediente (ex.: tempo_atendimento vazio) — ninguém com cliente some da tela.
  const base = barbeiros.map((b) => ({
    id: b.id,
    nome: b.nome,
    slot: slotDe(b.tempo_atendimento),
    abertura: curto(b.abertura),
    fechamento: curto(b.fechamento),
    almocoInicio: curto(b.almoco_inicio),
    almocoFim: curto(b.almoco_fim),
  }))
  const conhecidos = new Set(base.map((b) => b.id))
  for (const [id, ls] of Array.from(linhasPorBarbeiro)) {
    if (conhecidos.has(id)) continue
    base.push({
      id,
      nome: ls[0].colaborador_nome,
      slot: slotDe(ls[0].tempo_atendimento),
      abertura: null,
      fechamento: null,
      almocoInicio: null,
      almocoFim: null,
    })
  }

  const resultado: BarbeiroAgenda[] = base.map((b) => {
    const ls = linhasPorBarbeiro.get(b.id) ?? []
    const agendamentos = agruparAgendamentos(ls)
    const blocos: Bloqueio[] = bloqueios
      ? bloqueios
          .filter((bl) => bl.colaborador == null || bl.colaborador === b.id)
          .map((bl) => ({
            inicio: hhmm(toMin(bl.inicio)),
            fim: hhmm(toMin(bl.fim)),
            motivo: bl.motivo,
            ate: bl.termina_depois ? bl.ate : null,
          }))
      : bloqueiosDeLinhas(ls, b.slot)

    return {
      id: b.id,
      nome: b.nome,
      abertura: b.abertura,
      fechamento: b.fechamento,
      almocoInicio: b.almocoInicio,
      almocoFim: b.almocoFim,
      ocupacao: calcularOcupacao(b, agendamentos, blocos),
      agendamentos,
      bloqueios: blocos,
    }
  })

  const eixo = calcularEixo(resultado)
  return { unidade, data, inicioDia: eixo.inicio, fimDia: eixo.fim, barbeiros: resultado }
}
