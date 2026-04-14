import { NextResponse } from 'next/server'
import { getCachedDashboard } from '@/lib/cache/dashboard-cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data } = await getCachedDashboard()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Dashboard API] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno ao carregar dados do dashboard' },
      { status: 500 },
    )
  }
}
