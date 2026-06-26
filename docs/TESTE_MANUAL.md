# Checklist de Testes Manuais — GestEscolar MVP
**Data:** 2026-05-28  
**Versão:** 1.0

> Abra o sistema no navegador e siga cada seção na ordem.  
> Marque `[x]` para cada item testado com sucesso.

---

## 1. Landing Page (Pública)

- [ ] Acessar `/` — Landing page carrega sem erros no console
- [ ] Banner de cookies LGPD aparece na primeira visita
- [ ] Clicar "Apenas essenciais" — banner some e não reaparece ao recarregar
- [ ] Limpar `ges_cookie_consent` do localStorage e recarregar — banner reaparece
- [ ] Clicar "Aceitar todos" — banner some
- [ ] Footer contém links "Política de Privacidade" e "Termos de Uso"
- [ ] Link da Política de Privacidade abre a página `/privacy`
- [ ] Link dos Termos de Uso abre a página `/terms`
- [ ] Botão "Começar Grátis" / CTA direciona para `/login` ou `/register`
- [ ] Página é responsiva em mobile (≤ 640px)

---

## 2. Cadastro de Escola (Register)

- [ ] Acessar tela de cadastro
- [ ] Tentar enviar sem preencher campos obrigatórios — validação impede envio
- [ ] Checkbox "Li e aceito os Termos de Uso e Política de Privacidade" é **obrigatório**
- [ ] Tentar enviar sem marcar checkbox de termos — mensagem de erro aparece
- [ ] Checkbox de marketing (opt-in) é **opcional**
- [ ] Preencher todos os campos e enviar — escola criada com sucesso
- [ ] Verificar no Supabase: `termsAcceptedAt` e `privacyAcceptedAt` foram salvos
- [ ] Se marcou marketing: `marketingOptIn = true` e `marketingOptInAt` preenchido
- [ ] Após cadastro, usuário é redirecionado para o dashboard ou tela de planos
- [ ] Console do navegador sem erros JavaScript

---

## 3. Login / Logout

### 3.1 Login com E-mail
- [ ] Acessar `/login`
- [ ] Inserir e-mail e senha corretos — login com sucesso
- [ ] Verificar `audit_log`: registro `USER_LOGIN` com e-mail e User-Agent
- [ ] Inserir e-mail correto + senha errada — mensagem de erro clara
- [ ] Inserir e-mail inexistente — mensagem de erro (sem expor se e-mail existe)

### 3.2 Login com Matrícula (Professor/Pai)
- [ ] Inserir matrícula válida + senha — login funciona
- [ ] Inserir matrícula inválida — mensagem de erro

### 3.3 Logout
- [ ] Clicar em "Sair" — redireciona para login
- [ ] Verificar `audit_log`: registro `USER_LOGOUT`
- [ ] Após logout, acessar rota protegida — redireciona para login
- [ ] `ges_session` removido do localStorage

### 3.4 Idle Timer
- [ ] Após período de inatividade, sessão expira automaticamente
- [ ] Usuário é redirecionado para login

---

## 4. Trial Period (7 dias)

### 4.1 Escola Nova (dentro do trial)
- [ ] Criar escola nova — acesso total ao sistema
- [ ] `plan_id` da escola é `null` ou `free`
- [ ] `created_at` da escola é recente (< 7 dias)
- [ ] Nenhum modal de bloqueio aparece
- [ ] Todas as rotas funcionam normalmente

### 4.2 Trial Expirado
- [ ] Simular escola com `created_at` > 7 dias atrás e `plan_id = null`
- [ ] Ao navegar, modal de bloqueio aparece para gestor/administrativo/financeiro
- [ ] Gestor é redirecionado para tela de planos (`school-plans`)
- [ ] **Professor** NÃO é bloqueado (pode acessar normalmente)
- [ ] **Pai** NÃO é bloqueado (pode acessar normalmente)

---

## 5. Planos e Pagamento

### 5.1 Tela de Planos
- [ ] Acessar tela de planos — todos os planos visíveis (exceto Piloto)
- [ ] Toggle Mensal/Anual funciona — preços atualizam com -15%
- [ ] Plano atual mostra badge "PLANO ATUAL"
- [ ] Plano mais assinado mostra badge "⭐ PLANO MAIS ASSINADO"
- [ ] Plano Free não mostra botão de ação
- [ ] Plano 251+ mostra "Entrar em Contato com Suporte"
- [ ] Planos pagos mostram "Fazer Upgrade"

