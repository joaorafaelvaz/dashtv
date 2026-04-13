# Nginx Token Auth + SSL — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor o dashboard TV em `https://dashboard.franquiabv.xyz` com autenticação por token em query string, SSL via Let's Encrypt e Next.js escutando apenas em localhost.

**Architecture:** Nginx atua como único ponto de entrada público — valida o token via diretiva `map`, emite 403 para tokens inválidos, loga todos os IPs e repassa requests válidos como proxy reverso para o Next.js (127.0.0.1:3031). O Next.js é modificado para escutar apenas em loopback. PM2 gerencia o processo com restart automático.

**Tech Stack:** Nginx, Certbot (Let's Encrypt), PM2, Next.js 14, Ubuntu/Debian Linux.

---

## ⚠️ Pré-requisitos

Antes de iniciar:
- DNS: registro A de `dashboard.franquiabv.xyz` apontando para o IP do servidor já propagado
- Nginx instalado e rodando (`nginx -v`)
- Certbot instalado (`certbot --version`)
- PM2 instalado globalmente (`pm2 -v`)
- Porta 80 e 443 abertas no firewall do servidor/provedor de cloud

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `package.json` | Modificar | Bind Next.js a 127.0.0.1 |
| `ecosystem.config.js` | Criar | Configuração PM2 com logs e restart |
| `nginx/dashtv.conf.template` | Criar | Template do server block (sem token real) |
| `/etc/nginx/sites-available/dashtv.conf` | Criar (servidor) | Server block real com token |
| `/etc/nginx/sites-enabled/dashtv.conf` | Criar (servidor) | Symlink |

> `nginx/dashtv.conf.template` entra no repositório como documentação.
> `/etc/nginx/sites-available/dashtv.conf` **não entra no repo** — contém o token em texto plano.

---

## Chunk 1: Projeto Next.js

### Task 1: Bind Next.js a localhost + PM2 ecosystem

**Files:**
- Modify: `package.json`
- Create: `ecosystem.config.js`

- [ ] **Step 1.1: Modificar o script `start` no package.json**

Editar `package.json` — alterar a linha do script `start`:

```json
"start": "next start -p 3031 -H 127.0.0.1"
```

A flag `-H 127.0.0.1` faz o Next.js escutar apenas na interface loopback. A porta 3031 deixa de responder em interfaces externas.

- [ ] **Step 1.2: Verificar que o build ainda funciona**

```bash
cd /caminho/para/dashtv
npm run build
```
Esperado: `✓ Compiled successfully` — sem erros.

- [ ] **Step 1.3: Criar ecosystem.config.js**

Criar `ecosystem.config.js` na raiz do projeto:

```js
module.exports = {
  apps: [
    {
      name: 'dashtv',
      script: 'npm',
      args: 'start',
      cwd: '/caminho/para/dashtv', // ← substituir pelo caminho real
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/dashtv-error.log',
      out_file: '/var/log/pm2/dashtv-out.log',
      merge_logs: true,
    },
  ],
}
```

> Substituir `/caminho/para/dashtv` pelo caminho absoluto real no servidor (ex: `/home/ubuntu/dashtv` ou `/var/www/dashtv`).

- [ ] **Step 1.4: Criar diretório de logs do PM2**

```bash
mkdir -p /var/log/pm2
```

- [ ] **Step 1.5: Testar start via PM2**

```bash
# Parar processo anterior se existir
pm2 delete dashtv 2>/dev/null || true

# Iniciar com ecosystem
pm2 start ecosystem.config.js

# Verificar status
pm2 status
```

Esperado: processo `dashtv` com status `online`.

- [ ] **Step 1.6: Verificar que Next.js só escuta em localhost**

```bash
ss -tlnp | grep 3031
```

Esperado: `127.0.0.1:3031` — **não** deve aparecer `0.0.0.0:3031`.

- [ ] **Step 1.7: Verificar que porta 3031 está inacessível externamente**

De outra máquina na rede (ou usando curl com IP externo):
```bash
curl http://<IP-DO-SERVIDOR>:3031
```
Esperado: `Connection refused` ou timeout — nunca uma resposta HTML.

- [ ] **Step 1.8: Configurar PM2 para iniciar com o sistema**

```bash
pm2 save
pm2 startup
# Executar o comando que o PM2 imprimir (começa com sudo env PATH=...)
```

- [ ] **Step 1.9: Commit**

```bash
git add package.json ecosystem.config.js
git commit -m "feat: bind Next.js to localhost and add PM2 ecosystem config"
```

---

### Task 2: Template Nginx (documentação no repo)

**Files:**
- Create: `nginx/dashtv.conf.template`

- [ ] **Step 2.1: Criar diretório nginx**

```bash
mkdir -p nginx
```

- [ ] **Step 2.2: Criar o template**

Criar `nginx/dashtv.conf.template`:

```nginx
# Dashboard TV — Barbearia VIP Franqueadora
# Template do server block Nginx
#
# INSTRUÇÕES DE USO:
# 1. Copiar para /etc/nginx/sites-available/dashtv.conf
# 2. Substituir TOKEN_PLACEHOLDER pelo token real (openssl rand -hex 16)
# 3. Substituir /caminho/para/dashtv pelo caminho absoluto do projeto
# 4. Executar: certbot --nginx -d dashboard.franquiabv.xyz
# 5. Executar: ln -s /etc/nginx/sites-available/dashtv.conf /etc/nginx/sites-enabled/
# 6. Executar: nginx -s reload
#
# NUNCA commitar o arquivo real /etc/nginx/sites-available/dashtv.conf
# pois ele contém o token em texto plano.

# Mapa: token correto → $auth_ok = 1, qualquer outro valor → 0
map $arg_token $auth_ok {
    default              0;
    "TOKEN_PLACEHOLDER"  1;
}

server {
    listen 80;
    server_name dashboard.franquiabv.xyz;
    # Certbot adicionará redirect para HTTPS aqui
}

# Bloco SSL — Certbot preencherá os caminhos dos certificados
server {
    listen 443 ssl;
    server_name dashboard.franquiabv.xyz;

    # Certificados — preenchido pelo Certbot
    # ssl_certificate     /etc/letsencrypt/live/dashboard.franquiabv.xyz/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/dashboard.franquiabv.xyz/privkey.pem;
    # include             /etc/letsencrypt/options-ssl-nginx.conf;
    # ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Log dedicado: IP, timestamp, status HTTP, user-agent
    access_log /var/log/nginx/dashtv-access.log combined;
    error_log  /var/log/nginx/dashtv-error.log warn;

    location / {
        # Bloquear acesso se token inválido ou ausente
        if ($auth_ok = 0) {
            return 403 "Acesso negado";
        }

        # Proxy reverso para Next.js (token não é repassado ao app)
        proxy_pass http://127.0.0.1:3031;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts para o dashboard (queries SQL podem levar alguns segundos)
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
}
```

- [ ] **Step 2.3: Commit**

```bash
git add nginx/dashtv.conf.template
git commit -m "docs: add Nginx server block template for token auth"
```

---

## Chunk 2: Servidor — Nginx + SSL

> ⚠️ Os passos abaixo são executados **diretamente no servidor**, não pelo agente. São comandos de sistema que requerem acesso root/sudo.

### Task 3: Gerar token e criar server block

**Files (no servidor):**
- Create: `/etc/nginx/sites-available/dashtv.conf`
- Create: `/etc/nginx/sites-enabled/dashtv.conf` (symlink)
- Create: `/var/log/nginx/dashtv-access.log`

- [ ] **Step 3.1: Gerar o token**

```bash
openssl rand -hex 16
```

Copiar o output (ex: `a3f8c21d9e4b7f0a1c2d3e4f5a6b7c8d`). Guardar em local seguro — será necessário para configurar o RPi.

- [ ] **Step 3.2: Criar o server block real**

```bash
cp /caminho/para/dashtv/nginx/dashtv.conf.template /etc/nginx/sites-available/dashtv.conf
```

Editar `/etc/nginx/sites-available/dashtv.conf`:
- Substituir `TOKEN_PLACEHOLDER` pelo token gerado no Step 3.1
- Descomentar as linhas SSL (Certbot fará isso automaticamente no próximo passo, mas o `map` precisa ter o token real agora)

- [ ] **Step 3.3: Criar symlink**

```bash
ln -s /etc/nginx/sites-available/dashtv.conf /etc/nginx/sites-enabled/dashtv.conf
```

- [ ] **Step 3.4: Verificar sintaxe do Nginx**

```bash
nginx -t
```
Esperado: `syntax is ok` e `test is successful`.

- [ ] **Step 3.5: Reload do Nginx**

```bash
nginx -s reload
```

### Task 4: SSL com Certbot

- [ ] **Step 4.1: Executar Certbot**

```bash
certbot --nginx -d dashboard.franquiabv.xyz
```

Certbot irá:
1. Verificar que o domínio aponta para o servidor (HTTP challenge)
2. Emitir o certificado
3. Modificar `/etc/nginx/sites-available/dashtv.conf` adicionando as diretivas SSL
4. Configurar redirect HTTP → HTTPS

- [ ] **Step 4.2: Verificar certificado**

```bash
certbot certificates
```
Esperado: `dashboard.franquiabv.xyz` listado com data de expiração.

- [ ] **Step 4.3: Testar renovação automática**

```bash
certbot renew --dry-run
```
Esperado: `Congratulations, all simulated renewals succeeded`.

- [ ] **Step 4.4: Verificar SSL no browser**

Abrir `https://dashboard.franquiabv.xyz` — deve aparecer cadeado verde.

Testar sem token:
```bash
curl -I https://dashboard.franquiabv.xyz
```
Esperado: `HTTP/2 403`

Testar com token válido:
```bash
curl -I "https://dashboard.franquiabv.xyz?token=SEU_TOKEN"
```
Esperado: `HTTP/2 200`

Testar com token inválido:
```bash
curl -I "https://dashboard.franquiabv.xyz?token=errado"
```
Esperado: `HTTP/2 403`

### Task 5: Firewall

- [ ] **Step 5.1: Fechar porta 3031**

```bash
ufw status
ufw delete allow 3031
```

- [ ] **Step 5.2: Garantir portas 80 e 443 abertas**

```bash
ufw allow 80
ufw allow 443
ufw status
```

Esperado: apenas 80 e 443 abertas (além de SSH/22).

- [ ] **Step 5.3: Confirmar que 3031 está inacessível**

```bash
# De outra máquina ou via curl com IP:
curl http://<IP-DO-SERVIDOR>:3031
```
Esperado: `Connection refused`.

---

## Chunk 3: RPi 2 — Player

### Task 6: Configurar Chromium em kiosk

> Executado diretamente no Raspberry Pi 2.

- [ ] **Step 6.1: Configurar orientação portrait da TV**

Editar `/boot/config.txt`:
```bash
sudo nano /boot/config.txt
```

Adicionar no final:
```
display_rotate=1
```

Salvar e reiniciar: `sudo reboot`

- [ ] **Step 6.2: Criar arquivo de autostart**

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/dashtv.desktop
```

Conteúdo:
```ini
[Desktop Entry]
Type=Application
Name=Dashboard TV
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --no-first-run --disable-gpu "https://dashboard.franquiabv.xyz?token=SEU_TOKEN"
Hidden=false
X-GNOME-Autostart-enabled=true
```

Substituir `SEU_TOKEN` pelo token gerado no Step 3.1.

- [ ] **Step 6.3: Testar manualmente**

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-gpu "https://dashboard.franquiabv.xyz?token=SEU_TOKEN"
```

Esperado: dashboard abre em tela cheia, portrait, sem barra de navegação.

- [ ] **Step 6.4: Reiniciar e verificar auto-start**

```bash
sudo reboot
```

Após reiniciar: Chromium deve abrir automaticamente com o dashboard.

- [ ] **Step 6.5: Desabilitar screensaver/sleep da TV (opcional)**

```bash
# Adicionar ao ~/.config/autostart/disable-screensaver.desktop
[Desktop Entry]
Type=Application
Exec=xset s off -dpms
Hidden=false
```

---

## Verificação Final

- [ ] **Dashboard acessível via HTTPS com token:** `https://dashboard.franquiabv.xyz?token=TOKEN` → 200 ✅
- [ ] **Acesso sem token bloqueado:** `https://dashboard.franquiabv.xyz` → 403 ✅
- [ ] **Token errado bloqueado:** `?token=errado` → 403 ✅
- [ ] **Porta 3031 inacessível diretamente:** `http://IP:3031` → Connection refused ✅
- [ ] **SSL válido:** cadeado verde no browser ✅
- [ ] **RPi exibe o dashboard em portrait após reboot** ✅
- [ ] **Servidor Next.js sobrevive a reboot:** `pm2 status` → `online` ✅
- [ ] **Log de IPs funcionando:** `tail /var/log/nginx/dashtv-access.log` → entradas visíveis ✅

---

## Monitoramento Contínuo

```bash
# Acessos ao dashboard (todos)
tail -f /var/log/nginx/dashtv-access.log

# Tentativas com token inválido
grep " 403 " /var/log/nginx/dashtv-access.log

# Status do Next.js
pm2 status dashtv
pm2 logs dashtv --lines 50

# Validade do SSL (renovação automática via cron do Certbot)
certbot certificates
```

---

## Troca de Token

Quando precisar rotacionar o token:

1. Gerar novo token: `openssl rand -hex 16`
2. Editar `/etc/nginx/sites-available/dashtv.conf` — substituir o token na linha do `map`
3. Recarregar Nginx: `nginx -s reload`
4. Atualizar o `dashtv.desktop` no RPi com o novo token
5. Reiniciar o Chromium no RPi

Zero downtime — sem rebuild, sem redeploy do Next.js.
