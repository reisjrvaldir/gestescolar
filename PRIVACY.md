# Política de Privacidade - GestEscolar SaaS

> **Versão pública**: A versão completa e atualizada está disponível em `/privacy` na aplicação.
>
> Este documento é a referência técnica para desenvolvedores e auditores.

## Conformidade LGPD

Esta política atende aos requisitos da **Lei Geral de Proteção de Dados** (Lei 13.709/2018).

## Encarregado de Proteção de Dados (DPO)

Em conformidade com **Art. 41 da LGPD**:

- **Nome**: A definir (deve ser uma pessoa física ou pessoa jurídica)
- **E-mail**: `dpo@gestescolar.com`
- **Prazo de resposta a titulares**: até 15 dias úteis
- **Atribuições**:
  - Receber comunicações da ANPD
  - Receber reclamações de titulares de dados
  - Orientar funcionários sobre práticas de proteção de dados
  - Executar demais atribuições determinadas pelo controlador

## Bases Legais de Tratamento

| Dado | Base Legal LGPD |
|------|-----------------|
| Dados de gestores | Art. 7º, V - Execução de contrato |
| Dados de alunos menores | Art. 14 - Melhor interesse + consentimento responsável |
| Dados de pagamento | Art. 7º, V + Art. 7º, II - Obrigação legal (fiscal) |
| Logs de acesso | Art. 7º, VI - Exercício regular de direitos |
| E-mails de notificação | Art. 7º, V - Execução de contrato |

## Compartilhamento com Terceiros (Operadores)

Todos os operadores listados possuem contratos com cláusulas de proteção de dados:

- **Supabase** (PostgreSQL/Auth): https://supabase.com/privacy
- **Asaas** (Pagamentos): https://www.asaas.com/politica-de-privacidade
- **Resend** (E-mail): https://resend.com/legal/privacy-policy
- **Vercel** (Hospedagem): https://vercel.com/legal/privacy-policy

## Direitos do Titular (Art. 18 LGPD)

Implementação técnica:

| Direito | Como exercer no sistema |
|---------|------------------------|
| Confirmação e acesso | Endpoint `POST /api/export-my-data` |
| Correção | Edição direta no perfil |
| Portabilidade | Exportação JSON via API |
| Eliminação | Botão "Excluir conta" (Soft delete + anonimização em 30 dias) |
| Revogação de consentimento | Via perfil de usuário |
| Informação sobre compartilhamento | Esta política |

## Retenção de Dados

| Tipo | Período |
|------|---------|
| Conta ativa | Enquanto cliente |
| Dados acadêmicos (após cancelamento) | Anonimização em 30 dias |
| Dados fiscais (faturas, NFs) | 5 anos (Lei 5.172/66 - CTN) |
| Logs de auditoria | 12 meses |
| Logs de webhook (audit_log) | 90 dias |

## Notificação de Incidentes (Art. 48 LGPD)

Ver `INCIDENT_RESPONSE.md`.

## Atualizações desta política

- Alterações significativas → comunicação por e-mail aos titulares
- Versão sempre publicada em `/privacy` com data de atualização
- Histórico de versões mantido neste repositório (git log)
