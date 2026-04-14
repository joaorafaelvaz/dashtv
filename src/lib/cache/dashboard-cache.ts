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
  getTempoMedioAtendimento,
  getTopBarbeiros,
  getProdutosVendidos,
} from '@/lib/db/queries'
import { calcularSlotsLivres, calcularVariacaoPct } from '@/lib/utils/dashboard'
import type { DashboardData } from '@/lib/types/dashboard'

const CACHE_FILE = path.join(process.cwd(), 'data', 'dashboard-cache.json')
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

interface CacheEntry {
  data: DashboardData
  refreshed_at: string
}

let memoryCache: CacheEntry | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let isRefreshing = false

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
    tempoMedioAtendimento,
    topBarbeiros,
    produtosVendidos,
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
    getTempoMedioAtendimento(),
    getTopBarbeiros(),
    getProdutosVendidos(),
  ])

  const slotsLivres = calcularSlotsLivres(barbers, agendamentosDia)
  const totalSlots = agendamentosDia + slotsLivres
  const taxaOcupacao = totalSlots > 0
    ? Math.round((agendamentosDia / totalSlots) * 100)
    : 0

  return {
    faturamento_hoje: faturamentoHoje,
    agendamentos_dia: agendamentosDia,
    slots_livres: slotsLivres,
    em_atendimento: emAtendimento,
    servicos_realizados: servicosRealizados,
    faturamento_projetado: faturamentoHoje + faturamentoPendente,
    media_3meses: media3Meses,
    variacao_media_pct: calcularVariacaoPct(faturamentoHoje, media3Meses),
    taxa_ocupacao: taxaOcupacao,
    taxa_no_show: taxaNoShow,
    tempo_medio_atendimento: tempoMedioAtendimento,
    produtos_vendidos: produtosVendidos,
    top_barbeiros: topBarbeiros,
    ranking,
    ultima_atualizacao: new Date().toISOString(),
  }
}

/** Campos obrigatórios adicionados em versões recentes — cache sem eles é descartado */
const REQUIRED_FIELDS: (keyof DashboardData)[] = [
  'taxa_ocupacao',
  'taxa_no_show',
  'tempo_medio_atendimento',
  'produtos_vendidos',
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

async function refresh(): Promise<void> {
  if (isRefreshing) return
  isRefreshing = true
  try {
    const data = await fetchDashboardData()
    const entry: CacheEntry = { data, refreshed_at: data.ultima_atualizacao }
    memoryCache = entry
    saveToDisk(entry)
    console.log('[cache] Atualizado em', entry.refreshed_at)
  } catch (err) {
    console.error('[cache] Falha no refresh — mantendo cache anterior:', err)
  } finally {
    isRefreshing = false
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
