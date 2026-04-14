#!/usr/bin/env bash
# warm-cache.sh — Popula o cache do dashboard manualmente
#
# Chama o Next.js diretamente (porta interna 3031, sem Nginx/token).
# Útil após restart do servidor ou quando o cache estiver desatualizado.
#
# USO:
#   bash scripts/warm-cache.sh
#
# Saída: exibe o JSON resumido com os dados carregados e o timestamp.

set -euo pipefail

NEXT_PORT=3031
API_URL="http://127.0.0.1:${NEXT_PORT}/api/dashboard"

echo "==> Aquecendo cache em ${API_URL}..."

RESPONSE=$(curl -sf --max-time 30 "$API_URL")

if [ $? -ne 0 ]; then
  echo "ERRO: Não foi possível conectar ao Next.js em $API_URL"
  echo "Verifique se o PM2 está rodando: pm2 status"
  exit 1
fi

# Extrair campos principais para confirmação
TIMESTAMP=$(echo "$RESPONSE" | grep -o '"ultima_atualizacao":"[^"]*"' | cut -d'"' -f4)
FAT=$(echo "$RESPONSE" | grep -o '"faturamento_hoje":[0-9.]*' | cut -d':' -f2)

echo ""
echo "Cache populado com sucesso!"
echo "  Atualizado em : ${TIMESTAMP:-desconhecido}"
echo "  Faturamento   : R\$ ${FAT:-0}"
echo ""
echo "Arquivo: /var/www/dashtv/data/dashboard-cache.json"
