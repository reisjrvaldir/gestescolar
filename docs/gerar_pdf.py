from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

W, H = A4
BLUE   = colors.HexColor('#1a73e8')
GREEN  = colors.HexColor('#2e7d32')
DARK   = colors.HexColor('#1a1a2e')
GRAY   = colors.HexColor('#f5f7fa')
BORDER = colors.HexColor('#e0e0e0')
WHITE  = colors.white

OUTPUT = r'C:\Users\USER\Documents\Projetos\gestescolar\docs\como-instalar-app.pdf'

doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
    leftMargin=18*mm, rightMargin=18*mm,
    topMargin=16*mm, bottomMargin=16*mm)

def style(name='Normal', **kw):
    return ParagraphStyle(name, **kw)

s_title = style('title', fontSize=22, textColor=WHITE, fontName='Helvetica-Bold',
                alignment=TA_CENTER, leading=28)
s_sub   = style('sub', fontSize=12, textColor=colors.HexColor('#d0e4ff'),
                fontName='Helvetica', alignment=TA_CENTER, leading=16)
s_sec   = style('sec', fontSize=15, textColor=WHITE, fontName='Helvetica-Bold',
                alignment=TA_LEFT, leading=20)
s_step  = style('step', fontSize=11, textColor=DARK, fontName='Helvetica',
                alignment=TA_LEFT, leading=16, leftIndent=4)
s_foot  = style('foot', fontSize=9, textColor=colors.HexColor('#888'),
                fontName='Helvetica', alignment=TA_CENTER)

def header_block(story):
    title_p = Paragraph('GestEscolar', s_title)
    sub_p   = Paragraph('Como instalar o aplicativo no seu celular', s_sub)
    tbl = Table([[title_p], [sub_p]], colWidths=[W - 36*mm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), BLUE),
        ('TOPPADDING',    (0,0), (-1,-1), 18),
        ('BOTTOMPADDING', (0,0), (-1,-1), 18),
        ('LEFTPADDING',   (0,0), (-1,-1), 16),
        ('RIGHTPADDING',  (0,0), (-1,-1), 16),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 8*mm))

def section_header(story, title, color):
    title_p = Paragraph(title, s_sec)
    tbl = Table([[title_p]], colWidths=[W - 36*mm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), color),
        ('TOPPADDING',    (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING',   (0,0), (-1,-1), 14),
        ('RIGHTPADDING',  (0,0), (-1,-1), 14),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 3*mm))

def step_row(story, num, text):
    num_p  = Paragraph('<b>%s</b>' % num, style('n', fontSize=13, textColor=WHITE,
                        fontName='Helvetica-Bold', alignment=TA_CENTER))
    text_p = Paragraph(text, s_step)
    tbl = Table([[num_p, text_p]],
                colWidths=[9*mm, W - 36*mm - 12*mm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (0,0), BLUE),
        ('BACKGROUND',    (1,0), (1,0), GRAY),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 9),
        ('LEFTPADDING',   (0,0), (0,0), 0),
        ('RIGHTPADDING',  (0,0), (0,0), 0),
        ('LEFTPADDING',   (1,0), (1,0), 10),
        ('RIGHTPADDING',  (1,0), (1,0), 8),
        ('BOX',           (0,0), (-1,-1), 0.5, BORDER),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 2*mm))

def tip_box(story, text):
    p = Paragraph('<b>Importante:</b> ' + text,
                  style('tip', fontSize=10,
                        textColor=colors.HexColor('#0d47a1'),
                        fontName='Helvetica', alignment=TA_LEFT,
                        leading=14, leftIndent=4))
    tbl = Table([[p]], colWidths=[W - 36*mm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), colors.HexColor('#e8f0fe')),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 12),
        ('BOX',           (0,0), (-1,-1), 0.5, colors.HexColor('#90caf9')),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 4*mm))

# BUILD
story = []
header_block(story)

# ANDROID
section_header(story, 'Android  -  Google Chrome', GREEN)
story.append(Spacer(1, 2*mm))
step_row(story, '1', '<b>Abra o Google Chrome</b> no seu celular Android.')
step_row(story, '2', 'Na barra de endereco, acesse: <b>gestescolar.com.br</b>')
step_row(story, '3', 'O Chrome exibira um <b>banner na parte inferior</b> da tela: "Adicionar GestEscolar a tela inicial". Toque nele.')
step_row(story, '4', 'Se o banner nao aparecer, toque nos <b>3 pontos (menu)</b> no canto superior direito do Chrome.')
step_row(story, '5', 'No menu, toque em <b>"Instalar aplicativo"</b> ou <b>"Adicionar a tela inicial"</b>.')
step_row(story, '6', 'Confirme tocando em <b>"Instalar"</b> na janela que aparecer.')
step_row(story, '7', 'O icone do <b>GestEscolar</b> aparecera na sua tela inicial como um app normal.')

story.append(Spacer(1, 2*mm))
tip_box(story, 'O app abrira em <b>tela cheia</b>, sem a barra do navegador. Visual identico a um aplicativo nativo.')

story.append(Spacer(1, 5*mm))
story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
story.append(Spacer(1, 5*mm))

# IPHONE
section_header(story, 'iPhone  -  Safari', BLUE)
story.append(Spacer(1, 2*mm))
step_row(story, '1', '<b>Abra o Safari</b> no seu iPhone. Apenas o Safari permite instalar o app no iOS.')
step_row(story, '2', 'Na barra de endereco, acesse: <b>gestescolar.com.br</b>')
step_row(story, '3', 'Aguarde a pagina carregar completamente.')
step_row(story, '4', 'Toque no botao de <b>Compartilhar</b> - icone de quadrado com seta apontando para cima (na barra inferior do Safari).')
step_row(story, '5', 'Role a lista de opcoes para baixo e toque em <b>"Adicionar a Tela de Inicio"</b>.')
step_row(story, '6', 'O nome aparecera como <b>"GestEscolar"</b>. Confirme tocando em <b>"Adicionar"</b> no canto superior direito.')
step_row(story, '7', 'O icone estara na tela inicial. Toque nele para abrir o app em tela cheia.')

story.append(Spacer(1, 2*mm))
tip_box(story, 'No iPhone e obrigatorio usar o <b>Safari</b>. Chrome e Firefox nao permitem instalacao de PWA no iOS.')

story.append(Spacer(1, 6*mm))
story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
story.append(Spacer(1, 4*mm))

# RODAPE
story.append(Paragraph('GestEscolar - Plataforma de Gestao Escolar', s_foot))
story.append(Spacer(1, 1*mm))
story.append(Paragraph('gestescolar.com.br',
    style('f2', fontSize=9, textColor=BLUE, fontName='Helvetica', alignment=TA_CENTER)))

doc.build(story)
print('PDF gerado com sucesso!')
