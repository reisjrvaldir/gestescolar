# GestEscolar - Guia Completo de Deploy (VPS Hostinger)
# Para iniciantes - passo a passo detalhado

---

## PARTE 1: CONTRATAR O VPS NA HOSTINGER

### 1.1 Criar conta e contratar VPS

1. Acesse https://www.hostinger.com.br/servidor-vps
2. Escolha o plano **KVM 1** (o mais barato, suficiente para comecar)
   - 1 vCPU, 4GB RAM, 50GB SSD
   - Aproximadamente R$25/mes
3. No checkout, escolha o periodo (quanto maior, mais desconto)
4. Finalize o pagamento

### 1.2 Configurar o VPS

Apos o pagamento, a Hostinger vai te levar ao painel do VPS:

1. No painel, escolha o **Sistema Operacional**: Ubuntu 22.04
2. Defina a **senha de root** (anote em local seguro!)
   - Exemplo: MinhaSenh@VPS2026
   - IMPORTANTE: use letra maiuscula, minuscula, numero e simbolo
3. Aguarde a instalacao (1-3 minutos)
4. Anote o **endereco IP** do VPS (aparece no painel)
   - Exemplo: 185.200.100.50

---

## PARTE 2: REGISTRAR O DOMINIO

### 2.1 Comprar o dominio

Voce pode comprar na propria Hostinger ou em outro registrador:

- Hostinger: https://www.hostinger.com.br/registro-de-dominio
- Registro.br: https://registro.br (para .com.br)

Escolha um nome, por exemplo: `gestescolar.com.br`

### 2.2 Apontar o dominio para o VPS

Isso diz ao mundo: "quando alguem digitar gestescolar.com.br, va para o IP do meu VPS"

**Se o dominio foi comprado na Hostinger:**

1. Painel Hostinger > Dominios > Seu dominio > DNS / Nameservers
2. Na secao "Registros DNS", adicione/edite:

   | Tipo | Nome  | Valor           | TTL  |
   |------|-------|-----------------|------|
   | A    | @     | 185.200.100.50  | 3600 |
   | A    | www   | 185.200.100.50  | 3600 |

   (Substitua 185.200.100.50 pelo IP real do seu VPS)

3. Clique Salvar
4. **Aguarde 15 min a 24h** para o DNS propagar

**Se o dominio foi comprado no Registro.br:**

1. Acesse https://registro.br > Meus dominios
2. Clique no dominio > Editar zona DNS
3. Adicione os mesmos registros A acima
4. Salve e aguarde propagacao

### 2.3 Verificar se o DNS propagou

Apos alguns minutos, teste no seu computador:

- Windows: Abra o Prompt de Comando e digite:
  ```
  nslookup gestescolar.com.br
  ```
  Se mostrar o IP do seu VPS, o DNS propagou!

- Ou acesse: https://dnschecker.org e digite seu dominio

---

## PARTE 3: ACESSAR O VPS VIA SSH

SSH e a forma de controlar o VPS remotamente pelo terminal.

### 3.1 No Windows (usando PowerShell ou Terminal)

O Windows 10/11 ja tem SSH embutido:

1. Abra o **Terminal** (ou PowerShell)
2. Digite:
   ```
   ssh root@185.200.100.50
   ```
   (substitua pelo IP real do seu VPS)
3. Na primeira vez, vai perguntar se confia no servidor. Digite: **yes**
4. Digite a senha de root que voce definiu na Parte 1
5. Pronto! Voce esta dentro do VPS

Voce vera algo como:
```
root@vps-123456:~#
```

Isso significa que voce esta controlando o VPS remotamente.

### 3.2 Alternativa: Painel Hostinger

Se preferir nao usar o terminal local:

1. Painel Hostinger > VPS > Seu servidor
2. Clique em "Terminal" ou "Console" no painel
3. Faca login com root e sua senha

---

## PARTE 4: INSTALAR TUDO NO VPS

Agora voce esta dentro do VPS via SSH. Execute os comandos abaixo **um por um**.

### 4.1 Atualizar o sistema

```bash
apt update && apt upgrade -y
```
(Pode demorar 1-2 minutos. Se perguntar algo, aperte Enter para aceitar o padrao)

### 4.2 Instalar o Nginx (servidor web)

```bash
apt install -y nginx
```

Verificar se esta rodando:
```bash
systemctl status nginx
```
Deve mostrar "active (running)" em verde.

### 4.3 Instalar Git

```bash
apt install -y git
```

### 4.4 Instalar Certbot (para HTTPS gratuito)

```bash
apt install -y certbot python3-certbot-nginx
```

### 4.5 Configurar firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Se der um aviso sobre SSH, nao se preocupe - ja liberamos a porta 22.

---

## PARTE 5: ENVIAR OS ARQUIVOS DO GESTESCOLAR

### 5.1 Criar a pasta do site

No VPS (via SSH), execute:
```bash
mkdir -p /var/www/gestescolar
```

### 5.2 Opcao A: Enviar via Git (RECOMENDADO)

Se seu projeto esta no GitHub:

```bash
cd /var/www
git clone https://github.com/SEU_USUARIO/gestescolar.git
```

### 5.2 Opcao B: Enviar via SCP (sem Git)

No seu computador (NAO no VPS), abra outro terminal e execute:

```
scp -r index.html css js assets root@185.200.100.50:/var/www/gestescolar/
```

### 5.3 Opcao C: Enviar via SFTP (interface grafica)

Se preferir arrastar e soltar arquivos:

