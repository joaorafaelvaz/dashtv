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
