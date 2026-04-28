// =============================================
//  GESTESCOLAR – TICKETS DO USUARIO (Lista + Criar)
//  Qualquer usuario autenticado pode abrir e acompanhar
//  seus chamados de suporte interno.
// =============================================

const UserTickets = {

  CATEGORIAS: [
    { value: 'gestao',      label: 'Gestao'      },
    { value: 'financeiro',  label: 'Financeiro'  },
    { value: 'pedagogico',  label: 'Pedagogico'  },
    { value: 'sistemas',    label: 'Sistemas'    },
  ],

  STATUS_META: {
    aberto:        { color: '#F44336', icon: 'fa-circle-exclamation', label: 'Aberto'       },
    em_andamento:  { color: '#FF9800', icon: 'fa-rotate',             label: 'Em andamento' },
    resolvido:     { color: '#4CAF50', icon: 'fa-circle-check',       label: 'Resolvido'    },
    fechado:       { color: '#9E9E9E', icon: 'fa-lock',               label: 'Fechado'      },
  },

  CATEGORIA_LABEL(v) {
    return (this.CATEGORIAS.find(c => c.value === v) || {}).label || v;
  },

  // Buffer de imagem selecionada (antes do submit)
  _pendingImage: null,
  _filterStatus: 'todos',

  // -------- LISTAGEM --------
  render() {
    const user = Auth.require();
    if (!user) return;

    const tickets = DB.getTickets()
      .filter(t => t.userId === user.id)
      .sort((a, b) => new Date(b.criadoEm || b.createdAt) - new Date(a.criadoEm || a.createdAt));

    const filtered = this._filterStatus === 'todos'
      ? tickets
      : tickets.filter(t => t.status === this._filterStatus);

    const counts = {
      todos:        tickets.length,
      aberto:       tickets.filter(t => t.status === 'aberto').length,
      em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
      resolvido:    tickets.filter(t => t.status === 'resolvido').length,
      fechado:      tickets.filter(t => t.status === 'fechado').length,
    };

    Router.renderLayout(user, 'user-tickets', `
      <div style="max-width:1100px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
          <h2 style="margin:0;">
            <i class="fa-solid fa-headset" style="color:var(--primary);"></i>
            Meus Chamados
          </h2>
          <button class="btn btn-primary" onclick="UserTickets.openCreateModal()">
            <i class="fa-solid fa-plus"></i> Abrir Novo Chamado
          </button>
        </div>

        <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px;">
          Reporte aqui qualquer problema ou duvida. Nossa equipe de suporte respondera em ate 24h uteis.
        </p>

        <!-- Painel de Estatísticas em Tempo Real -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
          ${[
            { key:'aberto',       color:'#F44336', icon:'fa-circle-exclamation',   label:'Abertos'      },
            { key:'em_andamento', color:'#FF9800', icon:'fa-rotate',               label:'Em andamento' },
            { key:'resolvido',    color:'#4CAF50', icon:'fa-circle-check',         label:'Resolvidos'   },
            { key:'fechado',      color:'#9E9E9E', icon:'fa-lock',                 label:'Fechados'     },
          ].map(k => `
            <div class="card" style="padding:14px;border-left:4px solid ${k.color};cursor:pointer;transition:all .2s;"
              onclick="UserTickets.setFilter('${k.key}')"
              onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'"
              onmouseout="this.style.boxShadow='none'">
              <div style="display:flex;align-items:center;gap:10px;">
                <i class="fa-solid ${k.icon}" style="color:${k.color};font-size:22px;"></i>
                <div>
                  <div style="font-size:22px;font-weight:800;line-height:1;" id="count-${k.key}">${counts[k.key] || 0}</div>
                  <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">${k.label}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Filtros por status -->
        <div class="card" style="margin-bottom:16px;padding:8px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['todos','aberto','em_andamento','resolvido','fechado'].map(s => {
              const meta  = this.STATUS_META[s] || { color:'#666', label:'Todos' };
              const label = s === 'todos' ? 'Todos' : meta.label;
              const isAtivo = this._filterStatus === s;
              return `<button onclick="UserTickets.setFilter('${s}')"
                class="btn btn-sm ${isAtivo ? 'btn-primary' : 'btn-outline'}"
                style="${isAtivo ? '' : `border-color:${meta.color === '#666' ? 'var(--border)' : meta.color};color:${meta.color === '#666' ? 'var(--text)' : meta.color};`}">
                ${label} <span style="opacity:.7;">(${counts[s] || 0})</span>
              </button>`;
            }).join('')}
          </div>
        </div>

        <!-- Tabela de tickets -->
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Categoria</th>
                  <th>Descricao</th>
                  <th>Aberto em</th>
                  <th>Status</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">
                    <i class="fa-solid fa-inbox" style="font-size:32px;display:block;margin-bottom:8px;opacity:.4;"></i>
                    Nenhum chamado ${this._filterStatus !== 'todos' ? 'com este status' : 'aberto ainda'}.
                  </td></tr>
                ` : filtered.map(t => {
                  const meta = this.STATUS_META[t.status] || this.STATUS_META.aberto;
                  const user = Auth.current();
                  // Nao lido = usuario atual NAO esta na lista readBy
                  // (independente de hasUnreadComments — cada usuario tem seu proprio status)
                  const isReadByCurrentUser = Array.isArray(t.readBy) && t.readBy.includes(user?.id);
                  const isUnread = !isReadByCurrentUser;
                  const fontWeight = isUnread ? '700' : '500';
                  return `<tr style="opacity: ${isUnread ? '1' : '0.9'};">
                    <td style="font-family:monospace;font-weight:${fontWeight};position:relative;">
                      ${isUnread ? '<span style="display:inline-block;width:8px;height:8px;background:#F44336;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>' : ''}
                      ${Utils.escape(t.ticketNumber || '--')}
                    </td>
                    <td style="font-weight:${fontWeight};">${Utils.escape(this.CATEGORIA_LABEL(t.categoria))}</td>
                    <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${fontWeight};">
                      ${Utils.escape((t.descricao || '').substring(0, 80))}${(t.descricao || '').length > 80 ? '...' : ''}
                    </td>
                    <td style="font-size:12px;font-weight:${fontWeight};">${Utils.date(t.criadoEm || t.createdAt)}</td>
                    <td>
                      <span style="background:${meta.color};color:#fff;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                        <i class="fa-solid ${meta.icon}"></i> ${meta.label}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="UserTickets.openDetail('${t.id}')">
                        <i class="fa-solid fa-eye"></i> Ver
                      </button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  },

  setFilter(s) { this._filterStatus = s; this.render(); },

  // Atualiza contadores em tempo real
  updateCounters() {
    const user = Auth.require();
    if (!user) return;

    const tickets = DB.getTickets()
      .filter(t => t.userId === user.id);

    const counts = {
      aberto:       tickets.filter(t => t.status === 'aberto').length,
      em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
      resolvido:    tickets.filter(t => t.status === 'resolvido').length,
      fechado:      tickets.filter(t => t.status === 'fechado').length,
    };

    // Atualiza os elementos DOM
    ['aberto','em_andamento','resolvido','fechado'].forEach(status => {
      const el = document.getElementById(`count-${status}`);
      if (el) el.textContent = counts[status] || 0;
    });
  },

  // -------- MODAL DE CRIACAO --------
  openCreateModal() {
    this._pendingImage = null;
    Utils.modal('Abrir Novo Chamado', `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="form-group">
          <label class="form-label">Categoria <span style="color:var(--danger);">*</span></label>
          <select id="tk-categoria" class="form-control" required>
            <option value="">Selecione a categoria</option>
            ${this.CATEGORIAS.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Descricao do problema <span style="color:var(--danger);">*</span></label>
          <textarea id="tk-descricao" class="form-control" rows="5" maxlength="2000"
            placeholder="Descreva detalhadamente o que esta acontecendo..." required></textarea>
          <small style="color:var(--text-muted);font-size:11px;">Minimo 10 caracteres. Maximo 2000.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Anexar imagem (opcional)</label>
          <input type="file" id="tk-imagem" accept="image/png,image/jpeg,image/webp"
            onchange="UserTickets._onImageSelected(this)" class="form-control" />
          <small style="color:var(--text-muted);font-size:11px;">PNG, JPG ou WEBP. Maximo 5MB.</small>
          <div id="tk-imagem-preview" style="margin-top:8px;"></div>
        </div>
      </div>
    `,
    `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
     <button class="btn btn-primary" id="tk-submit-btn" onclick="UserTickets.submitTicket()">
       <i class="fa-solid fa-paper-plane"></i> Enviar Chamado
     </button>`);
  },

  _onImageSelected(input) {
    const file = input.files?.[0];
    const preview = document.getElementById('tk-imagem-preview');
    if (!file) { this._pendingImage = null; if (preview) preview.innerHTML = ''; return; }
    if (file.size > 5 * 1024 * 1024) {
      Utils.toast('Imagem muito grande. Maximo 5MB.', 'error');
      input.value = ''; return;
    }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      Utils.toast('Formato invalido. Use PNG, JPG ou WEBP.', 'error');
      input.value = ''; return;
    }
    this._pendingImage = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (preview) preview.innerHTML = `
        <img src="${e.target.result}" alt="preview" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid var(--border);" />
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
          ${Utils.escape(file.name)} (${(file.size / 1024).toFixed(0)} KB)
        </div>`;
    };
    reader.readAsDataURL(file);
  },

  async submitTicket() {
    const categoria = document.getElementById('tk-categoria')?.value;
    const descricao = (document.getElementById('tk-descricao')?.value || '').trim();
    if (!categoria)            { Utils.toast('Selecione uma categoria.', 'error'); return; }
    if (descricao.length < 10) { Utils.toast('Descreva o problema com pelo menos 10 caracteres.', 'error'); return; }
    if (descricao.length > 2000){ Utils.toast('Descricao muito longa (max 2000).', 'error'); return; }

    const btn = document.getElementById('tk-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }

    try {
      let imagemUrl = null;
      if (this._pendingImage) {
        imagemUrl = await this._uploadImage(this._pendingImage);
      }
      const ticket = await DB.addTicket({
        categoria,
        descricao,
        imagemUrl,
      });

      document.querySelector('.modal-overlay')?.remove();
      Utils.toast(`Chamado ${ticket.ticketNumber} aberto com sucesso!`, 'success');
      this.updateCounters();
      this.render();
    } catch (err) {
      console.error('[UserTickets] Erro ao criar:', err);
      Utils.toast('Erro ao abrir chamado: ' + (err.message || 'tente novamente'), 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Chamado'; }
    }
  },

  // Upload de imagem para Supabase Storage (bucket "ticket-attachments")
  // Se o bucket nao existir, salva como data URL no proprio registro (fallback dev)
  async _uploadImage(file) {
    const sess = Auth.current();
    const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${sess?.schoolId || 'public'}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    if (typeof supabaseClient !== 'undefined' && supabaseClient?.storage) {
      try {
        const { data, error } = await supabaseClient.storage
          .from('ticket-attachments')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (!error && data?.path) {
          const { data: pub } = supabaseClient.storage
            .from('ticket-attachments')
            .getPublicUrl(data.path);
          return pub?.publicUrl || data.path;
        }
        console.warn('[UserTickets] Upload Supabase falhou, usando fallback:', error?.message);
      } catch (e) {
        console.warn('[UserTickets] Upload erro:', e);
      }
    }

    // Fallback: data URL
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  },

  // -------- DETALHE DO TICKET --------
  openDetail(ticketId) {
    Router.go('user-ticket-detail', { ticketId });
  },
};

window.UserTickets = UserTickets;

// Rota: lista
Router.register('user-tickets', () => {
  const user = Auth.require();
  if (!user) return;
  UserTickets.render();

  // Realtime: atualiza lista quando tickets ou comentários mudam
  Realtime.subscribe('tickets', `user_id=eq.${user.id}`, () => {
    UserTickets.render();
  });
  Realtime.subscribe('ticket_comments', null, () => {
    // Rebusca dados e atualiza contadores sem re-render completo
    UserTickets.render();
  });
});

// Rota: detalhe
Router.register('user-ticket-detail', async (params) => {
  const user = Auth.require();
  if (!user) return;
  const id = params?.ticketId;
  let ticket = id ? DB.getTicketById(id) : null;
  if (!ticket) {
    Utils.toast('Chamado nao encontrado.', 'error');
    Router.go('user-tickets');
    return;
  }
  // Apenas o dono ou superadmin pode ver
  if (ticket.userId !== user.id && user.role !== 'superadmin') {
    Utils.toast('Voce nao tem permissao para ver este chamado.', 'error');
    Router.go('user-tickets');
    return;
  }

  // Marca como lido APENAS se o usuario NAO eh o dono do ticket
  // (evita que superadmin marque seu próprio ticket como lido ao responder)
  if (ticket.userId !== user.id) {
    await DB.markTicketAsRead(id);
    ticket = DB.getTicketById(id); // rebusca para pegar hasUnreadComments:false atualizado
  }

  // Atualiza badge do sidebar imediatamente
  Router._updateTicketBadge(user);

  const meta = UserTickets.STATUS_META[ticket.status] || UserTickets.STATUS_META.aberto;
  const comments = DB.getTicketComments(ticket.id);
  const isClosed = ticket.status === 'fechado';

  // Realtime: atualiza a conversa quando chega nova mensagem
  Realtime.subscribe('ticket_comments', `ticket_id=eq.${id}`, () => {
    Router.go('user-ticket-detail', { ticketId: id });
  });
  Realtime.subscribe('tickets', `id=eq.${id}`, () => {
    Router.go('user-ticket-detail', { ticketId: id });
  });

  Router.renderLayout(user, 'user-tickets', `
    <div style="max-width:900px;margin:0 auto;">
      <div style="margin-bottom:12px;">
        <button class="btn btn-sm btn-outline" onclick="Router.go('user-tickets')">
          <i class="fa-solid fa-arrow-left"></i> Voltar para meus chamados
        </button>
      </div>

      <!-- Cabecalho -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid ${meta.color};">
        <div style="padding:18px 20px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-family:monospace;font-size:13px;color:var(--text-muted);">${Utils.escape(ticket.ticketNumber || '')}</div>
              <h2 style="margin:4px 0 6px;font-size:20px;">
                <i class="fa-solid fa-tag" style="color:var(--primary);"></i>
                ${Utils.escape(UserTickets.CATEGORIA_LABEL(ticket.categoria))}
              </h2>
              <div style="font-size:12px;color:var(--text-muted);">
                Aberto em ${Utils.date(ticket.criadoEm || ticket.createdAt)}
                ${ticket.atualizadoEm && ticket.atualizadoEm !== (ticket.criadoEm || ticket.createdAt)
                  ? ` &middot; Atualizado em ${Utils.date(ticket.atualizadoEm)}` : ''}
              </div>
            </div>
            <span style="background:${meta.color};color:#fff;padding:6px 14px;border-radius:14px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
              <i class="fa-solid ${meta.icon}"></i> ${meta.label}
            </span>
          </div>
        </div>
      </div>

      <!-- Descricao + imagem -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><span class="card-title">Descricao do problema</span></div>
        <div style="padding:16px 20px;">
          <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 14px;">${Utils.escape(ticket.descricao || '')}</p>
          ${ticket.imagemUrl ? `
            <a href="${Utils.escape(ticket.imagemUrl)}" target="_blank" rel="noopener" style="display:inline-block;">
              <img src="${Utils.escape(ticket.imagemUrl)}" alt="Anexo" style="max-width:100%;max-height:340px;border-radius:8px;border:1px solid var(--border);" />
            </a>
          ` : ''}
        </div>
      </div>

      <!-- Comentarios -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-comments"></i> Conversa (${comments.length})</span>
        </div>
        <div style="padding:14px 20px;display:flex;flex-direction:column;gap:12px;">
          ${comments.length === 0 ? `
            <div style="color:var(--text-muted);font-size:13px;text-align:center;padding:14px;">
              Ainda nao ha mensagens neste chamado.
            </div>
          ` : comments.map(c => {
            const isMe = c.userId === user.id;
            const isAdmin = c.userRole === 'superadmin';
            const bg   = isAdmin ? '#E3F2FD' : (isMe ? '#F1F8E9' : '#fafafa');
            const side = isMe ? 'flex-end' : 'flex-start';
            return `<div style="align-self:${side};max-width:85%;background:${bg};border-radius:8px;padding:10px 14px;border:1px solid var(--border);">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">
                <strong>${Utils.escape(c.userName || 'Usuario')}</strong>
                ${isAdmin ? '<span style="background:#1976D2;color:#fff;padding:1px 6px;border-radius:6px;font-size:10px;margin-left:4px;">SUPORTE</span>' : ''}
                <span style="margin-left:6px;">${Utils.datetime ? Utils.datetime(c.criadoEm || c.createdAt) : Utils.date(c.criadoEm || c.createdAt)}</span>
              </div>
              <div style="white-space:pre-wrap;font-size:14px;">${Utils.escape(c.mensagem || '')}</div>
            </div>`;
          }).join('')}
        </div>
        ${isClosed ? `
          <div style="padding:14px 20px;border-top:1px solid var(--border);background:#f5f5f5;font-size:12px;color:var(--text-muted);">
            <i class="fa-solid fa-lock"></i> Este chamado foi fechado. Para uma nova solicitacao, abra um novo chamado.
          </div>
        ` : `
          <div style="padding:14px 20px;border-top:1px solid var(--border);">
            <textarea id="tk-comment-text" class="form-control" rows="3" maxlength="1500"
              placeholder="Escreva uma resposta ou complemento..."></textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <label style="flex:1;display:flex;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:var(--radius);padding:8px;cursor:pointer;background:#fafafa;">
                <i class="fa-solid fa-image" style="margin-right:6px;color:var(--primary);"></i>
                <span style="font-size:12px;color:var(--text-muted);">Adicionar imagem</span>
                <input type="file" id="tk-comment-image" accept="image/*" style="display:none;"
                  onchange="UserTickets._onCommentImageSelected(this)" />
              </label>
              <button class="btn btn-primary btn-sm" onclick="UserTickets.sendComment('${ticket.id}')">
                <i class="fa-solid fa-paper-plane"></i> Enviar
              </button>
            </div>
            <div id="tk-comment-image-preview" style="margin-top:8px;"></div>
          </div>
        `}
      </div>
    </div>
  `);
});

UserTickets._commentPendingImage = null;

UserTickets._onCommentImageSelected = function(input) {
  const file = input.files?.[0];
  const preview = document.getElementById('tk-comment-image-preview');
  if (!file) { this._commentPendingImage = null; if (preview) preview.innerHTML = ''; return; }
  if (file.size > 5 * 1024 * 1024) {
    Utils.toast('Imagem muito grande. Máximo 5MB.', 'error');
    input.value = ''; return;
  }
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
    Utils.toast('Formato inválido. Use PNG, JPG ou WEBP.', 'error');
    input.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    this._commentPendingImage = e.target.result;
    if (preview) preview.innerHTML = `<img src="${e.target.result}" style="max-height:120px;border-radius:var(--radius);" />`;
  };
  reader.readAsDataURL(file);
};

UserTickets.sendComment = async function(ticketId) {
  const txt = (document.getElementById('tk-comment-text')?.value || '').trim();
  if (txt.length < 2) { Utils.toast('Escreva uma mensagem.', 'error'); return; }
  if (txt.length > 1500) { Utils.toast('Mensagem muito longa.', 'error'); return; }
  try {
    let imagemUrl = null;
    if (UserTickets._commentPendingImage) {
      imagemUrl = await UserTickets._uploadImage(UserTickets._commentPendingImage);
    }
    await DB.addTicketComment({ ticketId, mensagem: txt, imagemUrl });
    // Se o ticket estava resolvido e o usuario respondeu, reabre como em_andamento
    const t = DB.getTicketById(ticketId);
    if (t && t.status === 'resolvido') {
      await DB.updateTicket(ticketId, { status: 'em_andamento' });
    }
    Utils.toast('Mensagem enviada!', 'success');
    UserTickets.updateCounters();
    Router.go('user-ticket-detail', { ticketId });
  } catch (err) {
    console.error('[UserTickets] erro sendComment:', err);
    Utils.toast('Erro ao enviar mensagem.', 'error');
  }
};
