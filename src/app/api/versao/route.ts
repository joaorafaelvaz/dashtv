import { cabecalhosVersao } from '@/lib/versao'

export const dynamic = 'force-dynamic'

/**
 * Consulta leve (sem corpo, sem banco) que as TVs fazem a cada minuto para
 * saber se saiu deploy ou se alguém rodou scripts/forcar-atualizacao.sh.
 */
export async function GET() {
  return new Response(null, {
    status: 204,
    headers: { ...cabecalhosVersao(), 'Cache-Control': 'no-store' },
  })
}
