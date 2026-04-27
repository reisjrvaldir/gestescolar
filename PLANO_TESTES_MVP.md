# GESTESCOLAR - Plano de Testes MVP

**Data:** 27/04/2026

---

## 📋 Sumário Executivo

Este documento apresenta o plano de testes abrangente para o MVP (Minimum Viable Product) do GestEscolar. O objetivo é validar todas as funcionalidades críticas do sistema antes do lançamento em produção.

---

## 1. Introdução

Este documento contém um plano de testes sistemático para validar todas as funcionalidades do GestEscolar MVP. O teste deve ser executado de forma estruturada, seguindo cada etapa descrita e garantindo que todas as funcionalidades funcionem corretamente em diferentes cenários.

---

## 2. Pré-requisitos

Antes de iniciar os testes, certifique-se de que:

- ✓ Acesso ao sistema em ambiente de testes
- ✓ Contas de teste para todos os papéis: Super Admin, Administrativo, Financeiro, Professor e Pai
- ✓ Base de dados de teste populada com escolas, turmas, alunos e boletos
- ✓ Acesso ao email para verificar recuperação de senha e mensagens
- ✓ Navegador web atualizado (Chrome, Firefox ou Safari)
- ✓ Acesso à integração com Asaas para testes de PIX
- ✓ Smartphone ou emulador para testes mobile (opcional)

---

## 3. Testes de Autenticação

### 3.1 Login com Credenciais Válidas

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Navegar para a página de login | Página de login é exibida | ☐ |
| 2 | Inserir email de teste válido | Email é aceito no campo | ☐ |
| 3 | Inserir senha correta | Senha é aceita no campo | ☐ |
| 4 | Clicar em "Entrar" | Usuário é autenticado e redirecionado para dashboard | ☐ |
| 5 | Verificar se sessão está ativa | Token de sessão válido em sessionStorage/localStorage | ☐ |
| **✓** | **Teste Passado** | **Login bem-sucedido para todos os papéis** | **☐** |

**Notas:** Testar com contas de diferentes papéis (Super Admin, Admin, Financeiro, Professor, Pai)

---

### 3.2 Login com Credenciais Inválidas

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Navegar para a página de login | Página de login é exibida | ☐ |
| 2 | Inserir email inválido ou senha incorreta | Campos aceitam a entrada | ☐ |
| 3 | Clicar em "Entrar" | Mensagem de erro: "Email ou senha inválidos" | ☐ |
| 4 | Verificar se usuário não é autenticado | Usuário permanece na página de login | ☐ |
| 5 | Tentar novamente | Campo de entrada é limpo | ☐ |
| **✓** | **Teste Passado** | **Erro é exibido claramente** | **☐** |

---

### 3.3 Logout

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Fazer login com credenciais válidas | Usuário entra no dashboard | ☐ |
| 2 | Localizar botão de logout (avatar/menu) | Botão está visível no canto superior direito | ☐ |
| 3 | Clicar em logout | Sessão é encerrada imediatamente | ☐ |
| 4 | Verificar redirecionamento | Página inicial ou login é exibida | ☐ |
| 5 | Tentar acessar dashboard via URL | Sistema redireciona para login | ☐ |
| 6 | Verificar se token foi removido | Token não existe mais em localStorage | ☐ |
| **✓** | **Teste Passado** | **Logout funciona corretamente** | **☐** |

---

## 4. Testes de Recuperação de Senha

### 4.1 Solicitar Recuperação de Senha

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Na página de login, clicar em "Esqueceu sua senha?" | Formulário de recuperação é exibido | ☐ |
| 2 | Inserir email de uma conta existente | Email é aceito | ☐ |
| 3 | Clicar em "Enviar Link de Recuperação" | Mensagem de sucesso: "Email enviado com sucesso" | ☐ |
| 4 | Aguardar alguns segundos | Spinner desaparece e mensagem persiste | ☐ |
| 5 | Verificar caixa de entrada do email | Email com link de recuperação foi recebido | ☐ |
| 6 | Verificar domínio do email | Email vem do domínio correto (gestescolar.com) | ☐ |
| **✓** | **Teste Passado** | **Link de recuperação é enviado e recebido** | **☐** |

