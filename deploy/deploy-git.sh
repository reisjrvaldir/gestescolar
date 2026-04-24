#!/bin/bash
# =============================================
#  GESTESCOLAR – DEPLOY VIA GIT (alternativa)
#  Executar NO VPS para atualizar via git pull
#  Uso: ssh deploy@IP 'bash /var/www/gestescolar/deploy-git.sh'
# =============================================

set -e

APP_DIR="/var/www/gestescolar"
BRANCH="main"

echo "[GestEscolar] Atualizando via git pull..."

cd $APP_DIR

# Salvar mudancas locais (se houver)
git stash 2>/dev/null || true

# Atualizar
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Restaurar mudancas locais
git stash pop 2>/dev/null || true

# Permissoes
chmod -R 755 $APP_DIR

# Versao
VERSION=$(grep -oP '\?v=\K[0-9]+' index.html | head -1)
echo "[GestEscolar] Deploy v$VERSION concluido!"
echo "[GestEscolar] $(date)"
