'use client'

import { useEffect, useState } from 'react'

export default function DashboardHeader() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    // Inicializar no cliente para evitar hydration mismatch
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const time = now
    ? now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--'

  const date = now
    ? now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <header className="flex flex-col items-center py-6 border-b border-[#D4AF37]/40 shrink-0">
      <h1 className="text-5xl font-bold tracking-widest uppercase text-[#FFD700]">
        Barbearia VIP
      </h1>
      <p className="text-gray-400 text-xl mt-1 tracking-wider">
        Dashboard Franqueadora
      </p>
      <div className="flex items-center gap-3 mt-3 text-gray-300">
        <span className="text-3xl font-mono font-semibold">{time}</span>
        <span className="text-[#D4AF37] text-2xl">•</span>
        <span className="text-lg capitalize">{date}</span>
      </div>
    </header>
  )
}