---

### 4.2 Redefinir Senha via Link

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Clicar no link de recuperação no email | Página de redefinição de senha é exibida | ☐ |
| 2 | Verificar se email está pré-preenchido | Email da solicitação aparece no formulário | ☐ |
| 3 | Inserir nova senha válida (mín 8 caracteres, maiúscula, número, símbolo) | Senha é aceita, barra de força é indicada | ☐ |
| 4 | Confirmar a mesma senha no campo de confirmação | Confirmação é aceita | ☐ |
| 5 | Clicar em "Salvar Nova Senha" | Mensagem de sucesso aparece | ☐ |
| 6 | Fazer logout (se aplicável) | Logout é processado | ☐ |
| 7 | Fazer login com nova senha | Acesso é permitido com a nova senha | ☐ |
| 8 | Verificar se consegue acessar dashboard | Dashboard carrega sem erros | ☐ |
| **✓** | **Teste Passado** | **Senha é redefinida e funciona corretamente** | **☐** |

---

### 4.3 Token Expirado

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Solicitar recuperação de senha | Email com link é enviado | ☐ |
| 2 | Aguardar mais de 1 hora | Token expira no servidor (1 hora é o padrão) | ☐ |
| 3 | Clicar no link do email após expiração | Mensagem de erro: "Link expirado, solicite um novo" | ☐ |
| 4 | Verificar se formulário não é exibido | Apenas mensagem de erro aparece | ☐ |
| 5 | Clicar em "Solicitar novo link" | Redirecionado para formulário de recuperação | ☐ |
| **✓** | **Teste Passado** | **Token expirado é detectado e tratado** | **☐** |

---

## 5. Testes de Dashboards

### 5.1 Dashboard Super Admin

| Elemento | Esperado | Status |
|----------|----------|--------|
| Acesso | Super Admin consegue acessar /superadmin-dashboard | ☐ |
| Navbar | Menu com opções: Escolas, Usuários, Configurações, Relatórios | ☐ |
| Cards de Resumo | Total de escolas, usuários, transações pendentes | ☐ |
| Tabela de Escolas | Lista todas as escolas cadastradas com ID, nome, status | ☐ |
| Ações | Botões para editar, visualizar, ativar/desativar escolas | ☐ |
| Paginação | Se > 10 escolas, paginação funciona | ☐ |
| Busca | Filtro de busca por nome funciona | ☐ |

---

### 5.2 Dashboard Administrativo

| Elemento | Esperado | Status |
|----------|----------|--------|
| Acesso | Admin consegue acessar /admin-dashboard | ☐ |
| Resumo da Escola | Nome, logo, dados, ano letivo atual | ☐ |
| Seções | Turmas, Alunos, Professores, Configurações, Financeiro | ☐ |
| Cards de Métricas | Total de alunos, turmas, ausências do mês | ☐ |
| Acesso Restrito | Admin não consegue acessar dados de outras escolas | ☐ |
| Performance | Dashboard carrega em < 2 segundos | ☐ |

---

### 5.3 Dashboard Financeiro

| Elemento | Esperado | Status |
|----------|----------|--------|
| Acesso | Financeiro consegue acessar /fin-dashboard | ☐ |
| Resumo Financeiro | Receita do mês, boletos pendentes, pagos, vencidos | ☐ |
| Filtros | Por mês, status (pendente/pago), tipo de pagamento | ☐ |
| Tabela de Boletos | Lista boletos com aluno, valor, vencimento, status | ☐ |
| Relatórios | Botão para exportação de dados em CSV/PDF | ☐ |
| Integração Asaas | PIX codes gerados e exibidos corretamente | ☐ |

