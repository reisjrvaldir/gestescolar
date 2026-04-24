// =============================================
//  GESTESCOLAR – SUPABASE REALTIME
//  Atualiza cache local + re-renderiza ao receber
//  eventos do Postgres via WebSocket.
// =============================================

const Realtime = {
  _channels: [],   // canais ativos da página atual
  _enabled: true,  // pode ser desligado globalmente

  // Subscreve uma tabela. Retorna função para cancelar.
  // table: nome da tabela ('invoices', 'messages')
  // filter: ex: 'school_id=eq.<uuid>' (ou null para todos)
  // onChange: callback(payload) — opcional, default re-renderiza a rota atual
  subscribe(table, filter, onChange) {
    if (!this._enabled || !supabaseClient) return () => {};

    const channelName = `rt-${table}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cfg = {
      event: '*',           // INSERT, UPDATE, DELETE
      schema: 'public',
      table,
    };
    if (filter) cfg.filter = filter;

    const channel = supabaseClient
      .channel(channelName)
      .on('postgres_changes', cfg, (payload) => {
        try {
          this._applyToCache(table, payload);
          if (typeof onChange === 'function') {
            onChange(payload);
          } else {
            // Re-render padrão: chama o callback global da rota atual
            const cur = (typeof Router !== 'undefined') ? Router._currentRoute : null;
            if (cur && typeof Router._rerender === 'function') {
              Router._rerender(cur);
            }
          }
        } catch (e) {
          console.error('[Realtime] erro no handler:', e);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] subscrito em ${table}${filter ? ' (' + filter + ')' : ''}`);
        }
      });

    this._channels.push(channel);
    return () => this._unsub(channel);
  },

  _unsub(channel) {
    if (!channel) return;
    try { supabaseClient.removeChannel(channel); } catch (e) {}
    this._channels = this._channels.filter(c => c !== channel);
  },

  // Cancela TODAS as subscrições ativas. Chamado ao trocar de página.
  unsubscribeAll() {
    if (!supabaseClient || !this._channels.length) return;
    this._channels.forEach(c => {
      try { supabaseClient.removeChannel(c); } catch (e) {}
    });
    console.log(`[Realtime] ${this._channels.length} canal(is) cancelado(s)`);
    this._channels = [];
  },

  // Aplica mudança ao cache do DB (mantém UI consistente sem refetch)
  _applyToCache(table, payload) {
    if (typeof DB === 'undefined' || !DB._cache[table]) return;
    const arr = DB._cache[table];
    const event = payload.eventType;
    const newRow = payload.new ? DB._toCamel(payload.new) : null;
    const oldRow = payload.old ? DB._toCamel(payload.old) : null;

    if (event === 'INSERT' && newRow) {
      // Evita duplicar se já existe (ex: quando o próprio cliente inseriu)
      if (!arr.find(r => r.id === newRow.id)) arr.push(newRow);
    } else if (event === 'UPDATE' && newRow) {
      const idx = arr.findIndex(r => r.id === newRow.id);
      if (idx >= 0) arr[idx] = { ...arr[idx], ...newRow };
      else arr.push(newRow);
    } else if (event === 'DELETE' && oldRow) {
      const idx = arr.findIndex(r => r.id === oldRow.id);
      if (idx >= 0) arr.splice(idx, 1);
    }
  },
};
