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

NEXT_PORT=3031
API_URL="http://127.0.0.1:${NEXT_PORT}/api/dashboard"

echo "==> Aquecendo cache em ${API_URL}..."

HTTP_CODE=$(curl -s -o /tmp/warm-cache-response.json -w "%{http_code}" --max-time 30 "$API_URL" || true)

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERRO: API retornou HTTP ${HTTP_CODE}"
  echo "--- Resposta ---"
  cat /tmp/warm-cache-response.json 2>/dev/null || true
  echo ""
  echo "--- Últimos logs PM2 ---"
  pm2 logs dashtv --lines 30 --nostream 2>/dev/null || true
  exit 1
fi

RESPONSE=$(cat /tmp/warm-cache-response.json)
TIMESTAMP=$(echo "$RESPONSE" | grep -o '"ultima_atualizacao":"[^"]*"' | cut -d'"' -f4)
FAT=$(echo "$RESPONSE" | grep -o '"faturamento_hoje":[0-9.]*' | cut -d':' -f2)

echo ""
echo "Cache populado com sucesso!"
echo "  Atualizado em : ${TIMESTAMP:-desconhecido}"
echo "  Faturamento   : R\$ ${FAT:-0}"
echo ""
echo "Arquivo: /var/www/dashtv/data/dashboard-cache.json"
