#!/usr/bin/env bash
# setup-producao.sh — Primeira instalação do Nginx + HTTPS do Dashboard TV em produção
#
# USO (como root, no servidor de produção, com o app já rodando no PM2):
#   bash scripts/setup-producao.sh --email voce@exemplo.com.br [--force]
#
# O que faz:
#   1. Publica um server block só na porta 80, para o desafio do Let's Encrypt
#   2. Emite o certificado (certbot certonly --webroot) com reload automático
#      do Nginx a cada renovação — se já existir, reaproveita
#   3. Gera o conf definitivo a partir de nginx/dashtv.prod.conf.template, com
#      tokens novos para o dashboard e para cada agenda do template
#   4. Valida (nginx -t), recarrega e testa o acesso com e sem token
#
# --force   sobrescreve /etc/nginx/sites-available/dashtv.conf (com backup)
#
# Os tokens e URLs gerados ficam em /root/dashtv-tokens.txt (somente root).
# Rodar este script de novo com --force gera TODOS os tokens de novo.

set -euo pipefail

DOMINIO="dashboard.franquiabv.com.br"
APP_DIR="/var/www/dashtv"
TEMPLATE="$APP_DIR/nginx/dashtv.prod.conf.template"
CONF="/etc/nginx/sites-available/dashtv.conf"
LINK="/etc/nginx/sites-enabled/dashtv.conf"
WEBROOT="/var/www/certbot"
CERT="/etc/letsencrypt/live/$DOMINIO/fullchain.pem"
TOKENS_FILE="/root/dashtv-tokens.txt"

EMAIL=""
FORCE=false
while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --force) FORCE=true; shift ;;
    *) echo "Argumento desconhecido: $1"; exit 1 ;;
  esac
done

falha() { echo "ERRO: $*" >&2; exit 1; }

# --- pré-condições ---
[ "$(id -u)" -eq 0 ] || falha "rode como root"
[ -n "$EMAIL" ] || falha "informe --email (avisos de expiração do Let's Encrypt)"
[ -f "$TEMPLATE" ] || falha "template não encontrado: $TEMPLATE"
for cmd in nginx certbot openssl curl; do
  command -v "$cmd" >/dev/null || falha "comando ausente: $cmd"
done
if [ -e "$CONF" ] && [ "$FORCE" != true ]; then
  falha "$CONF já existe. Use --force para sobrescrever (gera tokens novos)."
fi

APP_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://127.0.0.1:3031/api/dashboard || true)
if [ "$APP_HTTP" != "200" ]; then
  echo "AVISO: o app em 127.0.0.1:3031 respondeu HTTP ${APP_HTTP:-000}."
  echo "       O Nginx será configurado mesmo assim; confira 'pm2 logs dashtv' depois."
fi

[ -e "$CONF" ] && cp "$CONF" "$CONF.bak.$(date +%Y%m%d%H%M%S)"

# --- 1. porta 80 provisória, só para o desafio ---
echo "==> [1/4] Publicando a porta 80 para o desafio do Let's Encrypt..."
mkdir -p "$WEBROOT"
cat > "$CONF" <<EOF
# Provisório (setup-producao.sh) — substituído ao final do setup
server {
    listen 80;
    server_name $DOMINIO;
    location /.well-known/acme-challenge/ { root $WEBROOT; }
    location / { return 404; }
}
EOF
ln -sfn "$CONF" "$LINK"
nginx -t
nginx -s reload

# --- 2. certificado ---
echo "==> [2/4] Certificado..."
if [ -f "$CERT" ]; then
  echo "    Já existe em $CERT — reaproveitando."
else
  certbot certonly --webroot -w "$WEBROOT" -d "$DOMINIO" \
    --email "$EMAIL" --agree-tos --no-eff-email --non-interactive \
    --deploy-hook "systemctl reload nginx"
fi
[ -f "$CERT" ] || falha "certificado não foi emitido — confira o DNS de $DOMINIO"

# --- 3. conf definitivo com tokens novos ---
echo "==> [3/4] Gerando o conf definitivo com tokens novos..."
TMP=$(mktemp)
cp "$TEMPLATE" "$TMP"

umask 077
TD=$(openssl rand -hex 16)
sed -i "s/\"TOKEN_PLACEHOLDER\"/\"$TD\"/" "$TMP"
{
  echo "# Dashboard TV — tokens gerados em $(date '+%d/%m/%Y %H:%M') por setup-producao.sh"
  echo "dashboard: https://$DOMINIO/?token=$TD"
} > "$TOKENS_FILE"

# Unidades de agenda: lidas do próprio template, para script e conf nunca divergirem
for u in $(grep -oE '"[0-9]+:AGENDA[0-9]+_TOKEN_PLACEHOLDER"' "$TMP" | grep -oE '^"[0-9]+' | tr -d '"'); do
  t=$(openssl rand -hex 16)
  sed -i "s/\"$u:AGENDA${u}_TOKEN_PLACEHOLDER\"/\"$u:$t\"/" "$TMP"
  echo "agenda $u: https://$DOMINIO/$u/agenda?token=$t" >> "$TOKENS_FILE"
done

if grep -v '^\s*#' "$TMP" | grep -q PLACEHOLDER; then
  rm -f "$TMP"
  falha "sobrou placeholder no conf gerado — template inconsistente"
fi

# Só substitui o provisório se o definitivo passar no nginx -t
cp "$CONF" "$CONF.provisorio"
cp "$TMP" "$CONF"
rm -f "$TMP"
chmod 640 "$CONF"
if ! nginx -t; then
  cp "$CONF.provisorio" "$CONF"
  rm -f "$CONF.provisorio"
  falha "nginx -t falhou com o conf definitivo — o provisório foi restaurado"
fi
rm -f "$CONF.provisorio"
nginx -s reload

# --- 4. verificação ---
echo "==> [4/4] Testando o acesso..."
sleep 1
codigo() { curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$1" || echo "000"; }
COM=$(codigo "https://$DOMINIO/?token=$TD")
SEM=$(codigo "https://$DOMINIO/")
echo "    dashboard com token: HTTP $COM (esperado 200)"
echo "    dashboard sem token: HTTP $SEM (esperado 403)"

echo ""
echo "Pronto. URLs com os tokens (guardadas em $TOKENS_FILE):"
sed 's/^/    /' "$TOKENS_FILE"
