import fs from 'fs'
import path from 'path'

/** Cabeçalho em que as APIs informam a versão em execução no servidor */
export const CABECALHO_VERSAO = 'X-Dashtv-Versao'

/**
 * Identificador do build em execução (.next/BUILD_ID, gerado a cada
 * `next build`). Lido uma vez, na subida do processo: muda a cada deploy.
 * As TVs comparam com a versão que carregaram e recarregam a página sozinhas.
 */
export const VERSAO: string = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf-8').trim()
  } catch {
    return '' // dev: sem build — as TVs não recarregam
  }
})()

/** Cabeçalhos a incluir nas respostas das APIs */
export function cabecalhosVersao(): Record<string, string> {
  return VERSAO ? { [CABECALHO_VERSAO]: VERSAO } : {}
}
