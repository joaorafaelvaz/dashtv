import {
  agruparAgendamentos,
  bloqueiosDeLinhas,
  calcularEixo,
  calcularOcupacao,
  hhmm,
  montarAgenda,
  normalizarOrigem,
  statusAgendamento,
  toMin,
} from '../agenda'
import type { AgendaItem, AgendaLinha, AgendaRow, BarbeiroAgenda, BarbeiroRow, BloqueioRow } from '@/lib/types/agenda'

function linha(p: Partial<AgendaLinha> & { id: number; hora: string }): AgendaRow {
  return {
    id_pai: null,
    colaborador: 1,
    colaborador_nome: 'Barbeiro',
    tempo_atendimento: 30,
    origem: 'app',
    checkin: 0,
    checkout: 0,
    status: 1,
    fechamento: null,
    cliente_id: 10,
    cliente_nome: 'Cliente A',
    convenio: 0,
    primeira_visita: 0,
    teve_venda: 0,
    servico_nome: 'Corte',
    ...p,
  } as AgendaRow
}

function item(p: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: 1,
    inicio: '10:00',
    fim: '10:30',
    duracao: 30,
    cliente: 'Cliente A',
    servico: 'Corte',
    origem: 'app',
    checkin: false,
    checkout: false,
    noShowMarcado: false,
    teveVenda: false,
    convenio: false,
    primeiraVisita: false,
    ...p,
  }
}

describe('toMin / hhmm', () => {
  it('converte nos dois sentidos', () => {
    expect(toMin('09:30')).toBe(570)
    expect(toMin('09:30:00')).toBe(570)
    expect(hhmm(570)).toBe('09:30')
  })

  it('limita a 00:00–24:00', () => {
    expect(hhmm(-10)).toBe('00:00')
    expect(hhmm(1500)).toBe('24:00')
  })
})

describe('normalizarOrigem', () => {
  it('mapeia app, web/site e o resto como balcão', () => {
    expect(normalizarOrigem('app')).toBe('app')
    expect(normalizarOrigem(' APP ')).toBe('app')
    expect(normalizarOrigem('site')).toBe('web')
    expect(normalizarOrigem('web')).toBe('web')
    expect(normalizarOrigem('sis')).toBe('balcao')
    expect(normalizarOrigem(null)).toBe('balcao')
  })
})

describe('agruparAgendamentos', () => {
  it('une pai e slots filhos em um só agendamento', () => {
    // Corte + Barba de 60 min = 2 slots de 30
    const itens = agruparAgendamentos([
      linha({ id: 1, hora: '10:00', servico_nome: 'Corte + Barba' }),
      linha({ id: 2, id_pai: 1, hora: '10:30', servico_nome: 'Corte + Barba' }),
    ])
    expect(itens).toHaveLength(1)
    expect(itens[0]).toMatchObject({ id: 1, inicio: '10:00', fim: '11:00', duracao: 60, servico: 'Corte + Barba' })
  })

  it('usa o tempo_atendimento do barbeiro como tamanho do slot', () => {
    const [i] = agruparAgendamentos([linha({ id: 1, hora: '09:00', tempo_atendimento: 45 })])
    expect(i.fim).toBe('09:45')
  })

  it('cai para slot de 30 min quando o barbeiro não tem tempo configurado', () => {
    const [i] = agruparAgendamentos([linha({ id: 1, hora: '09:00', tempo_atendimento: null })])
    expect(i.fim).toBe('09:30')
  })

  it('ignora linhas de bloqueio (fechamento preenchido)', () => {
    const itens = agruparAgendamentos([
      linha({ id: 1, hora: '12:00', fechamento: 99, cliente_id: null, cliente_nome: null }),
      linha({ id: 2, hora: '13:00' }),
    ])
    expect(itens.map((i) => i.id)).toEqual([2])
  })

  it('propaga check-in e checkout de qualquer slot do grupo', () => {
    const [i] = agruparAgendamentos([
      linha({ id: 1, hora: '10:00' }),
      linha({ id: 2, id_pai: 1, hora: '10:30', checkin: 1 }),
    ])
    expect(i.checkin).toBe(true)
  })

  it('ordena por horário de início', () => {
    const itens = agruparAgendamentos([linha({ id: 5, hora: '15:00' }), linha({ id: 3, hora: '09:00' })])
    expect(itens.map((i) => i.inicio)).toEqual(['09:00', '15:00'])
  })

  it('só marca primeira visita quando há cliente', () => {
    const [semCliente] = agruparAgendamentos([
      linha({ id: 1, hora: '10:00', cliente_id: null, primeira_visita: 1 }),
    ])
    expect(semCliente.primeiraVisita).toBe(false)
  })
})

