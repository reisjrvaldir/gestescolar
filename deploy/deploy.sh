#!/bin/bash
# =============================================
#  GESTESCOLAR – DEPLOY AUTOMATIZADO
#  Executar da sua maquina local
#  Uso: ./deploy/deploy.sh [usuario@ip]
# =============================================

set -e

# Configuracao (edite conforme necessario)
VPS_HOST="${1:-deploy@SEU_IP_VPS}"
APP_DIR="/var/www/gestescolar"
BRANCH="main"

# Arquivos/pastas para enviar (apenas o necessario)
FILES=(
  "index.html"
  "css/"
  "js/"
  "assets/"
)

# Arquivos para IGNORAR (nunca enviar para producao)
EXCLUDES=(
  "--exclude=.git"
  "--exclude=.claude"
  "--exclude=deploy"
  "--exclude=supabase"
  "--exclude=docs"
  "--exclude=bundle.html"
  "--exclude=serve.*"
  "--exclude=*.md"
  "--exclude=.env*"
)

echo "========================================="
echo " GestEscolar Deploy"
echo " Host: $VPS_HOST"
echo " Dir:  $APP_DIR"
echo "========================================="

# Verificar se esta no diretorio do projeto
if [ ! -f "index.html" ]; then
  echo "ERRO: Execute este script da raiz do projeto GestEscolar."
  exit 1
fi

# Versao atual (extrair do index.html)
VERSION=$(grep -oP '\?v=\K[0-9]+' index.html | head -1)
echo "Versao: v$VERSION"

# 1. Deploy via rsync (rapido, envia apenas diferencas)
echo ""
echo "[1/3] Enviando arquivos via rsync..."
rsync -avz --delete \
  "${EXCLUDES[@]}" \
  "${FILES[@]}" \
  "$VPS_HOST:$APP_DIR/"

# 2. Ajustar permissoes
echo ""
echo "[2/3] Ajustando permissoes..."
ssh "$VPS_HOST" "chmod -R 755 $APP_DIR && chown -R deploy:www-data $APP_DIR"

# 3. Verificar deploy
echo ""
echo "[3/3] Verificando..."
ssh "$VPS_HOST" "ls -la $APP_DIR/index.html && echo 'Deploy OK!'"

echo ""
echo "========================================="
echo " Deploy v$VERSION concluido com sucesso!"
echo " Acesse o site para verificar."
echo "========================================="
