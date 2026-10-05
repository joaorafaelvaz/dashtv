import pool from './mysql'
import type { RowDataPacket } from 'mysql2'
import type { AgendaRow, BarbeiroRow, BloqueioRow } from '@/lib/types/agenda'

interface UnidadeRow extends RowDataPacket {
  id: number
  nome: string | null
  hoje: string // "YYYY-MM-DD" segundo o relógio do banco
}

/** Unidade + data de hoje no banco. null se a unidade não existe. */
export async function getUnidade(id: number): Promise<UnidadeRow | null> {
  const [rows] = await pool.execute<UnidadeRow[]>(
    `SELECT un.id, un.nome, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoje
     FROM unidades un
     WHERE un.id = ?`,
    [id],
  )
  return rows[0] ?? null
}

/** Barbeiros ativos da unidade com o expediente de hoje (mesmo critério de getSlotsBarbeiros). */
export async function getBarbeirosUnidade(unidade: number): Promise<BarbeiroRow[]> {
  const [rows] = await pool.execute<BarbeiroRow[]>(
    `SELECT
       u.id,
       u.nome,
       u.tempo_atendimento,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_abertura   WHEN 2 THEN u.segunda_abertura
         WHEN 3 THEN u.terca_abertura     WHEN 4 THEN u.quarta_abertura
         WHEN 5 THEN u.quinta_abertura    WHEN 6 THEN u.sexta_abertura
         WHEN 7 THEN u.sabado_abertura
       END AS abertura,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_fechamento WHEN 2 THEN u.segunda_fechamento
         WHEN 3 THEN u.terca_fechamento   WHEN 4 THEN u.quarta_fechamento
         WHEN 5 THEN u.quinta_fechamento  WHEN 6 THEN u.sexta_fechamento
         WHEN 7 THEN u.sabado_fechamento
       END AS fechamento,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_almoco_inicio WHEN 2 THEN u.segunda_almoco_inicio
         WHEN 3 THEN u.terca_almoco_inicio   WHEN 4 THEN u.quarta_almoco_inicio
         WHEN 5 THEN u.quinta_almoco_inicio  WHEN 6 THEN u.sexta_almoco_inicio
         WHEN 7 THEN u.sabado_almoco_inicio
       END AS almoco_inicio,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_almoco_fim WHEN 2 THEN u.segunda_almoco_fim
         WHEN 3 THEN u.terca_almoco_fim   WHEN 4 THEN u.quarta_almoco_fim
         WHEN 5 THEN u.quinta_almoco_fim  WHEN 6 THEN u.sexta_almoco_fim
         WHEN 7 THEN u.sabado_almoco_fim
       END AS almoco_fim
     FROM usuarios u
     WHERE u.unidade = ?
       AND u.status = 1
       AND u.tempo_atendimento > 0
     ORDER BY u.nome`,
    [unidade],
  )
  return rows
}

/**
 * Todas as linhas de agenda de hoje da unidade — uma por slot, inclusive as
 * filhas (id_pai) e as de bloqueio (fechamento). O agrupamento é feito em
 * montarAgenda.
 *
 * Filtro por faixa de `a.data` em vez de DATE(a.data) para poder usar índice.
 */
export async function getAgendaLinhas(unidade: number): Promise<AgendaRow[]> {
  const [rows] = await pool.execute<AgendaRow[]>(
    `SELECT
       a.id,
       a.id_pai,
       a.colaborador,
       u.nome AS colaborador_nome,
       u.tempo_atendimento,
       a.hora,
       a.origem,
       a.checkin,
       a.checkout,
       a.status,
       a.fechamento,
       a.cliente AS cliente_id,
       c.nome AS cliente_nome,
       (c.convenio IS NOT NULL) AS convenio,
       (a.cliente IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM agendas ah
          WHERE ah.cliente = a.cliente
            AND ah.checkout = 1
            AND ah.data < CURDATE()
       )) AS primeira_visita,
       (a.cliente IS NOT NULL AND EXISTS (
          SELECT 1 FROM vendas v
          WHERE v.cliente = a.cliente
            AND v.data_criacao >= CURDATE()
            AND v.data_criacao <  CURDATE() + INTERVAL 1 DAY
       )) AS teve_venda,
       p.nome AS servico_nome
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     LEFT JOIN clientes c  ON c.id = a.cliente
     LEFT JOIN produtos p  ON p.id = a.produto
     WHERE u.unidade = ?
       AND a.data >= CURDATE()
       AND a.data <  CURDATE() + INTERVAL 1 DAY
     ORDER BY a.colaborador, a.hora`,
    [unidade],
  )
  return rows
}

/** Erros que indicam ausência de permissão/tabela, e não um bug na query. */
const ACESSO_NEGADO = new Set([1142 /* ER_TABLEACCESS_DENIED */, 1146 /* ER_NO_SUCH_TABLE */])

/**
 * Bloqueios de agenda (folga, férias, consulta…) que tocam o dia de hoje,
 * recortados para hoje. `colaborador` NULL vale para a unidade inteira.
 *
 * Retorna null se o usuário do banco não puder ler `agendas_fechamentos` —
 * nesse caso a agenda usa as linhas com `fechamento` (sem o motivo). Outros
 * erros sobem normalmente.
 */
export async function getBloqueios(unidade: number): Promise<BloqueioRow[] | null> {
  try {
    const [rows] = await pool.execute<BloqueioRow[]>(
      `SELECT
         f.colaborador,
         f.motivo,
         DATE_FORMAT(GREATEST(f.data_inicio, TIMESTAMP(CURDATE())), '%H:%i') AS inicio,
         CASE WHEN f.data_fim >= TIMESTAMP(CURDATE() + INTERVAL 1 DAY)
              THEN '24:00'
              ELSE DATE_FORMAT(f.data_fim, '%H:%i')
         END AS fim,
         (f.data_fim >= TIMESTAMP(CURDATE() + INTERVAL 1 DAY)) AS termina_depois,
         DATE_FORMAT(f.data_fim, '%d/%m') AS ate
       FROM agendas_fechamentos f
       WHERE f.unidade = ?
         AND f.data_inicio < TIMESTAMP(CURDATE() + INTERVAL 1 DAY)
         AND f.data_fim    > TIMESTAMP(CURDATE())`,
      [unidade],
    )
    return rows
  } catch (err) {
    const errno = (err as { errno?: number }).errno
    if (errno !== undefined && ACESSO_NEGADO.has(errno)) {
      console.warn('[agenda] Sem acesso a agendas_fechamentos — bloqueios exibidos sem motivo')
      return null
    }
    throw err
  }
}