describe('bloqueiosDeLinhas', () => {
  it('funde slots bloqueados contíguos em um bloco', () => {
    const blocos = bloqueiosDeLinhas(
      [
        linha({ id: 1, hora: '12:00', fechamento: 7 }),
        linha({ id: 2, hora: '12:30', fechamento: 7 }),
        linha({ id: 3, hora: '15:00', fechamento: 8 }),
        linha({ id: 4, hora: '10:00' }), // atendimento, não bloqueio
      ],
      30,
    )
    expect(blocos).toEqual([
      { inicio: '12:00', fim: '13:00', motivo: null, ate: null },
      { inicio: '15:00', fim: '15:30', motivo: null, ate: null },
    ])
  })
})

describe('calcularOcupacao', () => {
  const expediente = { abertura: '09:00', fechamento: '18:00', almocoInicio: '12:00', almocoFim: '13:00' }

  it('desconta o almoço do tempo disponível', () => {
    // 540 min - 60 de almoço = 480 disponíveis; 240 ocupados = 50%
    const itens = [item({ inicio: '09:00', fim: '11:00' }), item({ inicio: '14:00', fim: '16:00' })]
    expect(calcularOcupacao(expediente, itens, [])).toBe(50)
  })

  it('desconta bloqueios do tempo disponível', () => {
    // disponível = 540 - 60 (almoço) - 300 (bloqueio) = 180; ocupado 120 → 67%
    const r = calcularOcupacao(
      expediente,
      [item({ inicio: '09:00', fim: '11:00' })],
      [{ inicio: '13:00', fim: '18:00', motivo: 'Consulta', ate: null }],
    )
    expect(r).toBe(67)
  })

  it('retorna null sem expediente ou com o dia todo bloqueado', () => {
    const semExpediente = { abertura: null, fechamento: null, almocoInicio: null, almocoFim: null }
    expect(calcularOcupacao(semExpediente, [], [])).toBeNull()
    expect(calcularOcupacao(expediente, [], [{ inicio: '00:00', fim: '24:00', motivo: 'Férias', ate: '20/10' }])).toBeNull()
  })

  it('nunca passa de 100%', () => {
    const umaHora = { abertura: '09:00', fechamento: '10:00', almocoInicio: null, almocoFim: null }
    const duplicados = [item({ inicio: '09:00', fim: '10:00' }), item({ inicio: '09:00', fim: '10:00' })]
    expect(calcularOcupacao(umaHora, duplicados, [])).toBe(100)
  })
})

describe('calcularEixo', () => {
  function barbeiro(p: Partial<BarbeiroAgenda>): BarbeiroAgenda {
    return {
      id: 1, nome: 'B', abertura: null, fechamento: null, almocoInicio: null, almocoFim: null,
      ocupacao: null, agendamentos: [], bloqueios: [], ...p,
    }
  }

  it('arredonda para horas cheias', () => {
    expect(calcularEixo([barbeiro({ abertura: '09:15', fechamento: '18:40' })])).toEqual({ inicio: '09:00', fim: '19:00' })
  })

  it('estende para atendimentos fora do expediente', () => {
    const b = barbeiro({ abertura: '09:00', fechamento: '18:00', agendamentos: [item({ inicio: '18:30', fim: '19:30' })] })
    expect(calcularEixo([b]).fim).toBe('20:00')
  })

  it('usa 08:00–20:00 quando não há nada', () => {
    expect(calcularEixo([barbeiro({})])).toEqual({ inicio: '08:00', fim: '20:00' })
  })
})

