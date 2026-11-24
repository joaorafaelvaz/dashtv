#!/usr/bin/env bash
# forcar-atualizacao.sh — Força a atualização do painel a partir do servidor
#
# USO (no servidor):
#   bash scripts/forcar-atualizacao.sh
#
# O que faz, sem build e sem reiniciar o app:
#   1. Grava um sinal em data/forcar-atualizacao
#   2. Chama a API local: o servidor vê o sinal e refaz o cache na hora
#   3. As TVs consultam a versão a cada 1 min, veem que mudou e recarregam
#      a página sozinhas (dashboard e agendas)
#
# Só funciona em TVs que já carregaram uma versão do painel com a recarga
# automática. TV com página antiga precisa de uma recarga manual, uma vez.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SINAL="$APP_DIR/data/forcar-atualizacao"
API_URL="http://127.0.0.1:3031/api/dashboard"

mkdir -p "$APP_DIR/data"
date +%Y%m%d%H%M%S > "$SINAL"
echo "==> Sinal gravado: $(cat "$SINAL")"

echo "==> Refazendo o cache..."
TMP=$(mktemp)
HTTP_CODE=$(curl -s -o "$TMP" -w "%{http_code}" --max-time 60 "$API_URL" || true)
if [ "$HTTP_CODE" != "200" ]; then
  rm -f "$TMP"
  echo "ERRO: a API respondeu HTTP ${HTTP_CODE:-000}. Veja: pm2 logs dashtv --lines 30"
  exit 1
fi
TIMESTAMP=$(grep -o '"ultima_atualizacao":"[^"]*"' "$TMP" | cut -d'"' -f4)
rm -f "$TMP"

echo "    Cache atualizado em: ${TIMESTAMP:-desconhecido} (UTC)"
echo ""
echo "Pronto. As TVs recarregam sozinhas em até 1 minuto."
