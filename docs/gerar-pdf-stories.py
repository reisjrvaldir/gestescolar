from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas

# Story format: 1080x1920 ratio -> A4 width, taller pages
# Simulating stories in portrait A4 pages (each page = 1 story)
W, H = A4

PRIMARY = HexColor('#1976d2')
PRIMARY_DARK = HexColor('#0d47a1')
ACCENT = HexColor('#ff6f00')
DARK = HexColor('#1a1a2e')
TEXT = HexColor('#2d3436')
MUTED = HexColor('#636e72')
LIGHT_BG = HexColor('#f8f9ff')
GREEN = HexColor('#00b894')
PURPLE = HexColor('#6c5ce7')
PINK = HexColor('#e84393')
CYAN = HexColor('#00cec9')
WHITE = white

def rounded_rect(c, x, y, w, h, r, fill_color=None):
    c.saveState()
    if fill_color:
        c.setFillColor(fill_color)
    p = c.beginPath()
    p.moveTo(x + r, y)
    p.lineTo(x + w - r, y)
    p.arcTo(x + w - r, y, x + w, y + r, -90, 90)
    p.lineTo(x + w, y + h - r)
    p.arcTo(x + w - r, y + h - r, x + w, y + h, 0, 90)
    p.lineTo(x + r, y + h)
    p.arcTo(x, y + h - r, x + r, y + h, 90, 90)
    p.lineTo(x, y + r)
    p.arcTo(x, y, x + r, y + r, 180, 90)
    p.close()
    c.drawPath(p, fill=1, stroke=0)
    c.restoreState()

def gradient_bg(c, color_top, color_bottom):
    steps = 60
    for i in range(steps):
        ratio = i / steps
        r = color_top.red + (color_bottom.red - color_top.red) * ratio
        g = color_top.green + (color_bottom.green - color_top.green) * ratio
        b = color_top.blue + (color_bottom.blue - color_top.blue) * ratio
        c.setFillColor(HexColor('#%02x%02x%02x' % (int(r*255), int(g*255), int(b*255))))
        sy = H - (i * H / steps)
        c.rect(0, sy - H/steps, W, H/steps + 1, fill=True, stroke=False)

def draw_circle(c, x, y, r, color):
    c.saveState()
    c.setFillColor(color)
    c.circle(x, y, r, fill=1, stroke=0)
    c.restoreState()

def footer_bar(c, page_num, total):
    c.setFillColor(HexColor('#00000033'))
    c.rect(0, 0, W, 12*mm, fill=True, stroke=False)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7)
    c.drawCentredString(W/2, 5*mm, f"gestescolar.com.br  |  {page_num}/{total}")

def story_dots(c, current, total):
    dot_w = 8*mm
    total_w = total * dot_w
    sx = (W - total_w) / 2
    for i in range(total):
        color = WHITE if i == current else HexColor('#ffffff55')
        draw_circle(c, sx + i * dot_w + 4*mm, H - 8*mm, 2*mm if i == current else 1.5*mm, color)

# ══════════════════════════════════════════════
#  STORY 1: CAPA
# ══════════════════════════════════════════════
def story_capa(c):
    gradient_bg(c, PRIMARY_DARK, HexColor('#0a1628'))
    story_dots(c, 0, 7)

    # Circulos decorativos
    draw_circle(c, W - 30*mm, H - 60*mm, 40*mm, HexColor('#ffffff08'))
    draw_circle(c, 40*mm, 80*mm, 55*mm, HexColor('#ffffff05'))

    # Logo
    cy = H/2 + 60*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 42)
    c.drawCentredString(W/2, cy, "GestEscolar")
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor('#bbdefb'))
    c.drawCentredString(W/2, cy - 16*mm, "Plataforma SaaS de Gestao Escolar")

    # Linha accent
    c.setStrokeColor(ACCENT)
    c.setLineWidth(3)
    c.line(W/2 - 30*mm, cy - 26*mm, W/2 + 30*mm, cy - 26*mm)

    # Tagline
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(W/2, cy - 45*mm, "Simplifique a gestao")
    c.drawCentredString(W/2, cy - 55*mm, "da sua escola.")

    c.setFillColor(HexColor('#90caf9'))
    c.setFont("Helvetica", 11)
    c.drawCentredString(W/2, cy - 72*mm, "Matriculas, financeiro, notas, frequencia")
    c.drawCentredString(W/2, cy - 80*mm, "e comunicacao em um so lugar.")

    # Badge
    rounded_rect(c, W/2 - 35*mm, cy - 108*mm, 70*mm, 14*mm, 7*mm, fill_color=ACCENT)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(W/2, cy - 101*mm, "Comece Gratis")

    # URL
    c.setFillColor(HexColor('#90caf9'))
    c.setFont("Helvetica", 10)
    c.drawCentredString(W/2, cy - 118*mm, "gestescolar.com.br")

    footer_bar(c, 1, 7)
    c.showPage()