describe('statusAgendamento', () => {
  const i = item({ inicio: '10:00', fim: '10:30' })

  it('agendado antes do horário', () => {
    expect(statusAgendamento(i, toMin('09:50'))).toBe('agendado')
  })

  it('atrasado depois do início, sem check-in', () => {
    expect(statusAgendamento(i, toMin('10:10'))).toBe('atrasado')
  })

  it('no-show quando o horário inteiro passou sem check-in, checkout nem venda', () => {
    expect(statusAgendamento(i, toMin('10:45'))).toBe('no_show')
  })

  it('venda do cliente hoje conta como comparecimento após o início', () => {
    expect(statusAgendamento({ ...i, teveVenda: true }, toMin('10:45'))).toBe('finalizado')
  })

  it('venda anterior ao horário não antecipa o status', () => {
    expect(statusAgendamento({ ...i, teveVenda: true }, toMin('09:00'))).toBe('agendado')
  })

  it('check-in e checkout têm prioridade', () => {
    expect(statusAgendamento({ ...i, checkin: true }, toMin('11:00'))).toBe('em_atendimento')
    expect(statusAgendamento({ ...i, checkin: true, checkout: true }, toMin('11:00'))).toBe('finalizado')
  })

  it('respeita no-show marcado no sistema', () => {
    expect(statusAgendamento({ ...i, noShowMarcado: true }, toMin('09:00'))).toBe('no_show')
  })
})

describe('montarAgenda', () => {
  const unidade = { id: 62, nome: 'VIP Centro' }
  const barbeiros = [
    { id: 1, nome: 'Anderson', tempo_atendimento: 30, abertura: '09:00:00', fechamento: '18:00:00', almoco_inicio: null, almoco_fim: null },
  ] as BarbeiroRow[]

  it('inclui quem tem agenda hoje mesmo fora da lista de barbeiros', () => {
    const r = montarAgenda({
      unidade,
      data: '2026-10-05',
      barbeiros,
      linhas: [linha({ id: 1, hora: '10:00', colaborador: 9, colaborador_nome: 'Avulso' })],
      bloqueios: [],
    })
    expect(r.barbeiros.map((b) => b.nome)).toEqual(['Anderson', 'Avulso'])
    expect(r.barbeiros[1].agendamentos).toHaveLength(1)
  })

  it('aplica bloqueio da unidade inteira (colaborador NULL) a todos', () => {
    const feriado = { colaborador: null, motivo: 'Feriado', inicio: '00:00', fim: '24:00', termina_depois: 0, ate: '05/10' } as BloqueioRow
    const r = montarAgenda({ unidade, data: '2026-10-05', barbeiros, linhas: [], bloqueios: [feriado] })
    expect(r.barbeiros[0].bloqueios[0]).toMatchObject({ motivo: 'Feriado', ate: null })
  })

  it('usa os bloqueios das linhas quando agendas_fechamentos não está disponível', () => {
    const r = montarAgenda({
      unidade,
      data: '2026-10-05',
      barbeiros,
      linhas: [linha({ id: 1, hora: '12:00', fechamento: 3, cliente_id: null })],
      bloqueios: null,
    })
    expect(r.barbeiros[0].bloqueios).toEqual([{ inicio: '12:00', fim: '12:30', motivo: null, ate: null }])
    expect(r.barbeiros[0].agendamentos).toHaveLength(0)
  })

  it('normaliza horários do expediente para HH:MM', () => {
    const r = montarAgenda({ unidade, data: '2026-10-05', barbeiros, linhas: [], bloqueios: [] })
    expect(r.barbeiros[0]).toMatchObject({ abertura: '09:00', fechamento: '18:00' })
    expect(r).toMatchObject({ inicioDia: '09:00', fimDia: '18:00' })
  })
})
