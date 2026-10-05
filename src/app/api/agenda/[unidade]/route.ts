import { NextResponse } from 'next/server'
import { getAgendaUnidade } from '@/lib/cache/agenda-cache'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { unidade: string } }) {
  if (!/^\d{1,9}$/.test(params.unidade)) {
    return NextResponse.json({ error: 'Unidade inválida' }, { status: 400 })
  }

  try {
    const data = await getAgendaUnidade(Number(params.unidade))
    if (!data) {
      return NextResponse.json({ error: 'Unidade não encontrada' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Agenda API] Erro:', error)
    return NextResponse.json({ error: 'Erro interno ao carregar a agenda' }, { status: 500 })
  }
}
