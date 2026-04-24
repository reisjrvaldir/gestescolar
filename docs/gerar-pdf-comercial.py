from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white, Color
from reportlab.pdfgen import canvas

W, H = A4
PRIMARY = HexColor('#1976d2')
PRIMARY_DARK = HexColor('#0d47a1')
ACCENT = HexColor('#ff6f00')
DARK = HexColor('#1a1a2e')
TEXT = HexColor('#2d3436')
MUTED = HexColor('#636e72')
LIGHT_BG = HexColor('#f8f9ff')
GREEN = HexColor('#00b894')
WHITE = white

def rounded_rect(c, x, y, w, h, r, fill_color=None, stroke_color=None):
    c.saveState()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(0.5)
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
    if fill_color and stroke_color:
        c.drawPath(p, fill=1, stroke=1)
    elif fill_color:
        c.drawPath(p, fill=1, stroke=0)
    else:
        c.drawPath(p, fill=0, stroke=1)
    c.restoreState()

def draw_icon_circle(c, x, y, r, color):
    c.saveState()
    c.setFillColor(color)
    c.circle(x, y, r, fill=1, stroke=0)
    c.restoreState()

def draw_pdf():
    c = canvas.Canvas("docs/GestEscolar-Comercial.pdf", pagesize=A4)

    # ── HERO HEADER ──
    c.setFillColor(PRIMARY_DARK)
    c.rect(0, H - 95*mm, W, 95*mm, fill=True, stroke=False)
    # Faixa accent
    c.setFillColor(ACCENT)
    c.rect(0, H - 95*mm, W, 3*mm, fill=True, stroke=False)

    # Logo e titulo
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 32)
    c.drawString(25*mm, H - 30*mm, "GestEscolar")
    c.setFont("Helvetica", 12)
    c.drawString(25*mm, H - 38*mm, "Plataforma SaaS de Gestao Escolar")

    # Tagline
    c.setFont("Helvetica-Bold", 16)
    c.drawString(25*mm, H - 58*mm, "Simplifique a gestao da sua escola.")
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor('#bbdefb'))
    c.drawString(25*mm, H - 66*mm, "Matriculas, financeiro, notas, frequencia e comunicacao em um so lugar.")
    c.drawString(25*mm, H - 74*mm, "100% online. Sem instalacao. Comece gratis.")

    # Badge
    c.setFillColor(ACCENT)
    rounded_rect(c, 25*mm, H - 88*mm, 52*mm, 8*mm, 4*mm, fill_color=ACCENT)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(29*mm, H - 85.5*mm, "gestescolar.com.br")

    # ── NUMEROS ──
    y_nums = H - 108*mm
    nums = [
        ("5+", "Modulos\nIntegrados"),
        ("100%", "Online e\nSeguro"),
        ("0", "Custo inicial\n(Plano Free)"),
        ("24/7", "Acesso de\nqualquer lugar"),
    ]
    box_w = (W - 50*mm) / 4
    for i, (num, label) in enumerate(nums):
        bx = 25*mm + i * box_w
        rounded_rect(c, bx, y_nums - 2*mm, box_w - 5*mm, 22*mm, 3*mm, fill_color=LIGHT_BG)
        c.setFillColor(PRIMARY)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(bx + (box_w - 5*mm)/2, y_nums + 11*mm, num)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7)
        lines = label.split('\n')
        for li, line in enumerate(lines):
            c.drawCentredString(bx + (box_w - 5*mm)/2, y_nums + 4*mm - li*3*mm, line)

    # ── MODULOS ──
    y_mod = H - 138*mm
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(25*mm, y_mod, "O que o GestEscolar faz por voce")
    y_mod -= 3*mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2)
    c.line(25*mm, y_mod, 85*mm, y_mod)
    y_mod -= 10*mm

    modules = [
        (PRIMARY, "Gestao Escolar", "Matriculas automaticas, turmas, alunos,\nprofessores e equipe administrativa"),
        (HexColor('#6c5ce7'), "Financeiro Completo", "Mensalidades, boletos, despesas fixas/variaveis,\nparcelamento e dashboard com saldo"),
        (GREEN, "Academico", "Lancamento de notas, controle de frequencia,\npainel do professor e portal do responsavel"),
        (ACCENT, "Comunicacao", "Chat interno entre gestores, professores e\nresponsaveis vinculado ao aluno"),
        (HexColor('#e84393'), "Seguranca", "Isolamento total entre escolas (RLS), login\nseguro, OAuth Google, recuperacao por e-mail"),
        (HexColor('#00cec9'), "Multi-tenant", "Cada escola com dados isolados, planos\nflexiveis e limite personalizado de alunos"),
    ]

    col_w = (W - 50*mm) / 2
    for i, (color, title, desc) in enumerate(modules):
        col = i % 2
        row = i // 2
        mx = 25*mm + col * (col_w + 5*mm)
        my = y_mod - row * 24*mm

        # Icone circular
        draw_icon_circle(c, mx + 5*mm, my + 5*mm, 4*mm, color)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(mx + 5*mm, my + 3.5*mm, str(i + 1))

        # Titulo
        c.setFillColor(DARK)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(mx + 13*mm, my + 6*mm, title)

        # Descricao
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.2)
        lines = desc.split('\n')
        for li, line in enumerate(lines):
            c.drawString(mx + 13*mm, my + 1*mm - li * 3.2*mm, line)

    # ── PLANOS ──
    y_plan = y_mod - 3 * 24*mm - 10*mm
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(25*mm, y_plan, "Planos")
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2)
    c.line(25*mm, y_plan - 3*mm, 55*mm, y_plan - 3*mm)
    y_plan -= 14*mm

    plans = [
        ("Free", "5 alunos", "Gratis", "Ideal para comecar"),
        ("Gestao 100", "100 alunos", "R$ 199,90/mes", "Escolas em crescimento"),
        ("Gestao 250", "250 alunos", "R$ 399,90/mes", "Mais popular"),
        ("251+", "Ilimitado", "Sob consulta", "Grandes instituicoes"),
    ]

    pw = (W - 50*mm - 15*mm) / 4
    for i, (name, limit, price, desc) in enumerate(plans):
        px = 25*mm + i * (pw + 5*mm)
        is_popular = (i == 2)
        bg = PRIMARY if is_popular else LIGHT_BG
        rounded_rect(c, px, y_plan - 2*mm, pw, 30*mm, 4*mm, fill_color=bg)

        if is_popular:
            # Badge "Mais popular"
            rounded_rect(c, px + 2*mm, y_plan + 24*mm, pw - 4*mm, 5*mm, 2*mm, fill_color=ACCENT)
            c.setFillColor(WHITE)
            c.setFont("Helvetica-Bold", 6)
            c.drawCentredString(px + pw/2, y_plan + 25.5*mm, "MAIS POPULAR")

        tc = WHITE if is_popular else DARK
        c.setFillColor(tc)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(px + pw/2, y_plan + 19*mm, name)

        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(px + pw/2, y_plan + 13*mm, price)

        mc = HexColor('#bbdefb') if is_popular else MUTED
        c.setFillColor(mc)
        c.setFont("Helvetica", 7)
        c.drawCentredString(px + pw/2, y_plan + 8*mm, "Ate " + limit)
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(px + pw/2, y_plan + 3*mm, desc)

    # ── TECNOLOGIA (barra) ──
    y_tech = y_plan - 18*mm
    rounded_rect(c, 25*mm, y_tech - 2*mm, W - 50*mm, 10*mm, 3*mm, fill_color=HexColor('#e8f0fe'))
    c.setFillColor(PRIMARY_DARK)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(30*mm, y_tech + 2*mm, "Stack:")
    c.setFillColor(TEXT)
    c.setFont("Helvetica", 7)
    c.drawString(44*mm, y_tech + 2*mm, "Supabase (PostgreSQL + Auth + RLS)  |  Vercel (CDN)  |  JavaScript SPA  |  Google OAuth 2.0")

    # ── FOOTER ──
    c.setFillColor(DARK)
    c.rect(0, 0, W, 16*mm, fill=True, stroke=False)
    c.setFillColor(ACCENT)
    c.rect(0, 16*mm, W, 1.5*mm, fill=True, stroke=False)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(W/2, 9*mm, "Comece gratis em gestescolar.com.br")
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor('#aaaaaa'))
    c.drawCentredString(W/2, 4*mm, "contato: valdir.rng@gmail.com  |  Marco 2026  |  Todos os direitos reservados")

    c.save()
    print("PDF comercial gerado: docs/GestEscolar-Comercial.pdf")

draw_pdf()