---

## 6. Testes de Gestão de Turmas

### 6.1 Criar Nova Turma

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Acessar seção de Turmas no painel admin | Lista de turmas é exibida | ☐ |
| 2 | Clicar em "Adicionar Turma" | Modal/formulário de criação abre | ☐ |
| 3 | Preencher: Nome (ex: "1º A"), Ano, Turno | Campos aceitam entrada | ☐ |
| 4 | Selecionar Professor responsável | Dropdown mostra lista de professores | ☐ |
| 5 | Selecionar disciplinas conforme educação | Checkboxes aparecem e são selecionáveis | ☐ |
| 6 | Clicar em "Salvar" | Turma é criada no banco de dados | ☐ |
| 7 | Verificar tabela | Nova turma aparece na lista | ☐ |
| **✓** | **Teste Passado** | **Nova turma é criada com todos os dados** | **☐** |

---

### 6.2 Editar Turma

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Localizar uma turma na lista | Turma está listada com nome e ano | ☐ |
| 2 | Clicar no botão "Editar" | Modal de edição abre com dados atuais | ☐ |
| 3 | Modificar nome, professor ou disciplinas | Campos permitem edição | ☐ |
| 4 | Clicar em "Salvar Alterações" | Turma é atualizada no banco de dados | ☐ |
| 5 | Verificar se mudanças aparecem | Dados atualizados são exibidos na lista | ☐ |
| 6 | Verificar histórico de alunos | Alunos continuam associados à turma | ☐ |
| **✓** | **Teste Passado** | **Turma é editada corretamente** | **☐** |

---

### 6.3 Adicionar Alunos à Turma

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Selecionar uma turma | Detalhes da turma são exibidos | ☐ |
| 2 | Clicar em "Adicionar Alunos" | Modal com opções abre | ☐ |
| 3 | Ver lista de alunos disponíveis | Alunos sem turma aparecem na lista | ☐ |
| 4 | Selecionar múltiplos alunos | Checkboxes permitem multi-seleção | ☐ |
| 5 | Clicar em "Confirmar" | Alunos são adicionados à turma | ☐ |
| 6 | Verificar lista de alunos | Alunos aparecem na lista da turma | ☐ |
| 7 | Verificar se pagador foi criado | Filiação pai/turma foi registrada | ☐ |
| **✓** | **Teste Passado** | **Alunos são adicionados corretamente** | **☐** |

---

### 6.4 Deletar Turma

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Localizar uma turma para deletar | Turma está listada | ☐ |
| 2 | Clicar em "Excluir" ou botão de delete | Confirmação de exclusão aparece | ☐ |
| 3 | Ler mensagem de aviso | Aviso menciona alunos que serão desvinculados | ☐ |
| 4 | Confirmar exclusão | Turma é removida do banco de dados | ☐ |
| 5 | Verificar tabela | Turma não aparece mais na lista | ☐ |
| 6 | Verificar boletos | Boletos não são deletados (apenas turma) | ☐ |
| **✓** | **Teste Passado** | **Turma é deletada com confirmação** | **☐** |

---

## 7. Testes de Gestão de Alunos

### 7.1 Criar Novo Aluno

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Acessar seção de Alunos | Lista de alunos é exibida | ☐ |
| 2 | Clicar em "Adicionar Aluno" | Formulário de criação abre | ☐ |
| 3 | Preencher: Nome, Data de Nascimento | Campos aceitam entrada | ☐ |
| 4 | Inserir email do pai/responsável | Email é validado | ☐ |
| 5 | Inserir telefone (opcional) | Telefone é aceitável | ☐ |
| 6 | Clicar em "Salvar" | Aluno é criado no banco de dados | ☐ |
| 7 | Verificar se aluno aparece na lista | Novo aluno está visível | ☐ |
| **✓** | **Teste Passado** | **Novo aluno é criado com sucesso** | **☐** |

