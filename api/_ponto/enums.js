// ─── ENUMS ────────────────────────────────────────────────────────────────────

const TipoPonto = Object.freeze({
  ENTRADA:         'ENTRADA',
  SAIDA:           'SAIDA',
  INTERVALO_INICIO:'INTERVALO_INICIO',
  INTERVALO_FIM:   'INTERVALO_FIM',
});

const StatusPonto = Object.freeze({
  AUTO_VALIDADO: 'AUTO_VALIDADO',
  PENDENTE:      'PENDENTE',
  APROVADO:      'APROVADO',
  REJEITADO:     'REJEITADO',
});

const StatusAjuste = Object.freeze({
  PENDENTE:  'PENDENTE',
  APROVADO:  'APROVADO',
  REJEITADO: 'REJEITADO',
});

const AcaoGestor = Object.freeze({
  APROVAR:  'APROVAR',
  REJEITAR: 'REJEITAR',
});

module.exports = { TipoPonto, StatusPonto, StatusAjuste, AcaoGestor };
