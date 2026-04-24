#!/bin/bash
# =============================================
#  GESTESCOLAR – SETUP INICIAL DO VPS
#  Executar UMA VEZ no VPS Hostinger (Ubuntu)
#  Uso: ssh root@IP_DO_VPS 'bash -s' < setup-vps.sh
# =============================================

set -e

DOMAIN="${1:-gestescolar.com.br}"
APP_DIR="/var/www/gestescolar"
REPO_URL="${2:-}"
DEPLOY_USER="deploy"

echo "========================================="
echo " GestEscolar VPS Setup"
echo " Dominio: $DOMAIN"
echo "========================================="

# 1. Atualizar sistema
echo "[1/7] Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar Nginx + Certbot + Git
echo "[2/7] Instalando Nginx, Certbot, Git..."
apt install -y nginx certbot python3-certbot-nginx git ufw

# 3. Criar usuario de deploy (sem root)
echo "[3/7] Criando usuario de deploy..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" $DEPLOY_USER
  mkdir -p /home/$DEPLOY_USER/.ssh
  cp ~/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
  chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
fi

# 4. Criar diretorio da aplicacao
echo "[4/7] Configurando diretorio da aplicacao..."
mkdir -p $APP_DIR
chown -R $DEPLOY_USER:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Clonar repo se URL fornecida
if [ -n "$REPO_URL" ]; then
  sudo -u $DEPLOY_USER git clone "$REPO_URL" $APP_DIR || true
fi

# 5. Configurar Nginx
echo "[5/7] Configurando Nginx..."
cat > /etc/nginx/sites-available/gestescolar <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR;
    index index.html;

    # Seguranca
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # SPA: qualquer rota cai no index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache para assets estaticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # Negar acesso a arquivos ocultos
    location ~ /\. {
        deny all;
        return 404;
    }

    # Negar acesso ao diretorio supabase/deploy
    location ~* /(supabase|deploy|\.claude|\.git) {
        deny all;
        return 404;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/gestescolar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar e reiniciar
nginx -t
systemctl restart nginx

# 6. Firewall
echo "[6/7] Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 7. SSL (Let's Encrypt)
echo "[7/7] Configurando SSL..."
echo ""
echo "  Para ativar HTTPS, execute APOS o DNS estar propagado:"
echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""

echo "========================================="
echo " Setup concluido!"
echo " App dir: $APP_DIR"
echo " Nginx:   http://$DOMAIN"
echo ""
echo " Proximos passos:"
echo "   1. Aponte o DNS A record para este IP"
echo "   2. Execute: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "   3. Faca deploy: ./deploy.sh"
echo "========================================="
