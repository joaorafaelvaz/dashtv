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

  // "Segunda, 10 ago" — só a primeira letra maiúscula, como se escreve em pt-BR
  const date = now
    ? now
        .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })
        .replace('-feira', '')
        .replace(/^./, (c) => c.toUpperCase())
        .replace(' de ', ', ')
    : ''

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-[60px] pt-11 pb-7 shrink-0 rise">
      <div className="flex items-baseline gap-3.5">
        <span className="text-[34px] font-semibold tracking-[-0.02em]">{time}</span>
        <span className="text-[15px] font-medium text-fg-dim">{date}</span>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <span className="text-[23px] font-bold uppercase tracking-[0.30em] text-gold">
          Barbearia VIP
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.22em] text-fg-dim">
          Dashboard Franqueadora
        </span>
      </div>

      <div className="flex justify-end">
        <span className="flex items-center gap-2.5 rounded-full bg-surface px-4 py-2
                         text-xs font-medium uppercase tracking-[0.13em] text-fg-muted
                         shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
          <span className="h-[7px] w-[7px] rounded-full bg-pos animate-pulse" />
          Ao vivo
        </span>
      </div>
    </header>
  )
}
