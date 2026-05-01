// =============================================
//  GESTESCOLAR – Feriados Nacionais Brasileiros
//  Calculados automaticamente (fixos + móveis)
// =============================================

const FeriadosNacionais = {

  // Cálculo da Páscoa pelo algoritmo de Meeus/Jones/Butcher
  pascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const L = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * L) / 451);
    const mes = Math.floor((h + L - 7 * m + 114) / 31);
    const dia = ((h + L - 7 * m + 114) % 31) + 1;
    return new Date(ano, mes - 1, dia);
  },

  // Soma N dias a uma data
  _addDias(data, n) {
    const d = new Date(data);
    d.setDate(d.getDate() + n);
    return d;
  },

  // Formata data como YYYY-MM-DD (local timezone)
  _fmt(d) {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  // Retorna lista de feriados nacionais para um ano específico
  doAno(ano) {
    const pascoa        = this.pascoa(ano);
    const carnavalSeg   = this._addDias(pascoa, -48);
    const carnavalTer   = this._addDias(pascoa, -47);
    const sextaSanta    = this._addDias(pascoa, -2);
    const corpusChristi = this._addDias(pascoa, 60);

    return [
      { data: `${ano}-01-01`,                 descricao: 'Confraternização Universal',   tipo: 'NACIONAL' },
      { data: this._fmt(carnavalSeg),          descricao: 'Carnaval (segunda)',           tipo: 'NACIONAL' },
      { data: this._fmt(carnavalTer),          descricao: 'Carnaval (terça)',             tipo: 'NACIONAL' },
      { data: this._fmt(sextaSanta),           descricao: 'Sexta-feira Santa',            tipo: 'NACIONAL' },
      { data: this._fmt(pascoa),               descricao: 'Páscoa',                       tipo: 'NACIONAL' },
      { data: `${ano}-04-21`,                 descricao: 'Tiradentes',                   tipo: 'NACIONAL' },
      { data: `${ano}-05-01`,                 descricao: 'Dia do Trabalho',              tipo: 'NACIONAL' },
      { data: this._fmt(corpusChristi),        descricao: 'Corpus Christi',               tipo: 'NACIONAL' },
      { data: `${ano}-09-07`,                 descricao: 'Independência do Brasil',      tipo: 'NACIONAL' },
      { data: `${ano}-10-12`,                 descricao: 'Nossa Senhora Aparecida',      tipo: 'NACIONAL' },
      { data: `${ano}-11-02`,                 descricao: 'Finados',                      tipo: 'NACIONAL' },
      { data: `${ano}-11-15`,                 descricao: 'Proclamação da República',     tipo: 'NACIONAL' },
      { data: `${ano}-11-20`,                 descricao: 'Consciência Negra',            tipo: 'NACIONAL' },
      { data: `${ano}-12-25`,                 descricao: 'Natal',                        tipo: 'NACIONAL' },
    ];
  },

  // Retorna feriados de um intervalo de datas (cruzando vários anos se preciso)
  doIntervalo(dataInicio, dataFim) {
    const ai = new Date(dataInicio).getFullYear();
    const af = new Date(dataFim).getFullYear();
    const lista = [];
    for (let ano = ai; ano <= af; ano++) {
      lista.push(...this.doAno(ano));
    }
    return lista.filter(f => f.data >= this._fmt(new Date(dataInicio)) && f.data <= this._fmt(new Date(dataFim)));
  },

  // Verifica se uma data específica é feriado nacional
  ehFeriado(data) {
    const d   = new Date(data);
    const ymd = this._fmt(d);
    return this.doAno(d.getFullYear()).some(f => f.data === ymd);
  },
};

window.FeriadosNacionais = FeriadosNacionais;
