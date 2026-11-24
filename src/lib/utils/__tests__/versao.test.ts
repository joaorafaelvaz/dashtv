import { deveRecarregar } from '../versao'

describe('deveRecarregar', () => {
  it('recarrega quando a versão do servidor muda', () => {
    expect(deveRecarregar('abc', 'def')).toBe(true)
  })

  it('não recarrega com a mesma versão', () => {
    expect(deveRecarregar('abc', 'abc')).toBe(false)
  })

  it('não recarrega se a resposta veio sem versão (evita loop)', () => {
    expect(deveRecarregar('abc', null)).toBe(false)
    expect(deveRecarregar('abc', '')).toBe(false)
  })

  it('não recarrega enquanto não conhece a versão inicial', () => {
    expect(deveRecarregar(null, 'abc')).toBe(false)
  })
})
