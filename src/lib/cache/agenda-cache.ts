import { getAgendaLinhas, getBarbeirosUnidade, getBloqueios, getUnidade } from '@/lib/db/agenda-queries'
import { montarAgenda } from '@/lib/utils/agenda'
import type { AgendaUnidade } from '@/lib/types/agenda'

/** A agenda muda bem mais rápido que o dashboard da rede — 1 minuto basta. */
const TTL_MS = 60 * 1000

interface Entrada {
  data: AgendaUnidade | null // null = unidade inexistente
  em: number
}

const cache = new Map<number, Entrada>()
/** Consulta em andamento por unidade: requisições simultâneas esperam a mesma. */
const emAndamento = new Map<number, Promise<AgendaUnidade | null>>()

async function carregar(id: number): Promise<AgendaUnidade | null> {
  const unidade = await getUnidade(id)
  if (!unidade) return null

  const [barbeiros, linhas, bloqueios] = await Promise.all([
    getBarbeirosUnidade(id),
    getAgendaLinhas(id),
    getBloqueios(id),
  ])

  return {
    ...montarAgenda({
      unidade: { id: unidade.id, nome: unidade.nome ?? `Unidade ${unidade.id}` },
      data: unidade.hoje,
      barbeiros,
      linhas,
      bloqueios,
    }),
    ultima_atualizacao: new Date().toISOString(),
  }
}

/**
 * Agenda de hoje da unidade, com cache de 1 minuto.
 * Se a consulta falhar e houver versão anterior, devolve a anterior — a TV
 * continua mostrando a última agenda conhecida em vez de uma tela de erro.
 */
export async function getAgendaUnidade(id: number): Promise<AgendaUnidade | null> {
  const atual = cache.get(id)
  if (atual && Date.now() - atual.em < TTL_MS) return atual.data

  const pendente = emAndamento.get(id)
  if (pendente) return pendente

  const consulta = carregar(id)
    .then((data) => {
      cache.set(id, { data, em: Date.now() })
      return data
    })
    .catch((err) => {
      if (atual) {
        console.error(`[agenda] Falha ao atualizar unidade ${id} — mantendo versão anterior:`, err)
        return atual.data
      }
      throw err
    })
    .finally(() => emAndamento.delete(id))

  emAndamento.set(id, consulta)
  return consulta
}
