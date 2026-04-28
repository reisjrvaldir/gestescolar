// =============================================
//  GESTESCOLAR – PAINEL DE TICKETS (SUPER ADMIN)
//  Dashboard, listagem com filtros e gestao completa
//  de chamados de suporte abertos por usuarios.
// =============================================

const SuperTickets = {

  CATEGORIAS: [
    { value: 'gestao',     label: 'Gestao'     },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'pedagogico', label: 'Pedagogico' },
    { value: 'sistemas',   label: 'Sistemas'   },
  ],

  STATUS_FLOW: ['aberto','em_andamento','resolvido','fechado'],

  STATUS_META: {
    aberto:       { color: '#F44336', icon: 'fa-circle-exclamation', label: 'Aberto'       },
    em_andamento: { color: '#FF9800', icon: 'fa-rotate',             label: 'Em andamento' },
    resolvido:    { color: '#4CAF50', icon: 'fa-circle-check',       label: 'Resolvido'    },
    fechado:      { color: '#9E9E9E', icon: 'fa-lock',               label: 'Fechado'      },
  },

  CATEGORIA_LABEL(v) { return (this.CATEGORIAS.find(c => c.value === v) || {}).label || v; },
  STATUS_LABEL(s)    { return (this.STATUS_META[s] || {}).label || s; },

  // Filtros (persistem entre re-renders)
  _filters: {
    status:    'todos',
    categoria: 'todas',
    dateFrom:  '',
    dateTo:    '',
    search:    '',
  },

  // -------- LISTAGEM --------
  render() {
    const user = Auth.require();
    if (!user || user.role !== 'superadmin') {
      Utils.toast('Acesso restrito ao Super Admin.', 'error');
      Router.go('login');
      return;
    }

    const all = (DB.getAllTickets() || []).slice().sort(
      (a, b) => new Date(b.criadoEm || b.createdAt) - new Date(a.criadoEm || a.createdAt)
    );

    // Aplica filtros
    const f = this._filters;
    const filtered = all.filter(t => {
      if (f.status    !== 'todos' && t.status    !== f.status)    return false;
      if (f.categoria !== 'todas' && t.categoria !== f.categoria) return false;
      if (f.dateFrom) {
        const d = (t.criadoEm || t.createdAt || '').slice(0, 10);
        if (d < f.dateFrom) return false;
      }
      if (f.dateTo) {
        const d = (t.criadoEm || t.createdAt || '').slice(0, 10);
        if (d > f.dateTo) return false;
      }
      if (f.search) {
        const q = f.search.toLowerCase();
        const hay = `${t.ticketNumber || ''} ${t.userName || ''} ${t.descricao || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const stats = {
      total:        all.length,
      aberto:       all.filter(t => t.status === 'aberto').length,
      em_andamento: all.filter(t => t.status === 'em_andamento').length,
      resolvido:    all.filter(t => t.status === 'resolvido').length,
      fechado:      all.filter(t => t.status === 'fechado').length,
    };

    // KPI cards
    const kpiHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
        ${[
          { key:'total',        color:'#1976D2', icon:'fa-headset',              label:'Total'        },
          { key:'aberto',       color:'#F44336', icon:'fa-circle-exclamation',   label:'Abertos'      },
          { key:'em_andamento', color:'#FF9800', icon:'fa-rotate',               label:'Em andamento' },
          { key:'resolvido',    color:'#4CAF50', icon:'fa-circle-check',         label:'Resolvidos'   },
          { key:'fechado',      color:'#9E9E9E', icon:'fa-lock',                 label:'Fechados'     },
        ].map(k => `
          <div class="card" style="padding:14px;border-left:4px solid ${k.color};cursor:pointer;transition:all .2s;"
            onclick="SuperTickets._setFilter('status', '${k.key}')"
            onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'"
            onmouseout="this.style.boxShadow='none'">
            <div style="display:flex;align-items:center;gap:10px;">
              <i class="fa-solid ${k.icon}" style="color:${k.color};font-size:22px;"></i>
              <div>
                <div style="font-size:22px;font-weight:800;line-height:1;" id="count-${k.key}">${stats[k.key] || 0}</div>
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">${k.label}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    Router.renderLayout(user, 'superadmin-tickets', `
      <div style="max-width:1300px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">
          <i class="fa-solid fa-headset" style="color:var(--primary);"></i>
          Central de Chamados
        </h2>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:18px;">
          Gerencie todos os tickets abertos por usuarios da plataforma.
        </p>

        ${kpiHTML}

        <!-- Filtros -->
        <div class="card" style="margin-bottom:14px;">
          <div style="padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Status</label>
              <select id="flt-status" class="form-control" onchange="SuperTickets._setFilter('status', this.value)">
                <option value="todos" ${f.status === 'todos' ? 'selected' : ''}>Todos</option>
                ${this.STATUS_FLOW.map(s => `
                  <option value="${s}" ${f.status === s ? 'selected' : ''}>${this.STATUS_META[s].label}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Categoria</label>
              <select id="flt-categoria" class="form-control" onchange="SuperTickets._setFilter('categoria', this.value)">
                <option value="todas" ${f.categoria === 'todas' ? 'selected' : ''}>Todas</option>
                ${this.CATEGORIAS.map(c => `
                  <option value="${c.value}" ${f.categoria === c.value ? 'selected' : ''}>${c.label}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">De</label>
              <input type="date" id="flt-from" class="form-control" value="${f.dateFrom}"
                onchange="SuperTickets._setFilter('dateFrom', this.value)" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Ate</label>
              <input type="date" id="flt-to" class="form-control" value="${f.dateTo}"
                onchange="SuperTickets._setFilter('dateTo', this.value)" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Buscar</label>
              <input type="text" id="flt-search" class="form-control" placeholder="numero, usuario, texto..."
                value="${Utils.escape(f.search)}"
                oninput="SuperTickets._setFilter('search', this.value)" />
            </div>
            <div>
              <button class="btn btn-outline btn-sm" onclick="SuperTickets._clearFilters()" style="width:100%;">
                <i class="fa-solid fa-eraser"></i> Limpar
              </button>
            </div>
          </div>
        </div>

        <!-- Tabela -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">${filtered.length} de ${all.length} chamado(s)</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Escola</th>
                  <th>Usuario</th>
                  <th>Categoria</th>
                  <th>Descricao</th>
                  <th>Aberto em</th>
                  <th>Status</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4;"></i>
                    Nenhum chamado corresponde aos filtros.
                  </td></tr>
                ` : filtered.map(t => {
                  const meta = this.STATUS_META[t.status] || this.STATUS_META.aberto;
                  const sch  = DB.getSchool(t.schoolId);
                  const schName = sch?.name || (t.schoolId ? '(escola removida)' : '--');
                  const user = Auth.current();
                  // Nao lido = usuario atual NAO esta na lista readBy
                  // (cada usuario tem seu proprio status independente)
                  const isReadByCurrentUser = Array.isArray(t.readBy) && t.readBy.includes(user?.id);
                  const isUnread = !isReadByCurrentUser;
                  const fontWeight = isUnread ? '700' : '500';
                  return `<tr style="opacity: ${isUnread ? '1' : '0.9'};">
                    <td style="font-family:monospace;font-weight:${fontWeight};position:relative;">
                      ${isUnread ? '<span style="display:inline-block;width:8px;height:8px;background:#F44336;border-radius:50%;margin-right:6px;vertical-align:middle;"></span>' : ''}
                      ${Utils.escape(t.ticketNumber || '--')}
                    </td>
                    <td style="font-size:12px;font-weight:${fontWeight};">${Utils.escape(schName)}</td>
                    <td style="font-size:12px;font-weight:${fontWeight};">${Utils.escape(t.userName || '--')}</td>
                    <td style="font-weight:${fontWeight};">${Utils.escape(this.CATEGORIA_LABEL(t.categoria))}</td>
                    <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:${fontWeight};">
                      ${Utils.escape((t.descricao || '').substring(0, 70))}${(t.descricao || '').length > 70 ? '...' : ''}
                    </td>
                    <td style="font-size:12px;white-space:nowrap;font-weight:${fontWeight};">${Utils.date(t.criadoEm || t.createdAt)}</td>
                    <td>
                      <span style="background:${meta.color};color:#fff;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                        <i class="fa-solid ${meta.icon}"></i> ${meta.label}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="Router.go('superadmin-ticket-detail', { ticketId:'${t.id}' })">
                        <i class="fa-solid fa-eye"></i> Abrir
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

  _setFilter(key, value) {
    this._filters[key] = value;
    // Re-render apenas se nao for input de texto (para nao perder o foco)
    if (key === 'search') {
      // debounce simples
      clearTimeout(this._searchT);
      this._searchT = setTimeout(() => this.render(), 250);
    } else {
      this.render();
    }
  },

  _clearFilters() {
    this._filters = { status:'todos', categoria:'todas', dateFrom:'', dateTo:'', search:'' };
    this.render();
  },

  // Atualiza contadores em tempo real
  updateCounters() {
    const all = (DB.getAllTickets() || []);

    const stats = {
      total:        all.length,
      aberto:       all.filter(t => t.status === 'aberto').length,
      em_andamento: all.filter(t => t.status === 'em_andamento').length,
      resolvido:    all.filter(t => t.status === 'resolvido').length,
      fechado:      all.filter(t => t.status === 'fechado').length,
    };

    // Atualiza os elementos DOM
    ['total','aberto','em_andamento','resolvido','fechado'].forEach(status => {
      const el = document.getElementById(`count-${status}`);
      if (el) el.textContent = stats[status] || 0;
    });
  },

  // -------- DETALHE COM ACOES DO ADMIN --------
  async renderDetail(ticketId) {
    const user = Auth.require();
    if (!user || user.role !== 'superadmin') {
      Utils.toast('Acesso restrito.', 'error');
      Router.go('login');
      return;
    }

    // Marca como lido ANTES de buscar o ticket
    await DB.markTicketAsRead(ticketId);

    // Atualiza badge do sidebar imediatamente
    Router._updateTicketBadge(user);

    const ticket = DB.getTicketById(ticketId); // rebusca depois de marcar como lido
    if (!ticket) {
      Utils.toast('Chamado nao encontrado.', 'error');
      Router.go('superadmin-tickets');
      return;
    }

    const meta = this.STATUS_META[ticket.status] || this.STATUS_META.aberto;
    const comments = DB.getTicketComments(ticket.id);
    const sch = DB.getSchool(ticket.schoolId);
    const author = (DB._cache?.users || []).find(u => u.id === ticket.userId);

    Router.renderLayout(user, 'superadmin-tickets', `
      <div style="max-width:1000px;margin:0 auto;">
        <div style="margin-bottom:12px;">
          <button class="btn btn-sm btn-outline" onclick="Router.go('superadmin-tickets')">
            <i class="fa-solid fa-arrow-left"></i> Voltar para a lista
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
                  ${Utils.escape(this.CATEGORIA_LABEL(ticket.categoria))}
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

        <!-- Dados do solicitante -->
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><span class="card-title">Solicitante</span></div>
          <div style="padding:14px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:13px;">
            <div><strong>Nome:</strong> ${Utils.escape(ticket.userName || author?.name || '--')}</div>
            <div><strong>E-mail:</strong> ${Utils.escape(author?.email || '--')}</div>
            <div><strong>Funcao:</strong> ${Utils.escape(author?.role || '--')}</div>
            <div><strong>Escola:</strong> ${Utils.escape(sch?.name || (ticket.schoolId ? '(removida)' : '--'))}</div>
          </div>
        </div>

        <!-- Descricao + imagem -->
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><span class="card-title">Descricao</span></div>
          <div style="padding:16px 20px;">
            <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 14px;">${Utils.escape(ticket.descricao || '')}</p>
            ${ticket.imagemUrl ? `
              <a href="${Utils.escape(ticket.imagemUrl)}" target="_blank" rel="noopener" style="display:inline-block;">
                <img src="${Utils.escape(ticket.imagemUrl)}" alt="Anexo" style="max-width:100%;max-height:380px;border-radius:8px;border:1px solid var(--border);" />
              </a>
            ` : '<div style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-image"></i> Sem imagem anexa.</div>'}
          </div>
        </div>

        <!-- Acoes do Admin -->
        <div class="card" style="margin-bottom:16px;background:#FFF8E1;">
          <div class="card-header"><span class="card-title"><i class="fa-solid fa-gear"></i> Acoes do Suporte</span></div>
          <div style="padding:14px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:end;">
            <div class="form-group" style="margin:0;flex:1;min-width:180px;">
              <label class="form-label" style="font-size:11px;">Alterar status</label>
              <select id="adm-status" class="form-control">
                ${this.STATUS_FLOW.map(s => `
                  <option value="${s}" ${ticket.status === s ? 'selected' : ''}>${this.STATUS_META[s].label}</option>
                `).join('')}
              </select>
            </div>
            <button class="btn btn-primary" onclick="SuperTickets.changeStatus('${ticket.id}')">
              <i class="fa-solid fa-check"></i> Aplicar
            </button>
            ${this.STATUS_FLOW.indexOf(ticket.status) < this.STATUS_FLOW.length - 1 ? `
              <button class="btn btn-outline" onclick="SuperTickets.advanceStatus('${ticket.id}')">
                <i class="fa-solid fa-forward"></i> Avancar para "${this.STATUS_META[this.STATUS_FLOW[this.STATUS_FLOW.indexOf(ticket.status) + 1]].label}"
              </button>
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
                Nenhuma resposta ainda. Inicie a conversa abaixo.
              </div>
            ` : comments.map(c => {
              const isAdmin = c.userRole === 'superadmin';
              const bg   = isAdmin ? '#E3F2FD' : '#fafafa';
              const side = isAdmin ? 'flex-end' : 'flex-start';
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
          <div style="padding:14px 20px;border-top:1px solid var(--border);">
            <textarea id="adm-comment-text" class="form-control" rows="3" maxlength="1500"
              placeholder="Responda ao usuario..."></textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <label style="flex:1;display:flex;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:var(--radius);padding:8px;cursor:pointer;background:#fafafa;">
                <i class="fa-solid fa-image" style="margin-right:6px;color:var(--primary);"></i>
                <span style="font-size:12px;color:var(--text-muted);">Adicionar imagem</span>
                <input type="file" id="adm-comment-image" accept="image/*" style="display:none;"
                  onchange="SuperTickets._onCommentImageSelected(this)" />
              </label>
              <button class="btn btn-primary btn-sm" onclick="SuperTickets.sendComment('${ticket.id}')">
                <i class="fa-solid fa-paper-plane"></i> Enviar resposta
              </button>
            </div>
            <div id="adm-comment-image-preview" style="margin-top:8px;"></div>
            <small style="color:var(--text-muted);margin-top:8px;display:block;">A resposta sera visivel ao usuario imediatamente.</small>
          </div>
        </div>
      </div>
    `);
  },

  async changeStatus(ticketId) {
    const newStatus = document.getElementById('adm-status')?.value;
    if (!newStatus) return;
    const t = DB.getTicketById(ticketId);
    if (!t) return;
    if (t.status === newStatus) { Utils.toast('Status ja esta como ' + this.STATUS_LABEL(newStatus), 'info'); return; }
    try {
      await DB.updateTicket(ticketId, { status: newStatus });
      Utils.toast(`Status alterado para "${this.STATUS_LABEL(newStatus)}".`, 'success');
      // Adiciona um comentario automatico de log
      await DB.addTicketComment({
        ticketId,
        mensagem: `Status alterado para "${this.STATUS_LABEL(newStatus)}".`,
      });
      this.updateCounters();
      this.renderDetail(ticketId);
    } catch (err) {
      console.error('[SuperTickets] erro changeStatus:', err);
      Utils.toast('Erro ao alterar status.', 'error');
    }
  },

  async advanceStatus(ticketId) {
    const t = DB.getTicketById(ticketId);
    if (!t) return;
    const idx = this.STATUS_FLOW.indexOf(t.status);
    if (idx < 0 || idx >= this.STATUS_FLOW.length - 1) return;
    const next = this.STATUS_FLOW[idx + 1];
    try {
      await DB.updateTicket(ticketId, { status: next });
      await DB.addTicketComment({
        ticketId,
        mensagem: `Status alterado para "${this.STATUS_LABEL(next)}".`,
      });
      Utils.toast(`Avancado para "${this.STATUS_LABEL(next)}".`, 'success');
      this.updateCounters();
      this.renderDetail(ticketId);
    } catch (err) {
      console.error('[SuperTickets] erro advanceStatus:', err);
      Utils.toast('Erro ao avancar status.', 'error');
    }
  },

  _commentPendingImage: null,

  _onCommentImageSelected(input) {
    const file = input.files?.[0];
    const preview = document.getElementById('adm-comment-image-preview');
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
  },

  async sendComment(ticketId) {
    const txt = (document.getElementById('adm-comment-text')?.value || '').trim();
    if (txt.length < 2) { Utils.toast('Escreva uma mensagem.', 'error'); return; }
    if (txt.length > 1500) { Utils.toast('Mensagem muito longa.', 'error'); return; }
    try {
      let imagemUrl = null;
      if (this._commentPendingImage) {
        imagemUrl = await this._uploadImage(this._commentPendingImage);
      }
      await DB.addTicketComment({ ticketId, mensagem: txt, imagemUrl });
      // Se estava aberto, move automaticamente para em_andamento
      const t = DB.getTicketById(ticketId);
      if (t && t.status === 'aberto') {
        await DB.updateTicket(ticketId, { status: 'em_andamento' });
      }
      Utils.toast('Resposta enviada!', 'success');
      this.updateCounters();
      this.renderDetail(ticketId);
    } catch (err) {
      console.error('[SuperTickets] erro sendComment:', err);
      Utils.toast('Erro ao enviar resposta.', 'error');
    }
  },

  async _uploadImage(base64) {
    const user = Auth.current();
    if (!user?.schoolId) throw new Error('Sem escola associada');
    const fileName = `ticket-comment-${Date.now()}.png`;
    const bucket = 'ticket-attachments';
    const path = `${user.schoolId}/comments/${fileName}`;
    const [data, error] = await supabase.storage.from(bucket).upload(path, this._base64ToBlob(base64));
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },

  _base64ToBlob(base64) {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteArrays = [];
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays.push(byteCharacters.charCodeAt(i));
    }
    return new Blob([new Uint8Array(byteArrays)], { type: 'image/png' });
  },
};

window.SuperTickets = SuperTickets;

// Rotas
Router.register('superadmin-tickets', () => {
  SuperTickets.render();

  // Realtime: atualiza lista e contadores quando qualquer ticket muda
  Realtime.subscribe('tickets', null, () => {
    SuperTickets.render();
  });
  Realtime.subscribe('ticket_comments', null, () => {
    SuperTickets.render();
  });
});

Router.register('superadmin-ticket-detail', async (params) => {
  if (!params?.ticketId) { Router.go('superadmin-tickets'); return; }
  await SuperTickets.renderDetail(params.ticketId);

  // Realtime: atualiza conversa ao vivo quando chega nova mensagem
  Realtime.subscribe('ticket_comments', `ticket_id=eq.${params.ticketId}`, () => {
    SuperTickets.renderDetail(params.ticketId);
  });
  Realtime.subscribe('tickets', `id=eq.${params.ticketId}`, () => {
    SuperTickets.renderDetail(params.ticketId);
  });
});
