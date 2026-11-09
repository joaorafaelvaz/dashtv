'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DashboardData, VendaNova } from '@/lib/types/dashboard'
import { agendarFila, aplicarPendentes, type VendaAgendada } from '@/lib/utils/vendas'

/** Quanto tempo cada notificação fica na tela (encurta se as vendas vierem rápido) */
const DURACAO_MAX_MS = 7000
const DURACAO_MIN_MS = 2500

export interface NotificacaoAtiva {
  venda: VendaNova
  duracaoMs: number
}

interface Estado {
  data: DashboardData | null
  fila: VendaAgendada[] // vendas recebidas e ainda não anunciadas
}

/**
 * Recebe cada leitura da API e devolve o painel "em reprodução": as vendas
 * novas da leitura são anunciadas uma a uma ao longo de `janelaMs` (o
 * intervalo até a próxima leitura), e só somam aos totais quando aparecem.
 *
 * Os números ficam até `janelaMs` atrás do banco — é o preço de mostrar as
 * vendas uma por vez em vez de todas juntas.
 */
export function useVendasAoVivo(janelaMs: number) {
  // data e fila mudam juntos: separados, haveria um frame com o total cheio
  // antes da fila ser descontada (o número "pularia" e voltaria).
  const [estado, setEstado] = useState<Estado>({ data: null, fila: [] })
  const [atual, setAtual] = useState<NotificacaoAtiva | null>(null)
  const vistas = useRef<Set<number> | null>(null)

  const receber = useCallback(
    (data: DashboardData) => {
      const novas = data.vendas_novas ?? []

      // 1ª leitura (TV ligou ou recarregou): o total já vem completo, não há
      // o que anunciar — só registrar o que já existe.
      if (!vistas.current) {
        vistas.current = new Set(novas.map((v) => v.id))
        setEstado({ data, fila: [] })
        return
      }

      const ineditas = novas.filter((v) => !vistas.current!.has(v.id))
      ineditas.forEach((v) => vistas.current!.add(v.id))

      setEstado((prev) => ({
        data,
        // O que sobrou da leitura anterior vai na frente e é reespaçado
        fila: ineditas.length > 0
          ? agendarFila([...prev.fila, ...ineditas], Date.now(), janelaMs)
          : prev.fila,
      }))
    },
    [janelaMs],
  )

  // Anuncia a próxima venda da fila na hora agendada
  const fila = estado.fila
  useEffect(() => {
    const proxima = fila[0]
    if (!proxima) return
    const passo = fila.length > 1 ? fila[1].exibirEm - proxima.exibirEm : janelaMs
    const t = setTimeout(() => {
      setEstado((prev) => ({ ...prev, fila: prev.fila.slice(1) }))
      setAtual({
        venda: proxima,
        duracaoMs: Math.max(DURACAO_MIN_MS, Math.min(DURACAO_MAX_MS, passo * 0.85)),
      })
    }, Math.max(0, proxima.exibirEm - Date.now()))
    return () => clearTimeout(t)
  }, [fila, janelaMs])

  // Some com a notificação ao fim da duração
  useEffect(() => {
    if (!atual) return
    const t = setTimeout(() => setAtual(null), atual.duracaoMs)
    return () => clearTimeout(t)
  }, [atual])

  const exibido = useMemo(
    () => (estado.data ? aplicarPendentes(estado.data, estado.fila) : null),
    [estado],
  )

  return { exibido, notificacao: atual, receber }
}

/**
 * Anima um número do valor anterior até o novo (ease-out). Na primeira
 * renderização mostra o valor direto, sem contar a partir do zero.
 */
export function useContagem(alvo: number, duracaoMs = 1400): number {
  const [valor, setValor] = useState(alvo)
  const atualRef = useRef(alvo)

  useEffect(() => {
    const de = atualRef.current
    if (de === alvo) return
    const inicio = performance.now()
    let raf = 0
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracaoMs)
      const v = de + (alvo - de) * (1 - Math.pow(1 - t, 3))
      atualRef.current = v
      setValor(v)
      if (t < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [alvo, duracaoMs])

  return valor
}
