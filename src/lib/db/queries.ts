import pool from './mysql'
import type { RowDataPacket } from 'mysql2'
import type { BarberSchedule, RankingUnidade, TopBarbeiro } from '@/lib/types/dashboard'

interface TotalRow extends RowDataPacket { total: number }
interface MediaRow extends RowDataPacket { media: number }

const VENDAS_STATUS_VALIDA = 1
/** agendas.status = 1 = "Agendado" (cliente ainda não atendido). */
const AGENDA_STATUS_AGENDADO = 1
/**
 * agendas.status = 3 = "No Show" no modelo do sistema, mas na prática não é
 * populado de forma confiável durante o dia. Por isso o no-show é calculado
 * por heurística em getTaxaNoShow. Esta constante é usada só para excluir
 * esses registros de getAgendamentosDia/getFaturamentoPendente.
 * Cancelamento não é status: vira linha em `agendas_exclusoes` (ver getTaxaCancelamento).
 */
const AGENDAS_STATUS_NO_SHOW = 3

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

/** Total de agendamentos marcados para hoje (excluindo no-shows, fechados e unidades inativas).
 *  Cancelados já não estão em `agendas` (foram para `agendas_exclusoes`). */
export async function getAgendamentosDia(): Promise<number> {
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COUNT(*) AS total
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(a.data) = CURDATE()
       AND a.status <> ?
       AND a.fechamento IS NULL
       AND un.status = 1`,
    [AGENDAS_STATUS_NO_SHOW],
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
 * Exclui no-shows (status 3): não vão gerar receita.
 */
export async function getFaturamentoPendente(): Promise<number> {
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
       AND a.status <> ?
       AND un.status = 1`,
    [AGENDAS_STATUS_NO_SHOW],
  )
  return Number(rows[0]?.total ?? 0)
}

/**
 * Média do faturamento DIÁRIO para o mesmo dia da semana de hoje, nos últimos 3 meses.
 *
 * Para cada data que cai no mesmo dia da semana de hoje (excluindo hoje), soma as
 * vendas válidas do dia — mesma definição de getFaturamentoHoje (comanda_temp = 0,
 * status válido, unidade ativa) — e tira a média desses totais diários. Dias sem
 * vendas não entram na média. O resultado é diretamente comparável a getFaturamentoHoje
 * (um dia vs. a média de um dia equivalente), evitando o erro de magnitude anterior,
 * que comparava 1 dia contra o total mensal daquele dia da semana (~4-5 dias).
 */
export async function getMedia3Meses(): Promise<number> {
  const [rows] = await pool.execute<MediaRow[]>(
    `SELECT COALESCE(AVG(daily.total), 0) AS media
     FROM (
       SELECT DATE(v.data_criacao) AS dia, SUM(v.valor_total) AS total
       FROM vendas v
       INNER JOIN usuarios u  ON v.usuario = u.id
       INNER JOIN unidades un ON u.unidade = un.id
       WHERE v.comanda_temp = 0
         AND v.status = ?
         AND un.status = 1
         AND DAYOFWEEK(v.data_criacao) = DAYOFWEEK(CURDATE())
         AND v.data_criacao >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
         AND v.data_criacao <  CURDATE()
       GROUP BY DATE(v.data_criacao)
     ) AS daily`,
    [VENDAS_STATUS_VALIDA],
  )
  return Number(rows[0]?.media ?? 0)
}

/**
 * Taxa de cancelamento: % de agendamentos que eram para hoje e foram cancelados.
 *
 * Cancelados não ficam em `agendas` — a linha é movida para `agendas_exclusoes`
 * (soft-delete) com `data` = data do agendamento. Por isso a taxa é:
 *   cancelados_hoje / (ativos_hoje + cancelados_hoje)
 * onde ativos_hoje = agendamentos de hoje que continuam em `agendas`.
 */
export async function getTaxaCancelamento(): Promise<number> {
  const [rows] = await pool.execute<(RowDataPacket & { taxa: number })[]>(
    `SELECT ROUND(
       canc.total * 100.0 / NULLIF(ativos.total + canc.total, 0),
     1) AS taxa
     FROM
       (SELECT COUNT(*) AS total
        FROM agendas a
        INNER JOIN usuarios u  ON a.colaborador = u.id
        INNER JOIN unidades un ON u.unidade = un.id
        WHERE DATE(a.data) = CURDATE()
          AND un.status = 1) AS ativos,
       (SELECT COUNT(*) AS total
        FROM agendas_exclusoes ae
        INNER JOIN usuarios u  ON ae.colaborador = u.id
        INNER JOIN unidades un ON u.unidade = un.id
        WHERE DATE(ae.data) = CURDATE()
          AND un.status = 1) AS canc`,
  )
  return Number(rows[0]?.taxa ?? 0)
}