# ══════════════════════════════════════════════
#  STORY 2: NUMEROS
# ══════════════════════════════════════════════
def story_numeros(c):
    gradient_bg(c, HexColor('#1565c0'), PRIMARY_DARK)
    story_dots(c, 1, 7)

    cy = H - 50*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(W/2, cy, "Por que escolher o")
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(ACCENT)
    c.drawCentredString(W/2, cy - 14*mm, "GestEscolar?")

    nums = [
        ("5+", "Modulos Integrados", "Gestao completa em uma plataforma"),
        ("100%", "Online e Seguro", "Acesse de qualquer dispositivo"),
        ("R$ 0", "Para Comecar", "Plano Free com ate 5 alunos"),
        ("24/7", "Disponivel", "Acesso a qualquer hora, qualquer lugar"),
    ]

    by = cy - 50*mm
    for i, (num, title, desc) in enumerate(nums):
        iy = by - i * 48*mm
        rounded_rect(c, 25*mm, iy - 8*mm, W - 50*mm, 40*mm, 8*mm, fill_color=HexColor('#ffffff12'))

        # Numero grande
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 32)
        c.drawString(35*mm, iy + 10*mm, num)

        # Titulo
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(35*mm, iy + 1*mm, title)

        # Desc
        c.setFillColor(HexColor('#90caf9'))
        c.setFont("Helvetica", 9)
        c.drawString(35*mm, iy - 6*mm, desc)

    footer_bar(c, 2, 7)
    c.showPage()

# ══════════════════════════════════════════════
#  STORY 3: MODULOS ATUAIS
# ══════════════════════════════════════════════
def story_modulos(c):
    gradient_bg(c, HexColor('#0d47a1'), DARK)
    story_dots(c, 2, 7)

    cy = H - 45*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(W/2, cy, "Modulos Disponiveis")
    c.setStrokeColor(ACCENT)
    c.setLineWidth(3)
    c.line(W/2 - 25*mm, cy - 5*mm, W/2 + 25*mm, cy - 5*mm)

    modules = [
        (PRIMARY, "Gestao Escolar", "Matriculas, turmas, alunos, professores\ne equipe administrativa"),
        (PURPLE, "Financeiro", "Mensalidades, boletos, despesas,\nparcelamento e dashboard"),
        (GREEN, "Academico", "Notas por disciplina, frequencia\ndiaria e boletim"),
        (ACCENT, "Comunicacao", "Chat entre gestores, professores\ne responsaveis"),
        (PINK, "Seguranca", "RLS por escola, login seguro,\nOAuth Google, recuperacao por e-mail"),
        (CYAN, "Multi-tenant", "Escolas isoladas, planos flexiveis,\nlimites personalizados"),
    ]

    by = cy - 22*mm
    for i, (color, title, desc) in enumerate(modules):
        iy = by - i * 34*mm
        rounded_rect(c, 25*mm, iy - 5*mm, W - 50*mm, 28*mm, 6*mm, fill_color=HexColor('#ffffff0a'))

        # Barra lateral colorida
        c.setFillColor(color)
        c.rect(25*mm, iy - 5*mm, 3*mm, 28*mm, fill=True, stroke=False)

        # Numero
        draw_circle(c, 38*mm, iy + 12*mm, 5*mm, color)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(38*mm, iy + 10.5*mm, str(i + 1))

        # Titulo
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(48*mm, iy + 14*mm, title)

        # Desc
        c.setFillColor(HexColor('#90caf9'))
        c.setFont("Helvetica", 8.5)
        lines = desc.split('\n')
        for li, line in enumerate(lines):
            c.drawString(48*mm, iy + 6*mm - li * 4*mm, line)

    footer_bar(c, 3, 7)
    c.showPage()

