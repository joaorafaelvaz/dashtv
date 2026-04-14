#!/usr/bin/env bash
# deploy.sh — Atualiza o Dashboard TV no servidor
#
# USO:
#   ./scripts/deploy.sh [--update-nginx]
#
# OPÇÕES:
#   --update-nginx   Copia o template Nginx para sites-available e faz reload
#                    Use apenas quando o server block precisar ser atualizado.
#                    ATENÇÃO: sobrescreve o token real — edite o arquivo após copiar.
#
# PRÉ-REQUISITOS (executar uma vez no servidor):
#   mkdir -p /var/log/pm2
#   pm2 startup   # e executar o comando que o PM2 imprimir

set -euo pipefail

APP_DIR="/var/www/dashtv"           # ajustar se necessário
NGINX_CONF="/etc/nginx/sites-available/dashtv.conf"
UPDATE_NGINX=false

# --- parse args ---
for arg in "$@"; do
  case $arg in
    --update-nginx) UPDATE_NGINX=true ;;
    *) echo "Argumento desconhecido: $arg" && exit 1 ;;
  esac
done

echo "==> [1/5] Pulling latest code..."
cd "$APP_DIR"
git pull origin master

echo "==> [2/5] Installing dependencies..."
# devDependencies são necessárias no build (tailwindcss, typescript, postcss)
npm ci

echo "==> [3/5] Building Next.js..."
npm run build

echo "==> [4/5] Restarting PM2..."
pm2 reload ecosystem.config.js --update-env
pm2 save

echo "==> [5/5] Creating data directory for disk cache..."
mkdir -p "$APP_DIR/data"

# --- Nginx (opcional) ---
if [ "$UPDATE_NGINX" = true ]; then
  echo ""
  echo "==> [Nginx] Atualizando server block..."
  cp "$APP_DIR/nginx/dashtv.conf.template" "$NGINX_CONF"
  echo ""
  echo "  ATENÇÃO: TOKEN_PLACEHOLDER está no arquivo copiado."
  echo "  Edite $NGINX_CONF e substitua TOKEN_PLACEHOLDER pelo token real:"
  echo "    nano $NGINX_CONF"
  echo "  Depois valide e recarregue:"
  echo "    nginx -t && nginx -s reload"
  echo ""
else
  echo ""
  echo "==> [Nginx] Recarregando configuração existente..."
  nginx -t && nginx -s reload
fi

echo ""
echo "Deploy concluído."
echo "  Status PM2 : $(pm2 jlist | python3 -c "import sys,json; apps=json.load(sys.stdin); [print(f'  {a[\"name\"]}: {a[\"pm2_env\"][\"status\"]}') for a in apps]" 2>/dev/null || pm2 status)"
echo "  Logs       : pm2 logs dashtv --lines 20"
echo "  Cache      : $APP_DIR/data/dashboard-cache.json"
