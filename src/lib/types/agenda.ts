import type { RowDataPacket } from 'mysql2'

/** Origem do agendamento, normalizada a partir de agendas.origem. */
export type AgendaOrigem = 'app' | 'web' | 'balcao'

/** Situação exibida no card — derivada no cliente, pois depende da hora atual. */
export type AgendaStatus =
  | 'agendado'
  | 'atrasado'        // horário começou e o cliente não fez check-in
  | 'em_atendimento'
  | 'finalizado'
  | 'no_show'         // horário inteiro passou sem check-in, checkout nem venda

/** Linha bruta de `agendas` (uma por slot) com os joins necessários. */
export interface AgendaRow extends RowDataPacket, AgendaLinha {}

/** Campos da linha, sem o tipo do driver — usado em testes e fixtures. */
export interface AgendaLinha {
  id: number
  id_pai: number | null
  colaborador: number
  colaborador_nome: string
  tempo_atendimento: number | null
  hora: string                 // "HH:MM"
  origem: string | null
  checkin: number
  checkout: number
  status: number
  fechamento: number | null
  cliente_id: number | null
  cliente_nome: string | null
  convenio: number
  primeira_visita: number
  teve_venda: number
  servico_nome: string | null
}

export interface BarbeiroRow extends RowDataPacket {
  id: number
  nome: string
  tempo_atendimento: number | null
  abertura: string | null
  fechamento: string | null
  almoco_inicio: string | null
  almoco_fim: string | null
}

export interface BloqueioRow extends RowDataPacket {
  colaborador: number | null   // NULL = a unidade inteira
  motivo: string | null
  inicio: string               // "HH:MM", já recortado para hoje
  fim: string
  termina_depois: number       // o bloqueio continua amanhã
  ate: string                  // "DD/MM" do fim real
}

/** Um agendamento já agrupado (pai + slots filhos). */
export interface AgendaItem {
  id: number
  inicio: string               // "HH:MM"
  fim: string
  duracao: number              // minutos
  cliente: string | null
  servico: string | null
  origem: AgendaOrigem
  checkin: boolean
  checkout: boolean
  noShowMarcado: boolean       // agendas.status = 3
  teveVenda: boolean           // o cliente tem venda hoje → compareceu
  convenio: boolean
  primeiraVisita: boolean
}

export interface Bloqueio {
  inicio: string
  fim: string
  motivo: string | null
  ate: string | null           // "DD/MM" quando o bloqueio vai além de hoje
}

export interface BarbeiroAgenda {
  id: number
  nome: string
  abertura: string | null      // null = sem expediente hoje
  fechamento: string | null
  almocoInicio: string | null
  almocoFim: string | null
  ocupacao: number | null      // % do expediente com atendimento
  agendamentos: AgendaItem[]
  bloqueios: Bloqueio[]
}

export interface AgendaUnidade {
  unidade: { id: number; nome: string }
  data: string                 // "YYYY-MM-DD" (data do banco)
  inicioDia: string            // eixo vertical, "HH:MM"
  fimDia: string
  barbeiros: BarbeiroAgenda[]
  ultima_atualizacao: string
}
