// =============================================
//  GESTESCOLAR – Utilitários de Jornada
//  Cálculos de horas, validação de período, dias úteis
// =============================================

const JornadaUtils = {

  // Converte 'HH:MM' ou 'HH:MM:SS' para minutos desde 00:00
  _horaParaMinutos(hora) {
    if (!hora) return null;
    const [h, m] = String(hora).split(':').map(n => parseInt(n, 10));
    return (h * 60) + (m || 0);
  },

  // Mapeia dia da semana JS (0=Dom..6=Sáb) → coluna da jornada
  _diaSemColuna(date) {
    const dias = ['dom','seg','ter','qua','qui','sex','sab'];
    return `trabalha_${dias[date.getDay()]}`;
  },

  // Verifica se professor trabalha em determinado dia da semana
  trabalhaNoDia(jornada, date) {
    if (!jornada) return false;
    return !!jornada[this._diaSemColuna(date)];
  },

  // Calcula horas/dia esperadas baseado nos períodos cadastrados
  // Retorna minutos
  minutosDiariosEsperados(jornada) {
    if (!jornada) return 0;
    const p1e = this._horaParaMinutos(jornada.periodo1_entrada);
    const p1s = this._horaParaMinutos(jornada.periodo1_saida);
    let total = (p1s - p1e);

    if (jornada.periodo2_entrada && jornada.periodo2_saida) {
      const p2e = this._horaParaMinutos(jornada.periodo2_entrada);
      const p2s = this._horaParaMinutos(jornada.periodo2_saida);
      total += (p2s - p2e);
    }

    // Desconta intervalo (quando há)
    total -= (jornada.intervalo_minutos || 0);
    return Math.max(0, total);
  },

  // Verifica se uma batida está dentro de algum período cadastrado (com tolerância)
  // hora: 'HH:MM' ou 'HH:MM:SS'  |  tipo: 'ENTRADA','SAIDA','INTERVALO_INICIO','INTERVALO_FIM'
  // Retorna { dentro: bool, periodo: 1|2|null, motivo: string }
  validarHorario(jornada, hora, tipo) {
    if (!jornada) return { dentro: false, periodo: null, motivo: 'Sem jornada cadastrada' };

    const tol = jornada.tolerancia_minutos || 15;
    const m   = this._horaParaMinutos(hora);
    const p1e = this._horaParaMinutos(jornada.periodo1_entrada);
    const p1s = this._horaParaMinutos(jornada.periodo1_saida);
    const p2e = jornada.periodo2_entrada ? this._horaParaMinutos(jornada.periodo2_entrada) : null;
    const p2s = jornada.periodo2_saida   ? this._horaParaMinutos(jornada.periodo2_saida)   : null;

    // Intervalo geral aceito = do menor entrada até a maior saída ± tolerância
    const inicio = (p1e - tol);
    const fim    = ((p2s !== null ? p2s : p1s) + tol);

    if (m < inicio || m > fim) {
      return { dentro: false, periodo: null, motivo: 'FUNCIONÁRIO FORA DO PERÍODO CADASTRADO' };
    }

    // Determina qual período pertence
    let periodo = 1;
    if (p2e !== null && m >= p2e - tol) periodo = 2;
    return { dentro: true, periodo, motivo: '' };
  },

  // Formata jornada para exibição compacta
  // Ex: "Seg-Sex • 07:30-12:30 + 13:30-17:30 • 44h/sem"
  formatarResumo(jornada) {
    if (!jornada) return 'Sem jornada cadastrada';
    const dias = [];
    const map = { seg:'Seg', ter:'Ter', qua:'Qua', qui:'Qui', sex:'Sex', sab:'Sáb', dom:'Dom' };
    for (const k of Object.keys(map)) {
      if (jornada[`trabalha_${k}`]) dias.push(map[k]);
    }
    const diasStr = dias.join(', ') || '—';

    const fmt = h => h ? String(h).slice(0, 5) : '';
    let periodos = `${fmt(jornada.periodo1_entrada)}-${fmt(jornada.periodo1_saida)}`;
    if (jornada.periodo2_entrada) {
      periodos += ` + ${fmt(jornada.periodo2_entrada)}-${fmt(jornada.periodo2_saida)}`;
    }

    const carga = parseFloat(jornada.carga_horaria_semanal || 0).toFixed(0);
    return `${diasStr} • ${periodos} • ${carga}h/sem`;
  },

  // Formata minutos como "Xh YYmin"
  formatarMinutos(min) {
    if (min == null || isNaN(min)) return '—';
    const sinal = min < 0 ? '-' : '';
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sinal}${h}h ${String(m).padStart(2, '0')}min`;
  },

  // Busca jornada de um professor (cache local + API)
  async buscarJornada(userId) {
    JornadaUtils._cache = JornadaUtils._cache || {};
    if (JornadaUtils._cache[userId]) return JornadaUtils._cache[userId];

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const resp = await fetch(`/api/jornadas?user_id=${userId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await resp.json();
      if (!resp.ok) return null;
      JornadaUtils._cache[userId] = json.data;
      return json.data;
    } catch (e) {
      console.error('[Jornada] Erro ao buscar:', e);
      return null;
    }
  },

  // Lista todas as jornadas da escola (gestor)
  async listarJornadas() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const resp = await fetch('/api/jornadas', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await resp.json();
      if (!resp.ok) return [];
      return json.data || [];
    } catch (e) {
      console.error('[Jornada] Erro ao listar:', e);
      return [];
    }
  },

  // Limpa cache (chamar após salvar/deletar jornada)
  limparCache() { JornadaUtils._cache = {}; },
};

window.JornadaUtils = JornadaUtils;