1. Baixe o **WinSCP**: https://winscp.net/eng/download.php
2. Abra o WinSCP e preencha:
   - Protocolo: SFTP
   - Host: IP do VPS
   - Usuario: root
   - Senha: sua senha
3. Conecte e navegue ate `/var/www/gestescolar/`
4. Arraste os arquivos do seu computador para la
5. Envie APENAS: `index.html`, `css/`, `js/`, `assets/`
6. NAO envie: `deploy/`, `supabase/`, `.claude/`, `.git/`

### 5.4 Verificar os arquivos

No VPS, verifique:
```bash
ls -la /var/www/gestescolar/
```

Deve mostrar:
```
index.html
css/
js/
assets/
```

---

## PARTE 6: CONFIGURAR O NGINX

### 6.1 Criar arquivo de configuracao

No VPS, execute:
```bash
nano /etc/nginx/sites-available/gestescolar
```

Isso abre um editor de texto. Cole o conteudo abaixo (substitua gestescolar.com.br pelo seu dominio):

```
server {
    listen 80;
    server_name gestescolar.com.br www.gestescolar.com.br;

    root /var/www/gestescolar;
    index index.html;

    # Seguranca
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # SPA: qualquer rota cai no index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para arquivos estaticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Bloquear acesso a pastas sensiveis
    location ~* /(supabase|deploy|\.claude|\.git) {
        deny all;
        return 404;
    }

    # Compressao
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 256;
}
```

Para salvar e sair do nano:
1. Aperte **Ctrl + O** (salvar) > Enter
2. Aperte **Ctrl + X** (sair)

### 6.2 Ativar o site

```bash
ln -sf /etc/nginx/sites-available/gestescolar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

### 6.3 Testar e reiniciar

```bash
nginx -t
```
Deve mostrar: "syntax is ok" e "test is successful"

```bash
systemctl restart nginx
```

### 6.4 Testar no navegador

Abra o navegador e acesse:
```
http://185.200.100.50
```
(substitua pelo IP do seu VPS)

Deve aparecer a tela de login do GestEscolar!

Se o DNS ja propagou, tambem funciona:
```
http://gestescolar.com.br
```

---

## PARTE 7: ATIVAR HTTPS (SSL GRATUITO)

IMPORTANTE: So faca isso APOS o DNS estar propagado (Parte 2.3).

```bash
certbot --nginx -d gestescolar.com.br -d www.gestescolar.com.br
```

Vai perguntar:
1. Seu email: digite seu email (para avisos de renovacao)
2. Aceitar termos: **Y**
3. Compartilhar email: **N**
4. Redirecionar HTTP para HTTPS: **2** (sim, redirecionar)

Pronto! Agora `https://gestescolar.com.br` funciona com cadeado verde.

O certificado renova automaticamente a cada 90 dias.

---

## PARTE 8: CONFIGURAR O SUPABASE

Apos o site estar no ar com dominio, atualize o Supabase:

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Va em **Authentication** > **URL Configuration**
4. Altere:
   - **Site URL**: `https://gestescolar.com.br`
   - **Redirect URLs**: adicione `https://gestescolar.com.br/**`
5. Salve

---

## PARTE 9: COMO ATUALIZAR O SITE (DEPLOY FUTURO)

Sempre que fizer mudancas no codigo:

### Se usou Git (Opcao A):

```bash
ssh root@185.200.100.50
cd /var/www/gestescolar
git pull
```

### Se usou SCP (Opcao B):

No seu computador:
```
scp -r index.html css js assets root@185.200.100.50:/var/www/gestescolar/
```

### Se usou WinSCP (Opcao C):

1. Abra WinSCP
2. Conecte no VPS
3. Arraste os arquivos atualizados

---

## RESUMO RAPIDO (CHECKLIST)

- [ ] Contratei VPS na Hostinger (Ubuntu 22.04)
- [ ] Anotei o IP do VPS
- [ ] Registrei dominio e apontei DNS A record para o IP
- [ ] Acessei VPS via SSH
- [ ] Executei: apt update && apt upgrade -y
- [ ] Executei: apt install -y nginx git certbot python3-certbot-nginx
- [ ] Configurei firewall (ufw)
- [ ] Enviei arquivos para /var/www/gestescolar/
- [ ] Criei config Nginx e ativei
- [ ] Testei no navegador via IP
- [ ] DNS propagou (nslookup mostra meu IP)
- [ ] Ativei SSL com certbot
- [ ] Site abre em https://meudominio.com.br
- [ ] Atualizei URL no painel Supabase

---

## PROBLEMAS COMUNS

### "Connection refused" ao acessar pelo navegador
- Verifique se o Nginx esta rodando: `systemctl status nginx`
- Verifique o firewall: `ufw status`

### "502 Bad Gateway"
- Verifique se os arquivos existem: `ls /var/www/gestescolar/`
- Verifique o config: `nginx -t`

### Site carrega mas Supabase nao conecta
- Verifique o console do navegador (F12 > Console)
- Certifique-se que o dominio esta liberado no Supabase

### "DNS_PROBE_FINISHED_NXDOMAIN"
- O DNS ainda nao propagou. Aguarde ate 24h
- Verifique em https://dnschecker.org

### Esqueci a senha do VPS
- No painel Hostinger > VPS > Reset Root Password

### Como reiniciar o Nginx
```bash
systemctl restart nginx
```

### Como ver logs de erro
```bash
tail -50 /var/log/nginx/error.log
```
