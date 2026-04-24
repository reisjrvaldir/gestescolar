"""
Gera o PDF: POP - Processo Operacional Padrão
Criação de Tabelas no Supabase para o GestEscolar
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Image
)

PRIMARY = HexColor('#1a73e8')
DARK = HexColor('#0d1b2a')
GREEN = HexColor('#2e7d32')
ORANGE = HexColor('#ff6d00')
GRAY = HexColor('#666666')
LIGHT_BG = HexColor('#f8f9fa')
WHITE = HexColor('#ffffff')

def build_pdf():
    output = "C:/Users/USER/Documents/Projetos/gestescolar/docs/POP_Supabase_GestEscolar.pdf"
    doc = SimpleDocTemplate(output, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'],
        fontSize=22, textColor=PRIMARY, spaceAfter=6, alignment=1)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
        fontSize=12, textColor=GRAY, alignment=1, spaceAfter=20)
    h1 = ParagraphStyle('H1', parent=styles['Heading1'],
        fontSize=16, textColor=DARK, spaceBefore=20, spaceAfter=10,
        borderWidth=0, borderColor=PRIMARY, borderPadding=4)
    h2 = ParagraphStyle('H2', parent=styles['Heading2'],
        fontSize=13, textColor=PRIMARY, spaceBefore=14, spaceAfter=8)
    body = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=10, textColor=DARK, spaceAfter=6, leading=14)
    code_style = ParagraphStyle('Code', parent=styles['Normal'],
        fontSize=8.5, fontName='Courier', textColor=DARK,
        backColor=LIGHT_BG, borderWidth=1, borderColor=HexColor('#ddd'),
        borderPadding=8, spaceAfter=10, leading=11)
    note_style = ParagraphStyle('Note', parent=styles['Normal'],
        fontSize=9, textColor=ORANGE, backColor=HexColor('#fff8e1'),
        borderWidth=1, borderColor=ORANGE, borderPadding=8,
        spaceAfter=10, leading=12)
    step_style = ParagraphStyle('Step', parent=styles['Normal'],
        fontSize=11, textColor=WHITE, backColor=PRIMARY,
        borderPadding=8, spaceAfter=6, leading=14, fontName='Helvetica-Bold')

    story = []

    # === CAPA ===
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph("POP - Processo Operacional Padrao", title_style))
    story.append(Paragraph("Criacao de Tabelas no Supabase", subtitle_style))
    story.append(HRFlowable(width="60%", color=PRIMARY, thickness=2, spaceAfter=20))
    story.append(Paragraph("Sistema GestEscolar SaaS", ParagraphStyle('x',
        parent=styles['Normal'], fontSize=14, textColor=DARK, alignment=1, spaceAfter=8)))
    story.append(Paragraph("Versao 1.0 - Marco 2026", ParagraphStyle('x2',
        parent=styles['Normal'], fontSize=10, textColor=GRAY, alignment=1, spaceAfter=40)))

    # Info box
    info_data = [
        ['Documento:', 'POP-001 - Configuracao Supabase'],
        ['Responsavel:', 'Equipe GestEscolar'],
        ['Objetivo:', 'Criar todas as tabelas do banco de dados no Supabase'],
        ['Projeto URL:', 'https://exqkzqmpbfakrjqinvnf.supabase.co'],
    ]
    info_table = Table(info_data, colWidths=[3.5*cm, 12*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), LIGHT_BG),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#ddd')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)

    story.append(PageBreak())

    # === SUMARIO ===
    story.append(Paragraph("Sumario", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))
    sumario = [
        "1. Pre-requisitos",
        "2. Acessar o SQL Editor",
        "3. Criar as Tabelas (Schema)",
        "4. Verificar as Tabelas Criadas",
        "5. Estrutura das Tabelas",
        "6. Seguranca (Row Level Security)",
        "7. Proximos Passos",
    ]
    for item in sumario:
        story.append(Paragraph(item, ParagraphStyle('sum', parent=body,
            fontSize=11, spaceBefore=4, leftIndent=20)))
    story.append(Spacer(1, 1*cm))

    # === 1. PRE-REQUISITOS ===
    story.append(Paragraph("1. Pre-requisitos", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))
    story.append(Paragraph("Antes de comecar, voce precisa:", body))
    prereqs = [
        "Conta criada no Supabase (https://supabase.com)",
        "Projeto 'GestEscolar' criado na regiao South America (Sao Paulo)",
        "Acesso ao Dashboard do projeto",
        "Arquivo schema.sql (fornecido junto com este POP)",
    ]
    for p in prereqs:
        story.append(Paragraph(f"&bull; {p}", ParagraphStyle('bullet', parent=body, leftIndent=20)))

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "IMPORTANTE: Anote e guarde a Database Password que voce definiu ao criar o projeto. "
        "Ela sera necessaria para conexoes diretas ao banco.",
        note_style))

    # === 2. ACESSAR SQL EDITOR ===
    story.append(PageBreak())
    story.append(Paragraph("2. Acessar o SQL Editor", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))

    story.append(Paragraph("PASSO 1", step_style))
    story.append(Paragraph(
        "Acesse o dashboard do seu projeto:<br/>"
        "<b>https://supabase.com/dashboard/project/exqkzqmpbfakrjqinvnf</b>",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 2", step_style))
    story.append(Paragraph(
        "No menu lateral esquerdo, clique em <b>SQL Editor</b> "
        "(icone de parenteses &lt;/&gt;). Ele fica logo abaixo de 'Table Editor'.",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 3", step_style))
    story.append(Paragraph(
        "Clique em <b>+ New Query</b> (botao verde no canto superior) "
        "para abrir um editor SQL em branco.",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph(
        "Ou acesse diretamente: https://supabase.com/dashboard/project/exqkzqmpbfakrjqinvnf/sql/new",
        note_style))

    # === 3. CRIAR TABELAS ===
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("3. Criar as Tabelas (Schema)", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))

    story.append(Paragraph("PASSO 4", step_style))
    story.append(Paragraph(
        "Abra o arquivo <b>supabase/schema.sql</b> que esta na pasta do projeto GestEscolar. "
        "Voce pode abrir com o Bloco de Notas, VS Code ou qualquer editor de texto.",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 5", step_style))
    story.append(Paragraph(
        "Selecione <b>TODO o conteudo</b> do arquivo (Ctrl+A) e copie (Ctrl+C).",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 6", step_style))
    story.append(Paragraph(
        "Cole (Ctrl+V) todo o conteudo no SQL Editor do Supabase.",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 7", step_style))
    story.append(Paragraph(
        "Clique no botao <b>Run</b> (botao verde, ou pressione Ctrl+Enter). "
        "Aguarde a execucao — pode levar alguns segundos.",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 8", step_style))
    story.append(Paragraph(
        "Se tudo der certo, voce vera a mensagem <b>'Success. No rows returned'</b> "
        "na area de resultados abaixo do editor. Isso e normal — o SQL cria tabelas, "
        "nao retorna dados.",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph(
        "Se aparecer algum erro em VERMELHO, copie a mensagem de erro e me envie no chat. "
        "Eu resolvo para voce.",
        note_style))

    # === 4. VERIFICAR ===
    story.append(PageBreak())
    story.append(Paragraph("4. Verificar as Tabelas Criadas", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))

    story.append(Paragraph("PASSO 9", step_style))
    story.append(Paragraph(
        "No menu lateral esquerdo, clique em <b>Table Editor</b> "
        "(icone de tabela, primeiro item do menu).",
        body))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("PASSO 10", step_style))
    story.append(Paragraph(
        "Voce deve ver as seguintes 11 tabelas listadas:",
        body))

    # Tabela de verificação
    check_data = [
        ['Tabela', 'Descricao', 'Status'],
        ['schools', 'Escolas cadastradas', '[ ]'],
        ['users', 'Usuarios do sistema', '[ ]'],
        ['classes', 'Turmas', '[ ]'],
        ['students', 'Alunos', '[ ]'],
        ['invoices', 'Boletos/Mensalidades', '[ ]'],
        ['expenses', 'Contas a pagar', '[ ]'],
        ['transactions', 'Transacoes financeiras', '[ ]'],
        ['messages', 'Mensagens', '[ ]'],
        ['audit_log', 'Log de auditoria', '[ ]'],
        ['grades', 'Notas/Avaliacoes', '[ ]'],
        ['attendance', 'Chamada/Presenca', '[ ]'],
    ]
    check_table = Table(check_data, colWidths=[3.5*cm, 8*cm, 2.5*cm])
    check_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), DARK),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#ddd')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
    ]))
    story.append(check_table)
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "Marque cada tabela conforme for verificando. Se alguma estiver faltando, "
        "execute o SQL novamente ou me avise.",
        body))

    # === 5. ESTRUTURA ===
    story.append(PageBreak())
    story.append(Paragraph("5. Estrutura das Tabelas", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))

    tables_info = [
        ("schools - Escolas", [
            "id (UUID) - Identificador unico",
            "name - Nome da escola",
            "cnpj - CNPJ",
            "email, phone, address - Contato",
            "plan_id - Plano contratado (free, gestao_100, etc)",
            "pix_key - Chave PIX para recebimentos",
        ]),
        ("users - Usuarios", [
            "id (UUID) - Identificador unico",
            "auth_id - Vinculo com Supabase Auth",
            "school_id - Escola vinculada",
            "name, email, cpf, phone - Dados pessoais",
            "role - Funcao (gestor, professor, pai, etc)",
            "active - Se o usuario esta ativo",
        ]),
        ("students - Alunos", [
            "id, school_id, name, cpf, matricula",
            "class_id - Turma vinculada",
            "status - ativo/inativo",
            "monthly_fee - Valor da mensalidade",
            "responsaveis (JSON) - Lista de responsaveis",
            "parent_id - Vinculo com usuario pai",
        ]),
        ("invoices - Mensalidades", [
            "id, school_id, student_id, student_name",
            "description, amount, due_date",
            "status - pendente/pago/vencido/cancelado",
            "paid_at - Data do pagamento",
            "asaas_id - ID da cobranca no Asaas",
        ]),
        ("expenses - Contas a Pagar", [
            "id, school_id, description",
            "tipo - fixa/variavel",
            "category, amount, due_date, status",
            "parcelado, parcelas, parcela_num",
        ]),
        ("messages - Mensagens", [
            "id, school_id",
            "from_user_id, from_name - Remetente",
            "to_user_id - Destinatario",
            "student_id, student_name - Aluno relacionado",
            "subject, text - Conteudo",
            "read - Se foi lida",
        ]),
    ]

    for title, fields in tables_info:
        story.append(Paragraph(title, h2))
        for f in fields:
            story.append(Paragraph(f"&bull; <font size='9'>{f}</font>",
                ParagraphStyle('tf', parent=body, leftIndent=15, fontSize=9, spaceAfter=2)))

    # === 6. RLS ===
    story.append(PageBreak())
    story.append(Paragraph("6. Seguranca - Row Level Security (RLS)", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))

    story.append(Paragraph(
        "O schema ja configura automaticamente o <b>Row Level Security (RLS)</b> "
        "em todas as tabelas. Isso significa que:",
        body))

    rls_points = [
        "Cada escola so ve seus proprios dados",
        "Um usuario da Escola A NAO consegue acessar dados da Escola B",
        "O superadmin consegue ver dados de todas as escolas",
        "A seguranca e aplicada no nivel do banco de dados (nao depende do frontend)",
    ]
    for p in rls_points:
        story.append(Paragraph(f"&bull; {p}", ParagraphStyle('rls', parent=body, leftIndent=20)))

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        "NAO desabilite o RLS nas tabelas. Ele e essencial para a seguranca "
        "do sistema multi-tenant.",
        note_style))

    # === 7. PROXIMOS PASSOS ===
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph("7. Proximos Passos", h1))
    story.append(HRFlowable(width="100%", color=PRIMARY, thickness=1, spaceAfter=12))

    steps_data = [
        ['Etapa', 'Descricao', 'Responsavel'],
        ['1', 'Criar tabelas no Supabase (este POP)', 'Voce'],
        ['2', 'Migrar codigo JS (data.js / auth.js)', 'Claude'],
        ['3', 'Configurar autenticacao (Supabase Auth)', 'Claude + Voce'],
        ['4', 'Integrar Asaas (pagamentos)', 'Claude + Voce'],
        ['5', 'Testar sistema completo', 'Voce + Claude'],
        ['6', 'Deploy em producao (VPS)', 'Claude + Voce'],
    ]
    steps_table = Table(steps_data, colWidths=[1.5*cm, 8.5*cm, 4*cm])
    steps_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (-1, -1), DARK),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#ddd')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
    ]))
    story.append(steps_table)

    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width="100%", color=GRAY, thickness=0.5, spaceAfter=10))
    story.append(Paragraph(
        "Documento gerado automaticamente pelo GestEscolar - Marco 2026",
        ParagraphStyle('footer', parent=styles['Normal'],
            fontSize=8, textColor=GRAY, alignment=1)))

    # Build
    doc.build(story)
    print(f"PDF gerado: {output}")

if __name__ == '__main__':
    build_pdf()
