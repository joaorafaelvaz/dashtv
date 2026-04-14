'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardData } from '@/lib/types/dashboard'
import DashboardHeader from '@/components/DashboardHeader'
import FaturamentoHero from '@/components/FaturamentoHero'
import KpiGrid from '@/components/KpiGrid'
import ProjecaoGrid from '@/components/ProjecaoGrid'
import RankingSection from '@/components/RankingSection'
import StatusBar from '@/components/StatusBar'

/** Intervalo de atualização em milissegundos (5 minutos) */
const REFRESH_MS = 5 * 60 * 1000

/** Dimensões fixas do canvas portrait para TV 50" (1080p portrait = 1080×1920) */
const CANVAS_W = 1080
const CANVAS_H = 1920

export default function DashboardTV() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [hasError, setHasError] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  // ---------- Escalonamento do canvas para a TV ----------
  useEffect(() => {
    function scale() {
      if (!canvasRef.current) return
      const s = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H)
      canvasRef.current.style.transform = `scale(${s})`
      canvasRef.current.style.transformOrigin = 'top left'
      // Ajustar o wrapper para que não crie scroll
      document.body.style.width = `${CANVAS_W * s}px`
      document.body.style.height = `${CANVAS_H * s}px`
    }
    scale()
    window.addEventListener('resize', scale)
    return () => window.removeEventListener('resize', scale)
  }, [])

  // ---------- Busca de dados ----------
  const fetchData = useCallback(async () => {
    try {
      // Repassa o token da URL para a API — Nginx exige em todas as rotas de /
      const token = new URLSearchParams(window.location.search).get('token')
      const apiUrl = token
        ? `/api/dashboard?token=${encodeURIComponent(token)}`
        : '/api/dashboard'
      const res = await fetch(apiUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: DashboardData = await res.json()
      setData(json)
      setHasError(false)
    } catch (err) {
      console.error('[DashboardTV] Erro ao buscar dados:', err)
      setHasError(true)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, REFRESH_MS)
    return () => clearInterval(timer)
  }, [fetchData])

  // ---------- Estados de carregamento e erro ----------
  if (hasError && !data) {
    return (
      <div className="w-screen h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
        <p className="text-red-500 text-3xl font-bold">⚠ Erro de conexão</p>
        <p className="text-gray-500 text-xl">Tentando reconectar automaticamente...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-screen h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-[#D4AF37] text-3xl font-bold animate-pulse">
          Carregando dashboard...
        </p>
      </div>
    )
  }

  // ---------- Dashboard principal ----------
  return (
    <div className="w-screen h-screen bg-[#0A0A0A] overflow-hidden">
      <div
        ref={canvasRef}
        className="bg-[#0A0A0A] flex flex-col"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      >
        <DashboardHeader />

        <FaturamentoHero
          faturamento={data.faturamento_hoje}
          variacaoPct={data.variacao_media_pct}
          media3meses={data.media_3meses}
        />

        <KpiGrid
          agendamentos={data.agendamentos_dia}
          slotsLivres={data.slots_livres}
          emAtendimento={data.em_atendimento}
          servicosRealizados={data.servicos_realizados}
        />

        <ProjecaoGrid
          faturamentoProjetado={data.faturamento_projetado}
          media3meses={data.media_3meses}
        />

        <RankingSection ranking={data.ranking} />

        <StatusBar ultimaAtualizacao={data.ultima_atualizacao} />
      </div>
    </div>
  )
}
