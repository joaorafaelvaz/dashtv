import {
  detectarNovas,
  montarVendaNova,
  podarAntigas,
  agendarFila,
  aplicarPendentes,
  JANELA_RETENCAO_MS,
} from '../vendas'
import { nomeUnidadeCurto } from '../format'
import type { DashboardData, RankingUnidade, VendaNova } from '@/lib/types/dashboard'

const AGORA = Date.parse('2026-11-09T15:00:00Z')

function venda(id: number, valor: number, porUnidade: Record<string, number> = {}): VendaNova {
  return {
    id,
    valor,
    unidade_id: 1,
    unidade_nome: 'Brasil - SC - Joinville - Centro',
    barbeiro: 'Carlos',
    itens: ['Corte'],
    por_unidade: porUnidade,
    detectada_em: new Date(AGORA).toISOString(),
  }
}

function unidade(id: number, faturamento_dia: number): RankingUnidade {
  return { id, nome: `U${id}`, cidade: 'C', bairro: 'B', faturamento_dia } as RankingUnidade
}

function dashboard(faturamento: number, ranking: RankingUnidade[]): DashboardData {
  return {
    faturamento_hoje: faturamento,
    faturamento_projetado: faturamento + 1000,
    unidades_faturando: ranking.filter((u) => u.faturamento_dia > 0).length,
    ranking,
    vendas_novas: [],
  } as unknown as DashboardData
}

describe('detectarNovas', () => {
  it('sem refresh anterior, nada é novo (não despeja o dia inteiro)', () => {
    expect(detectarNovas([{ id: 1 }, { id: 2 }], null)).toEqual([])
  })

  it('devolve só os ids ausentes no refresh anterior', () => {
    expect(detectarNovas([{ id: 1 }, { id: 2 }, { id: 3 }], new Set([1, 3]))).toEqual([{ id: 2 }])
  })
})

describe('montarVendaNova', () => {
  const itens = [
    { venda: 7, valor: 40, produto: 'Barba', colaborador: 'ANA PAULA', unidade_colaborador: 10 },
    { venda: 7, valor: 60, produto: 'Corte', colaborador: 'joão silva', unidade_colaborador: 10 },
    { venda: 7, valor: 25, produto: 'Pomada', colaborador: null, unidade_colaborador: null },
    { venda: 8, valor: 99, produto: 'Outro', colaborador: 'X', unidade_colaborador: 11 },
  ]
  const v = montarVendaNova(
    { id: 7, valor: 125, unidade_id: 10, unidade_nome: 'Brasil - SC - Joinville' },
    itens,
    '2026-11-09T15:00:00.000Z',
  )

  it('usa o valor total da venda', () => expect(v.valor).toBe(125))

  it('barbeiro = primeiro nome do item de maior valor, capitalizado', () => {
    expect(v.barbeiro).toBe('João')
  })

  it('lista os itens só da própria venda', () => {
    expect(v.itens).toEqual(['Barba', 'Corte', 'Pomada'])
  })

  it('soma por unidade do executor e ignora item sem executor (igual ao ranking)', () => {
    expect(v.por_unidade).toEqual({ '10': 100 })
  })

  it('venda sem itens não quebra', () => {
    const vazia = montarVendaNova({ id: 9, valor: 10, unidade_id: 1, unidade_nome: null }, [], 'x')
    expect(vazia).toMatchObject({ barbeiro: null, itens: [], por_unidade: {} })
  })
})

describe('podarAntigas', () => {
  it('descarta vendas detectadas há mais que a janela de retenção', () => {
    const recente = venda(1, 10)
    const antiga = { ...venda(2, 10), detectada_em: new Date(AGORA - JANELA_RETENCAO_MS - 1).toISOString() }
    expect(podarAntigas([recente, antiga], AGORA).map((v) => v.id)).toEqual([1])
  })
})

describe('agendarFila', () => {
  it('espalha as vendas igualmente pela janela, a primeira imediata', () => {
    const fila = agendarFila([venda(1, 1), venda(2, 1), venda(3, 1), venda(4, 1)], AGORA, 300_000)
    expect(fila.map((v) => v.exibirEm - AGORA)).toEqual([0, 75_000, 150_000, 225_000])
  })

  it('fila vazia', () => expect(agendarFila([], AGORA, 1000)).toEqual([]))
})

describe('aplicarPendentes', () => {
  const base = dashboard(1000, [unidade(1, 600), unidade(2, 400), unidade(3, 0)])

  it('sem pendentes devolve o próprio objeto', () => {
    expect(aplicarPendentes(base, [])).toBe(base)
  })

  it('desconta pendentes do total, da projeção e da unidade do executor', () => {
    const r = aplicarPendentes(base, [venda(1, 250, { '1': 250 })])
    expect(r.faturamento_hoje).toBe(750)
    expect(r.faturamento_projetado).toBe(1750)
    expect(r.ranking.find((u) => u.id === 1)!.faturamento_dia).toBe(350)
  })

  it('reordena o ranking — a unidade só "sobe" quando a venda aparece', () => {
    const r = aplicarPendentes(base, [venda(1, 250, { '1': 250 })])
    expect(r.ranking.map((u) => u.id)).toEqual([2, 1, 3])
  })

  it('unidade cuja única venda está pendente sai da contagem de faturando', () => {
    const r = aplicarPendentes(base, [venda(1, 400, { '2': 400 })])
    expect(r.unidades_faturando).toBe(1)
  })

  it('nunca fica negativo (venda cancelada depois de detectada)', () => {
    const r = aplicarPendentes(base, [venda(1, 5000, { '1': 5000 })])
    expect(r.faturamento_hoje).toBe(0)
    expect(r.ranking.find((u) => u.id === 1)!.faturamento_dia).toBe(0)
  })

  it('não altera o objeto original', () => {
    aplicarPendentes(base, [venda(1, 250, { '1': 250 })])
    expect(base.faturamento_hoje).toBe(1000)
    expect(base.ranking[0].faturamento_dia).toBe(600)
  })
})

describe('nomeUnidadeCurto', () => {
  it('remove "Brasil" e separa a UF', () => {
    expect(nomeUnidadeCurto('Brasil - SC - Joinville - Centro')).toEqual({
      local: 'Joinville — Centro',
      uf: 'SC',
    })
  })

  it('nome nulo', () => expect(nomeUnidadeCurto(null)).toEqual({ local: '', uf: '' }))
})
