import {
  getDayColumn,
  calcularVariacaoPct,
  timeToMinutes,
  calcularSlotsLivres,
} from '../dashboard'
import type { BarberSchedule } from '@/lib/types/dashboard'

describe('getDayColumn', () => {
  it('retorna faturamento_segunda para segunda-feira', () => {
    // 2026-04-13 é segunda-feira
    expect(getDayColumn(new Date('2026-04-13T12:00:00'))).toBe('faturamento_segunda')
  })

  it('retorna faturamento_domingo para domingo', () => {
    // 2026-04-12 é domingo
    expect(getDayColumn(new Date('2026-04-12T12:00:00'))).toBe('faturamento_domingo')
  })

  it('retorna faturamento_sabado para sábado', () => {
    // 2026-04-11 é sábado
    expect(getDayColumn(new Date('2026-04-11T12:00:00'))).toBe('faturamento_sabado')
  })

  it('mapeia todos os 7 dias corretamente', () => {
    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
    // getDay(): 0=Dom, 1=Seg, ..., 6=Sáb
    const base = new Date('2026-04-12T12:00:00') // domingo
    dias.forEach((dia, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      expect(getDayColumn(d)).toBe(`faturamento_${dia}`)
    })
  })

  it('lança erro para Date inválido', () => {
    expect(() => getDayColumn(new Date('invalid'))).toThrow('getDayColumn: invalid Date')
  })
})

describe('calcularVariacaoPct', () => {
  it('retorna 0 quando referência é 0 (evita divisão por zero)', () => {
    expect(calcularVariacaoPct(1000, 0)).toBe(0)
  })

  it('retorna 100 quando atual é o dobro da referência', () => {
    expect(calcularVariacaoPct(200, 100)).toBe(100)
  })

  it('retorna -50 quando atual é metade da referência', () => {
    expect(calcularVariacaoPct(50, 100)).toBe(-50)
  })

  it('retorna 0 quando atual === referência', () => {
    expect(calcularVariacaoPct(100, 100)).toBe(0)
  })
})

describe('timeToMinutes', () => {
  it('converte 09:00:00 em 540 minutos', () => {
    expect(timeToMinutes('09:00:00')).toBe(540)
  })

  it('converte 18:30:00 em 1110 minutos', () => {
    expect(timeToMinutes('18:30:00')).toBe(1110)
  })

  it('converte 00:00:00 em 0', () => {
    expect(timeToMinutes('00:00:00')).toBe(0)
  })

  it('converte 09:00:30 em 541 minutos (30s arredondado)', () => {
    expect(timeToMinutes('09:00:30')).toBe(541)
  })
})

describe('calcularSlotsLivres', () => {
  const barbeiro = {
    id: 1,
    tempo_atendimento: 30,
    abertura: '09:00:00',    // 540 min
    fechamento: '18:00:00',  // 1080 min → 540 min disponíveis → 18 slots
    almoco_inicio: null,
    almoco_fim: null,
  } as BarberSchedule

  it('calcula 18 slots para 9h de trabalho com atendimento de 30min', () => {
    expect(calcularSlotsLivres([barbeiro], 0)).toBe(18)
  })

  it('subtrai os slots já ocupados', () => {
    expect(calcularSlotsLivres([barbeiro], 5)).toBe(13)
  })

  it('desconta intervalo de almoço de 1h (16 slots)', () => {
    const comAlmoco: BarberSchedule = {
      ...barbeiro,
      almoco_inicio: '12:00:00',
      almoco_fim: '13:00:00',
    }
    // 9h - 1h almoço = 8h = 480 min / 30 = 16 slots
    expect(calcularSlotsLivres([comAlmoco], 0)).toBe(16)
  })

  it('soma slots de múltiplos barbeiros com horários distintos', () => {
    const barbeiro2 = {
      id: 2,
      tempo_atendimento: 60,
      abertura: '08:00:00',   // 480 min
      fechamento: '16:00:00', // 960 min → 480 min → 8 slots
      almoco_inicio: null,
      almoco_fim: null,
    } as BarberSchedule
    // barbeiro: 18 slots (30min, 9h), barbeiro2: 8 slots (60min, 8h)
    expect(calcularSlotsLivres([barbeiro, barbeiro2], 0)).toBe(26)
  })

  it('nunca retorna valor negativo', () => {
    expect(calcularSlotsLivres([barbeiro], 100)).toBe(0)
  })

  it('ignora barbeiros sem horário definido', () => {
    const semHorario: BarberSchedule = {
      ...barbeiro,
      abertura: null,
      fechamento: null,
    }
    expect(calcularSlotsLivres([semHorario], 0)).toBe(0)
  })

  it('ignora barbeiros com tempo_atendimento zero', () => {
    const semTempo: BarberSchedule = { ...barbeiro, tempo_atendimento: 0 }
    expect(calcularSlotsLivres([semTempo], 0)).toBe(0)
  })

  it('retorna 0 para lista vazia de barbeiros', () => {
    expect(calcularSlotsLivres([], 0)).toBe(0)
  })
})
