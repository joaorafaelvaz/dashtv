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

export interface DashboardData {
  faturamento_hoje: number
  agendamentos_dia: number
  slots_livres: number
  em_atendimento: number
  servicos_realizados: number
  faturamento_projetado: number
  media_3meses: number
  variacao_media_pct: number   // % de variação vs média 3 meses
  ranking: RankingUnidade[]    // todas as unidades, ordem DESC por faturamento_dia
  ultima_atualizacao: string   // ISO timestamp
}
