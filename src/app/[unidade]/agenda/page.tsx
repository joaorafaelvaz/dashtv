'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgendaUnidade } from '@/lib/types/agenda'
import { statusAgendamento } from '@/lib/utils/agenda'
import AgendaHeader from '@/components/agenda/AgendaHeader'
import AgendaGrade from '@/components/agenda/AgendaGrade'

/** A API guarda 1 min de cache; buscar no mesmo ritmo. */
const REFRESH_MS = 60 * 1000
/** Relógio, linha do "agora" e status (atrasado/não veio) andam a cada 15s. */
const TICK_MS = 15 * 1000

export default function AgendaUnidadePage({ params }: { params: { unidade: string } }) {
  const [agenda, setAgenda] = useState<AgendaUnidade | null>(null)
  const [erroFatal, setErroFatal] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [agora, setAgora] = useState<Date | null>(null)

  useEffect(() => {
    setAgora(new Date()) // só no cliente, evita hydration mismatch
    const t = setInterval(() => setAgora(new Date()), TICK_MS)
    return () => clearInterval(t)
  }, [])

  const carregar = useCallback(async () => {
    try {
      // Repassa o token da URL para a API — o Nginx exige em todas as rotas
      const token = new URLSearchParams(window.location.search).get('token')
      const url =
        `/api/agenda/${encodeURIComponent(params.unidade)}` +
        (token ? `?token=${encodeURIComponent(token)}` : '')
      const res = await fetch(url, { cache: 'no-store' })

      if (res.status === 400 || res.status === 404) {
        const corpo = await res.json().catch(() => ({}))
        setErroFatal(corpo.error ?? 'Unidade não encontrada')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      setAgenda(await res.json())
      setErroFatal(null)
      setOffline(false)
    } catch (err) {
      // Mantém a última agenda na tela e só sinaliza a falha no cabeçalho
      console.error('[Agenda] Erro ao buscar dados:', err)
      setOffline(true)
    }
  }, [params.unidade])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, REFRESH_MS)
    return () => clearInterval(t)
  }, [carregar])

  useEffect(() => {
    if (agenda) document.title = `Agenda — ${agenda.unidade.nome}`
  }, [agenda])

  const agoraMin = agora ? agora.getHours() * 60 + agora.getMinutes() + agora.getSeconds() / 60 : null

  const resumo = useMemo(() => {
    const itens = agenda?.barbeiros.flatMap((b) => b.agendamentos) ?? []
    const status = agoraMin == null ? [] : itens.map((i) => statusAgendamento(i, agoraMin))
    return {
      total: itens.length,
      naCadeira: status.filter((s) => s === 'em_atendimento').length,
      finalizados: status.filter((s) => s === 'finalizado').length,
    }
  }, [agenda, agoraMin])

  // Escala tipográfica pela largura da tela: legível tanto num monitor quanto numa TV
  const base = 'h-screen w-screen overflow-hidden bg-ink text-fg [font-size:clamp(11px,0.74vw,18px)]'

  if (erroFatal) {
    return (
      <div className={`${base} flex flex-col items-center justify-center gap-3`}>
        <p className="text-[2em] font-bold text-neg">{erroFatal}</p>
        <p className="text-[1.1em] text-fg-muted">Confira o número da unidade no endereço.</p>
      </div>
    )
  }

  if (!agenda) {
    return (
      <div className={`${base} flex items-center justify-center`}>
        <p className={`text-[1.8em] font-bold ${offline ? 'text-neg' : 'animate-pulse text-gold'}`}>
          {offline ? 'Erro de conexão — tentando novamente…' : 'Carregando agenda…'}
        </p>
      </div>
    )
  }

  return (
    <div className={`${base} flex flex-col`}>
      <AgendaHeader
        unidade={agenda.unidade.nome}
        data={agenda.data}
        agora={agora}
        total={resumo.total}
        naCadeira={resumo.naCadeira}
        finalizados={resumo.finalizados}
        offline={offline}
      />
      <AgendaGrade agenda={agenda} agoraMin={agoraMin} />
    </div>
  )
}
