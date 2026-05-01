// =============================================
//  ADMIN — Jornadas dos Professores
//  Gestor cadastra/edita jornada de cada professor
//  Rota: admin-jornadas
// =============================================

const AdminJornadas = {
  _jornadas: [],

  async render() {
    const user = Auth.require();
    if (!user) return;
    if (!['gestor','admin','administrativo','superadmin'].includes(user.role)) {
      Utils.toast('Acesso restrito ao gestor.', 'error');
      Router.go('admin-dashboard');
      return;
    }

    this._jornadas = await JornadaUtils.listarJornadas();

    const professores = (DB.getUsers() || [])
      .filter(u => u.role === 'professor')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const totalCadastradas = this._jornadas.length;
    const totalProf        = professores.length;
    const semJornada       = totalProf - totalCadastradas;

    Router.renderLayout(user, 'admin-jornadas', `
      <div style="max-width:1100px;margin:0 auto;">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0;"><i class="fa-solid fa-user-clock" style="color:var(--primary);"></i> Jornadas dos Professores</h2>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
              Configure dias, períodos e carga horária. Sem jornada cadastrada, o professor não consegue bater ponto.
            </div>
          </div>
        </div>

        <!-- Resumo -->
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <div class="card" style="flex:1;min-width:200px;padding:14px">
            <div style="font-size:12px;color:#888">Professores cadastrados</div>
            <div style="font-size:24px;font-weight:700;color:#1976d2">${totalProf}</div>
          </div>
          <div class="card" style="flex:1;min-width:200px;padding:14px">
            <div style="font-size:12px;color:#888">Com jornada</div>
            <div style="font-size:24px;font-weight:700;color:#0a7a3a">${totalCadastradas}</div>
          </div>
          <div class="card" style="flex:1;min-width:200px;padding:14px">
            <div style="font-size:12px;color:#888">Sem jornada</div>
            <div style="font-size:24px;font-weight:700;color:${semJornada > 0 ? '#c33' : '#0a7a3a'}">${semJornada}</div>
          </div>
        </div>

        <!-- Tabela de professores -->
        <div class="card" style="padding:0;overflow-x:auto">
          <table class="table" style="margin:0">
            <thead>
              <tr>
                <th>Professor</th>
                <th>Jornada</th>
                <th>Carga</th>
                <th style="text-align:right">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${professores.length
                ? professores.map(p => this._linhaProfessor(p)).join('')
                : '<tr><td colspan="4" style="text-align:center;color:#888;padding:20px">Nenhum professor cadastrado.</td></tr>'}
            </tbody>
          </table>
        </div>

      </div>
    `);
  },

  _linhaProfessor(p) {
    const jornada = this._jornadas.find(j => j.user_id === p.id);
    const status  = jornada
      ? `<span style="color:#0a7a3a">✅ ${JornadaUtils.formatarResumo(jornada)}</span>`
      : `<span style="color:#c33">⚠️ Sem jornada cadastrada</span>`;

    const carga = jornada ? `<strong>${parseFloat(jornada.carga_horaria_semanal).toFixed(0)}h</strong>/sem` : '—';

    const btnEditar = `<button class="btn btn-sm" onclick="AdminJornadas.abrirEditor('${p.id}')">
      <i class="fa-solid fa-pen"></i> ${jornada ? 'Editar' : 'Cadastrar'}
    </button>`;

    const btnRemover = jornada
      ? `<button class="btn btn-sm btn-danger" onclick="AdminJornadas.removerJornada('${jornada.id}')" style="margin-left:6px" title="Remover">
          <i class="fa-solid fa-trash"></i>
        </button>`
      : '';

    return `
      <tr>
        <td><strong>${p.name}</strong><br><small style="color:#888">${p.email || p.username || ''}</small></td>
        <td>${status}</td>
        <td>${carga}</td>
        <td style="text-align:right;white-space:nowrap">${btnEditar}${btnRemover}</td>
      </tr>
    `;
  },

  abrirEditor(userId) {
    const prof    = DB.getUsers().find(u => u.id === userId);
    const jornada = this._jornadas.find(j => j.user_id === userId) || {};
    if (!prof) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999';
    modal.innerHTML = `
      <div class="card" style="max-width:640px;width:92%;max-height:92vh;overflow-y:auto;padding:20px">
        <h2 style="margin-top:0">
          <i class="fa-solid fa-user-clock"></i>
          Jornada de ${prof.name}
        </h2>

        <div style="display:flex;flex-direction:column;gap:14px">

          <div>
            <label style="font-weight:600;display:block;margin-bottom:6px">📅 Dias da semana</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${this._chkDia('seg', 'Seg', jornada.trabalha_seg ?? true)}
              ${this._chkDia('ter', 'Ter', jornada.trabalha_ter ?? true)}
              ${this._chkDia('qua', 'Qua', jornada.trabalha_qua ?? true)}
              ${this._chkDia('qui', 'Qui', jornada.trabalha_qui ?? true)}
              ${this._chkDia('sex', 'Sex', jornada.trabalha_sex ?? true)}
              ${this._chkDia('sab', 'Sáb', jornada.trabalha_sab ?? false)}
              ${this._chkDia('dom', 'Dom', jornada.trabalha_dom ?? false)}
            </div>
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:6px">🕐 Período 1 <span style="color:#c33">*</span></label>
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
              <label style="display:flex;flex-direction:column">
                <span style="font-size:12px;color:#666">Entrada</span>
                <input type="time" id="jorP1Entrada" value="${(jornada.periodo1_entrada || '07:30').slice(0,5)}" required>
              </label>
              <label style="display:flex;flex-direction:column">
                <span style="font-size:12px;color:#666">Saída</span>
                <input type="time" id="jorP1Saida" value="${(jornada.periodo1_saida || '12:30').slice(0,5)}" required>
              </label>
            </div>
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:6px">
              🕒 Período 2 <small style="color:#888;font-weight:400">(opcional — para jornada integral)</small>
            </label>
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
              <label style="display:flex;flex-direction:column">
                <span style="font-size:12px;color:#666">Entrada</span>
                <input type="time" id="jorP2Entrada" value="${(jornada.periodo2_entrada || '').slice(0,5)}">
              </label>
              <label style="display:flex;flex-direction:column">
                <span style="font-size:12px;color:#666">Saída</span>
                <input type="time" id="jorP2Saida" value="${(jornada.periodo2_saida || '').slice(0,5)}">
              </label>
              <button type="button" class="btn btn-sm" onclick="document.getElementById('jorP2Entrada').value='';document.getElementById('jorP2Saida').value=''">
                Limpar
              </button>
            </div>
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:6px">
              ⏸️ Intervalo descontado (minutos)
            </label>
            <input type="number" id="jorIntervalo" min="0" max="240" value="${jornada.intervalo_minutos || 0}" style="width:100px">
            <small style="display:block;color:#888;margin-top:4px">Ex: bate 08-18 (10h) com intervalo=60 → computa 9h</small>
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:6px">
              📊 Carga horária semanal (horas) <span style="color:#c33">*</span>
            </label>
            <input type="number" id="jorCarga" step="0.5" min="1" max="80"
              value="${jornada.carga_horaria_semanal || 44}" style="width:100px" required>
            <small style="display:block;color:#888;margin-top:4px">Ex: 44, 40, 30, 20</small>
          </div>

          <div>
            <label style="font-weight:600;display:block;margin-bottom:6px">
              🎯 Tolerância de horário (minutos)
            </label>
            <input type="number" id="jorTolerancia" min="0" max="60"
              value="${jornada.tolerancia_minutos ?? 15}" style="width:100px">
            <small style="display:block;color:#888;margin-top:4px">Margem ± para aceitar batida automaticamente</small>
          </div>

        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="AdminJornadas._salvar('${userId}', this.closest('.modal-overlay'))">
            <i class="fa-solid fa-save"></i> Salvar Jornada
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  _chkDia(key, label, checked) {
    return `<label style="display:flex;align-items:center;gap:4px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:${checked ? '#e3f2fd' : '#fff'}">
      <input type="checkbox" data-dia="${key}" ${checked ? 'checked' : ''}> ${label}
    </label>`;
  },

  async _salvar(userId, modal) {
    const dias = {};
    modal.querySelectorAll('[data-dia]').forEach(c => {
      dias[`trabalha_${c.dataset.dia}`] = c.checked;
    });
    const algumDia = Object.values(dias).some(v => v);
    if (!algumDia) { Utils.toast('Selecione pelo menos um dia da semana.', 'error'); return; }

    const p2e = modal.querySelector('#jorP2Entrada').value;
    const p2s = modal.querySelector('#jorP2Saida').value;
    if ((p2e && !p2s) || (!p2e && p2s)) {
      Utils.toast('Período 2: preencha entrada E saída ou deixe ambos vazios.', 'error');
      return;
    }

    const payload = {
      user_id: userId,
      ...dias,
      periodo1_entrada: modal.querySelector('#jorP1Entrada').value,
      periodo1_saida:   modal.querySelector('#jorP1Saida').value,
      periodo2_entrada: p2e || null,
      periodo2_saida:   p2s || null,
      intervalo_minutos:     parseInt(modal.querySelector('#jorIntervalo').value, 10) || 0,
      carga_horaria_semanal: parseFloat(modal.querySelector('#jorCarga').value),
      tolerancia_minutos:    parseInt(modal.querySelector('#jorTolerancia').value, 10) || 15,
    };

    try {
      const token = await AdminJornadas._getToken();
      if (!token) { Utils.toast('Sessão expirada. Faça login novamente.', 'error'); return; }

      const resp = await fetch('/api/jornadas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message || 'Erro ao salvar');

      JornadaUtils.limparCache();
      modal.remove();
      Utils.toast('Jornada salva com sucesso!', 'success');
      this.render();
    } catch (e) {
      Utils.toast('Erro ao salvar: ' + e.message, 'error');
    }
  },

  async removerJornada(id) {
    if (!confirm('Remover jornada? O professor ficará sem permissão para bater ponto até cadastrar uma nova.')) return;

    try {
      const token = await AdminJornadas._getToken();
      if (!token) { Utils.toast('Sessão expirada. Faça login novamente.', 'error'); return; }

      const resp = await fetch(`/api/jornadas?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Falha ao remover');
      JornadaUtils.limparCache();
      Utils.toast('Jornada removida.', 'success');
      this.render();
    } catch (e) {
      Utils.toast('Erro ao remover: ' + e.message, 'error');
    }
  },

  async _getToken() {
    try {
      let { data } = await supabaseClient.auth.getSession();
      if (!data?.session?.access_token) {
        const refresh = await supabaseClient.auth.refreshSession();
        data = refresh.data;
      }
      return data?.session?.access_token || null;
    } catch (e) {
      console.error('[AdminJornadas] getToken erro:', e);
      return null;
    }
  },
};

window.AdminJornadas = AdminJornadas;

Router.register('admin-jornadas', () => AdminJornadas.render());