### 5.2 Pagamento PIX
- [ ] Clicar "Fazer Upgrade" em plano pago — modal abre
- [ ] Clicar "Pagar com PIX" — QR Code / código PIX gerado
- [ ] Copiar código PIX funciona
- [ ] Após pagamento (simular webhook): escola desbloqueada, `plan_id` atualizado

### 5.3 Pagamento Cartão
- [ ] Formulário de cartão renderiza corretamente
- [ ] Validação de número do cartão funciona
- [ ] Validação de validade e CVV funciona
- [ ] Enviar pagamento — processamento via Asaas
- [ ] Após sucesso: escola ativada com novo plano

### 5.4 Limites de Plano
- [ ] No Plano Free: tentar cadastrar > 5 alunos — modal de upgrade aparece
- [ ] No Plano 100: tentar cadastrar > 100 alunos — modal de upgrade aparece
- [ ] Mensagem do modal indica o limite atingido

---

## 6. Dashboard do Gestor/Admin

### 6.1 Navegação
- [ ] Menu lateral mostra todas as opções corretas para o papel do usuário
- [ ] Menu contém "Meus Dados (LGPD)" com ícone de escudo
- [ ] Cada item do menu navega para a página correta
- [ ] Rota atual fica destacada no menu

### 6.2 Alunos
- [ ] Listar alunos — tabela renderiza
- [ ] Adicionar aluno — modal abre, preencher dados, salvar
- [ ] Editar aluno — dados carregam no modal, salvar atualiza
- [ ] Buscar aluno por nome — filtro funciona
- [ ] Responsável é criado automaticamente junto com o aluno (se configurado)

### 6.3 Turmas
- [ ] Listar turmas
- [ ] Criar turma com nome, ano, turno, nível
- [ ] Vincular professor à turma
- [ ] Vincular alunos à turma

### 6.4 Professores
- [ ] Listar professores
- [ ] Adicionar professor com nome, e-mail, disciplinas
- [ ] Professor recebe credenciais de acesso

### 6.5 Financeiro
- [ ] Gerar cobranças para alunos
- [ ] Visualizar faturas (pendentes, pagas, vencidas)
- [ ] Status badges (verde=pago, amarelo=pendente, vermelho=vencido) corretos
- [ ] Valores formatados em BRL (R$ 149,90)

---

## 7. Portal do Professor

- [ ] Login com credenciais de professor
- [ ] Dashboard do professor carrega
- [ ] Visualizar turmas atribuídas
- [ ] Lançar notas — selecionar turma, disciplina, período
- [ ] Notas salvas corretamente no banco
- [ ] Lançar frequência (chamada) — marcar presença/falta
- [ ] Frequência salva corretamente
- [ ] Registro de ponto — entrada e saída registrados
- [ ] Menu contém "Meus Dados (LGPD)"

---

## 8. Portal do Responsável (Pai)

- [ ] Login com credenciais de pai/responsável
- [ ] Dashboard mostra dados do(s) filho(s) vinculado(s)
- [ ] Visualizar boletim — notas por disciplina e período
- [ ] Visualizar frequência — dias com presença/falta
- [ ] Visualizar faturas — status de pagamento
- [ ] Menu contém "Meus Dados (LGPD)"

---

## 9. Sistema de Mensagens

- [ ] Enviar mensagem de gestor para professor
- [ ] Professor recebe a mensagem
- [ ] Responder mensagem
- [ ] Marcar como lida — status atualiza
- [ ] Notificação de mensagem não lida aparece

---

## 10. Tickets de Suporte

- [ ] Criar ticket com categoria e descrição
- [ ] Ticket aparece na lista com número e status
- [ ] Adicionar comentário ao ticket
- [ ] SuperAdmin visualiza tickets de todas as escolas
- [ ] Status do ticket atualiza (aberto → em andamento → resolvido)

---

## 11. Calendário e Jornadas

- [ ] Calendário escolar renderiza corretamente
- [ ] Feriados nacionais aparecem marcados
- [ ] Adicionar evento ao calendário
- [ ] Configurar jornada de trabalho para professor
- [ ] Jornada reflete nos relatórios de ponto

---

## 12. LGPD — Portal do Titular

### 12.1 Acesso ao Portal
- [ ] Menu "Meus Dados (LGPD)" visível para **todos** os papéis
- [ ] Clicar navega para `/lgpd-portal`
- [ ] Página exibe 4 cards: Baixar dados, Política, Termos, Excluir conta