# ══════════════════════════════════════════════
#  STORY 4: PLANOS
# ══════════════════════════════════════════════
def story_planos(c):
    gradient_bg(c, DARK, HexColor('#0a0a1a'))
    story_dots(c, 3, 7)

    cy = H - 45*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W/2, cy, "Planos para cada")
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W/2, cy - 12*mm, "tamanho de escola")

    plans = [
        ("Free", "Gratis", "5 alunos", "1 professor", "1 gestor", False, HexColor('#ffffff15')),
        ("Gestao 100", "R$ 199,90/mes", "100 alunos", "Ilimitados", "Ilimitados", False, HexColor('#ffffff15')),
        ("Gestao 250", "R$ 399,90/mes", "250 alunos", "Ilimitados", "Ilimitados", True, PRIMARY),
        ("251+", "Sob consulta", "Ilimitado", "Ilimitados", "Ilimitados", False, HexColor('#ffffff15')),
    ]

    by = cy - 40*mm
    for i, (name, price, students, teachers, gestors, popular, bg) in enumerate(plans):
        iy = by - i * 46*mm
        rounded_rect(c, 30*mm, iy - 5*mm, W - 60*mm, 40*mm, 8*mm, fill_color=bg)

        if popular:
            rounded_rect(c, W/2 - 22*mm, iy + 32*mm, 44*mm, 7*mm, 3*mm, fill_color=ACCENT)
            c.setFillColor(WHITE)
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(W/2, iy + 33.5*mm, "MAIS POPULAR")

        # Nome e preco
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(40*mm, iy + 22*mm, name)
        c.setFillColor(ACCENT if popular else HexColor('#ffd54f'))
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(W - 40*mm, iy + 22*mm, price)

        # Detalhes
        c.setFillColor(HexColor('#bbdefb') if popular else HexColor('#aaaaaa'))
        c.setFont("Helvetica", 9)
        c.drawString(40*mm, iy + 10*mm, f"Ate {students}  |  Prof: {teachers}  |  Gestores: {gestors}")

        # Desconto anual
        c.setFont("Helvetica", 7.5)
        c.drawString(40*mm, iy + 3*mm, "15% desconto no plano anual" if name != "Free" else "Sem custo, para sempre")

    footer_bar(c, 4, 7)
    c.showPage()

# ══════════════════════════════════════════════
#  STORY 5: PORTAL DO RESPONSAVEL (EM BREVE)
# ══════════════════════════════════════════════
def story_portal_responsavel(c):
    gradient_bg(c, HexColor('#4a148c'), HexColor('#1a0533'))
    story_dots(c, 4, 7)

    # Badge "em breve"
    rounded_rect(c, W/2 - 22*mm, H - 40*mm, 44*mm, 8*mm, 4*mm, fill_color=ACCENT)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(W/2, H - 37*mm, "EM BREVE")

    cy = H - 65*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W/2, cy, "Portal do")
    c.setFillColor(HexColor('#ce93d8'))
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(W/2, cy - 14*mm, "Responsavel")

    c.setFillColor(HexColor('#e1bee7'))
    c.setFont("Helvetica", 11)
    c.drawCentredString(W/2, cy - 32*mm, "Tudo sobre o aluno na palma da mao.")
    c.drawCentredString(W/2, cy - 42*mm, "Acesso exclusivo para pais e responsaveis.")

    features = [
        (HexColor('#7c4dff'), "Acompanhamento Academico", "Notas, boletim, frequencia e\ndesempenho por disciplina em tempo real"),
        (GREEN, "Financeiro", "Boletos, mensalidades pendentes,\nhistorico de pagamentos e 2a via"),
        (ACCENT, "Documentos", "Declaracoes, atestados, historico\nescolar e matricula digital"),
        (PINK, "Chat Direto", "Comunicacao direta com professores\ne gestores da escola"),
    ]

    by = cy - 68*mm
    for i, (color, title, desc) in enumerate(features):
        iy = by - i * 42*mm
        rounded_rect(c, 28*mm, iy - 5*mm, W - 56*mm, 36*mm, 8*mm, fill_color=HexColor('#ffffff0d'))

        # Barra colorida
        c.setFillColor(color)
        c.rect(28*mm, iy - 5*mm, 4*mm, 36*mm, fill=True, stroke=False)

        # Icone
        draw_circle(c, 42*mm, iy + 16*mm, 6*mm, color)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 12)
        icons = ["A", "$", "D", "C"]
        c.drawCentredString(42*mm, iy + 14*mm, icons[i])

        # Titulo
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(53*mm, iy + 18*mm, title)

        # Desc
        c.setFillColor(HexColor('#ce93d8'))
        c.setFont("Helvetica", 8.5)
        lines = desc.split('\n')
        for li, line in enumerate(lines):
            c.drawString(53*mm, iy + 9*mm - li * 4*mm, line)

    footer_bar(c, 5, 7)
    c.showPage()