---

### 7.2 Editar Aluno

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Localizar um aluno | Aluno está listado | ☐ |
| 2 | Clicar em "Editar" | Formulário de edição abre | ☐ |
| 3 | Modificar dados (nome, email, etc) | Campos permitem edição | ☐ |
| 4 | Clicar em "Salvar" | Alterações são salvas | ☐ |
| 5 | Verificar se dados atualizados aparecem | Dados novos são exibidos na lista | ☐ |
| 6 | Verificar se histórico é mantido | Turmas anteriores continuam associadas | ☐ |
| **✓** | **Teste Passado** | **Aluno é editado corretamente** | **☐** |

---

## 8. Testes de Gestão Financeira

### 8.1 Gerar Boletos

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Acessar Dashboard Financeiro | Painel financeiro é exibido | ☐ |
| 2 | Selecionar período/turma para gerar boletos | Opções de filtro aparecem | ☐ |
| 3 | Clicar em "Gerar Boletos" | Confirmação aparece | ☐ |
| 4 | Confirmar geração | Boletos são criados no Asaas | ☐ |
| 5 | Aguardar processamento | Mensagem de sucesso aparece | ☐ |
| 6 | Verificar tabela de boletos | Boletos listados com status "Pendente" | ☐ |
| 7 | Verificar linhas de leitura | Cada boleto tem um código de barras | ☐ |
| **✓** | **Teste Passado** | **Boletos são gerados com sucesso** | **☐** |

---

### 8.2 Gerar PIX em Massa

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Acessar Dashboard Financeiro | Painel é exibido | ☐ |
| 2 | Filtrar boletos pendentes do mês | Lista de boletos pendentes aparece | ☐ |
| 3 | Clicar em "Enviar PIX em Massa" | Confirmação de ação aparece | ☐ |
| 4 | Confirmar envio | Sistema inicia geração de PIX | ☐ |
| 5 | Verificar barra de progresso | Progresso (X de Y) é exibido em tempo real | ☐ |
| 6 | Aguardar conclusão | Todas as gerações são concluídas | ☐ |
| 7 | Verificar notificação de sucesso | Mensagem: "X PIX enviados com sucesso" | ☐ |
| 8 | Verificar se PIX foram enviados | Pais recebem mensagens com PIX codes | ☐ |
| **✓** | **Teste Passado** | **PIX em massa é enviado com sucesso** | **☐** |

---

### 8.3 Enviar PIX Individual

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Localizar um boleto pendente | Boleto está listado na tabela | ☐ |
| 2 | Clicar no botão "PIX" | QR code e código numérico são gerados | ☐ |
| 3 | Verificar se QR code é válido | QR code é legível e pode ser escaneado | ☐ |
| 4 | Clicar em "Enviar via Mensagem" | Confirmação aparece | ☐ |
| 5 | Confirmar envio | PIX é enviado ao pai/responsável | ☐ |
| 6 | Verificar se mensagem foi recebida | Mensagem com PIX aparece no chat do pai | ☐ |
| 7 | Verificar conteúdo da mensagem | QR code ou código PIX é mostrado | ☐ |
| **✓** | **Teste Passado** | **PIX individual é enviado com sucesso** | **☐** |

---

### 8.4 Confirmar Pagamento de Boleto

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Aguardar até que um boleto seja pago | Pai faz pagamento via PIX ou código de barras | ☐ |
| 2 | Verificar se status foi atualizado | Status mudou de "Pendente" para "Pago" | ☐ |
| 3 | Clicar em detalhes do boleto | Data de pagamento é exibida | ☐ |
| 4 | Verificar se valor pago está correto | Valor pago = valor do boleto | ☐ |
| 5 | Verificar se é exibido em relatórios | Relatório inclui boleto como "Pago" | ☐ |
| 6 | Verificar notificação ao admin | Admin recebe notificação de pagamento | ☐ |
| **✓** | **Teste Passado** | **Pagamento é confirmado corretamente** | **☐** |

