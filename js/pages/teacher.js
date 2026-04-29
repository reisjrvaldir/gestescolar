// =============================================
//  GESTESCOLAR – PAINEL DO PROFESSOR
// =============================================

Router.register('teacher-dashboard', () => {
  const user    = Auth.require(); if (!user) return;
  const myClass = DB.getClasses().find(c => c.id === user.classId);
  const students= myClass ? DB.getStudents().filter(s=>s.classId===myClass.id) : [];
  const today   = new Date().toISOString().split('T')[0];
  const todayAtt= DB.getAttendance().filter(a=>a.date===today && students.some(s=>s.id===a.studentId));
  const messages= DB.getMessages().filter(m=>m.fromUserId===user.id);

  Router.renderLayout(user, 'teacher-dashboard', `
    <h2 style="margin-bottom:4px;">Olá, ${Utils.escape(user.name.split(' ')[0])}!</h2>
    <p class="text-muted" style="margin-bottom:20px;">${myClass?`Turma: ${Utils.escape(myClass.name)}`:'Sem turma atribuída'}</p>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon blue"><i class="fa-solid fa-users"></i></div>
        <div><div class="stat-value">${students.length}</div><div class="stat-label">Alunos na turma</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="fa-solid fa-clipboard-check"></i></div>
        <div><div class="stat-value">${todayAtt.filter(a=>a.status==='presente').length}</div><div class="stat-label">Presentes hoje</div></div></div>
      <div class="stat-card"><div class="stat-icon red"><i class="fa-solid fa-user-xmark"></i></div>
        <div><div class="stat-value">${todayAtt.filter(a=>a.status==='falta').length}</div><div class="stat-label">Faltas hoje</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow"><i class="fa-solid fa-envelope"></i></div>
        <div><div class="stat-value">${messages.length}</div><div class="stat-label">Mensagens enviadas</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Ações Rápidas</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
        <button class="btn btn-primary" onclick="Router.go('teacher-attendance')"><i class="fa-solid fa-clipboard-check"></i> Fazer Chamada</button>
        <button class="btn btn-secondary" onclick="Router.go('teacher-grades')"><i class="fa-solid fa-star"></i> Lançar Notas</button>
        <button class="btn btn-outline" onclick="Router.go('teacher-messages')"><i class="fa-solid fa-envelope"></i> Mensagens</button>
      </div>
    </div>
  `);
});

// ---------- CHAMADA ----------
Router.register('teacher-attendance', () => {
  const user = Auth.require(); if (!user) return;
  TeacherAttendance._user = user;
  TeacherAttendance._classId = null;
  TeacherAttendance._state = {};
  Router.renderLayout(user, 'teacher-attendance', TeacherAttendance.renderClassList());
});

