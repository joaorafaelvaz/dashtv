'use client'

import { useEffect, useState } from 'react'

interface Props {
  ultimaAtualizacao: string // ISO timestamp
}

export default function StatusBar({ ultimaAtualizacao }: Props) {
  // Re-renderiza a cada 60s para manter o contador de elapsed atualizado
  const [, tick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const elapsed = Math.floor(
    (Date.now() - new Date(ultimaAtualizacao).getTime()) / 60_000,
  )

  const elapsedLabel =
    elapsed === 0 ? 'agora mesmo' : `há ${elapsed} min`

  return (
    <footer className="flex items-center justify-between px-6 py-3 border-t border-[#D4AF37]/20 shrink-0">
      <span className="text-gray-500 text-sm">
        ⟳ Atualizado {elapsedLabel}
      </span>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-gray-500 text-sm">Ao vivo · atualiza em 5 min</span>
      </div>
    </footer>
  )
}
