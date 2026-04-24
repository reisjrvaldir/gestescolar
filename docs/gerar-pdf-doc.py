from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_CENTER, TA_LEFT

W, H = A4
PRIMARY = HexColor('#1976d2')
DARK = HexColor('#212529')
MUTED = HexColor('#6c757d')
BG_LIGHT = HexColor('#f0f6ff')
WHITE = HexColor('#ffffff')
GREEN = HexColor('#28a745')

def draw_pdf():
    c = canvas.Canvas("docs/GestEscolar-Documentacao.pdf", pagesize=A4)

    # ── HEADER ──
    c.setFillColor(PRIMARY)
    c.rect(0, H - 65, W, 65, fill=True, stroke=False)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20*mm, H - 28*mm, "GestEscolar")
    c.setFont("Helvetica", 10)
    c.drawString(20*mm, H - 34*mm, "Plataforma SaaS de Gestao Escolar  |  Documentacao v28  |  Marco 2026")

    # ── SUBTITULO ──
    y = H - 50*mm
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(20*mm, y, "Funcionalidades Implementadas")
    y -= 3*mm
    c.setStrokeColor(PRIMARY)
    c.setLineWidth(1.5)
    c.line(20*mm, y, W - 20*mm, y)
    y -= 8*mm

    # ── MODULOS ──
    modules = [
        ("Autenticacao e Seguranca", [
            "Login com e-mail/senha via Supabase Auth",
            "Login com Google (OAuth 2.0)",
            "Recuperacao de senha por e-mail",
            "Row Level Security (RLS) - isolamento total entre escolas",
            "Sessao segura com validacao server-side",
        ]),
        ("Painel Super Admin", [
            "Dashboard global (total escolas, alunos, professores)",
            "CRUD de escolas (criar, editar, suspender, cancelar)",
            "Limite personalizado de alunos por escola",
            "Gestao de planos e upgrade",
        ]),
        ("Painel Administrativo (Gestor)", [
            "Dashboard com estatisticas da escola",
            "Alerta de limite de plano (80% e 100%)",
            "Cadastro de alunos com matricula automatica",
            "Cadastro automatico de responsaveis (conta pai)",
            "Gestao de turmas, turnos e niveis",
            "Cadastro de equipe (professores, administrativos, financeiro)",
        ]),
        ("Modulo Financeiro", [
            "Boletos/mensalidades por aluno (pendente, pago, vencido)",
            "Contas a pagar (despesas fixas e variaveis, parcelamento)",
            "Transacoes financeiras (credito/debito)",
            "Dashboard financeiro com saldo e graficos",
        ]),
        ("Comunicacao", [
            "Chat interno entre gestores, professores e responsaveis",
            "Mensagens vinculadas ao aluno e turma",
            "Marcacao de leitura",
        ]),
        ("Academico", [
            "Lancamento de notas por disciplina e periodo",
            "Controle de frequencia/chamada diaria",
            "Painel do professor com suas turmas",
            "Portal do responsavel (notas, frequencia, mensagens)",
        ]),
    ]

    c.setFont("Helvetica", 8.2)
    left_x = 20*mm
    col2_x = W/2 + 5*mm
    col_width = W/2 - 25*mm

    # Dividir em 2 colunas: 3 modulos cada
    for col_idx in range(2):
        x = left_x if col_idx == 0 else col2_x
        cy = y if col_idx == 0 else y
        start = col_idx * 3
        end = start + 3

        for mod_name, items in modules[start:end]:
            # Titulo do modulo
            c.setFillColor(PRIMARY)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(x, cy, mod_name)
            cy -= 4.5*mm

            c.setFillColor(DARK)
            c.setFont("Helvetica", 7.5)
            for item in items:
                c.drawString(x + 3*mm, cy, "•  " + item)
                cy -= 3.8*mm
            cy -= 3*mm

    # ── INFRAESTRUTURA ──
    bottom_y = 52*mm
    c.setFillColor(BG_LIGHT)
    c.rect(15*mm, bottom_y - 5*mm, W - 30*mm, 40*mm, fill=True, stroke=False)

    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(20*mm, bottom_y + 28*mm, "Infraestrutura e Tecnologia")

    c.setFillColor(DARK)
    c.setFont("Helvetica", 7.5)
    infra_left = [
        "Frontend: HTML5, CSS3, JavaScript vanilla (SPA)",
        "Backend: Supabase (PostgreSQL + Auth + RLS)",
        "Hospedagem: Vercel (CDN global)",
        "Dominio: gestescolar.com.br",
    ]
    infra_right = [
        "Planos: Free (5), Gestao 100, 250 e Ilimitado",
        "Seguranca: RLS por escola, Auth com OAuth 2.0",
        "Cache-first: leituras instantaneas, sync async",
        "Gateway pagamento: Asaas com split 2% (Fase 3)",
    ]

    iy = bottom_y + 22*mm
    for item in infra_left:
        c.drawString(20*mm, iy, "•  " + item)
        iy -= 4*mm

    iy = bottom_y + 22*mm
    for item in infra_right:
        c.drawString(col2_x, iy, "•  " + item)
        iy -= 4*mm

    # ── PLANOS ──
    plan_y = 30*mm
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(20*mm, plan_y, "Planos disponiveis:")
    c.setFont("Helvetica", 7.5)
    plans_text = "Free (5 alunos, gratis)  |  Gestao 100 (R$ 199,90/mes)  |  Gestao 250 (R$ 399,90/mes)  |  251+ (sob consulta)"
    c.drawString(57*mm, plan_y, plans_text)

    # ── FOOTER ──
    c.setFillColor(PRIMARY)
    c.rect(0, 0, W, 18*mm, fill=True, stroke=False)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(W/2, 10*mm, "GestEscolar  •  gestescolar.com.br  •  SaaS de Gestao Escolar  •  Documento gerado em Marco/2026")
    c.drawCentredString(W/2, 5.5*mm, "Contato: valdir.rng@gmail.com  •  Todos os direitos reservados")

    c.save()
    print("PDF gerado: docs/GestEscolar-Documentacao.pdf")

draw_pdf()