const TeacherAttendance = {
  _user:    null,
  _classId: null,
  _date:    new Date().toISOString().split('T')[0],
  _state:   {},

  // ── TELA 1: lista de turmas ──────────────────────────────
  renderClassList() {
    const classes  = DB.getClasses().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const students = DB.getStudents().filter(s => s.status === 'ativo');
    const users    = DB.getUsers();
    const today    = new Date().toISOString().split('T')[0];
    const att      = DB.getAttendance().filter(a => a.date === today);

    if (classes.length === 0) return `
      <div class="empty-state" style="padding:60px 0;">
        <i class="fa-solid fa-chalkboard" style="font-size:48px;color:var(--text-muted);"></i>
        <p>Nenhuma turma cadastrada.<br>Acesse <strong>Gestão › Turmas</strong> para criar.</p>
      </div>`;

    return `
      <h2 style="margin-bottom:20px;"><i class="fa-solid fa-clipboard-check"></i> Chamada — Turmas</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${classes.map(cls => {
          const clsStudents = students.filter(s => s.classId === cls.id);
          const teacher     = users.find(u => u.id === cls.teacherId);
          const todayCalled = att.filter(a => clsStudents.some(s => s.id === a.studentId));
          const done        = clsStudents.length > 0 && todayCalled.length >= clsStudents.length;
          const partial     = todayCalled.length > 0 && !done;
          const borderColor = done ? 'var(--secondary)' : partial ? 'var(--warning)' : '#1a73e8';
          return `
            <div class="card" style="border-left:5px solid ${borderColor};border-radius:var(--radius);margin:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                    <strong style="font-size:15px;">${Utils.escape(cls.name)}</strong>
                    ${done
                      ? `<span class="badge badge-green" style="font-size:11px;">Chamada feita</span>`
                      : partial
                        ? `<span class="badge badge-yellow" style="font-size:11px;">Parcial</span>`
                        : `<span class="badge" style="background:#e8f0fe;color:#1a73e8;font-size:11px;">Pendente</span>`}
                  </div>
                  <div style="font-size:13px;color:var(--text-muted);">
                    <i class="fa-solid fa-users"></i> ${clsStudents.length} aluno(s)
                    &nbsp;·&nbsp;
                    <i class="fa-solid fa-chalkboard-user"></i> ${teacher ? Utils.escape(teacher.name) : 'Sem professor'}
                    ${cls.shift ? `&nbsp;·&nbsp;${cls.shift}` : ''}
                    ${cls.year  ? `&nbsp;·&nbsp;${cls.year}`  : ''}
                  </div>
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                  ${done
                    ? `<button class="btn btn-outline btn-sm" onclick="TeacherAttendance.openClass('${cls.id}')">
                         <i class="fa-solid fa-pen"></i> Editar Chamada
                       </button>`
                    : `<button class="btn btn-sm" style="background:#1a73e8;color:#fff;border:none;"
                         onclick="TeacherAttendance.openClass('${cls.id}')">
                         <i class="fa-solid fa-clipboard-check"></i> Fazer Chamada
                       </button>`}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ── TELA 2: formulário de chamada ────────────────────────
  openClass(classId) {
    this._classId = classId;
    this._date    = new Date().toISOString().split('T')[0];
    this._state   = {};
    this._renderForm();
  },

  _renderForm() {
    const content  = document.getElementById('page-content');
    if (!content) return;

    const cls      = DB.getClasses().find(c => c.id === this._classId);
    const students = DB.getStudents()
      .filter(s => s.classId === this._classId && s.status === 'ativo')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const date     = this._date;
    const records  = DB.getAttendance();

    // Pré-carrega estado salvo para a data selecionada
    students.forEach(s => {
      if (!this._state[s.id]) {
        const saved = records.find(r => r.studentId === s.id && r.date === date);
        if (saved) this._state[s.id] = saved.status;
      }
    });

    const alreadySaved = students.length > 0 &&
      students.every(s => records.some(r => r.studentId === s.id && r.date === date));

    content.innerHTML = `
      <style>
        .att-card-list { display:none; }
        @media (max-width:600px) {
          .att-table-wrap { display:none; }
          .att-card-list  { display:flex; flex-direction:column; gap:10px; padding:12px; }
          .att-card { display:flex; align-items:center; justify-content:space-between; gap:10px;
            padding:12px 14px; border:1.5px solid var(--border); border-radius:var(--radius);
            background:var(--card); }
          .att-card.presente { border-color:var(--secondary); background:#f0faf3; }
          .att-card.falta    { border-color:var(--danger);    background:#fdecea; }
          .att-card-info { flex:1; min-width:0; }
          .att-card-name { font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .att-card-freq { font-size:12px; color:var(--text-muted); margin-top:2px; }
          .att-card-btns { display:flex; gap:6px; flex-shrink:0; }
          .att-card-btns .btn-present, .att-card-btns .btn-absent { width:44px; height:44px; border-radius:50%; font-size:18px; display:flex; align-items:center; justify-content:center; }
        }
      </style>
      <div style="margin-bottom:16px;">
        <button class="btn btn-outline btn-sm" onclick="TeacherAttendance.backToList()">
          <i class="fa-solid fa-arrow-left"></i> Voltar às turmas
        </button>
      </div>

      <div class="card">
        <div class="card-header" style="flex-wrap:wrap;gap:8px;">
          <span class="card-title">
            <i class="fa-solid fa-clipboard-check"></i>
            Chamada — ${cls ? Utils.escape(cls.name) : '–'}
          </span>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="date" id="att-date-input" value="${date}"
              style="padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;"
              onchange="TeacherAttendance.changeDate(this.value)">
            <button class="btn btn-outline btn-sm" onclick="TeacherAttendance.markAll('presente')">
              <i class="fa-solid fa-check-double"></i> Todos Presentes
            </button>
          </div>
        </div>

        ${students.length === 0
          ? `<div class="empty-state"><i class="fa-solid fa-users"></i><p>Nenhum aluno nesta turma.</p></div>`
          : `<!-- Tabela (desktop) -->
            <div class="att-table-wrap table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Aluno</th>
                    <th>Freq.</th>
                    <th style="text-align:center;">Presente</th>
                    <th style="text-align:center;">Ausente</th>
                  </tr>
                </thead>
                <tbody>
                  ${students.map((s, i) => {
                    const st  = this._state[s.id] || '';
                    const pct = Utils.attendancePercent(s.id);
                    return `<tr id="att-row-${s.id}" class="${st}">
                      <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
                      <td><strong>${Utils.escape(s.name)}</strong></td>
                      <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                          <div class="progress-bar-wrap" style="width:50px;">
                            <div class="progress-bar" style="width:${pct}%;background:${pct >= 75 ? 'var(--secondary)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'};"></div>
                          </div>
                          <span style="font-size:12px;font-weight:700;">${pct}%</span>
                        </div>
                      </td>
                      <td style="text-align:center;">
                        <button class="btn btn-sm btn-present ${st === 'presente' ? 'active' : ''}"
                          id="btn-p-${s.id}" onclick="TeacherAttendance.mark('${s.id}','presente')">
                          <i class="fa-solid fa-check"></i>
                        </button>
                      </td>
                      <td style="text-align:center;">
                        <button class="btn btn-sm btn-absent ${st === 'falta' ? 'active' : ''}"
                          id="btn-a-${s.id}" onclick="TeacherAttendance.mark('${s.id}','falta')">
                          <i class="fa-solid fa-xmark"></i>
                        </button>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Cards (mobile) -->
            <div class="att-card-list">
              ${students.map((s, i) => {
                const st  = this._state[s.id] || '';
                const pct = Utils.attendancePercent(s.id);
                return `<div class="att-card ${st}" id="att-card-${s.id}">
                  <div class="att-card-info">
                    <div class="att-card-name">${i + 1}. ${Utils.escape(s.name)}</div>
                    <div class="att-card-freq">Freq. ${pct}%</div>
                  </div>
                  <div class="att-card-btns">
                    <button class="btn btn-sm btn-present ${st === 'presente' ? 'active' : ''}"
                      id="btn-p-${s.id}" onclick="TeacherAttendance.mark('${s.id}','presente')">
                      <i class="fa-solid fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-absent ${st === 'falta' ? 'active' : ''}"
                      id="btn-a-${s.id}" onclick="TeacherAttendance.mark('${s.id}','falta')">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>`;
              }).join('')}
            </div>

            <div style="padding:16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;">
              <button id="btn-salvar-chamada" class="btn btn-primary"
                onclick="TeacherAttendance.submit()"
                style="padding:12px 32px;font-size:15px;width:100%;max-width:320px;${alreadySaved ? 'opacity:.45;cursor:not-allowed;' : ''}"
                ${alreadySaved ? 'disabled' : ''}>
                <i class="fa-solid fa-floppy-disk"></i> Salvar Chamada
              </button>
            </div>`}
      </div>`;
  },

  // ── AÇÕES ────────────────────────────────────────────────
  mark(studentId, status) {
    this._state[studentId] = status;
    // Atualiza todos os pares de botões (tabela desktop + card mobile)
    document.querySelectorAll(`[id="btn-p-${studentId}"]`).forEach(b => b.classList.toggle('active', status === 'presente'));
    document.querySelectorAll(`[id="btn-a-${studentId}"]`).forEach(b => b.classList.toggle('active', status === 'falta'));

    // Cor do card mobile
    const card = document.getElementById(`att-card-${studentId}`);
    if (card) { card.className = `att-card ${status}`; }

    // Reativa o botão Salvar
    const salvar = document.getElementById('btn-salvar-chamada');
    if (salvar && salvar.disabled) {
      salvar.disabled = false;
      salvar.style.opacity = '';
      salvar.style.cursor  = '';
    }
  },

  markAll(status) {
    DB.getStudents()
      .filter(s => s.classId === this._classId && s.status === 'ativo')
      .forEach(s => this.mark(s.id, status));
  },

  changeDate(date) {
    this._date  = date;
    this._state = {};
    this._renderForm();
  },

  submit() {
    const user     = Auth.current();
    const students = DB.getStudents().filter(s => s.classId === this._classId && s.status === 'ativo');
    const missing  = students.filter(s => !this._state[s.id]);

    if (missing.length > 0) {
      Utils.toast(`Marque todos os alunos. Faltando: ${missing.map(s => s.name.split(' ')[0]).join(', ')}`, 'error');
      return;
    }

    const records = students.map(s => ({
      studentId: s.id,
      date:      this._date,
      status:    this._state[s.id],
      teacherId: user.id,
      updatedAt: new Date().toISOString()
    }));

    DB.saveAttendanceBatch(records);
    Utils.toast(`Chamada de ${Utils.date(this._date)} salva! ${records.length} aluno(s) registrado(s).`, 'success');
    this._renderForm();
  },

  backToList() {
    this._classId = null;
    this._state   = {};
    const content = document.getElementById('page-content');
    if (content) content.innerHTML = this.renderClassList();
  }
};

// ---------- AVALIAÇÕES ----------
Router.register('teacher-grades', () => {
  const user = Auth.require(); if (!user) return;
  TeacherGrades._user    = user;
  TeacherGrades._classId = null;
  TeacherGrades._unit    = '1ª Unidade';
  TeacherGrades._subject = 'Matemática';
  Router.renderLayout(user, 'teacher-grades', TeacherGrades.renderClassList());
});

// Gestor também pode acessar avaliações com permissão total
Router.register('gestor-grades', () => {
  const user = Auth.require(); if (!user) return;
  TeacherGrades._user    = user;
  TeacherGrades._classId = null;
  TeacherGrades._unit    = '1ª Unidade';
  TeacherGrades._subject = 'Matemática';
  Router.renderLayout(user, 'gestor-grades', TeacherGrades.renderClassList());
});

const TeacherGrades = {
  _user:     null,
  _classId:  null,
  _unit:     '1ª Unidade',
  _subject:  'Matemática',
  _units:    ['1ª Unidade', '2ª Unidade', '3ª Unidade', '4ª Unidade'],
  _subjects: ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Artes', 'Educação Física'],

  // Chave composta: "1ª Unidade|av1"
  _key(unit, av) { return `${unit}|${av}`; },

  _getGrade(grades, studentId, subject, unit, av) {
    const g = grades.find(g => g.studentId === studentId && g.subject === subject && g.unit === this._key(unit, av));
    return g ? g.grade : null;
  },

  // Média das duas avaliações da unidade: (Av.1 + Av.2) / 2
  _unitAvg(grades, studentId, subject, unit) {
    const av1 = this._getGrade(grades, studentId, subject, unit, 'av1');
    const av2 = this._getGrade(grades, studentId, subject, unit, 'av2');
    if (av1 === null && av2 === null) return null;
    const vals = [av1, av2].filter(v => v !== null);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  },

  // Nota efetiva: se média < 6 e há recuperação, usa o maior valor
  _effectiveAvg(grades, studentId, subject, unit) {
    const base = this._unitAvg(grades, studentId, subject, unit);
    if (base === null || base >= 6) return base;
    const rec = this._getGrade(grades, studentId, subject, unit, 'rec');
    return rec !== null ? Math.max(base, rec) : base;
  },

  // Média geral: média das notas efetivas de todas as unidades com dados
  _overallAvg(grades, studentId, subject) {
    const avgs = this._units
      .map(u => this._effectiveAvg(grades, studentId, subject, u))
      .filter(v => v !== null);
    return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  },

  // ── TELA 1: lista de turmas ───────────────────────────────
  renderClassList() {
    const user     = this._user;
    const isGestor = user && (user.role === 'gestor' || user.role === 'administrativo');
    // Professor vê apenas as turmas onde é o titular; gestor vê todas
    const classes  = DB.getClasses()
      .filter(c => isGestor || c.teacherId === user.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const students = DB.getStudents().filter(s => s.status === 'ativo');
    const users    = DB.getUsers();

    if (classes.length === 0) return `
      <div class="empty-state" style="padding:60px 0;">
        <i class="fa-solid fa-star" style="font-size:48px;color:var(--text-muted);"></i>
        <p>Nenhuma turma cadastrada.</p>
      </div>`;

    return `
      <h2 style="margin-bottom:20px;"><i class="fa-solid fa-star"></i> Avaliações — Turmas</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${classes.map(cls => {
          const clsStudents = students.filter(s => s.classId === cls.id);
          const teacher     = users.find(u => u.id === cls.teacherId);
          return `
            <div class="card" style="border-left:5px solid #1a73e8;border-radius:var(--radius);margin:0;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:0;">
                  <strong style="font-size:15px;">${Utils.escape(cls.name)}</strong>
                  <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
                    <i class="fa-solid fa-users"></i> ${clsStudents.length} aluno(s)
                    &nbsp;·&nbsp;
                    <i class="fa-solid fa-chalkboard-user"></i> ${teacher ? Utils.escape(teacher.name) : 'Sem professor'}
                    ${cls.shift ? `&nbsp;·&nbsp;${cls.shift}` : ''}
                    ${cls.year  ? `&nbsp;·&nbsp;${cls.year}`  : ''}
                  </div>
                </div>
                <button class="btn btn-sm" style="background:#1a73e8;color:#fff;border:none;"
                  onclick="TeacherGrades.openClass('${cls.id}')">
                  Realizar avaliações
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ── TELA 2: lançamento de notas ───────────────────────────
  openClass(classId) {
    this._classId = classId;
    this._unit    = '1ª Unidade';
    // Define a primeira matéria da turma (ou Matemática como fallback)
    const cls = DB.getClasses().find(c => c.id === classId);
    this._subject = (cls?.subjects?.[0]) || 'Matemática';
    this._renderGrades();
  },

  // ── Lock de avaliações ───────────────────────────────────
  _lockKey(classId, unit, subject) { return `ges_glock_${classId}_${unit}_${subject}`; },
  _isLocked(classId, unit, subject) { return !!localStorage.getItem(this._lockKey(classId, unit, subject)); },
  _lock(classId, unit, subject)   { localStorage.setItem(this._lockKey(classId, unit, subject), new Date().toISOString()); },
  _unlock(classId, unit, subject) { localStorage.removeItem(this._lockKey(classId, unit, subject)); },

  _renderGrades() {
    const content = document.getElementById('page-content');
    if (!content) return;

    const user     = this._user;
    const isGestor = user && (user.role === 'gestor' || user.role === 'administrativo');

    const cls      = DB.getClasses().find(c => c.id === this._classId);
    const teacher  = cls ? DB.getUsers().find(u => u.id === cls.teacherId) : null;
    const students = DB.getStudents()
      .filter(s => s.classId === this._classId && s.status === 'ativo')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const grades   = DB.getGrades();
    const unit     = this._unit;

    // Prioridade: matérias da turma > todas MATERIAS_MEC > fallback hardcoded
    let subjects;
    if (cls && cls.subjects && cls.subjects.length > 0) {
      subjects = cls.subjects;
    } else if (window.MATERIAS_MEC) {
      subjects = [...new Set(Object.values(window.MATERIAS_MEC).flat())].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } else {
      subjects = this._subjects;
    }
    if (!subjects.includes(this._subject)) this._subject = subjects[0] || 'Matemática';
    const subject = this._subject;

    const locked   = this._isLocked(this._classId, unit, subject);
    const editable = isGestor || !locked;

    const teacherLabel = teacher
      ? 'Prof. ' + teacher.name.split(' ').slice(0, 2).join(' ') : '';

    const _input = (sid, av, val, style) => `
      <input type="number" min="0" max="10" step="0.1"
        value="${val !== null ? val : ''}" placeholder="–"
        data-sid="${sid}" data-av="${av}"
        onchange="TeacherGrades.saveInline(this)"
        style="width:56px;text-align:center;padding:5px;font-size:14px;border-radius:var(--radius);${style}">`;

    const _readOnly = (val, color) =>
      `<strong style="color:${color};font-size:15px;">${val !== null ? Number(val).toFixed(1) : '–'}</strong>`;

    content.innerHTML = `
      <style>
        .grades-table-wrap { overflow-x:auto; overflow-y:auto; max-height:65vh; -webkit-overflow-scrolling:touch; }
        .grades-table-wrap table { min-width:520px; }
        .grades-table-wrap thead th { position:sticky; top:0; z-index:2; background:#f8f9fa; }
        @media (max-width:600px) {
          .grades-table-wrap { max-height:60vh; }
          .grades-table-wrap table { min-width:440px; }
          .grades-table-wrap input[type=number] { width:48px !important; font-size:13px !important; padding:4px !important; }
        }
      </style>
      <div style="margin-bottom:16px;">
        <button class="btn btn-outline btn-sm" onclick="TeacherGrades.backToList()">
          <i class="fa-solid fa-arrow-left"></i> Voltar às turmas
        </button>
      </div>

      <div class="card">
        <div class="card-header" style="flex-wrap:wrap;gap:10px;">
          <span class="card-title">
            <i class="fa-solid fa-star"></i>
            ${cls ? Utils.escape(cls.name) : '–'}
            ${teacherLabel ? `<span style="font-weight:400;color:var(--text-muted);font-size:14px;"> — ${Utils.escape(teacherLabel)}</span>` : ''}
            ${locked ? `<span class="badge badge-green" style="font-size:11px;margin-left:8px;"><i class="fa-solid fa-lock"></i> Notas salvas</span>` : ''}
          </span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select onchange="TeacherGrades._unit=this.value;TeacherGrades._renderGrades()"
              style="padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;">
              ${[...this._units, 'Média Final'].map(u => `<option value="${u}" ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
            <select onchange="TeacherGrades._subject=this.value;TeacherGrades._renderGrades()"
              style="padding:6px 10px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;">
              ${subjects.map(s => `<option value="${s}" ${s === subject ? 'selected' : ''}>${Utils.escape(s)}</option>`).join('')}
            </select>
            ${isGestor && locked
              ? `<button class="btn btn-outline btn-sm" style="color:var(--warning);border-color:var(--warning);"
                   onclick="TeacherGrades.unlockGrades()">
                   <i class="fa-solid fa-lock-open"></i> Liberar Edição
                 </button>`
              : ''}
          </div>
        </div>

        ${students.length === 0
          ? `<div class="empty-state"><i class="fa-solid fa-users"></i><p>Nenhum aluno nesta turma.</p></div>`
          : unit === 'Média Final'
            ? `<div class="grades-table-wrap table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Aluno</th>
                      <th style="text-align:center;">1ª Unidade</th>
                      <th style="text-align:center;">2ª Unidade</th>
                      <th style="text-align:center;">3ª Unidade</th>
                      <th style="text-align:center;">4ª Unidade</th>
                      <th style="text-align:center;">Média Final</th>
                      <th style="text-align:center;">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${students.map((s, i) => {
                      const notas = this._units.map(u => this._effectiveAvg(grades, s.id, subject, u));
                      const comNota = notas.filter(v => v !== null);
                      const mediaFinal = comNota.length === 4
                        ? notas.reduce((a, b) => a + b, 0) / 4
                        : comNota.length > 0
                          ? comNota.reduce((a, b) => a + b, 0) / comNota.length
                          : null;
                      const aprovado  = mediaFinal !== null && parseFloat(mediaFinal.toFixed(1)) >= 6;
                      const cor = (v) => v !== null ? (v >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)';
                      return `<tr>
                        <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
                        <td><strong>${Utils.escape(s.name)}</strong></td>
                        ${notas.map(n => `<td style="text-align:center;"><span style="font-size:12px;color:${cor(n)};">${n !== null ? n.toFixed(1) : '–'}</span></td>`).join('')}
                        <td style="text-align:center;padding:6px;">
                          ${mediaFinal !== null
                            ? `<span style="display:inline-block;min-width:52px;padding:6px 10px;border-radius:var(--radius);font-size:16px;font-weight:700;color:#fff;background:${aprovado ? 'var(--secondary)' : 'var(--danger)'};">
                                ${mediaFinal.toFixed(1)}
                               </span>`
                            : `<span style="color:var(--text-muted);font-size:13px;">–</span>`}
                        </td>
                        <td style="text-align:center;">
                          ${mediaFinal !== null
                            ? (aprovado
                                ? `<span class="badge badge-green">Aprovado</span>`
                                : `<span class="badge badge-red">Reprovado</span>`)
                            : `<span style="color:var(--text-muted);font-size:13px;">–</span>`}
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>`
            : `<div class="grades-table-wrap table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Aluno</th>
                      <th style="text-align:center;">Av. 1</th>
                      <th style="text-align:center;">Av. 2</th>
                      <th style="text-align:center;">Média</th>
                      <th style="text-align:center;">Av. Rec.</th>
                      <th style="text-align:center;">Nota Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${students.map((s, i) => {
                      const av1      = this._getGrade(grades, s.id, subject, unit, 'av1');
                      const av2      = this._getGrade(grades, s.id, subject, unit, 'av2');
                      const rec      = this._getGrade(grades, s.id, subject, unit, 'rec');
                      const mediaU   = this._unitAvg(grades, s.id, subject, unit);
                      const mediaG   = this._effectiveAvg(grades, s.id, subject, unit);
                      const needsRec = mediaU !== null && mediaU < 6;
                      const colorU   = mediaU !== null ? (mediaU >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)';
                      const colorG   = mediaG !== null ? (mediaG >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)';
                      return `<tr>
                        <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
                        <td><strong>${Utils.escape(s.name)}</strong></td>
                        <td style="text-align:center;">
                          ${editable
                            ? _input(s.id, 'av1', av1, 'border:1.5px solid var(--border);')
                            : _readOnly(av1, av1 !== null ? (av1 >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)')}
                        </td>
                        <td style="text-align:center;">
                          ${editable
                            ? _input(s.id, 'av2', av2, 'border:1.5px solid var(--border);')
                            : _readOnly(av2, av2 !== null ? (av2 >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)')}
                        </td>
                        <td style="text-align:center;">
                          <strong id="media-u-${s.id}" style="color:${colorU};">
                            ${mediaU !== null ? mediaU.toFixed(1) : '–'}
                          </strong>
                        </td>
                        <td style="text-align:center;" id="rec-cell-${s.id}">
                          ${needsRec
                            ? (editable
                                ? _input(s.id, 'rec', rec, 'border:2px solid #e65100;background:#fff8f4;')
                                : _readOnly(rec, rec !== null ? (rec >= 6 ? 'var(--secondary)' : 'var(--danger)') : '#e65100'))
                            : `<span style="color:var(--text-muted);font-size:13px;">–</span>`}
                        </td>
                        <td style="text-align:center;">
                          <strong id="media-g-${s.id}" style="color:${colorG};">
                            ${mediaG !== null ? mediaG.toFixed(1) : '–'}
                          </strong>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
              ${!locked
                ? `<div style="padding:16px 0 0;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;">
                     <button class="btn btn-primary" style="padding:10px 32px;font-size:15px;"
                       onclick="TeacherGrades.submitGrades()">
                       <i class="fa-solid fa-floppy-disk"></i> Salvar Avaliações
                     </button>
                   </div>`
                : isGestor
                  ? ''
                  : `<div style="padding:14px 0 0;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;color:var(--secondary);">
                       <i class="fa-solid fa-circle-check"></i>
                       <span style="font-size:13px;">Avaliações salvas. Apenas o gestor pode editar.</span>
                     </div>`}`}
      </div>`;
  },

  submitGrades() {
    const grades   = DB.getGrades();
    const students = DB.getStudents().filter(s => s.classId === this._classId && s.status === 'ativo');
    const unit     = this._unit;
    const subject  = this._subject;

    const missing = students.filter(s => {
      const av1 = this._getGrade(grades, s.id, subject, unit, 'av1');
      const av2 = this._getGrade(grades, s.id, subject, unit, 'av2');
      return av1 === null || av2 === null;
    });

    if (missing.length > 0) {
      Utils.toast(`Preencha Av.1 e Av.2 de todos os alunos. Faltando: ${missing.map(s => s.name.split(' ')[0]).join(', ')}`, 'error');
      return;
    }

    this._lock(this._classId, unit, subject);
    Utils.toast('Avaliações salvas e bloqueadas para edição!', 'success');
    this._renderGrades();
  },

  unlockGrades() {
    this._unlock(this._classId, this._unit, this._subject);
    Utils.toast('Edição liberada pelo gestor.', 'info');
    this._renderGrades();
  },

  saveInline(input) {
    const user    = Auth.current();
    const isGestor = user && (user.role === 'gestor' || user.role === 'administrativo');

    if (!isGestor && this._isLocked(this._classId, this._unit, this._subject)) {
      Utils.toast('Avaliação bloqueada. Apenas o gestor pode editar.', 'error');
      return;
    }

    const value   = parseFloat(input.value);
    const sid     = input.dataset.sid;
    const av      = input.dataset.av;
    const unit    = this._unit;
    const subject = this._subject;

    if (input.value === '') return;
    if (isNaN(value) || value < 0 || value > 10) {
      input.style.borderColor = 'var(--danger)';
      Utils.toast('Nota deve ser entre 0 e 10.', 'error');
      return;
    }
    input.style.borderColor = 'var(--secondary)';

    DB.setGrade(sid, subject, this._key(unit, av), value, user.id);

    const grades   = DB.getGrades();
    const mediaU   = this._unitAvg(grades, sid, subject, unit);
    const mediaG   = this._effectiveAvg(grades, sid, subject, unit);
    const needsRec = mediaU !== null && mediaU < 6;

    const muEl  = document.getElementById(`media-u-${sid}`);
    const mgEl  = document.getElementById(`media-g-${sid}`);
    const recEl = document.getElementById(`rec-cell-${sid}`);

    if (muEl) {
      muEl.textContent = mediaU !== null ? mediaU.toFixed(1) : '–';
      muEl.style.color = mediaU !== null ? (mediaU >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)';
    }

    if (mgEl) {
      mgEl.textContent = mediaG !== null ? mediaG.toFixed(1) : '–';
      mgEl.style.color = mediaG !== null ? (mediaG >= 6 ? 'var(--secondary)' : 'var(--danger)') : 'var(--text-muted)';
    }
    if (recEl) {
      const recGrade = this._getGrade(grades, sid, subject, unit, 'rec');
      recEl.innerHTML = needsRec
        ? `<input type="number" min="0" max="10" step="0.1"
             value="${recGrade !== null ? recGrade : ''}" placeholder="–"
             data-sid="${sid}" data-av="rec"
             onchange="TeacherGrades.saveInline(this)"
             style="width:62px;text-align:center;padding:5px;border:2px solid #e65100;border-radius:var(--radius);font-size:14px;background:#fff8f4;">`
        : `<span style="color:var(--text-muted);font-size:13px;">–</span>`;
    }
  },

  backToList() {
    this._classId = null;
    const content = document.getElementById('page-content');
    if (content) content.innerHTML = this.renderClassList();
  }
};

// ---------- MENSAGENS ----------
Router.register('teacher-messages', () => {
  const user      = Auth.require(); if (!user) return;
  const isGestor  = user.role === 'gestor' || user.role === 'administrativo';
  const allClasses = DB.getClasses().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const myClasses  = isGestor ? allClasses : allClasses.filter(c=>c.teacherId===user.id || c.id===user.classId);
  const sent       = DB.getMessages().filter(m=>m.fromUserId===user.id);
  const received   = DB.getMessagesForUser(user.id);

  // Agrupa por aluno (studentId), cria lista de conversas
  const convMap = {};
  [...sent, ...received].forEach(m => {
    const key = m.studentId || m.toUserId || m.fromUserId;
    if (!convMap[key]) convMap[key] = {
      studentId:   m.studentId   || '',
      studentName: m.studentName || (m.fromName||'').replace(/\(.*\)/,'').trim() || '–',
      matricula:   m.matricula   || '',
      classId:     m.classId     || '',
      toUserId:    m.toUserId    || '',
      msgs:        [],
      unread:      0,
    };
    convMap[key].msgs.push(m);
    if (!m.read && m.toUserId === user.id) convMap[key].unread++;
    // garante toUserId para envio posterior
    if (m.fromUserId === user.id && m.toUserId) convMap[key].toUserId = m.toUserId;
  });

  const conversations = Object.values(convMap)
    .map(c => ({...c, msgs: c.msgs.sort((a,b)=>new Date(a.sentAt)-new Date(b.sentAt))}))
    .sort((a,b) => new Date(b.msgs[b.msgs.length-1].sentAt) - new Date(a.msgs[a.msgs.length-1].sentAt));

  const _convItem = (c) => {
    const last    = c.msgs[c.msgs.length-1];
    const preview = last.text.length > 38 ? last.text.slice(0,38)+'…' : last.text;
    const avatar  = (c.studentName||'?')[0].toUpperCase();
    const unreadBadge = c.unread > 0
      ? `<span style="min-width:20px;height:20px;border-radius:10px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;flex-shrink:0;">${c.unread>9?'9+':c.unread}</span>`
      : '';
    return `<div class="tm-conv-item" data-sid="${c.studentId}"
      onclick="TeacherMessages.openConv('${c.studentId}')"
      style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:center;transition:background .15s;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;flex-shrink:0;">${avatar}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(c.studentName)}</div>
        <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(preview)}</div>
      </div>
      ${unreadBadge}
    </div>`;
  };

  Router.renderLayout(user, 'teacher-messages', `
    <!-- Card principal estilo messenger -->
    <div class="card" style="height:620px;display:flex;flex-direction:column;overflow:hidden;">
      <!-- Barra superior -->
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <span style="font-weight:700;font-size:16px;">Mensagens</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="TeacherMessages.openAll()">Enviar para Todos</button>
          <button class="btn btn-primary btn-sm" onclick="TeacherMessages.openNew()">+ Nova Conversa</button>
        </div>
      </div>

      <!-- Corpo: lista esquerda + chat direita -->
      <div style="flex:1;display:flex;overflow:hidden;">

        <!-- Lista de conversas -->
        <div id="tmConvList" style="width:280px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;">
          ${conversations.length === 0
            ? `<div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:14px;">Nenhuma conversa ainda.</div>`
            : conversations.map(_convItem).join('')}
        </div>

        <!-- Painel de chat -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <!-- Mensagens -->
          <div id="tmChatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;">
            <div style="margin:auto;text-align:center;color:var(--text-muted);">
              <i class="fa-solid fa-comments" style="font-size:36px;opacity:.4;margin-bottom:8px;"></i>
              <p style="font-size:14px;">Selecione uma conversa</p>
            </div>
          </div>
          <!-- Input fixo na base -->
          <div style="border-top:1px solid var(--border);padding:12px;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;">
            <textarea id="tmReplyText" class="form-control" rows="2"
              style="resize:none;flex:1;"
              placeholder="Selecione uma conversa para responder…"
              disabled
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();TeacherMessages.sendInline();}"></textarea>
            <button class="btn btn-primary" id="tmSendBtn" onclick="TeacherMessages.sendInline()" disabled
              style="height:52px;width:52px;padding:0;display:flex;align-items:center;justify-content:center;">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Enviar para Todos -->
    <div id="tmAllModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;align-items:center;justify-content:center;">
      <div class="card" style="width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;">
        <div class="card-header">
          <span class="card-title">Enviar para Todos da Turma</span>
          <button class="btn btn-sm btn-outline" onclick="TeacherMessages.closeAll()">✕</button>
        </div>
        <div style="padding:16px;">
          <form onsubmit="TeacherMessages.sendAll(event)">
            <div class="form-group">
              <label class="form-label">Turma *</label>
              <select class="form-control" id="tmAllClass" required onchange="TeacherMessages.previewAll()">
                <option value="">Selecione a turma</option>
                ${myClasses.map(c=>`<option value="${c.id}">${Utils.escape(c.name)}</option>`).join('')}
              </select>
            </div>
            <div id="tmAllPreview" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></div>
            <div class="form-group">
              <label class="form-label">Assunto *</label>
              <input class="form-control" id="tmAllSubject" required placeholder="Ex: Reunião de Pais" />
            </div>
            <div class="form-group">
              <label class="form-label">Mensagem *</label>
              <textarea class="form-control" id="tmAllText" rows="4" required style="resize:vertical;" placeholder="Escreva aqui…"></textarea>
            </div>
            <button type="submit" class="btn btn-primary w-100">Enviar para Todos os Responsáveis</button>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal Nova Conversa -->
    <div id="tmNewModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:2000;align-items:center;justify-content:center;">
      <div class="card" style="width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;">
        <div class="card-header">
          <span class="card-title">Nova Conversa</span>
          <button class="btn btn-sm btn-outline" onclick="TeacherMessages.closeNew()">✕</button>
        </div>
        <div style="padding:16px;">
          <form onsubmit="TeacherMessages.sendNew(event)">
            <div class="form-group">
              <label class="form-label">Turma *</label>
              <select class="form-control" id="tmClass" required onchange="TeacherMessages.filterStudents()">
                <option value="">Selecione a turma</option>
                ${myClasses.map(c=>`<option value="${c.id}">${Utils.escape(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Para (aluno / responsável) *</label>
              <select class="form-control" id="tmTo" required disabled>
                <option value="">Selecione primeiro a turma</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Assunto *</label>
              <input class="form-control" id="tmSubject" required placeholder="Ex: Avaliação de Matemática" />
            </div>
            <div class="form-group">
              <label class="form-label">Mensagem *</label>
              <textarea class="form-control" id="tmMsgText" rows="3" required style="resize:vertical;" placeholder="Escreva aqui…"></textarea>
            </div>
            <button type="submit" class="btn btn-primary w-100">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  `);

  received.forEach(m => DB.markMessageRead(m.id));
  TeacherMessages._conversations = conversations;
  TeacherMessages._user          = user;

  // Realtime: nova mensagem → re-renderiza lista de conversas
  if (user.schoolId) {
    Realtime.subscribe('messages', `school_id=eq.${user.schoolId}`, () => {
      Router.go('teacher-messages');
    });
  }
});

const TeacherMessages = {
  _conversations: [],
  _user:          null,
  _activeKey:     null,

  _bubble(m, dir) {
    const isOut       = dir === 'out';
    const wrapStyle   = isOut
      ? 'display:flex;flex-direction:column;align-items:flex-end;margin-bottom:14px;'
      : 'display:flex;flex-direction:column;align-items:flex-start;margin-bottom:14px;';
    const bubbleStyle = isOut
      ? 'padding:10px 14px;background:var(--primary);color:#fff;border-radius:18px 18px 4px 18px;max-width:75%;word-break:break-word;'
      : 'padding:10px 14px;background:#f0f2f5;color:var(--text);border-radius:18px 18px 18px 4px;max-width:75%;word-break:break-word;';
    const metaStyle   = isOut
      ? 'font-size:11px;color:var(--text-muted);margin-top:3px;text-align:right;'
      : 'font-size:11px;color:var(--text-muted);margin-top:3px;';
    const status = isOut
      ? `<span style="color:${m.read?'var(--secondary)':'var(--text-muted)'};">${m.read?'✓✓ Visualizado':'✓ Enviado'}</span>`
      : '';
    const label = isOut
      ? ''
      : `<span style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">${Utils.escape(m.fromName||'Responsável')}</span>`;
    return `<div style="${wrapStyle}">
      ${label}
      <div style="${bubbleStyle}">
        ${m.subject?`<div style="font-size:11px;font-weight:700;margin-bottom:4px;${isOut?'color:rgba(255,255,255,0.75);':'color:var(--text-muted);'}">${Utils.escape(m.subject)}</div>`:''}
        <div style="font-size:14px;line-height:1.5;">${Utils.escape(m.text)}</div>
      </div>
      <div style="${metaStyle}">${Utils.datetime(m.sentAt)} ${status}</div>
    </div>`;
  },

  openConv(studentId) {
    this._activeKey = studentId;
    const conv = this._conversations.find(c=>c.studentId===studentId);
    if (!conv) return;

    // Destaca item ativo
    document.querySelectorAll('.tm-conv-item').forEach(el => {
      el.style.background = el.dataset.sid === studentId ? 'rgba(var(--primary-rgb,37,99,235),.08)' : '';
    });

    const user = this._user || Auth.current();
    const box  = document.getElementById('tmChatMessages');
    if (box) {
      box.innerHTML = conv.msgs.map(m => this._bubble(m, m.fromUserId===user.id?'out':'in')).join('');
      box.scrollTop = box.scrollHeight;
    }

    const ta  = document.getElementById('tmReplyText');
    const btn = document.getElementById('tmSendBtn');
    if (ta)  { ta.disabled = false; ta.placeholder = 'Digite uma mensagem…'; ta.focus(); }
    if (btn) btn.disabled = false;
  },

  sendInline() {
    const user = this._user || Auth.current();
    const text = document.getElementById('tmReplyText')?.value.trim();
    if (!text) { Utils.toast('Escreva uma mensagem.','error'); return; }
    const conv = this._conversations.find(c=>c.studentId===this._activeKey);
    if (!conv) return;

    const msg = {
      fromUserId:  user.id,
      fromName:    `${user.name} ${user.role==='gestor'?'(Gestor)':'(Professor)'}`,
      toUserId:    conv.toUserId,
      studentId:   conv.studentId,
      studentName: conv.studentName,
      matricula:   conv.matricula,
      classId:     conv.classId,
      subject:     conv.msgs[0]?.subject || 'Mensagem',
      text,
    };
    DB.addMessage(msg);
    document.getElementById('tmReplyText').value = '';
    const dummy = {...msg, sentAt: new Date().toISOString(), read: false};
    conv.msgs.push(dummy);
    const box = document.getElementById('tmChatMessages');
    if (box) {
      box.insertAdjacentHTML('beforeend', this._bubble(dummy, 'out'));
      box.scrollTop = box.scrollHeight;
    }
  },

  openNew() {
    const modal = document.getElementById('tmNewModal');
    if (modal) modal.style.display = 'flex';
  },

  closeNew() {
    const modal = document.getElementById('tmNewModal');
    if (modal) modal.style.display = 'none';
  },

  filterStudents() {
    const classId = document.getElementById('tmClass').value;
    const sel     = document.getElementById('tmTo');
    sel.innerHTML = '<option value="">Selecione o aluno</option>';
    if (!classId) { sel.disabled = true; return; }
    const students = DB.getStudents().filter(s=>s.classId===classId)
      .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    students.forEach(s => {
      const resp = (s.responsaveis||[])[0]?.nome || 'sem responsável';
      sel.innerHTML += `<option value="${s.id}">${Utils.escape(s.name)} — ${Utils.escape(resp)}</option>`;
    });
    sel.disabled = students.length === 0;
    if (students.length === 0) sel.innerHTML = '<option value="">Nenhum aluno nesta turma</option>';
  },

  sendNew(e) {
    e.preventDefault();
    const user      = this._user || Auth.current();
    const classId   = document.getElementById('tmClass').value;
    if (!classId) { Utils.toast('Selecione a turma.','error'); return; }
    const studentId = document.getElementById('tmTo').value;
    const s         = DB.getStudents().find(s=>s.id===studentId);
    if (!s) { Utils.toast('Selecione um aluno.','error'); return; }
    if (!s.parentId) { Utils.toast('Responsável não possui acesso ao sistema. Vincule um responsável ao aluno primeiro.','info'); return; }
    DB.addMessage({
      fromUserId:  user.id,
      fromName:    `${user.name} ${user.role==='gestor'?'(Gestor)':'(Professor)'}`,
      toUserId:    s.parentId,
      studentId:   s.id,
      studentName: s.name,
      matricula:   s.matricula || '',
      classId,
      subject:     document.getElementById('tmSubject').value,
      text:        document.getElementById('tmMsgText').value,
    });
    Utils.toast('Mensagem enviada!','success');
    this.closeNew();
    Router.go('teacher-messages');
  },

  openAll() {
    const modal = document.getElementById('tmAllModal');
    if (modal) modal.style.display = 'flex';
  },

  closeAll() {
    const modal = document.getElementById('tmAllModal');
    if (modal) modal.style.display = 'none';
  },

  previewAll() {
    const classId = document.getElementById('tmAllClass').value;
    const preview = document.getElementById('tmAllPreview');
    if (!preview) return;
    if (!classId) { preview.textContent = ''; return; }
    const students = DB.getStudents().filter(s => s.classId === classId && s.parentId);
    preview.innerHTML = students.length > 0
      ? `<i class="fa-solid fa-circle-info"></i> ${students.length} responsável(is) receberão esta mensagem.`
      : `<span style="color:var(--danger);">Nenhum aluno com responsável vinculado nesta turma.</span>`;
  },

  sendAll(e) {
    e.preventDefault();
    const user    = this._user || Auth.current();
    const classId = document.getElementById('tmAllClass').value;
    if (!classId) { Utils.toast('Selecione a turma.','error'); return; }
    const subject = document.getElementById('tmAllSubject').value;
    const text    = document.getElementById('tmAllText').value;
    const students = DB.getStudents().filter(s => s.classId === classId && s.parentId);
    if (students.length === 0) { Utils.toast('Nenhum aluno com responsável vinculado nesta turma.','error'); return; }
    const fromName = `${user.name} ${user.role==='gestor'?'(Gestor)':'(Professor)'}`;
    students.forEach(s => {
      DB.addMessage({
        fromUserId:  user.id,
        fromName,
        toUserId:    s.parentId,
        studentId:   s.id,
        studentName: s.name,
        matricula:   s.matricula || '',
        classId,
        subject,
        text,
      });
    });
    Utils.toast(`Mensagem enviada para ${students.length} responsável(is)!`, 'success');
    this.closeAll();
    Router.go('teacher-messages');
  }
};

// ─── [gestor-messages removido] ──────────────────────────────────────────────
/*
Router.register('gestor-messages', () => {
  const user        = Auth.require(); if (!user) return;
  const allClasses  = DB.getClasses().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const allMessages = DB.getMessages();
  const allStudents = DB.getStudents();

  // Agrupa mensagens por aluno (conversa)
  const _buildConvs = (msgs) => {
    const map = {};
    msgs.forEach(m => {
      const key = m.studentId || m.toUserId || m.fromUserId;
      if (!map[key]) map[key] = {
        studentId:   m.studentId   || '',
        studentName: m.studentName || '–',
        matricula:   m.matricula   || '',
        classId:     m.classId     || '',
        msgs:        [],
        unread:      0,
      };
      map[key].msgs.push(m);
      if (!m.read) map[key].unread++;
    });
    return Object.values(map)
      .map(c => ({...c, msgs: c.msgs.sort((a,b)=>new Date(a.sentAt)-new Date(b.sentAt))}))
      .sort((a,b) => new Date(b.msgs[b.msgs.length-1].sentAt) - new Date(a.msgs[a.msgs.length-1].sentAt));
  };

  const conversations = _buildConvs(allMessages);
  const classOptions  = allClasses.map(c=>`<option value="${c.id}">${Utils.escape(c.name)}</option>`).join('');

  const _convItem = (c) => {
    const last    = c.msgs[c.msgs.length-1];
    const preview = last.text.length > 36 ? last.text.slice(0,36)+'…' : last.text;
    const avatar  = (c.studentName||'?')[0].toUpperCase();
    const cls     = allClasses.find(cl=>cl.id===c.classId);
    const unreadBadge = c.unread > 0
      ? `<span style="min-width:20px;height:20px;border-radius:10px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;flex-shrink:0;">${c.unread>9?'9+':c.unread}</span>`
      : '';
    return `<div class="gm-conv-item" data-sid="${c.studentId}"
      onclick="GestorMessages.openConv('${c.studentId}')"
      style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:center;transition:background .15s;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:17px;flex-shrink:0;">${avatar}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(c.studentName)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">${Utils.escape(cls?.name||'–')} ${c.matricula?'· '+c.matricula:''}</div>
        <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(preview)}</div>
      </div>
      ${unreadBadge}
    </div>`;
  };

  Router.renderLayout(user, 'gestor-messages', `
    <div class="card" style="height:620px;display:flex;flex-direction:column;overflow:hidden;">
      <!-- Barra superior -->
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <span style="font-weight:700;font-size:16px;flex:1;">Gestão de Mensagens</span>
        <select class="form-control" id="gmClass" style="max-width:220px;" onchange="GestorMessages.filter()">
          <option value="">Todas as turmas</option>
          ${classOptions}
        </select>
      </div>

      <!-- Corpo -->
      <div style="flex:1;display:flex;overflow:hidden;">
        <!-- Lista de conversas -->
        <div id="gmConvList" style="width:300px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;">
          ${conversations.length === 0
            ? `<div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:14px;">Nenhuma conversa.</div>`
            : conversations.map(_convItem).join('')}
        </div>

        <!-- Painel de chat (somente leitura) -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div id="gmChatHeader" style="padding:12px 16px;border-bottom:1px solid var(--border);flex-shrink:0;display:none;">
            <span id="gmChatTitle" style="font-weight:600;"></span>
            <span id="gmChatSub" style="font-size:12px;color:var(--text-muted);margin-left:8px;"></span>
          </div>
          <div id="gmChatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;">
            <div style="margin:auto;text-align:center;color:var(--text-muted);">
              <i class="fa-solid fa-comments" style="font-size:36px;opacity:.4;margin-bottom:8px;"></i>
              <p style="font-size:14px;">Clique em uma conversa para visualizar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  GestorMessages._conversations = conversations;
  GestorMessages._allClasses    = allClasses;
  GestorMessages._allStudents   = allStudents;
  GestorMessages._allMessages   = allMessages;
  GestorMessages._buildConvs    = _buildConvs;
  GestorMessages._convItem      = _convItem;
});

const GestorMessages = {
  _conversations: [],
  _allClasses:    [],
  _allStudents:   [],
  _allMessages:   [],
  _buildConvs:    null,
  _convItem:      null,

  _bubble(m) {
    // No contexto do gestor, mensagens de remetentes (escola) ficam à direita,
    // respostas de responsáveis ficam à esquerda
    const isSchool = !m.fromName?.includes('Responsável');
    const isOut    = isSchool;
    const wrapStyle   = isOut
      ? 'display:flex;flex-direction:column;align-items:flex-end;margin-bottom:14px;'
      : 'display:flex;flex-direction:column;align-items:flex-start;margin-bottom:14px;';
    const bubbleStyle = isOut
      ? 'padding:10px 14px;background:var(--primary);color:#fff;border-radius:18px 18px 4px 18px;max-width:75%;word-break:break-word;'
      : 'padding:10px 14px;background:#f0f2f5;color:var(--text);border-radius:18px 18px 18px 4px;max-width:75%;word-break:break-word;';
    const metaStyle = isOut
      ? 'font-size:11px;color:var(--text-muted);margin-top:3px;text-align:right;'
      : 'font-size:11px;color:var(--text-muted);margin-top:3px;';
    const status = isOut
      ? `<span style="color:${m.read?'var(--secondary)':'var(--text-muted)'};">${m.read?'✓✓ Visualizado':'✓ Enviado'}</span>`
      : '';
    const label = isOut
      ? `<span style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">${Utils.escape(m.fromName||'Escola')}</span>`
      : `<span style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">${Utils.escape(m.fromName||'Responsável')}</span>`;
    return `<div style="${wrapStyle}">
      ${label}
      <div style="${bubbleStyle}">
        ${m.subject?`<div style="font-size:11px;font-weight:700;margin-bottom:4px;${isOut?'color:rgba(255,255,255,0.75);':'color:var(--text-muted);'}">${Utils.escape(m.subject)}</div>`:''}
        <div style="font-size:14px;line-height:1.5;">${Utils.escape(m.text)}</div>
      </div>
      <div style="${metaStyle}">${Utils.datetime(m.sentAt)} ${status}</div>
    </div>`;
  },

  openConv(studentId) {
    const conv = this._conversations.find(c=>c.studentId===studentId);
    if (!conv) return;

    // Destaca item ativo
    document.querySelectorAll('.gm-conv-item').forEach(el => {
      el.style.background = el.dataset.sid === studentId ? 'rgba(37,99,235,.08)' : '';
    });

    // Cabeçalho do chat
    const cls    = this._allClasses.find(c=>c.id===conv.classId);
    const header = document.getElementById('gmChatHeader');
    const title  = document.getElementById('gmChatTitle');
    const sub    = document.getElementById('gmChatSub');
    if (header) header.style.display = 'block';
    if (title)  title.textContent = conv.studentName;
    if (sub)    sub.textContent   = `${cls?.name||'–'} ${conv.matricula?'· Matrícula: '+conv.matricula:''}`;

    // Renderiza mensagens
    const box = document.getElementById('gmChatMessages');
    if (box) {
      box.innerHTML = conv.msgs.map(m => this._bubble(m)).join('');
      box.scrollTop = box.scrollHeight;
    }

    // Marca como lidas apenas as mensagens RECEBIDAS pelo gestor (toUserId = gestor)
    // Não afeta as mensagens enviadas ao pai (toUserId = parentId) nem as do professor
    const gestorUser = Auth.current();
    const gestorId   = gestorUser?.id;
    conv.msgs.forEach(m => {
      if (!m.read && m.toUserId === gestorId) {
        DB.markMessageRead(m.id);
        m.read = true;
      }
    });
    // Atualiza badge e bolinha na lista de conversas
    conv.unread = conv.msgs.filter(m => !m.read && m.toUserId === gestorId).length;
    const convItem = document.querySelector(`.gm-conv-item[data-sid="${studentId}"]`);
    if (convItem) {
      const badge = convItem.querySelector('span[style*="border-radius:10px"]');
      if (badge) badge.remove();
    }
    // Atualiza badge global no nav
    const navBadge = document.querySelector('.nav-item.active ~ .nav-item span[style*="var(--danger)"], .nav-item span[style*="var(--danger)"]');
    const totalUnread = DB.getMessages().filter(m => m.toUserId === gestorId && !m.read).length;
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.onclick?.toString().includes('gestor-messages')) {
        const b = el.querySelector('span[style*="var(--danger)"]');
        if (b) { if (totalUnread > 0) b.textContent = totalUnread > 9 ? '9+' : totalUnread; else b.remove(); }
      }
    });
  },

  filter() {
    const classId = document.getElementById('gmClass').value;
    let msgs = this._allMessages;
    if (classId) {
      const sids = this._allStudents.filter(s=>s.classId===classId).map(s=>s.id);
      msgs = msgs.filter(m => m.classId===classId || sids.includes(m.studentId));
    }
    const convs = this._buildConvs ? this._buildConvs(msgs) : [];
    this._conversations = convs;
    const list = document.getElementById('gmConvList');
    if (!list) return;
    list.innerHTML = convs.length === 0
      ? `<div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:14px;">Nenhuma conversa.</div>`
      : convs.map(c => this._convItem ? this._convItem(c) : '').join('');
    // Limpa chat ao filtrar
    const box = document.getElementById('gmChatMessages');
    if (box) box.innerHTML = `<div style="margin:auto;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-comments" style="font-size:36px;opacity:.4;margin-bottom:8px;"></i><p style="font-size:14px;">Clique em uma conversa para visualizar</p></div>`;
    const header = document.getElementById('gmChatHeader');
    if (header) header.style.display = 'none';
  }
};
*/
