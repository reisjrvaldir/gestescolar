const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
        WidthType, BorderStyle, ShadingType, HeadingLevel, PageBreak, PageNumber,
        PageOrientation, Footer, Header } = require('docx');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } }
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1a73e8" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 }
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "1a73e8" },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 }
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "1a73e8" },
        paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 2 }
      }
    ]
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: "bullet",
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          },
          {
            level: 1,
            format: "bullet",
            text: "◦",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } }
          }
        ]
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: "decimal",
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          },
          {
            level: 1,
            format: "decimal",
            text: "%2.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } }
          }
        ]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Página ",
                  size: 20
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  size: 20
                })
              ]
            })
          ]
        })
      }
    },
    children: [
      // Capa
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "GESTESCOLAR",
          bold: true,
          size: 48,
          color: "1a73e8"
        })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "Plano de Testes - MVP",
          bold: true,
          size: 36,
          color: "1a73e8"
        })]
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "Documento de Validação e Testes de Funcionalidades",
          size: 24,
          italics: true
        })]
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: `Data: ${new Date().toLocaleDateString('pt-BR')}`,
          size: 22
        })]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // 1. INTRODUÇÃO
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("1. Introdução")]
      }),
      new Paragraph({
        children: [new TextRun("Este documento apresenta o plano de testes abrangente para o MVP (Minimum Viable Product) do GestEscolar. O objetivo é validar todas as funcionalidades críticas do sistema antes do lançamento.")]
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [new TextRun("O teste deve ser executado de forma sistemática, seguindo cada etapa descrita neste documento, garantindo que todas as funcionalidades funcionem corretamente em diferentes cenários.")]
      }),
      new Paragraph({ children: [new TextRun("")] }),

      // 2. PRÉ-REQUISITOS
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("2. Pré-requisitos")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Acesso ao sistema em ambiente de testes")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Contas de teste para todos os papéis: Super Admin, Administrativo, Financeiro, Professor e Pai")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Base de dados de teste populada com escolas, turmas, alunos e boletos")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Acesso ao email para verificar recuperação de senha e mensagens")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Navegador web atualizado (Chrome, Firefox ou Safari)")]
      }),
      new Paragraph({ children: [new TextRun("")] }),

      // 3. TESTES DE AUTENTICAÇÃO
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("3. Testes de Autenticação")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.1 Login com Credenciais Válidas")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Navegar para a página de login", "Página de login é exibida"],
        ["2", "Inserir email de teste válido", "Email é aceito no campo"],
        ["3", "Inserir senha correta", "Senha é aceita no campo"],
        ["4", "Clicar em 'Entrar'", "Usuário é autenticado e redirecionado para dashboard"],
        ["5", "Verificar se sessão está ativa", "Token de sessão válido em sessionStorage/localStorage"],
        ["✓", "Teste Passado", "Login bem-sucedido para todos os papéis (Super Admin, Admin, Financeiro, Professor, Pai)"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.2 Login com Credenciais Inválidas")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Navegar para a página de login", "Página de login é exibida"],
        ["2", "Inserir email inválido ou senha incorreta", "Campos aceitem a entrada"],
        ["3", "Clicar em 'Entrar'", "Mensagem de erro: 'Email ou senha inválidos'"],
        ["4", "Verificar se usuário não é autenticado", "Usuário permanece na página de login"],
        ["✓", "Teste Passado", "Erro é exibido claramente e usuário não consegue acessar o sistema"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("3.3 Logout")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Fazer login com credenciais válidas", "Usuário entra no dashboard"],
        ["2", "Localizar botão de logout (avatar/menu)", "Botão está visível"],
        ["3", "Clicar em logout", "Sessão é encerrada"],
        ["4", "Verificar se é redirecionado para login/landing", "Página inicial ou login é exibida"],
        ["5", "Tentar acessar dashboard diretamente via URL", "Sistema redireciona para login"],
        ["✓", "Teste Passado", "Logout funciona corretamente e sessão é encerrada"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 4. RECUPERAÇÃO DE SENHA
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("4. Testes de Recuperação de Senha")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.1 Solicitar Recuperação de Senha")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Na página de login, clicar em 'Esqueceu sua senha?'", "Formulário de recuperação é exibido"],
        ["2", "Inserir email de uma conta existente", "Email é aceito"],
        ["3", "Clicar em 'Enviar Link de Recuperação'", "Mensagem de sucesso: 'Email enviado'"],
        ["4", "Verificar caixa de entrada do email", "Email com link de recuperação foi recebido"],
        ["✓", "Teste Passado", "Link de recuperação é enviado e recebido com sucesso"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.2 Redefinir Senha via Link")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Clicar no link de recuperação no email", "Página de redefinição de senha é exibida"],
        ["2", "Verificar se email está pré-preenchido", "Email da solicitação aparece no formulário"],
        ["3", "Inserir nova senha válida (mín 8 caracteres, maiúscula, número, símbolo)", "Senha é aceita, força é indicada (barra de força)"],
        ["4", "Confirmar a mesma senha no campo de confirmação", "Confirmação é aceita"],
        ["5", "Clicar em 'Salvar Nova Senha'", "Mensagem de sucesso: 'Senha alterada com sucesso'"],
        ["6", "Fazer logout e login com nova senha", "Acesso é permitido com a nova senha"],
        ["✓", "Teste Passado", "Senha é redefinida e funciona corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("4.3 Token Expirado")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Solicitar recuperação de senha", "Email com link é enviado"],
        ["2", "Aguardar mais de 1 hora", "Token expira no servidor"],
        ["3", "Clicar no link do email após expiração", "Mensagem de erro: 'Link expirado, solicite um novo'"],
        ["4", "Verificar se formulário não é exibido", "Apenas mensagem de erro aparece"],
        ["✓", "Teste Passado", "Token expirado é detectado e tratado adequadamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 5. DASHBOARDS
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("5. Testes de Dashboards")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("5.1 Dashboard Super Admin")]
      }),
      createTestTable([
        ["Elemento", "Esperado", "Status"],
        ["Acesso ao Dashboard", "Super Admin consegue acessar /superadmin-dashboard", ""],
        ["Navbar", "Menu com opções: Escolas, Usuários, Configurações", ""],
        ["Cards de Resumo", "Total de escolas, usuários, transações pendentes", ""],
        ["Tabela de Escolas", "Lista todas as escolas cadastradas", ""],
        ["Ações", "Botões para editar, visualizar, ativar/desativar escolas", ""]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("5.2 Dashboard Administrativo")]
      }),
      createTestTable([
        ["Elemento", "Esperado", "Status"],
        ["Acesso ao Dashboard", "Admin consegue acessar /admin-dashboard", ""],
        ["Resumo da Escola", "Nome, dados, ano letivo atual", ""],
        ["Seções", "Turmas, Alunos, Professores, Configurações", ""],
        ["Cards de Métricas", "Total de alunos, turmas, ausências", ""],
        ["Acesso Restrito", "Admin não consegue acessar dados de outras escolas", ""]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("5.3 Dashboard Financeiro")]
      }),
      createTestTable([
        ["Elemento", "Esperado", "Status"],
        ["Acesso ao Dashboard", "Financeiro consegue acessar /fin-dashboard", ""],
        ["Resumo Financeiro", "Receita, boletos pendentes, pagos", ""],
        ["Filtros", "Por mês, status, tipo de pagamento", ""],
        ["Relatórios", "Exportação de dados em CSV/PDF", ""],
        ["Integração Asaas", "PIX codes gerados e exibidos corretamente", ""]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 6. GESTÃO DE TURMAS
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("6. Testes de Gestão de Turmas")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.1 Criar Nova Turma")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Acessar seção de Turmas no painel admin", "Lista de turmas é exibida"],
        ["2", "Clicar em 'Adicionar Turma'", "Modal/formulário de criação abre"],
        ["3", "Preencher: Nome, Ano, Turno, Professor", "Campos aceitam entrada"],
        ["4", "Selecionar disciplinas conforme educação", "Checkboxes aparecem e são selecionáveis"],
        ["5", "Clicar em 'Salvar'", "Turma é criada e aparece na lista"],
        ["✓", "Teste Passado", "Nova turma é criada com todos os dados"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.2 Editar Turma")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Localizar uma turma na lista", "Turma está listada"],
        ["2", "Clicar no botão 'Editar'", "Modal de edição abre com dados atuais"],
        ["3", "Modificar nome, professor ou disciplinas", "Campos permitem edição"],
        ["4", "Clicar em 'Salvar Alterações'", "Turma é atualizada"],
        ["5", "Verificar se mudanças aparecem na lista", "Dados atualizados são exibidos"],
        ["✓", "Teste Passado", "Turma é editada corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.3 Adicionar Alunos à Turma")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Selecionar uma turma", "Detalhes da turma são exibidos"],
        ["2", "Clicar em 'Adicionar Alunos'", "Modal com opções abre"],
        ["3", "Selecionar alunos existentes ou criar novo", "Alunos são selecionáveis"],
        ["4", "Clicar em 'Confirmar'", "Alunos são adicionados à turma"],
        ["5", "Verificar lista de alunos da turma", "Alunos aparecem na lista"],
        ["✓", "Teste Passado", "Alunos são adicionados corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("6.4 Deletar Turma")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Localizar uma turma para deletar", "Turma está listada"],
        ["2", "Clicar em 'Excluir'", "Confirmação de exclusão aparece"],
        ["3", "Confirmar exclusão", "Turma é removida do banco de dados"],
        ["4", "Verificar se turma não aparece mais na lista", "Turma não está mais visível"],
        ["✓", "Teste Passado", "Turma é deletada com confirmação"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 7. GESTÃO DE ALUNOS
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("7. Testes de Gestão de Alunos")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("7.1 Criar Novo Aluno")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Acessar seção de Alunos", "Lista de alunos é exibida"],
        ["2", "Clicar em 'Adicionar Aluno'", "Formulário de criação abre"],
        ["3", "Preencher: Nome, Data de Nascimento, Email pai/responsável", "Campos aceitam entrada"],
        ["4", "Inserir informações de contato", "Email e telefone são validados"],
        ["5", "Clicar em 'Salvar'", "Aluno é criado e aparece na lista"],
        ["✓", "Teste Passado", "Novo aluno é criado com sucesso"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("7.2 Editar Aluno")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Localizar um aluno", "Aluno está listado"],
        ["2", "Clicar em 'Editar'", "Formulário de edição abre"],
        ["3", "Modificar dados (nome, email, etc)", "Campos permitem edição"],
        ["4", "Clicar em 'Salvar'", "Alterações são salvas"],
        ["5", "Verificar se dados atualizados aparecem", "Dados novos são exibidos"],
        ["✓", "Teste Passado", "Aluno é editado corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 8. GESTÃO FINANCEIRA
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("8. Testes de Gestão Financeira")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("8.1 Gerar Boletos")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Acessar Dashboard Financeiro", "Painel financeiro é exibido"],
        ["2", "Selecionar período/turma para gerar boletos", "Opções de filtro aparecem"],
        ["3", "Clicar em 'Gerar Boletos'", "Boletos são criados no Asaas"],
        ["4", "Aguardar processamento", "Mensagem de sucesso ou progresso aparece"],
        ["5", "Verificar se boletos aparecem na tabela", "Boletos listados com status 'Pendente'"],
        ["✓", "Teste Passado", "Boletos são gerados com sucesso"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("8.2 Gerar PIX em Massa")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Acessar Dashboard Financeiro", "Painel financeiro é exibido"],
        ["2", "Filtrar boletos pendentes do mês", "Lista de boletos pendentes aparece"],
        ["3", "Clicar em 'Enviar PIX em Massa'", "Confirmação de ação aparece"],
        ["4", "Confirmar envio", "Sistema gera PIX para cada aluno"],
        ["5", "Verificar barra de progresso", "Progresso (X de Y) é exibido"],
        ["6", "Ao finalizar, verificar se PIX foram enviados", "Mensagens/notificações foram entregues"],
        ["✓", "Teste Passado", "PIX em massa é enviado com sucesso"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("8.3 Enviar PIX Individual")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Localizar um boleto pendente na tabela", "Boleto está listado"],
        ["2", "Clicar no botão 'PIX'", "QR code/PIX é gerado"],
        ["3", "Verificar se PIX é válido", "QR code é legível e pode ser escaneado"],
        ["4", "Clicar em 'Enviar via Mensagem'", "PIX é enviado ao pai/responsável"],
        ["5", "Verificar se mensagem foi recebida", "Mensagem com PIX aparece no chat"],
        ["✓", "Teste Passado", "PIX individual é enviado com sucesso"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("8.4 Confirmar Pagamento de Boleto")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Localizar um boleto pago (status atualizado pelo Asaas)", "Boleto com status 'Pago' aparece"],
        ["2", "Verificar se status foi atualizado automaticamente", "Status mudou de 'Pendente' para 'Pago'"],
        ["3", "Clicar em detalhes do boleto", "Data de pagamento é exibida"],
        ["4", "Verificar se é exibido em relatórios corretamente", "Relatório inclui boleto como 'Pago'"],
        ["✓", "Teste Passado", "Pagamento é confirmado corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 9. COMUNICAÇÕES
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("9. Testes de Comunicações")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("9.1 Enviar Mensagem para Pai/Responsável")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Acessar chat/mensagens", "Interface de chat é exibida"],
        ["2", "Selecionar um pai/responsável", "Conversa abre"],
        ["3", "Digitar uma mensagem", "Campo de texto aceita entrada"],
        ["4", "Clicar em 'Enviar'", "Mensagem é enviada"],
        ["5", "Verificar se mensagem aparece no histórico", "Mensagem está visível no chat"],
        ["6", "Login como pai e verificar recebimento", "Mensagem recebida aparece no seu chat"],
        ["✓", "Teste Passado", "Mensagem é enviada e recebida corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("9.2 Enviar Notificação de Falta")]
      }),
      createTestTable([
        ["Passo", "Ação", "Resultado Esperado"],
        ["1", "Professor registra falta de um aluno", "Falta é salva no sistema"],
        ["2", "Sistema envia notificação ao pai", "Notificação é enviada automaticamente"],
        ["3", "Pai recebe notificação", "Mensagem/email sobre falta é recebido"],
        ["4", "Pai acessa dashboard e vê a falta", "Falta aparece no histórico do aluno"],
        ["✓", "Teste Passado", "Notificação de falta é enviada corretamente"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 10. RESPONSIVIDADE
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("10. Testes de Responsividade")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("10.1 Desktop")]
      }),
      createTestTable([
        ["Elemento", "Esperado", "Status"],
        ["Layout", "Bem distribuído em tela completa", ""],
        ["Sidebar", "Visível e navegável", ""],
        ["Tabelas", "Colunas bem dispostas, sem scroll horizontal", ""],
        ["Botões", "Legíveis e clicáveis", ""]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("10.2 Tablet")]
      }),
      createTestTable([
        ["Elemento", "Esperado", "Status"],
        ["Layout", "Adaptado para tela média", ""],
        ["Menu", "Recolhível ou hamburger", ""],
        ["Tabelas", "Scroll horizontal controlado ou responsivo", ""],
        ["Touch", "Botões grandes o suficiente para toque", ""]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("10.3 Mobile")]
      }),
      createTestTable([
        ["Elemento", "Esperado", "Status"],
        ["Layout", "Stack vertical, otimizado para mobile", ""],
        ["Menu", "Hamburger/drawer menu", ""],
        ["Formas", "Campos verticais, fáceis de preencher", ""],
        ["Performance", "Carregamento rápido em 3G/4G", ""]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 11. SEGURANÇA
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("11. Testes de Segurança")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("11.1 Validação de Acesso")]
      }),
      createTestTable([
        ["Teste", "Procedimento", "Resultado Esperado"],
        ["RLS Supabase", "Admin tenta acessar dados de outra escola", "Acesso negado (403/404)"],
        ["Token Inválido", "Remover/alterar token no localStorage", "Redirecionado para login"],
        ["CORS", "Fazer requisição de origem diferente", "Requisição bloqueada"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("11.2 Validação de Senhas")]
      }),
      createTestTable([
        ["Teste", "Entrada", "Resultado Esperado"],
        ["Senha Fraca", "123456", "Erro: não atende requisitos"],
        ["Senha Válida", "Senha@1234", "Aceita e salva com sucesso"],
        ["Hashing", "Verificar se token é armazenado como hash", "Token em plain text não existe no banco"]
      ]),
      new Paragraph({ children: [new TextRun("")] }),

      // 12. PERFORMANCE
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("12. Testes de Performance")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Tempo de carregamento do dashboard: < 2 segundos")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Tempo de resposta de requisição API: < 500ms")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Geração de boletos em massa: progressão visível, < 30 segundos para 50 boletos")]
      }),
      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Sem erros de memória ou travamentos")]
      }),
      new Paragraph({ children: [new TextRun("")] }),

      // 13. CHECKLIST FINAL
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("13. Checklist Final de Lançamento")]
      }),

      createChecklistTable(),

      new Paragraph({ children: [new TextRun("")] }),

      // 14. NOTAS
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("14. Notas e Observações")]
      }),

      new Paragraph({
        children: [new TextRun({
          text: "Use este espaço para anotações durante o teste:",
          italics: true
        })]
      }),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({ children: [new TextRun("_________________________________________________________________")] }),
      new Paragraph({ children: [new TextRun("_________________________________________________________________")] }),
      new Paragraph({ children: [new TextRun("_________________________________________________________________")] }),
      new Paragraph({ children: [new TextRun("_________________________________________________________________")] }),
      new Paragraph({ children: [new TextRun("")] }),

      // 15. APROVAÇÃO
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("15. Aprovação para Lançamento")]
      }),

      createApprovalTable(),
      new Paragraph({ children: [new TextRun("")] }),
      new Paragraph({
        children: [new TextRun({
          text: "Documento de Teste Completado",
          bold: true,
          italics: true
        })]
      })
    ]
  }]
});

