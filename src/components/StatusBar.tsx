'use client'

import { useEffect, useState } from 'react'

interface Props {
  ultimaAtualizacao: string // ISO timestamp
  unidadesTotal: number
}

export default function StatusBar({ ultimaAtualizacao, unidadesTotal }: Props) {
  // Re-renderiza a cada 60s para manter o contador de elapsed atualizado
  const [, tick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const elapsed = Math.floor(
    (Date.now() - new Date(ultimaAtualizacao).getTime()) / 60_000,
  )
  const elapsedLabel = elapsed === 0 ? 'agora mesmo' : `há ${elapsed} min`

  return (
    <footer
      className="shrink-0 mx-[60px] pt-5 pb-[30px] border-t border-white/[0.07]
                 flex items-center justify-between
                 text-[13px] font-medium uppercase tracking-[0.08em] text-fg-dim rise"
      style={{ animationDelay: '0.52s' }}
    >
      <span>Atualizado {elapsedLabel}</span>
      <span>{unidadesTotal} unidades ativas</span>
      <span>Próxima leitura em 5 min</span>
    </footer>
  )
}
