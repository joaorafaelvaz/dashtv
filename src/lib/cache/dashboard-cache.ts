import fs from 'fs'
import path from 'path'
import {
  getFaturamentoHoje,
  getAgendamentosDia,
  getSlotsBarbeiros,
  getEmAtendimento,
  getServicosRealizados,
  getFaturamentoPendente,
  getMedia3Meses,
  getRankingUnidades,
  getTaxaNoShow,
  getTaxaCancelamento,
  getTempoMedioAtendimento,
  getTopBarbeiros,
  getAtendimentosRealizados,
  getWalkIns,
  getVendasHoje,
  getItensVendas,
} from '@/lib/db/queries'
import { calcularSlotsLivres, calcularVariacaoPct } from '@/lib/utils/dashboard'
import {
  detectarNovas,
  montarVendaNova,
  podarAntigas,
  MAX_NOTIFICACOES_POR_REFRESH,
} from '@/lib/utils/vendas'
import type { DashboardData, VendaNova } from '@/lib/types/dashboard'

const CACHE_FILE = path.join(process.cwd(), 'data', 'dashboard-cache.json')
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

interface CacheEntry {
  data: DashboardData
  refreshed_at: string
  /** Ids das vendas de hoje no último refresh — base para detectar as novas */
  venda_ids?: number[]
}

let memoryCache: CacheEntry | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
/** Refresh em andamento. Requisições concorrentes aguardam este mesmo promise. */
let refreshPromise: Promise<void> | null = null

/** Idade máxima do refresh anterior para servir de referência às vendas novas */
const MAX_IDADE_REFERENCIA_MS = 3 * REFRESH_INTERVAL_MS

/**
 * Vendas que apareceram desde o refresh anterior, somadas às ainda dentro da
 * janela de retenção. Devolve também os ids atuais, para o próximo refresh.
 */
async function detectarVendasNovas(
  anterior: CacheEntry | null,
  agoraIso: string,
): Promise<{ vendasNovas: VendaNova[]; vendaIds: number[] }> {
  const atuais = await getVendasHoje()
  const vendaIds = atuais.map((v) => v.id)

  // Refresh anterior antigo demais (processo parado, cache do disco de ontem):
  // não dá para saber o que é "novo" — melhor não notificar do que despejar
  // o dia inteiro na tela.
  const recente =
    anterior?.venda_ids &&
    Date.parse(agoraIso) - Date.parse(anterior.refreshed_at) <= MAX_IDADE_REFERENCIA_MS
  const idsAnteriores = recente ? new Set(anterior!.venda_ids) : null
  // Excedente (ex.: volta de uma queda) entra no total sem notificação
  const novas = detectarNovas(atuais, idsAnteriores).slice(-MAX_NOTIFICACOES_POR_REFRESH)

  const itens = await getItensVendas(novas.map((v) => v.id))
  const detectadas = novas.map((v) => montarVendaNova(v, itens, agoraIso))

  const retidas = podarAntigas(anterior?.data.vendas_novas ?? [], Date.parse(agoraIso))
  return { vendasNovas: [...retidas, ...detectadas], vendaIds }
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [
    faturamentoHoje,
    agendamentosDia,
    barbers,
    emAtendimento,
    servicosRealizados,
    faturamentoPendente,
    media3Meses,
    ranking,
    taxaNoShow,
    taxaCancelamento,
    tempoMedioAtendimento,
    topBarbeiros,
    atendimentos,
    walkIns,
  ] = await Promise.all([
    getFaturamentoHoje(),
    getAgendamentosDia(),
    getSlotsBarbeiros(),
    getEmAtendimento(),
    getServicosRealizados(),
    getFaturamentoPendente(),
    getMedia3Meses(),
    getRankingUnidades(),
    getTaxaNoShow(),
    getTaxaCancelamento(),
    getTempoMedioAtendimento(),
    getTopBarbeiros(),
    getAtendimentosRealizados(),
    getWalkIns(),
  ])

  const slotsLivres = calcularSlotsLivres(barbers, agendamentosDia)
  const totalSlots = agendamentosDia + slotsLivres
  const taxaOcupacao = totalSlots > 0
    ? Math.round((agendamentosDia / totalSlots) * 100)
    : 0

  const faturamentoProjetado = faturamentoHoje + faturamentoPendente

  // Cobertura da rede sai do próprio ranking — sem query adicional.
  // Unidades zeradas não aparecem em nenhum ranking, então este é o único
  // lugar do painel onde elas ficam visíveis.
  const unidadesFaturando = ranking.filter((u) => u.faturamento_dia > 0).length

  return {
    faturamento_hoje: faturamentoHoje,
    agendamentos_dia: agendamentosDia,
    slots_livres: slotsLivres,
    em_atendimento: emAtendimento,
    servicos_realizados: servicosRealizados,
    faturamento_projetado: faturamentoProjetado,
    media_3meses: media3Meses,
    // Compara o PROJETADO do dia (não o parcial) contra a média de um dia
    // equivalente. Comparar o realizado às 11h com a média de um dia cheio
    // deixava o indicador permanentemente vermelho.
    variacao_media_pct: calcularVariacaoPct(faturamentoProjetado, media3Meses),
    taxa_ocupacao: taxaOcupacao,
    taxa_cancelamento: taxaCancelamento,
    taxa_no_show: taxaNoShow,
    tempo_medio_atendimento: tempoMedioAtendimento,
    atendimentos,
    walk_ins: walkIns,
    unidades_total: ranking.length,
    unidades_faturando: unidadesFaturando,
    top_barbeiros: topBarbeiros,
    ranking,
    ultima_atualizacao: new Date().toISOString(),
    vendas_novas: [],
  }
}