function createTestTable(data) {
  const headerBg = "d5e8f0";
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const rows = data.map((row, idx) => {
    const isHeader = idx === 0;
    return new TableRow({
      children: row.map(cell =>
        new TableCell({
          borders,
          shading: isHeader ? { fill: headerBg, type: ShadingType.CLEAR } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: cell,
              bold: isHeader,
              size: isHeader ? 22 : 20
            })]
          })]
        })
      )
    });
  });

  const colWidths = data[0].length === 3 ? [1560, 3900, 3900] : [2340, 3510, 3510];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows
  });
}

function createChecklistTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const headerBg = "d5e8f0";

  const items = [
    "✓ Todos os testes de autenticação passaram",
    "✓ Recuperação de senha funciona corretamente",
    "✓ Todos os dashboards carregam sem erros",
    "✓ CRUD de turmas funciona completamente",
    "✓ CRUD de alunos funciona completamente",
    "✓ Geração de boletos sem erros",
    "✓ PIX em massa funciona corretamente",
    "✓ Comunicações são entregues corretamente",
    "✓ Testes de responsividade aprovados",
    "✓ Testes de segurança aprovados",
    "✓ Performance dentro dos limites",
    "✓ Sem bugs críticos encontrados"
  ];

  const rows = items.map((item, idx) =>
    new TableRow({
      children: [
        new TableCell({
          borders,
          shading: idx === 0 ? { fill: headerBg, type: ShadingType.CLEAR } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: idx === 0 ? "Item" : item,
              bold: idx === 0,
              size: idx === 0 ? 22 : 20
            })]
          })]
        }),
        new TableCell({
          borders,
          shading: idx === 0 ? { fill: headerBg, type: ShadingType.CLEAR } : undefined,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: idx === 0 ? "Status" : "☐ Passou",
              bold: idx === 0,
              size: idx === 0 ? 22 : 20
            })]
          })]
        })
      ]
    })
  );

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [7020, 2340],
    rows: rows
  });
}

function createApprovalTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({
              text: "Testador",
              bold: true
            })] })]
          }),
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun("_______________________")] })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({
              text: "Data",
              bold: true
            })] })]
          }),
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun("_______________________")] })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({
              text: "Aprovado para Lançamento",
              bold: true
            })] })]
          }),
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun("☐ SIM   ☐ NÃO")] })]
          })
        ]
      })
    ]
  });
}

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("Plano_Testes_GestEscolar_MVP.docx", buffer);
  console.log("✅ Documento de testes criado: Plano_Testes_GestEscolar_MVP.docx");
});
