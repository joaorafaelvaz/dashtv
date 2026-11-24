import { periodoHojeBrasilia, interpretarStats } from '../client'

describe('periodoHojeBrasilia', () => {
  it('usa o dia de Brasília, não o do servidor em UTC', () => {
    // 01:30 UTC do dia 25 = 22:30 do dia 24 em Brasília
    expect(periodoHojeBrasilia(new Date('2026-11-25T01:30:00Z'))).toEqual({
      from: '2026-11-24',
      to: '2026-11-25',
    })
  })

  it('logo após a meia-noite de Brasília já é o dia novo', () => {
    expect(periodoHojeBrasilia(new Date('2026-11-25T03:05:00Z'))).toEqual({
      from: '2026-11-25',
      to: '2026-11-26',
    })
  })

  it('vira o mês e o ano', () => {
    expect(periodoHojeBrasilia(new Date('2026-12-31T15:00:00Z'))).toEqual({
      from: '2026-12-31',
      to: '2027-01-01',
    })
  })
})

describe('interpretarStats', () => {
  it('extrai agendamentos, cancelados e valor sem cancelados', () => {
    const json = {
      appointments_booked: 187,
      appointments_cancelled: 14,
      appointments_value: 9840.0,
      appointments_value_all: 10560.0,
    }
    expect(interpretarStats(json, '2026-11-24')).toEqual({
      dia: '2026-11-24',
      agendamentos: 187,
      cancelados: 14,
      valor: 9840,
    })
  })

  it('resposta fora do formato vira null', () => {
    expect(interpretarStats({ detail: 'erro' }, '2026-11-24')).toBeNull()
    expect(interpretarStats(null, '2026-11-24')).toBeNull()
  })

  it('campos opcionais ausentes viram zero', () => {
    expect(interpretarStats({ appointments_booked: 3 }, 'd')).toMatchObject({
      cancelados: 0,
      valor: 0,
    })
  })
})