/**
 * Taxa de no-show (tempo real): % de agendamentos cujo horário já passou e o
 * cliente não compareceu — ainda "agendado" (status = 1), sem check-in nem
 * checkout, e sem nenhuma venda registrada para o cliente hoje (se vendeu, veio).
 *
 * Denominador: agendamentos de hoje cujo horário já passou (os que "deviam" ter
 * acontecido) — assim a taxa é estável durante o dia, em vez de diluída por
 * horários ainda futuros.
 *
 * Ex.: agendado 10h, corte. Às 11h ainda status=1, sem check-in/checkout e sem
 * venda do cliente hoje → conta como no-show.
 *
 * Regra extra: se `fechamento` não for NULL, o atendimento foi fechado
 * (cliente atendido/pago) — nunca conta como no-show.
 */
export async function getTaxaNoShow(): Promise<number> {
  const [rows] = await pool.execute<(RowDataPacket & { taxa: number })[]>(
    `SELECT ROUND(
       COUNT(CASE
         WHEN a.status = ?
          AND a.cliente IS NOT NULL
          AND a.checkin = 0
          AND a.checkout = 0
          AND a.fechamento IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM vendas vd
            WHERE vd.cliente = a.cliente
              AND DATE(vd.data_criacao) = CURDATE()
          )
         THEN 1 END)
       * 100.0 / NULLIF(COUNT(*), 0),
     1) AS taxa
     FROM agendas a
     INNER JOIN usuarios u  ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(a.data) = CURDATE()
       AND a.hora < TIME_FORMAT(NOW(), '%H:%i')
       AND un.status = 1`,
    [AGENDA_STATUS_AGENDADO],
  )
  return Number(rows[0]?.taxa ?? 0)
}

/**
 * Tempo médio de atendimento em minutos, baseado nos agendamentos
 * já concluídos hoje (checkout = 1) e no tempo_atendimento configurado por barbeiro.
 */
export async function getTempoMedioAtendimento(): Promise<number> {
  const [rows] = await pool.execute<(RowDataPacket & { media_minutos: number })[]>(
    `SELECT COALESCE(ROUND(AVG(u.tempo_atendimento)), 0) AS media_minutos
     FROM agendas a
     INNER JOIN usuarios u ON a.colaborador = u.id
     WHERE DATE(a.data) = CURDATE()
       AND a.checkout = 1`,
  )
  return Number(rows[0]?.media_minutos ?? 0)
}

/**
 * Top 3 barbeiros mais produtivos hoje, ordenados por serviços concluídos.
 *
 * Serviços: agendas com checkout = 1.
 * Faturamento: vendas_produtos.colaborador — cada item da venda registra
 * o profissional que realizou, independente de quem fechou o caixa.
 */
export async function getTopBarbeiros(): Promise<TopBarbeiro[]> {
  const [rows] = await pool.execute<TopBarbeiro[]>(
    `SELECT
       u.nome,
       un.estado AS unidade_estado,
       un.cidade AS unidade_cidade,
       un.bairro AS unidade_bairro,
       COUNT(a.id) AS servicos,
       COALESCE((
         SELECT SUM(vp.valor_total)
         FROM vendas_produtos vp
         INNER JOIN vendas v ON v.id = vp.venda
         WHERE vp.colaborador = u.id
           AND DATE(v.data_criacao) = CURDATE()
           AND v.comanda_temp = 0
           AND v.status = ?
       ), 0) AS faturamento
     FROM agendas a
     INNER JOIN usuarios u  ON a.colaborador = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(a.data) = CURDATE()
       AND a.checkout = 1
       AND un.status = 1
     GROUP BY u.id, u.nome, un.estado, un.cidade, un.bairro
     ORDER BY servicos DESC, faturamento DESC
     LIMIT 3`,
    [VENDAS_STATUS_VALIDA],
  )
  return rows
}

/**
 * Total de vendas (produtos/serviços) finalizadas hoje em todas as unidades ativas.
 */
export async function getProdutosVendidos(): Promise<number> {
  const [rows] = await pool.execute<TotalRow[]>(
    `SELECT COUNT(*) AS total
     FROM vendas v
     INNER JOIN usuarios u  ON v.usuario = u.id
     INNER JOIN unidades un ON u.unidade = un.id
     WHERE DATE(v.data_criacao) = CURDATE()
       AND v.comanda_temp = 0
       AND v.status = ?
       AND un.status = 1`,
    [VENDAS_STATUS_VALIDA],
  )
  return Number(rows[0]?.total ?? 0)
}

/**
 * Ranking de todas as unidades ativas por faturamento hoje, atribuído por EXECUTOR
 * (vendas_produtos.colaborador) — mesma base do Top Barbeiros, de modo que o
 * faturamento de cada profissional soma para a unidade onde ele está lotado.
 * Itens de venda sem colaborador atribuído não entram no ranking da unidade.
 * Retorna ordenado DESC — use slice(0,5) para top5 e slice(-5) para bottom5.
 */
export async function getRankingUnidades(): Promise<RankingUnidade[]> {
  const [rows] = await pool.execute<RankingUnidade[]>(
    `SELECT
       un.id,
       un.nome,
       un.cidade,
       un.bairro,
       COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN vp.valor_total END), 0) AS faturamento_dia
     FROM unidades un
     LEFT JOIN usuarios us        ON us.unidade = un.id AND us.status = 1
     LEFT JOIN vendas_produtos vp ON vp.colaborador = us.id
     LEFT JOIN vendas v
       ON v.id = vp.venda
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
