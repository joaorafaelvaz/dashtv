# Deploy em produção — dashboard.franquiabv.com.br

Ordem: **DNS → pacotes → banco → código → build → PM2 → Nginx + HTTPS → TVs**.
Comandos rodam como `root` no servidor de produção.

## 0. Antes de começar

- **DNS:** registro `A` de `dashboard.franquiabv.com.br` apontando para o IP do
  servidor de produção. O certificado só sai depois que isso propagar:
  ```bash
  dig +short dashboard.franquiabv.com.br   # deve mostrar o IP deste servidor
  ```
- **Firewall:** portas 80 e 443 abertas.
- **Porta 3031 livre** (é onde o Next.js escuta, só em 127.0.0.1):
  ```bash
  ss -ltnp | grep ':3031 '   # não deve retornar nada
  ```

## 1. Pacotes

Pule o que já estiver instalado. O Next 14 precisa de Node ≥ 18.17 (use o 20 LTS).

```bash
apt update && apt install -y nginx certbot git curl
node -v || echo "instalar Node 20 LTS"
npm install -g pm2
```

## 2. Usuário do banco (somente leitura)

No MySQL de produção, como administrador. Se houver réplica de leitura, prefira
apontar o painel para ela — as consultas rodam a cada 1–5 min.

```sql
CREATE USER 'dashtv'@'HOST_DO_APP' IDENTIFIED BY 'SENHA_FORTE';
GRANT SELECT ON franquia_producao.agendas             TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.agendas_exclusoes   TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.agendas_fechamentos TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.clientes            TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.produtos            TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.unidades            TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.usuarios            TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.vendas              TO 'dashtv'@'HOST_DO_APP';
GRANT SELECT ON franquia_producao.vendas_produtos     TO 'dashtv'@'HOST_DO_APP';
FLUSH PRIVILEGES;
```

`HOST_DO_APP` é `localhost` se o MySQL estiver nesta máquina, ou o IP deste
servidor se estiver em outra. `agendas_fechamentos` é opcional: sem ela, os
bloqueios da agenda aparecem sem o motivo.

## 3. Código

O repositório é privado: autentique antes (`gh auth login` ou uma deploy key).

```bash
git clone https://github.com/joaorafaelvaz/dashtv.git /var/www/dashtv
```

## 4. Credenciais do banco

```bash
cat > /var/www/dashtv/.env.local <<'EOF'
DB_HOST=HOST_DO_MYSQL
DB_PORT=3306
DB_USER=dashtv
DB_PASSWORD=SENHA_FORTE
DB_NAME=franquia_producao
EOF
chmod 600 /var/www/dashtv/.env.local
```

## 5. Build

```bash
cd /var/www/dashtv
npm ci --fetch-retries=5 --fetch-timeout=300000
npm run build
mkdir -p data /var/log/pm2
```

Se o `npm ci` der `ETIMEDOUT`, rode `export NODE_OPTIONS="--dns-result-order=ipv4first"`
e tente de novo.

## 6. PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup                 # rodar o comando que ele imprimir
bash scripts/warm-cache.sh  # deve terminar em "Cache populado com sucesso!"
```

Se der HTTP 500, veja `pm2 logs dashtv --lines 50`. O erro mais comum é
`SELECT command denied ... for table 'X'`: falta o `GRANT` da tabela X (passo 2).

## 7. Nginx + HTTPS

```bash
bash scripts/setup-producao.sh --email SEU_EMAIL
```

O script:

1. publica a porta 80 só para o desafio do Let's Encrypt e cria o link
   `sites-enabled/dashtv.conf`;
2. emite o certificado (`certbot certonly --webroot`), com reload automático do
   Nginx nas renovações. Rodá-lo aceita os termos de uso do Let's Encrypt;
3. gera o conf definitivo a partir de `nginx/dashtv.prod.conf.template`, com
   **tokens novos** para o dashboard e para cada agenda (62, 1, 39, 10). Os
   tokens do servidor de teste não valem aqui;
4. valida (`nginx -t`), recarrega e testa com e sem token.

As URLs com os tokens ficam em `/root/dashtv-tokens.txt` (só root lê):

```bash
cat /root/dashtv-tokens.txt
```

O script recusa sobrescrever um conf existente. `--force` sobrescreve (com
backup) e gera **todos** os tokens de novo — as TVs precisarão das URLs novas.

## 8. Conferir

```bash
D=https://dashboard.franquiabv.com.br
curl -s -o /dev/null -w "dashboard sem token: %{http_code} (403)\n" "$D/"
curl -s -o /dev/null -w "agenda 62 sem token: %{http_code} (403)\n" "$D/62/agenda"
certbot renew --dry-run    # renovação automática funcionando
```

Depois abra as URLs de `/root/dashtv-tokens.txt` em cada TV.

## Deploys seguintes

```bash
cd /var/www/dashtv && bash scripts/deploy.sh
```

Não use `--update-nginx` em produção: ele aborta, porque copiaria o template de
teste por cima do conf de produção. Para regerar o conf, use o
`setup-producao.sh --force`.

## Incluir uma unidade na agenda

Em `/etc/nginx/sites-available/dashtv.conf`, no `map ... $dashtv_agenda_ok`,
adicione uma linha com um token aleatório e recarregue:

```bash
T=$(openssl rand -hex 16); echo "agenda N: https://dashboard.franquiabv.com.br/N/agenda?token=$T"
# adicionar no map:   "N:<token>"  1;
nginx -t && nginx -s reload
```

Inclua a mesma linha no template (`nginx/dashtv.prod.conf.template`, com
`AGENDAN_TOKEN_PLACEHOLDER`) para que um futuro `setup-producao.sh --force`
também gere o token dela.
