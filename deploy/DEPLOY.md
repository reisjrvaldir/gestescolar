# GestEscolar - Guia de Deploy

## Pre-requisitos
- VPS Hostinger (Ubuntu 22.04+)
- Dominio apontando para o IP do VPS (DNS A record)
- SSH configurado

## 1. Setup Inicial (uma vez)

```bash
# Da sua maquina local:
ssh root@IP_DO_VPS 'bash -s' < deploy/setup-vps.sh gestescolar.com.br
```

Isso instala Nginx, configura firewall, cria usuario de deploy.

## 2. SSL (apos DNS propagado)

```bash
ssh root@IP_DO_VPS
sudo certbot --nginx -d gestescolar.com.br -d www.gestescolar.com.br
```

## 3. Deploy

### Opcao A: rsync (recomendado)
```bash
cd /caminho/para/gestescolar
./deploy/deploy.sh deploy@IP_DO_VPS
```

### Opcao B: git pull (se repo clonado no VPS)
```bash
ssh deploy@IP_DO_VPS 'bash /var/www/gestescolar/deploy-git.sh'
```

## 4. Supabase - Configurar dominio

No painel Supabase (supabase.com/dashboard):
1. Authentication > URL Configuration
2. Site URL: `https://gestescolar.com.br`
3. Redirect URLs: `https://gestescolar.com.br/**`

## Estrutura no VPS

```
/var/www/gestescolar/
  index.html
  css/
  js/
  assets/
```

Arquivos de config (supabase/, deploy/, .claude/) NAO sao enviados.
