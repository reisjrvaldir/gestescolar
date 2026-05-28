# Plano de Resposta a Incidentes de Segurança

> **Conformidade**: Art. 48 da LGPD (Lei 13.709/2018) - Comunicação de incidentes
>
> **Prazo legal**: Notificação à ANPD e aos titulares afetados em **até 72 horas**.

## 1. Classificação de Incidentes

### CRÍTICO (P0) - Notificar em <2h
- Vazamento de dados pessoais (qualquer volume)
- Acesso não autorizado a conta de gestor
- Comprometimento de credenciais administrativas (Supabase service key)
- Ransomware ou criptografia maliciosa
- Indisponibilidade total >30min

### ALTO (P1) - Notificar em <24h
- Tentativa de acesso não autorizado (bloqueada)
- Exploração de vulnerabilidade técnica
- Falha em controles de RLS (multi-tenancy)
- Vazamento de dados de pagamento

### MÉDIO (P2) - Notificar em <72h
- Bug que expõe dados além do escopo da conta
- Falha de webhook de pagamento causando inconsistência
- Logs de acesso anormal (brute force, scrapers)

### BAIXO (P3) - Documentar
- Spam ou abuso de conta isolada
- Erros de aplicação sem exposição de dados

## 2. Fluxo de Resposta

```
DETECÇÃO → CONTENÇÃO → AVALIAÇÃO → NOTIFICAÇÃO → ERRADICAÇÃO → RECUPERAÇÃO → LIÇÕES
```

### 2.1 Detecção
**Quem detecta:**
- Monitoramento automático (Sentry, logs Vercel)
- Usuário (suporte ou DPO)
- Pesquisador externo (bug bounty)
- Notificação de terceiros (Asaas, Supabase)

**Ações imediatas:**
1. Registrar timestamp e descrição inicial
2. Notificar DPO via `dpo@gestescolar.com`
3. Abrir issue privado no repositório

### 2.2 Contenção (primeiras 2h)
- [ ] Isolar sistema afetado (rotação de keys, revogação de tokens)
- [ ] Bloquear endpoint vulnerável temporariamente
- [ ] Preservar evidências (logs, snapshots de DB)
- [ ] Evitar destruição de evidências (não deletar logs)

### 2.3 Avaliação (próximas 6h)
**Perguntas a responder:**
- Quais dados foram afetados? (tipos, volume)
- Quantos titulares foram afetados?
- Qual o risco para os titulares? (alto/médio/baixo)
- O incidente ainda está em curso?
- Há indícios de exfiltração de dados?

### 2.4 Notificação (dentro de 72h)

**Para a ANPD:**
- Canal: https://www.gov.br/anpd/pt-br/canais_atendimento
- Formulário oficial de comunicação de incidentes
- Anexar: descrição técnica, dados afetados, medidas adotadas

**Para titulares afetados:**
- E-mail individual com:
  - Natureza do incidente
  - Dados pessoais envolvidos
  - Medidas tomadas
  - Recomendações ao titular
  - Contato do DPO

**Modelo de e-mail:**
```
Assunto: [GestEscolar] Comunicado de incidente de segurança - Ação necessária

Prezado(a) [Nome],

Em [DATA], identificamos um incidente de segurança que pode ter
afetado seus dados pessoais cadastrados no GestEscolar.

Dados potencialmente expostos:
- [Lista de campos: nome, e-mail, etc.]

Medidas adotadas:
- [Ações de contenção]
- [Ações corretivas]

Recomendações:
- [Trocar senha]
- [Monitorar contas]

Em conformidade com a LGPD, notificamos a Autoridade Nacional
de Proteção de Dados (ANPD).

Para dúvidas: dpo@gestescolar.com

Pedimos sinceras desculpas pelo ocorrido.
Equipe GestEscolar
```

### 2.5 Erradicação
- [ ] Corrigir vulnerabilidade root cause
- [ ] Aplicar patches em produção
- [ ] Forçar rotação de credenciais afetadas
- [ ] Atualizar regras de RLS se necessário

### 2.6 Recuperação
- [ ] Restaurar serviço normal
- [ ] Monitoramento intensivo por 7 dias
- [ ] Verificar integridade de backups

### 2.7 Lições Aprendidas
**Em até 7 dias após resolução:**
- Documento `post-mortem` em `docs/incidents/YYYY-MM-DD-codigo.md`
- Atualização desta política (se necessário)
- Treinamento da equipe sobre nova ameaça
- Adicionar testes automatizados para regressão

## 3. Contatos de Emergência

| Função | Contato | Disponibilidade |
|--------|---------|-----------------|
| DPO | dpo@gestescolar.com | Comercial |
| Equipe técnica | (a definir) | 24/7 |
| Suporte Supabase | https://supabase.com/support | 24/7 (planos pagos) |
| Suporte Asaas | atendimento@asaas.com | Comercial |
| ANPD | https://www.gov.br/anpd | Comercial |

## 4. Documentação de Evidências

**Toda comunicação interna deve ser preservada:**
- Logs de aplicação (Vercel)
- Logs de banco (Supabase audit logs)
- Histórico de commits/deploys
- E-mails trocados
- Decisões tomadas (com timestamp e responsável)

**Local de armazenamento:** repositório privado `gestescolar-incidents` (acesso restrito DPO + CTO)

## 5. Treinamento

A equipe deve:
- Conhecer este plano (revisão semestral)
- Saber identificar um incidente
- Saber escalar via DPO
- **NUNCA** prometer ao usuário antes de avaliação completa
- **NUNCA** apagar logs durante investigação

## 6. Revisão deste documento

- Revisão obrigatória: anual
- Revisão extraordinária: após qualquer incidente P0/P1
- Última revisão: data do commit
