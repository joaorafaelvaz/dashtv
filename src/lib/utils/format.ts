/**
 * Formata um número como moeda BRL.
 * Ex: 142350.5 → "R$ 142.350,50"
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

/**
 * Formata um número inteiro com separador de milhar.
 * Ex: 1234 → "1.234"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

/**
 * Separa um valor em parte inteira e centavos, para o número-herói do painel
 * exibir os centavos em corpo menor.
 * Ex: 33414.35 → { inteiro: "33.414", centavos: "35" }
 */
export function splitCurrency(value: number): { inteiro: string; centavos: string } {
  const [int, dec] = Math.abs(value).toFixed(2).split('.')
  return { inteiro: Number(int).toLocaleString('pt-BR'), centavos: dec }
}

/** Moeda sem centavos, para números de apoio. Ex: 60727.35 → "60.727" */
export function formatCurrencyShort(value: number): string {
  return Math.round(value).toLocaleString('pt-BR')
}

/**
 * Nome da unidade sem o prefixo "Brasil - ", constante em toda unidade e que
 * só rouba espaço. "Brasil - SC - Joinville - Centro" → { local: "Joinville — Centro", uf: "SC" }
 */
export function nomeUnidadeCurto(nome: string | null): { local: string; uf: string } {
  const partes = (nome ?? '').split(' - ').map((p) => p.trim()).filter((p) => p && p !== 'Brasil')
  const uf = partes.length > 2 && partes[0].length === 2 ? partes[0] : ''
  const local = (uf ? partes.slice(1) : partes).join(' — ')
  return { local, uf }
}