---

## 9. Testes de Comunicações

### 9.1 Enviar Mensagem para Pai/Responsável

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Acessar seção de chat/mensagens | Interface de chat é exibida | ☐ |
| 2 | Selecionar um pai/responsável | Conversa abre | ☐ |
| 3 | Digitar uma mensagem | Campo de texto aceita entrada | ☐ |
| 4 | Clicar em "Enviar" ou pressionar Enter | Mensagem é enviada | ☐ |
| 5 | Verificar se mensagem aparece no histórico | Mensagem está visível no chat com timestamp | ☐ |
| 6 | Fazer login como pai | Pai acessa seu dashboard | ☐ |
| 7 | Acessar chat | Conversa aparece | ☐ |
| 8 | Verificar recebimento | Mensagem recebida aparece com "lido" | ☐ |
| **✓** | **Teste Passado** | **Mensagem é enviada e recebida corretamente** | **☐** |

---

### 9.2 Enviar Notificação de Falta

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| 1 | Professor registra falta de um aluno | Falta é salva no sistema | ☐ |
| 2 | Sistema envia notificação ao pai | Notificação é enviada automaticamente | ☐ |
| 3 | Pai recebe notificação | Mensagem ou email sobre falta é recebido | ☐ |
| 4 | Pai acessa dashboard | Dashboard carrega | ☐ |
| 5 | Verificar faltas do aluno | Falta aparece no histórico do aluno | ☐ |
| 6 | Verificar se pode comentar | Pai pode responder à notificação | ☐ |
| **✓** | **Teste Passado** | **Notificação de falta é enviada corretamente** | **☐** |

---

## 10. Testes de Responsividade

### 10.1 Desktop (1920x1080)

| Elemento | Esperado | Status |
|----------|----------|--------|
| Layout | Bem distribuído em tela completa | ☐ |
| Sidebar | Visível e navegável | ☐ |
| Tabelas | Colunas bem dispostas, sem scroll horizontal | ☐ |
| Botões | Legíveis e clicáveis, com feedback ao passar | ☐ |
| Modals | Bem centrados e dimensionados | ☐ |

---

### 10.2 Tablet (768x1024)

| Elemento | Esperado | Status |
|----------|----------|--------|
| Layout | Adaptado para tela média | ☐ |
| Menu | Recolhível ou hamburger menu | ☐ |
| Tabelas | Scroll horizontal controlado ou responsivo | ☐ |
| Touch | Botões grandes o suficiente para toque (mín 44x44px) | ☐ |
| Fonts | Legível sem zoom | ☐ |

---

### 10.3 Mobile (375x667)

| Elemento | Esperado | Status |
|----------|----------|--------|
| Layout | Stack vertical, otimizado para mobile | ☐ |
| Menu | Hamburger/drawer menu | ☐ |
| Formas | Campos verticais, fáceis de preencher com touch | ☐ |
| Performance | Carregamento rápido em 3G/4G | ☐ |
| Botões | Fáceis de cliquear (mín 44x44px) | ☐ |
| Texto | Sem necessidade de scroll horizontal | ☐ |

---

## 11. Testes de Segurança

### 11.1 Validação de Acesso

| Teste | Procedimento | Resultado Esperado | Status |
|-------|--------------|-------------------|--------|
| RLS Supabase | Admin tenta acessar dados de outra escola | Acesso negado (403/404) | ☐ |
| Token Inválido | Remover/alterar token no localStorage | Redirecionado para login | ☐ |
| CORS | Fazer requisição de origem diferente | Requisição bloqueada | ☐ |
| Session Timeout | Não usar o sistema por 30 min | Sessão expirada, redireção para login | ☐ |

---

### 11.2 Validação de Senhas

