import pool from './mysql'
import type { RowDataPacket } from 'mysql2'
import type { BarberSchedule, RankingUnidade } from '@/lib/types/dashboard'

interface TotalRow extends RowDataPacket { total: number }
interface MediaRow extends RowDataPacket { media: number }

// ⚠️ Confirmar estes valores contra produção antes de fazer deploy
const VENDAS_STATUS_VALIDA = 1
const AGENDAS_STATUS_CANCELADO = [3, 4]

/** Faturamento total de vendas finalizadas hoje (todas as unidades) */
export async function getFaturamentoHoje(): Promise<number> {
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COALESCE(SUM(v.valor_total), 0) AS total
     FROM vendas v
     INNER JOIN usuarios u ON v.usuario = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(v.data_criacao) = CURDATE()
       AND v.comanda_temp = 0
       AND v.status = ?
       AND un.status = 1`,
    [VENDAS_STATUS_VALIDA],
  )
  return Number(rows[0]?.total ?? 0)
}

/** Total de agendamentos marcados para hoje (excluindo cancelados, fechados e unidades inativas) */
export async function getAgendamentosDia(): Promise<number> {
  const placeholders = AGENDAS_STATUS_CANCELADO.map(() => '?').join(',')
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(a.data) = CURDATE()
       AND a.status NOT IN (${placeholders})
       AND a.fechamento IS NULL
       AND un.status = 1`,
    AGENDAS_STATUS_CANCELADO,
  )
  return Number(rows[0]?.total ?? 0)
}

/**
 * Retorna a grade de horários de todos os barbeiros ativos hoje.
 * Usa CASE DAYOFWEEK para selecionar dinamicamente a coluna do dia.
 */
export async function getSlotsBarbeiros(): Promise<BarberSchedule[]> {
  const [rows] = await pool.execute<BarberSchedule[]>(
    `SELECT
       u.id,
       u.tempo_atendimento,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_abertura
         WHEN 2 THEN u.segunda_abertura
         WHEN 3 THEN u.terca_abertura
         WHEN 4 THEN u.quarta_abertura
         WHEN 5 THEN u.quinta_abertura
         WHEN 6 THEN u.sexta_abertura
         WHEN 7 THEN u.sabado_abertura
       END AS abertura,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_fechamento
         WHEN 2 THEN u.segunda_fechamento
         WHEN 3 THEN u.terca_fechamento
         WHEN 4 THEN u.quarta_fechamento
         WHEN 5 THEN u.quinta_fechamento
         WHEN 6 THEN u.sexta_fechamento
         WHEN 7 THEN u.sabado_fechamento
       END AS fechamento,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_almoco_inicio
         WHEN 2 THEN u.segunda_almoco_inicio
         WHEN 3 THEN u.terca_almoco_inicio
         WHEN 4 THEN u.quarta_almoco_inicio
         WHEN 5 THEN u.quinta_almoco_inicio
         WHEN 6 THEN u.sexta_almoco_inicio
         WHEN 7 THEN u.sabado_almoco_inicio
       END AS almoco_inicio,
       CASE DAYOFWEEK(CURDATE())
         WHEN 1 THEN u.domingo_almoco_fim
         WHEN 2 THEN u.segunda_almoco_fim
         WHEN 3 THEN u.terca_almoco_fim
         WHEN 4 THEN u.quarta_almoco_fim
         WHEN 5 THEN u.quinta_almoco_fim
         WHEN 6 THEN u.sexta_almoco_fim
         WHEN 7 THEN u.sabado_almoco_fim
       END AS almoco_fim
     FROM usuarios u
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE u.status = 1
       AND un.status = 1
       AND u.tempo_atendimento IS NOT NULL
       AND u.tempo_atendimento > 0`,
  )
  return rows
}

/**
 * Slots ocupados hoje. Alias direto de getAgendamentosDia().
 * Válido enquanto cada agendamento não-cancelado ocupa exatamente um slot.
 * Se a lógica de slots mudar (ex: múltiplos serviços por slot), implementar query própria aqui.
 */
export async function getSlotsOcupados(): Promise<number> {
  return getAgendamentosDia()
}