### 12.2 Exportação de Dados (Portabilidade)
- [ ] Clicar "Baixar JSON" — download inicia
- [ ] Arquivo JSON contém `_meta` com referência ao Art. 18, V
- [ ] Arquivo contém `personalData` (nome, e-mail, CPF, telefone)
- [ ] Arquivo contém dados da escola (se gestor)
- [ ] Arquivo contém faturas (se existirem)
- [ ] Toast "Dados baixados com sucesso!" aparece

### 12.3 Links de Política e Termos
- [ ] Botão "Ver Política" abre `/privacy` em nova aba
- [ ] Botão "Ver Termos" abre `/terms` em nova aba

### 12.4 Exclusão de Conta
- [ ] Clicar "Solicitar Exclusão" — modal de confirmação abre
- [ ] Modal exibe aviso de 15 dias úteis e dados fiscais preservados
- [ ] Link "Baixar cópia de seus dados" no modal funciona
- [ ] Tentar enviar sem marcar checkbox — mensagem "Marque a caixa de confirmação"
- [ ] Marcar checkbox + enviar — solicitação registrada
- [ ] Modal de sucesso aparece com mensagem do DPO
- [ ] `audit_log` registra `LGPD_DELETION_REQUEST` com e-mail e motivo

---

## 13. Segurança

### 13.1 Isolamento Multi-Tenant (RLS)
- [ ] Logar como gestor da Escola A
- [ ] Verificar que **nenhum** dado da Escola B aparece
- [ ] No console: `DB._schoolId` corresponde à escola do gestor
- [ ] Tentar acessar endpoint com `schoolId` de outra escola — RLS bloqueia

### 13.2 Controle de Acesso por Papel
- [ ] Professor **não** acessa menu financeiro
- [ ] Pai **não** acessa gestão de alunos/turmas
- [ ] Financeiro **não** acessa lançamento de notas
- [ ] SuperAdmin acessa painel com todas as escolas

### 13.3 Sessão
- [ ] JWT válido após login (verificar no Supabase)
- [ ] Sessão expira após inatividade
- [ ] Recarregar página mantém sessão ativa (se não expirou)
- [ ] Após logout, JWT é invalidado

### 13.4 Headers e Cache
- [ ] Verificar `Cache-Control: no-store, no-cache` no HTML
- [ ] Service Workers desregistrados (verificar no DevTools > Application)
- [ ] Caches limpos na inicialização

---

## 14. Responsividade (Mobile)

- [ ] Landing page — layout adapta em ≤ 640px
- [ ] Login — formulário centralizado e usável em mobile
- [ ] Dashboard — menu lateral colapsável ou hamburger
- [ ] Tabelas — scroll horizontal ou layout adaptado
- [ ] Modais — não ultrapassam a tela em mobile
- [ ] Banner de cookies — empilha verticalmente em mobile

---

## 15. Performance e Erros

- [ ] Console do navegador **sem** erros JS vermelhos em todas as páginas
- [ ] Nenhum `404` para scripts ou assets no Network tab
- [ ] Carregamento inicial < 5 segundos
- [ ] Transições entre páginas são fluídas (< 500ms)
- [ ] Supabase Realtime conecta sem erros (verificar WebSocket no Network)

---

## Resultado Final

| Seção | Total | ✅ OK | ❌ Falha | Observações |
|-------|-------|-------|---------|-------------|
| 1. Landing | 10 | | | |
| 2. Cadastro | 10 | | | |
| 3. Login/Logout | 13 | | | |
| 4. Trial | 7 | | | |
| 5. Planos/Pagamento | 15 | | | |
| 6. Dashboard Admin | 17 | | | |
| 7. Professor | 9 | | | |
| 8. Responsável | 6 | | | |
| 9. Mensagens | 5 | | | |
| 10. Tickets | 5 | | | |
| 11. Calendário | 5 | | | |
| 12. LGPD | 15 | | | |
| 13. Segurança | 11 | | | |
| 14. Mobile | 6 | | | |
| 15. Performance | 5 | | | |
| **TOTAL** | **139** | | | |

---

**Critério para MVP:**  
- 0 falhas em seções 3 (Login), 4 (Trial), 12 (LGPD), 13 (Segurança)  
- ≤ 5 falhas totais não-críticas nas demais seções
