const CABECALHO = 'X-Dashtv-Versao'

/**
 * Recarrega só quando o servidor informa uma versão diferente da que esta
 * página carregou. Versão ausente (dev, proxy que remove o cabeçalho, resposta
 * de erro) nunca dispara recarga — senão a TV ficaria em loop.
 */
export function deveRecarregar(inicial: string | null, atual: string | null): boolean {
  return !!inicial && !!atual && inicial !== atual
}

let versaoInicial: string | null = null

/**
 * Chamar a cada resposta da API. Na primeira, guarda a versão do servidor;
 * quando ela mudar (deploy novo), recarrega a página para a TV pegar o
 * código novo sem ninguém precisar apertar F5.
 */
export function recarregarSeVersaoMudou(res: Response): void {
  const atual = res.headers.get(CABECALHO)
  if (!versaoInicial) {
    versaoInicial = atual
    return
  }
  if (deveRecarregar(versaoInicial, atual)) {
    console.log('[DashboardTV] Versão nova no servidor — recarregando')
    window.location.reload()
  }
}
