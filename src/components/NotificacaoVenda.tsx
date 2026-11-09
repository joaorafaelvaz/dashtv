'use client'

import { useEffect, useState } from 'react'
import { formatCurrency, nomeUnidadeCurto } from '@/lib/utils/format'
import type { NotificacaoAtiva } from '@/lib/hooks/useVendasAoVivo'

const SAIDA_MS = 450

/**
 * Cartão de "nova venda", sobreposto ao cabeçalho. Entra descendo, fica
 * `duracaoMs` e sai subindo. Uma por vez — o hook já espaça as vendas.
 */
export default function NotificacaoVenda({ notificacao }: { notificacao: NotificacaoAtiva | null }) {
  if (!notificacao) return null
  // key = id da venda: cada venda remonta o cartão e refaz a animação de entrada
  return <Cartao key={notificacao.venda.id} {...notificacao} />
}

function Cartao({ venda, duracaoMs }: NotificacaoAtiva) {
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSaindo(true), Math.max(0, duracaoMs - SAIDA_MS))
    return () => clearTimeout(t)
  }, [duracaoMs])

  const { local, uf } = nomeUnidadeCurto(venda.unidade_nome)
  const detalhe = [venda.barbeiro, venda.itens.slice(0, 2).join(' + ')]
    .filter(Boolean)
    .join(' · ')
  const extras = venda.itens.length > 2 ? ` +${venda.itens.length - 2}` : ''

  return (
    <div
      className={`absolute left-[60px] right-[60px] top-[26px] z-50 ${
        saindo ? 'toast-out' : 'toast-in'
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-7 rounded-2xl border border-gold/30 bg-surface px-8 py-5
                   shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(217,180,55,0.06)]"
      >
        <span className="relative flex h-3.5 w-3.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-gold opacity-60 animate-ping" />
          <span className="relative h-3.5 w-3.5 rounded-full bg-gold" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-gold">
            Nova venda
          </p>
          <p className="mt-1.5 flex items-baseline gap-2.5">
            <span className="truncate text-[28px] font-semibold tracking-[-0.02em]">
              {local || 'Unidade'}
            </span>
            {uf && (
              <span className="shrink-0 text-sm font-semibold tracking-[0.08em] text-fg-dim">{uf}</span>
            )}
          </p>
          {detalhe && (
            <p className="mt-1 truncate text-[17px] font-medium text-fg-muted">
              {detalhe}
              {extras}
            </p>
          )}
        </div>

        <span className="shrink-0 text-[40px] font-bold tracking-[-0.03em] text-gold">
          +{formatCurrency(venda.valor)}
        </span>
      </div>
    </div>
  )
}