/** Clientes com check-in aberto e sem checkout (em atendimento agora) */
export async function getEmAtendimento(): Promise<number> {
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     WHERE DATE(a.data) = CURDATE()
       AND a.checkin = 1
       AND a.checkout = 0`,
  )
  return Number(rows[0]?.total ?? 0)
}

/** Total de atendimentos concluídos hoje (checkout realizado) */
export async function getServicosRealizados(): Promise<number> {
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     WHERE DATE(a.data) = CURDATE()
       AND a.checkout = 1`,
  )
  return Number(rows[0]?.total ?? 0)
}

/**
 * Valor projetado dos agendamentos ainda não realizados hoje.
 * Soma o valor_venda do serviço agendado para slots não iniciados.
 * Filtra unidades inativas para consistência com os demais indicadores.
 */
export async function getFaturamentoPendente(): Promise<number> {
  const placeholders = AGENDAS_STATUS_CANCELADO.map(() => '?').join(',')
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COALESCE(SUM(p.valor_venda), 0) AS total
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     INNER JOIN produtos p ON a.produto = p.id
     WHERE DATE(a.data) = CURDATE()
       AND a.checkout = 0
       AND a.checkin = 0
       AND a.produto IS NOT NULL
       AND a.status NOT IN (${placeholders})
       AND un.status = 1`,
    AGENDAS_STATUS_CANCELADO,
  )
  return Number(rows[0]?.total ?? 0)
}

/**
 * Média do faturamento consolidado (todas as unidades) para o mesmo dia
 * da semana, calculada sobre os últimos 3 meses completos.
 * Usa a tabela dashboard_movimentos que já agrega faturamento semanal por unidade.
 * No primeiro dia de cada mês a janela se desloca e a média recalcula. Comportamento esperado.
 */
export async function getMedia3Meses(): Promise<number> {
  const [rows] = await pool.execute<MediaRow[]>(
    `SELECT COALESCE(AVG(monthly_total), 0) AS media
     FROM (
       SELECT SUM(
         CASE DAYOFWEEK(CURDATE())
           WHEN 1 THEN dm.faturamento_domingo
           WHEN 2 THEN dm.faturamento_segunda
           WHEN 3 THEN dm.faturamento_terca
           WHEN 4 THEN dm.faturamento_quarta
           WHEN 5 THEN dm.faturamento_quinta
           WHEN 6 THEN dm.faturamento_sexta
           WHEN 7 THEN dm.faturamento_sabado
         END
       ) AS monthly_total
       FROM dashboard_movimentos dm
       WHERE (dm.ano * 100 + dm.mes) >=
               (YEAR(DATE_SUB(CURDATE(), INTERVAL 3 MONTH)) * 100
                + MONTH(DATE_SUB(CURDATE(), INTERVAL 3 MONTH)))
         AND (dm.ano * 100 + dm.mes) <
               (YEAR(CURDATE()) * 100 + MONTH(CURDATE()))
       GROUP BY dm.ano, dm.mes
     ) AS monthly_sums`,
  )
  return Number(rows[0]?.media ?? 0)
}

/**
 * Ranking de todas as unidades ativas por faturamento hoje.
 * Retorna ordenado DESC — use slice(0,5) para top5 e slice(-5) para bottom5.
 */
export async function getRankingUnidades(): Promise<RankingUnidade[]> {
  const [rows] = await pool.execute<RankingUnidade[]>(
    `SELECT
       un.id,
       un.nome,
       un.cidade,
       un.bairro,
       COALESCE(SUM(v.valor_total), 0) AS faturamento_dia
     FROM unidades un
     LEFT JOIN usuarios us ON us.unidade = un.id AND us.status = 1
     LEFT JOIN vendas v
       ON v.usuario = us.id
       AND DATE(v.data_criacao) = CURDATE()
       AND v.comanda_temp = 0
       AND v.status = ?
     WHERE un.status = 1
       AND un.tipo != 'FRANQUEADORA'
     GROUP BY un.id, un.nome, un.cidade, un.bairro
     ORDER BY faturamento_dia DESC`,
    [VENDAS_STATUS_VALIDA],
  )
  return rows
}
