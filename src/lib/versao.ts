import fs from 'fs'
import path from 'path'

/** Cabeçalho em que as APIs informam a versão em execução no servidor */
export const CABECALHO_VERSAO = 'X-Dashtv-Versao'

/**
 * Arquivo de sinal gravado por scripts/forcar-atualizacao.sh. Mudar o conteúdo
 * dele faz o servidor refazer o cache na hora e as TVs recarregarem a página,
 * sem precisar de build nem de restart.
 */
const ARQUIVO_SINAL = path.join(process.cwd(), 'data', 'forcar-atualizacao')

/** Build em execução (.next/BUILD_ID): muda a cada deploy. Vazio em dev. */
const BUILD: string = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf-8').trim()
  } catch {
    return ''
  }
})()

/** Conteúdo atual do sinal de atualização forçada ('' se nunca foi usado). */
export function lerSinal(): string {
  try {
    // Vai num cabeçalho HTTP: só letras, dígitos, ponto, hífen e sublinhado
    return fs.readFileSync(ARQUIVO_SINAL, 'utf-8').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64)
  } catch {
    return ''
  }
}

/**
 * Versão que as TVs comparam: build + sinal. Muda num deploy ou num
 * `forcar-atualizacao.sh`; nos dois casos a TV recarrega sozinha.
 * Lida a cada requisição (arquivo minúsculo, poucas requisições por minuto).
 */
export function versaoAtual(): string {
  if (!BUILD) return '' // dev: as TVs não recarregam
  const sinal = lerSinal()
  return sinal ? `${BUILD}-${sinal}` : BUILD
}

/** Cabeçalhos a incluir nas respostas das APIs */
export function cabecalhosVersao(): Record<string, string> {
  const v = versaoAtual()
  return v ? { [CABECALHO_VERSAO]: v } : {}
}