# ══════════════════════════════════════════════
#  STORY 6: PROXIMOS MODULOS
# ══════════════════════════════════════════════
def story_roadmap(c):
    gradient_bg(c, HexColor('#004d40'), HexColor('#0a1a18'))
    story_dots(c, 5, 7)

    rounded_rect(c, W/2 - 28*mm, H - 40*mm, 56*mm, 8*mm, 4*mm, fill_color=ACCENT)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(W/2, H - 37*mm, "ROADMAP 2026")

    cy = H - 65*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W/2, cy, "Proximos Modulos")
    c.setFillColor(HexColor('#80cbc4'))
    c.setFont("Helvetica", 11)
    c.drawCentredString(W/2, cy - 14*mm, "Novas funcionalidades chegando em breve")

    roadmap = [
        ("ABR/2026", ACCENT, "Gateway de Pagamento Asaas", "Cobranca automatica com PIX, boleto\ne split de 2% por transacao"),
        ("MAI/2026", PURPLE, "Portal Completo do Responsavel", "App dedicado com notas, financeiro,\ndocumentos e chat em tempo real"),
        ("JUN/2026", PINK, "Relatorios Avancados", "Graficos de desempenho, frequencia,\nfinanceiro e exportacao em PDF/Excel"),
        ("JUL/2026", CYAN, "Notificacoes Push e WhatsApp", "Alertas automaticos de boletos,\nnotas e comunicados via WhatsApp"),
        ("AGO/2026", GREEN, "App Mobile (PWA)", "Aplicativo instalavel no celular\npara gestores, professores e pais"),
    ]

    by = cy - 40*mm
    # Linha do tempo vertical
    c.setStrokeColor(HexColor('#ffffff20'))
    c.setLineWidth(2)
    c.line(38*mm, by + 10*mm, 38*mm, by - (len(roadmap)-1) * 40*mm - 10*mm)

    for i, (date, color, title, desc) in enumerate(roadmap):
        iy = by - i * 40*mm

        # Dot na timeline
        draw_circle(c, 38*mm, iy + 6*mm, 5*mm, color)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawCentredString(38*mm, iy + 4.5*mm, str(i + 1))

        # Data
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(48*mm, iy + 14*mm, date)

        # Titulo
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(48*mm, iy + 6*mm, title)

        # Desc
        c.setFillColor(HexColor('#80cbc4'))
        c.setFont("Helvetica", 8)
        lines = desc.split('\n')
        for li, line in enumerate(lines):
            c.drawString(48*mm, iy - 1*mm - li * 3.5*mm, line)

    footer_bar(c, 6, 7)
    c.showPage()

# ══════════════════════════════════════════════
#  STORY 7: CTA FINAL
# ══════════════════════════════════════════════
def story_cta(c):
    gradient_bg(c, PRIMARY_DARK, HexColor('#0a1628'))
    story_dots(c, 6, 7)

    # Circulos decorativos
    draw_circle(c, W/2, H/2 + 20*mm, 80*mm, HexColor('#ffffff06'))
    draw_circle(c, W/2, H/2 + 20*mm, 55*mm, HexColor('#ffffff06'))

    cy = H/2 + 50*mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(W/2, cy, "Pronto para")
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(W/2, cy - 16*mm, "transformar")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(W/2, cy - 32*mm, "sua escola?")

    # Beneficios
    benefits = [
        "Cadastro gratuito em menos de 2 minutos",
        "Sem cartao de credito para comecar",
        "Suporte dedicado para implantacao",
        "Migre seus dados com facilidade",
    ]

    by = cy - 58*mm
    for i, b in enumerate(benefits):
        iy = by - i * 12*mm
        draw_circle(c, W/2 - 55*mm, iy + 2*mm, 3*mm, GREEN)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 6)
        c.drawCentredString(W/2 - 55*mm, iy + 0.8*mm, "V")
        c.setFillColor(HexColor('#e3f2fd'))
        c.setFont("Helvetica", 11)
        c.drawString(W/2 - 48*mm, iy, b)

    # CTA Button
    btn_y = by - len(benefits) * 12*mm - 15*mm
    rounded_rect(c, W/2 - 45*mm, btn_y, 90*mm, 16*mm, 8*mm, fill_color=ACCENT)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(W/2, btn_y + 5*mm, "Comece Gratis Agora")

    # URL
    c.setFillColor(HexColor('#90caf9'))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(W/2, btn_y - 14*mm, "gestescolar.com.br")

    # Contato
    c.setFillColor(HexColor('#546e7a'))
    c.setFont("Helvetica", 9)
    c.drawCentredString(W/2, btn_y - 30*mm, "contato: valdir.rng@gmail.com")

    footer_bar(c, 7, 7)
    c.showPage()


# ══════════════════════════════════════════════
#  GERAR PDF
# ══════════════════════════════════════════════
def main():
    c = canvas.Canvas("docs/GestEscolar-Stories.pdf", pagesize=A4)

    story_capa(c)
    story_numeros(c)
    story_modulos(c)
    story_planos(c)
    story_portal_responsavel(c)
    story_roadmap(c)
    story_cta(c)

    c.save()
    print("PDF Stories gerado: docs/GestEscolar-Stories.pdf (7 paginas)")

main()
