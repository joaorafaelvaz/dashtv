# Design — Nginx Token Auth + SSL para Dashboard TV

**Data:** 2026-04-13
**Domínio:** `dashboard.franquiabv.xyz`
**Objetivo:** Expor o dashboard na internet de forma segura, com autenticação por token em query string e SSL, sem modificar o código Next.js.

---

## Contexto

O dashboard TV roda em Next.js 14 na porta 3031. O servidor já hospeda outros sites com Nginx. O Raspberry Pi 2 acessa via Chromium em modo kiosk — nenhum humano digita credenciais.

---

## Arquitetura

```
Internet / RPi 2
      │
      ▼
 Nginx (porta 443 HTTPS)
  ├─ Certbot (Let's Encrypt) → SSL automático + renovação por cron
  ├─ Valida ?token=<TOKEN>   → 403 se inválido ou ausente
  ├─ Loga IP de cada acesso  → /var/log/nginx/dashtv-access.log
  └─ Proxy reverso           → http://127.0.0.1:3031 (Next.js)
      │
      ▼
 Next.js (PM2, escuta em 127.0.0.1:3031 — inacessível externamente)
      │
      ▼
 MySQL franquia_producao (barbeariavip.cloud)
```

**Princípios:**
- Next.js ligado **apenas em `127.0.0.1`** — porta 3031 invisível externamente
- Nginx é o único ponto de entrada público
- IPs desconhecidos não são bloqueados, mas ficam registrados com status no log dedicado
- Token nunca chega ao Next.js (removido pelo Nginx antes do proxy)

---

## Seção 1: Nginx

### Arquivos

```
/etc/nginx/
├── sites-available/dashtv.conf   ← server block principal
├── sites-enabled/dashtv.conf     ← symlink
└── /var/log/nginx/
    └── dashtv-access.log         ← log dedicado (IP + status + UA)
```

### Lógica do server block

```nginx
# Mapa: token correto → $auth_ok = 1, qualquer outro → 0
map $arg_token $auth_ok {
    default        0;
    "TOKEN_AQUI"   1;
}

server {
    listen 443 ssl;
    server_name dashboard.franquiabv.xyz;

    # SSL — preenchido pelo Certbot
    ssl_certificate     /etc/letsencrypt/live/dashboard.franquiabv.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.franquiabv.xyz/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Log dedicado: IP, timestamp, status, user-agent
    access_log /var/log/nginx/dashtv-access.log combined;

    location / {
        # Bloquear se token inválido ou ausente
        if ($auth_ok = 0) {
            return 403 "Acesso negado";
        }

        # Proxy para Next.js (token não é repassado)
        proxy_pass http://127.0.0.1:3031;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Ocultar token dos logs do Next.js
        proxy_set_header X-Token "";
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name dashboard.franquiabv.xyz;
    return 301 https://$host$request_uri;
}
```

### Token

Gerado com:
```bash
openssl rand -hex 16
# ex: a3f8c21d9e4b7f0a1c2d3e4f5a6b7c8d
```

Para trocar o token: editar a linha `"TOKEN_AQUI"` no `dashtv.conf` + `nginx -s reload`. Sem rebuild, sem redeploy.

### SSL — Certbot

```bash
certbot --nginx -d dashboard.franquiabv.xyz
```

Certbot modifica o `dashtv.conf` automaticamente adicionando os blocos SSL. Renovação automática já configurada pelo cron existente no servidor.

---

## Seção 2: Next.js — Binding em Localhost

### Mudança no package.json

```json
"start": "next start -p 3031 -H 127.0.0.1"
```

A flag `-H 127.0.0.1` restringe o Next.js a escutar apenas na interface loopback. A porta 3031 deixa de ser acessível externamente.

### ecosystem.config.js (novo arquivo na raiz)

```js
module.exports = {
  apps: [
    {
      name: 'dashtv',
      script: 'npm',
      args: 'start',
      cwd: '/caminho/para/dashtv',
      restart_delay: 5000,
      max_restarts: 10,
      error_file: '/var/log/pm2/dashtv-error.log',
      out_file: '/var/log/pm2/dashtv-out.log',
    },
  ],
}
```

### Firewall

```bash
# Fechar porta 3031 para o mundo (só Nginx local acessa)
ufw delete allow 3031

# Garantir que 80 e 443 estão abertos
ufw allow 80
ufw allow 443
```

---

## Seção 3: RPi 2 — Configuração do Chromium

### URL de kiosk

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  --disable-gpu \
  "https://dashboard.franquiabv.xyz?token=TOKEN_AQUI"
```

### Auto-start (arquivo de desktop)

```ini
# ~/.config/autostart/dashtv.desktop
[Desktop Entry]
Type=Application
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-gpu "https://dashboard.franquiabv.xyz?token=TOKEN_AQUI"
Hidden=false
X-GNOME-Autostart-enabled=true
Name=Dashboard TV
```

---

## Fluxo de Boot Completo

```
Servidor reinicia
  ├─ systemd → PM2 daemon → Next.js (127.0.0.1:3031)
  └─ systemd → Nginx       → porta 443 ativa

RPi 2 reinicia
  └─ autostart → Chromium kiosk → https://dashboard.franquiabv.xyz?token=...
                                        │
                                   Nginx valida token
                                        │
                                   proxy → Next.js → dados
```

---

## Monitoramento

```bash
# Ver logs de acesso (IPs, tokens inválidos)
tail -f /var/log/nginx/dashtv-access.log

# Status do Next.js
pm2 status dashtv
pm2 logs dashtv

# Validade do certificado SSL
certbot certificates
```

---

## Segurança — Resumo

| Camada | Proteção |
|---|---|
| SSL/TLS | Tráfego criptografado ponta a ponta |
| Token query string | 403 para qualquer acesso sem token válido |
| Next.js em localhost | Porta 3031 inacessível diretamente da internet |
| Log de IPs | Visibilidade de tentativas de acesso não autorizadas |
| Firewall | Porta 3031 fechada externamente |

**Não protege contra:** token copiado e usado de outro IP (mitigável no futuro com restrição de IP na camada Nginx se necessário).

---

## Mudanças no Repositório

| Arquivo | Ação |
|---|---|
| `package.json` | Modificar: adicionar `-H 127.0.0.1` ao script `start` |
| `ecosystem.config.js` | Criar: configuração PM2 |
| `/etc/nginx/sites-available/dashtv.conf` | Criar: server block (fora do repo) |

> O `dashtv.conf` **não entra no repositório** — contém o token em texto plano. Documentar apenas o template.