| Teste | Entrada | Resultado Esperado | Status |
|-------|---------|-------------------|--------|
| Senha Fraca | 123456 | Erro: "Senha deve ter mín. 8 caracteres..." | ☐ |
| Senha Válida | Senha@1234 | Aceita e salva com sucesso | ☐ |
| Hashing | Verificar armazenamento no banco | Token em hash, não plain text | ☐ |
| Requisição HTTPS | Verificar conexão | Todas requisições em HTTPS | ☐ |

---

## 12. Testes de Performance

- ✓ Tempo de carregamento do dashboard: **< 2 segundos**
- ✓ Tempo de resposta de requisição API: **< 500ms**
- ✓ Geração de boletos em massa: **< 30 segundos para 50 boletos**
- ✓ Geração de PIX em massa: **< 1 segundo por PIX**
- ✓ Sem erros de memória ou travamentos
- ✓ Paginação de tabelas com > 100 registros funciona sem lag

**Ferramentas de teste:**
- Chrome DevTools (Lighthouse)
- Network tab para verificar tempos de requisição
- Performance tab para identificar gargalos

---

## 13. Checklist Final de Lançamento

| Item | Status |
|------|--------|
| ✓ Todos os testes de autenticação passaram | ☐ |
| ✓ Recuperação de senha funciona corretamente | ☐ |
| ✓ Todos os dashboards carregam sem erros | ☐ |
| ✓ CRUD de turmas funciona completamente | ☐ |
| ✓ CRUD de alunos funciona completamente | ☐ |
| ✓ Geração de boletos sem erros | ☐ |
| ✓ PIX em massa funciona corretamente | ☐ |
| ✓ Comunicações são entregues corretamente | ☐ |
| ✓ Testes de responsividade aprovados (desktop, tablet, mobile) | ☐ |
| ✓ Testes de segurança aprovados | ☐ |
| ✓ Performance dentro dos limites | ☐ |
| ✓ Sem bugs críticos encontrados | ☐ |
| ✓ Documentação atualizada | ☐ |
| ✓ Integração Asaas validada | ☐ |
| ✓ Email de recuperação sendo entregue | ☐ |

---

## 14. Notas e Observações

Use este espaço para registrar problemas encontrados, melhorias sugeridas ou comportamentos inesperados:

```
________________________________________________________________________________________________

________________________________________________________________________________________________

________________________________________________________________________________________________

________________________________________________________________________________________________

________________________________________________________________________________________________
```

---

## 15. Problemas Encontrados

| ID | Problema | Severidade | Status | Solução |
|----|----------|-----------|--------|---------|
| | | | | |
| | | | | |
| | | | | |

**Legenda de Severidade:**
- 🔴 **Crítica** - Bloqueia lançamento
- 🟠 **Alta** - Afeta funcionalidade principal
- 🟡 **Média** - Afeta usabilidade
- 🟢 **Baixa** - Comportamento anômalo, não bloqueia

---

## 16. Aprovação para Lançamento

| Campo | Valor |
|-------|-------|
| **Testador** | _________________________ |
| **Data de Conclusão** | _________________________ |
| **Aprovado para Lançamento** | ☐ **SIM**   ☐ **NÃO** |
| **Observações Finais** | _________________________ |

---

## 17. Instruções para Converter para Word

Se necessário converter este documento para Word (.docx):

### Opção 1: Online
1. Acesse [pandoc.org/try](https://pandoc.org/try)
2. Cole o conteúdo deste arquivo
3. Selecione output: Docx (MS Word)
4. Download

### Opção 2: Usando Pandoc (local)
```bash
pandoc PLANO_TESTES_MVP.md -o Plano_Testes_GestEscolar_MVP.docx
```

### Opção 3: Usando Google Docs
1. Abra Google Docs
2. Copie e cole o conteúdo
3. Formate conforme necessário
4. Download como Word

---

**Documento de Teste Completado** ✅

Versão: 1.0  
Última atualização: 27/04/2026