/** Campos obrigatórios adicionados em versões recentes — cache sem eles é descartado */
const REQUIRED_FIELDS: (keyof DashboardData)[] = [
  'taxa_ocupacao',
  'taxa_cancelamento',
  'taxa_no_show',
  'tempo_medio_atendimento',
  'atendimentos',
  'walk_ins',
  'unidades_faturando',
  'top_barbeiros',
]

function isValidCache(entry: CacheEntry): boolean {
  return REQUIRED_FIELDS.every((f) => entry.data[f] !== undefined)
}

function loadFromDisk(): CacheEntry | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8')
    const entry = JSON.parse(raw) as CacheEntry
    if (!isValidCache(entry)) {
      console.log('[cache] Cache do disco desatualizado (campos ausentes) — descartando')
      return null
    }
    return entry
  } catch {
    return null
  }
}

function saveToDisk(entry: CacheEntry): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry), 'utf-8')
  } catch (err) {
    console.error('[cache] Falha ao gravar cache em disco:', err)
  }
}

/**
 * Atualiza o cache. Chamadas concorrentes compartilham o mesmo refresh em vez
 * de retornarem de imediato — caso contrário, no cold start a segunda
 * requisição voltava com o cache ainda vazio e derrubava a API com
 * "Cache indisponível" enquanto a primeira ainda consultava o banco.
 */
async function refresh(): Promise<void> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const data = await fetchDashboardData()
      let vendaIds: number[] | undefined
      try {
        const r = await detectarVendasNovas(memoryCache, data.ultima_atualizacao)
        data.vendas_novas = r.vendasNovas
        vendaIds = r.vendaIds
      } catch (err) {
        // Notificação é acessório: falhar aqui não pode derrubar o painel
        console.error('[cache] Falha ao detectar vendas novas:', err)
        vendaIds = memoryCache?.venda_ids
      }
      const entry: CacheEntry = {
        data,
        refreshed_at: data.ultima_atualizacao,
        venda_ids: vendaIds,
      }
      memoryCache = entry
      saveToDisk(entry)
      console.log('[cache] Atualizado em', entry.refreshed_at)
    } catch (err) {
      console.error('[cache] Falha no refresh — mantendo cache anterior:', err)
    }
  })()

  try {
    await refreshPromise
  } finally {
    refreshPromise = null
  }
}

function startBackgroundRefresh(): void {
  if (refreshTimer) return
  refreshTimer = setInterval(refresh, REFRESH_INTERVAL_MS)
  console.log('[cache] Refresh em background iniciado (intervalo: 5min)')
}

export async function getCachedDashboard(): Promise<CacheEntry> {
  // Tentar memória → disco → query bloqueante (apenas no cold start)
  if (!memoryCache) {
    memoryCache = loadFromDisk()
    if (memoryCache) {
      console.log('[cache] Cache restaurado do disco:', memoryCache.refreshed_at)
    }
  }

  if (!memoryCache) {
    await refresh()
  }

  if (!memoryCache) {
    throw new Error('Cache indisponível — falha na query inicial. Verifique os logs do PM2.')
  }

  startBackgroundRefresh()

  return memoryCache
}
