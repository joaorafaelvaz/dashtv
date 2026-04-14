import type { RowDataPacket } from 'mysql2'

export interface BarberSchedule extends RowDataPacket {
  id: number
  tempo_atendimento: number // minutos por atendimento
  abertura: string | null   // ex: "09:00:00"
  fechamento: string | null // ex: "18:00:00"
  almoco_inicio: string | null
  almoco_fim: string | null
}

export interface RankingUnidade extends RowDataPacket {
  id: number
  nome: string | null  // NULL permitido no schema — tratar no componente de renderização
  cidade: string
  bairro: string
  faturamento_dia: number
}

export interface TopBarbeiro extends RowDataPacket {
  nome: string
  servicos: number
  faturamento: number
  unidade_estado: string | null
  unidade_cidade: string | null
  unidade_bairro: string | null
}

export interface DashboardData {
  faturamento_hoje: number
  agendamentos_dia: number
  slots_livres: number
  em_atendimento: number
  servicos_realizados: number
  faturamento_projetado: number
  media_3meses: number
  variacao_media_pct: number     // % de variação vs média 3 meses
  taxa_ocupacao: number          // % de slots ocupados vs total
  taxa_cancelamento: number      // % de agendamentos cancelados sobre o total
  taxa_no_show: number           // % de agendamentos passados sem check-in
  tempo_medio_atendimento: number // minutos médios por atendimento concluído
  produtos_vendidos: number      // total de vendas finalizadas hoje
  top_barbeiros: TopBarbeiro[]   // top 3 por serviços realizados
  ranking: RankingUnidade[]      // todas as unidades, ordem DESC por faturamento_dia
  ultima_atualizacao: string     // ISO timestamp
}
