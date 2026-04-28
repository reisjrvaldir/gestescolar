// =============================================
//  GESTESCOLAR – PAINEL DO RESPONSÁVEL (PAI/MÃE)
// =============================================

Router.register('parent-dashboard', () => {
  const user = Auth.require(); if (!user) return;
  const student = DB.getStudents().find(s => s.id === user.studentId);
  const messages = DB.getMessagesForUser(user.id);
  const unread   = messages.filter(m => !m.read);

  if (!student) {
    Router.renderLayout(user, 'parent-dashboard', `
      <div class="card"><div class="empty-state">
        <i class="fa-solid fa-user-graduate"></i>
        <p>Nenhum aluno vinculado à sua conta. Contate o administrador.</p>
      </div></div>`);
    return;
  }

  const cls     = DB.getClasses().find(c => c.id === student.classId);
  const pct     = Utils.attendancePercent(student.id);
  const grades  = DB.getStudentGrades(student.id);
  const invoices= DB.getStudentInvoices(student.id);
  const pending = invoices.filter(i => i.status === 'pendente');

  // Puxar matérias da turma
  let subjects = (cls?.subjects && cls.subjects.length > 0) ? cls.subjects : [];
  if (subjects.length === 0 && grades.length > 0) {
    const seen = new Set();
    grades.forEach(g => { if (g.subject) seen.add(g.subject); });
    subjects = [...seen].sort();
  }

  // Foto do aluno (localStorage)
  const photoKey  = `student_photo_${student.id}`;
  const photoUrl  = localStorage.getItem(photoKey) || '';

  const content = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      <!-- Avatar com foto ou ícone -->
      <div style="position:relative;flex-shrink:0;">
        <div id="student-avatar" style="width:72px;height:72px;border-radius:50%;overflow:hidden;
             background:#e3f2fd;border:3px solid var(--primary);display:flex;align-items:center;justify-content:center;cursor:pointer;"
             onclick="document.getElementById('student-photo-input').click()" title="Clique para adicionar foto">
          ${photoUrl
            ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<i class="fa-solid fa-user-graduate" style="font-size:30px;color:var(--primary);"></i>`}
        </div>
        <div style="position:absolute;bottom:0;right:0;width:22px;height:22px;border-radius:50%;
             background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;
             cursor:pointer;font-size:11px;" onclick="document.getElementById('student-photo-input').click()" title="Editar foto">
          <i class="fa-solid fa-camera"></i>
        </div>
        <input type="file" id="student-photo-input" accept="image/*" style="display:none;"
          onchange="(function(e){
            const f=e.target.files[0]; if(!f)return;
            if(f.size > 204800){ Utils.toast('Imagem muito grande. Máximo 200 KB.','error'); return; }
            const r=new FileReader(); r.onload=function(ev){
              try{ localStorage.setItem('${photoKey}',ev.target.result); }catch(ex){ Utils.toast('Não foi possível salvar a foto localmente.','error'); return; }
              const av=document.getElementById('student-avatar');
              if(av)av.innerHTML='<img src=\\''+ev.target.result+'\\' style=\\'width:100%;height:100%;object-fit:cover;\\' />';
            }; r.readAsDataURL(f);
          })(event)" />
      </div>
      <div>
        <h2 style="margin:0;">${Utils.escape(student.name)}</h2>
        <div class="text-muted">${cls ? Utils.escape(cls.name) : '–'} · ${new Date().getFullYear()} · Matrícula: <strong>${Utils.escape(student.matricula || '–')}</strong></div>
      </div>
    </div>

    ${unread.length > 0 ? `
      <div class="alert alert-info">
        <i class="fa-solid fa-bell"></i>
        Você tem <strong>${unread.length} mensagem(ns) nova(s)</strong> do professor.
        <a href="#" onclick="Router.go('parent-messages')">Ver agora</a>
      </div>` : ''}

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon ${pct>=75?'green':pct>=50?'yellow':'red'}">
          <i class="fa-solid fa-clipboard-check"></i>
        </div>
        <div>
          <div class="stat-value">${pct}%</div>
          <div class="stat-label">Frequência</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">
          <i class="fa-solid fa-star"></i>
        </div>
        <div>
          <div class="stat-value">${grades.length}</div>
          <div class="stat-label">Avaliações lançadas</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${pending.length>0?'red':'green'}">
          <i class="fa-solid fa-file-invoice"></i>
        </div>
        <div>
          <div class="stat-value">${pending.length}</div>
          <div class="stat-label">Pagamento(s) pendente(s)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">
          <i class="fa-solid fa-envelope"></i>
        </div>
        <div>
          <div class="stat-value">${unread.length}</div>
          <div class="stat-label">Mensagens não lidas</div>
        </div>
      </div>
    </div>

    <!-- MATÉRIAS DO ALUNO -->
    ${subjects.length > 0 ? `
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-book"></i> Matérias</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;padding:0;">
        ${subjects.map(sub => `
          <div style="background:linear-gradient(135deg,#f5f7fa,#ffffff);border:1px solid #e0e6ed;border-radius:8px;padding:16px;text-align:center;">
            <i class="fa-solid fa-book" style="font-size:24px;color:var(--primary);margin-bottom:8px;display:block;"></i>
            <div style="font-weight:600;font-size:13px;color:#0d1b2a;">${Utils.escape(sub)}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:0;">

      <!-- PRESENÇAS RECENTES -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-clipboard-check"></i> Frequência</span>
          <button class="btn btn-outline btn-sm" onclick="Router.go('parent-attendance')">Ver tudo</button>
        </div>
        ${(() => {
          const att = DB.getStudentAttendance(student.id).sort((a,b) => b.date.localeCompare(a.date));
          const ultimas = att.slice(0,7);
          const barColor = r => r.status === 'presente' ? 'var(--secondary)' : r.status === 'justificado' ? '#f9ab00' : 'var(--danger)';
          const icon = r => r.status === 'presente' ? '✅' : r.status === 'justificado' ? '⚠️' : '❌';
          return ultimas.length === 0
            ? `<div class="empty-state"><i class="fa-solid fa-clipboard-check"></i><p>Nenhuma chamada registrada.</p></div>`
            : `<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">${pct}% de frequência geral</div>
               <div style="background:#f0f0f0;border-radius:20px;height:8px;margin-bottom:12px;">
                 <div style="width:${pct}%;height:100%;border-radius:20px;background:${pct>=75?'var(--secondary)':pct>=50?'#f9ab00':'var(--danger)'}"></div>
               </div>
               ${ultimas.map(r => `
                 <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">
                   <span>${Utils.date(r.date)}</span>
                   <span>${icon(r)} ${r.status}</span>
                 </div>`).join('')}`;
        })()}
      </div>

      <!-- ÚLTIMAS NOTAS -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-star"></i> Notas</span>
          <button class="btn btn-outline btn-sm" onclick="Router.go('parent-grades')">Ver boletim</button>
        </div>
        ${grades.length === 0 ? `<div class="empty-state"><i class="fa-solid fa-star"></i><p>Nenhuma nota lançada ainda.</p></div>` :
          grades.slice(0,6).map(g => {
            const v = parseFloat(g.gradeValue || g.grade || 0);
            const max = parseFloat(g.maxValue || 10);
            const pctG = max > 0 ? Math.round((v/max)*100) : 0;
            const cor = pctG >= 70 ? 'var(--secondary)' : pctG >= 50 ? '#f9ab00' : 'var(--danger)';
            return `<div style="padding:6px 0;border-bottom:1px solid #f5f5f5;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <span style="font-size:13px;font-weight:600;">${Utils.escape(g.subject)}</span>
                <span style="font-size:13px;font-weight:700;color:${cor};">${v}/${max}</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">${Utils.escape(g.period || '')}</div>
              <div style="background:#f0f0f0;border-radius:20px;height:5px;">
                <div style="width:${pctG}%;height:100%;border-radius:20px;background:${cor};"></div>
              </div>
            </div>`;
          }).join('')}
      </div>

      <!-- PAGAMENTOS -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-file-invoice"></i> Mensalidades</span>
          <button class="btn btn-outline btn-sm" onclick="Router.go('parent-invoices')">Ver todos</button>
        </div>
        ${(() => {
          const now = new Date();
          const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
          const isMensal = i => /mensalidade/i.test(i.description || '');
          const mensais  = invoices.filter(isMensal);
          // Gera 5 meses: atual + 4 próximos
          const meses = Array.from({length:5}, (_,k) => {
            const d = new Date(now.getFullYear(), now.getMonth()+k, 1);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          });
          return meses.map(mk => {
            const inv = mensais.find(i => i.dueDate && i.dueDate.startsWith(mk));
            const [y,m] = mk.split('-');
            const label = `${MONTHS_PT[parseInt(m)-1]} / ${y}`;
            if (!inv) return `
              <div style="padding:8px 0;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;font-size:13px;">${label}</div>
                  <div class="text-muted" style="font-size:11px;">Sem cobrança lançada</div>
                </div>
                <span style="font-size:11px;color:var(--text-muted);">–</span>
              </div>`;
            const pago  = inv.status === 'pago';
            const venc  = !pago && Utils.isOverdue(inv.dueDate);
            const cor   = pago ? 'var(--secondary)' : venc ? 'var(--danger)' : '#f9a825';
            return `
              <div style="padding:8px 0;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:600;font-size:13px;">${label}</div>
                  <div class="text-muted" style="font-size:11px;">Vence: ${Utils.date(inv.dueDate)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <strong style="color:${cor};">${Utils.currency(inv.amount)}</strong>
                  ${pago
                    ? `<span style="font-size:11px;color:var(--secondary);"><i class="fa-solid fa-check-circle"></i> Pago</span>`
                    : `<button class="btn btn-primary btn-sm" style="font-size:11px;padding:3px 8px;" onclick="ParentInvoices.payPix('${inv.id}')"><i class="fa-solid fa-qrcode"></i> PIX</button>`}
                </div>
              </div>`;
          }).join('');
        })()}

        <!-- COBRANÇAS EXTRAS -->
        ${(() => {
          const isMensal = i => /mensalidade/i.test(i.description || '');
          const avulsas = invoices.filter(i => !isMensal(i) && i.status !== 'pago')
            .sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,3);
          if (!avulsas.length) return '';
          return `<div style="margin-top:10px;padding:10px;background:#f3e5f5;border-radius:8px;border-left:4px solid #7b1fa2;">
            <div style="font-size:11px;font-weight:700;color:#7b1fa2;margin-bottom:6px;text-transform:uppercase;">
              <i class="fa-solid fa-receipt"></i> Cobranças Extras
            </div>
            ${avulsas.map(inv => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #e1bee7;font-size:12px;">
                <div>
                  <div style="font-weight:600;color:#4a148c;">${Utils.escape(inv.description)}</div>
                  <div style="color:#8e24aa;">Vence: ${Utils.date(inv.dueDate)}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <strong style="color:#7b1fa2;">${Utils.currency(inv.amount)}</strong>
                  <button class="btn btn-sm" style="background:#7b1fa2;color:#fff;border:none;font-size:10px;padding:3px 7px;border-radius:6px;"
                    onclick="ParentInvoices.payPix('${inv.id}')"><i class="fa-solid fa-qrcode"></i></button>
                </div>
              </div>`).join('')}
          </div>`;
        })()}
      </div>

    </div>
  `;
  Router.renderLayout(user, 'parent-dashboard', content);
});

// --- Presenças ---
Router.register('parent-attendance', () => {
  const user = Auth.require(); if (!user) return;
  const student   = DB.getStudents().find(s => s.id === user.studentId);
  if (!student) { Router.renderLayout(user, 'parent-attendance', `<div class="card"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><p>Nenhum aluno vinculado.</p></div></div>`); return; }

  const records = DB.getStudentAttendance(student.id).sort((a,b) => b.date.localeCompare(a.date));
  const total   = records.length;
  const present = records.filter(r => r.status === 'presente').length;
  const absent  = total - present;
  const pct     = total ? Math.round((present/total)*100) : 0;

  const content = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-clipboard-check"></i> Presenças – ${Utils.escape(student.name)}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div class="fin-card" style="border-top:4px solid var(--secondary);">
          <div class="fin-card-label">Total de Aulas</div>
          <div class="fin-card-value" style="font-size:28px;">${total}</div>
        </div>
        <div class="fin-card" style="border-top:4px solid var(--secondary);">
          <div class="fin-card-label">Presenças</div>
          <div class="fin-card-value" style="font-size:28px;color:var(--secondary);">${present}</div>
        </div>
        <div class="fin-card" style="border-top:4px solid var(--danger);">
          <div class="fin-card-label">Faltas</div>
          <div class="fin-card-value" style="font-size:28px;color:var(--danger);">${absent}</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-weight:600;">Frequência</span>
          <span style="font-weight:800;color:${pct>=75?'var(--secondary)':pct>=50?'#b06000':'var(--danger)'};">${pct}%</span>
        </div>
        <div class="progress-bar-wrap" style="height:12px;border-radius:20px;">
          <div class="progress-bar" style="width:${pct}%;height:12px;background:${pct>=75?'var(--secondary)':pct>=50?'var(--warning)':'var(--danger)'};"></div>
        </div>
        ${pct < 75 ? `<div class="alert alert-warning mt-8"><i class="fa-solid fa-triangle-exclamation"></i> Frequência abaixo de 75%. Atenção: o mínimo exigido é 75%.</div>` : ''}
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Status</th></tr></thead>
          <tbody>
            ${records.length === 0 ? `<tr><td colspan="2"><div class="empty-state"><i class="fa-solid fa-clipboard"></i><p>Nenhum registro de presença.</p></div></td></tr>` :
              records.map(r => `<tr>
                <td>${Utils.date(r.date)}</td>
                <td>${Utils.statusBadge(r.status)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  Router.renderLayout(user, 'parent-attendance', content);
});

// --- Avaliações / Boletim ---
Router.register('parent-grades', () => {
  const user = Auth.require(); if (!user) return;
  const student = DB.getStudents().find(s => s.id === user.studentId);
  if (!student) { Router.renderLayout(user, 'parent-grades', `<div class="card"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><p>Nenhum aluno vinculado.</p></div></div>`); return; }

  const cls      = DB.getClasses().find(c => c.id === student.classId);
  const grades   = DB.getStudentGrades(student.id);
  const units    = ['1ª Unidade', '2ª Unidade', '3ª Unidade', '4ª Unidade'];

  // Usa matérias da turma; se vazio, extrai das notas lançadas
  let subjects = (cls?.subjects && cls.subjects.length > 0) ? cls.subjects : [];
  if (subjects.length === 0 && grades.length > 0) {
    const seen = new Set();
    grades.forEach(g => { if (g.subject) seen.add(g.subject); });
    subjects = [...seen].sort();
  }

  const getG = (sub, u, av) => {
    // Tenta formato "1ª Unidade|av1" e também só "av1" ou o period direto
    const g = grades.find(g => g.subject === sub && (g.unit === `${u}|${av}` || g.period === `${u}|${av}`));
    if (g) return parseFloat(g.gradeValue ?? g.grade);
    // Fallback: procura por gradeType = av
    const g2 = grades.find(g => g.subject === sub && (g.gradeType === av || g.unit === av) && (g.period || '').includes(u.replace('ª Unidade','').trim()));
    return g2 ? parseFloat(g2.gradeValue ?? g2.grade) : null;
  };
  const unitAvg = (sub, u) => {
    const a1 = getG(sub, u, 'av1'), a2 = getG(sub, u, 'av2');
    if (a1 === null && a2 === null) return null;
    const vals = [a1, a2].filter(v => v !== null);
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  };
  const effectiveAvg = (sub, u) => {
    const ua = unitAvg(sub, u);
    const rec = getG(sub, u, 'rec');
    if (ua === null) return null;
    return (ua < 6 && rec !== null) ? Math.max(ua, rec) : ua;
  };

  const cor  = n => n === null ? 'var(--text-muted)' : n >= 6 ? 'var(--secondary)' : 'var(--danger)';
  const fmt  = n => n !== null
    ? `<span style="font-weight:600;color:${cor(n)};">${n.toFixed(1)}</span>`
    : `<span style="color:var(--text-muted);">–</span>`;

  const subjectCards = subjects.map(sub => {
    const notas   = units.map(u => effectiveAvg(sub, u));
    const valid   = notas.filter(v => v !== null);
    const avg     = valid.length === 4
      ? notas.reduce((a,b)=>a+b,0) / 4
      : valid.length > 0 ? valid.reduce((a,b)=>a+b,0) / valid.length : null;
    const aprovado = avg !== null && parseFloat(avg.toFixed(1)) >= 6;

    const unitRows = units.map(u => {
      const av1   = getG(sub, u, 'av1');
      const av2   = getG(sub, u, 'av2');
      const media = unitAvg(sub, u);
      const rec   = getG(sub, u, 'rec');
      const nota  = effectiveAvg(sub, u);
      return `<tr>
        <td style="font-weight:500;color:var(--text-muted);font-size:13px;">${u}</td>
        <td style="text-align:center;">${fmt(av1)}</td>
        <td style="text-align:center;">${fmt(av2)}</td>
        <td style="text-align:center;">${fmt(media)}</td>
        <td style="text-align:center;">${fmt(rec)}</td>
        <td style="text-align:center;">
          ${nota !== null
            ? `<span style="display:inline-block;min-width:40px;padding:3px 8px;border-radius:var(--radius);font-size:13px;font-weight:700;color:#fff;background:${nota>=6?'var(--secondary)':'var(--danger)'};">${nota.toFixed(1)}</span>`
            : `<span style="color:var(--text-muted);">–</span>`}
        </td>
      </tr>`;
    }).join('');

    return `<div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <span class="card-title">${Utils.escape(sub)}</span>
        <span style="display:inline-flex;align-items:center;gap:8px;margin-left:auto;">
          <span style="font-size:12px;color:var(--text-muted);">Média Final:</span>
          ${avg !== null
            ? `<span style="display:inline-block;padding:4px 12px;border-radius:var(--radius);font-size:15px;font-weight:700;color:#fff;background:${aprovado?'var(--secondary)':'var(--danger)'};">${avg.toFixed(1)}</span>
               ${aprovado ? '<span class="badge badge-green">Aprovado</span>' : '<span class="badge badge-red">Reprovado</span>'}`
            : '<span style="color:var(--text-muted);font-size:13px;">Sem notas</span>'}
        </span>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr>
            <th>Unidade</th>
            <th style="text-align:center;">Av. 1</th>
            <th style="text-align:center;">Av. 2</th>
            <th style="text-align:center;">Média</th>
            <th style="text-align:center;">Av. Rec.</th>
            <th style="text-align:center;">Nota Final</th>
          </tr></thead>
          <tbody>${unitRows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  const content = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:20px;">
      <div>
        <h2 style="margin:0;font-size:20px;"><i class="fa-solid fa-star" style="color:var(--primary);margin-right:8px;"></i>Boletim – ${Utils.escape(student.name)}</h2>
        ${cls ? `<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${Utils.escape(cls.name)}</div>` : ''}
      </div>
      <button class="btn btn-outline btn-sm" onclick="ParentGrades.exportPDF()">
        <i class="fa-solid fa-file-pdf"></i> Exportar PDF
      </button>
    </div>
    ${subjects.length === 0
      ? `<div class="card"><div class="empty-state"><i class="fa-solid fa-star"></i><p>Nenhuma matéria cadastrada para esta turma.</p></div></div>`
      : subjectCards}
  `;
  Router.renderLayout(user, 'parent-grades', content);
});

const ParentGrades = {
  exportPDF() {
    const user    = Auth.current();
    const student = DB.getStudents().find(s => s.id === user.studentId);
    if (!student) return;

    const cls      = DB.getClasses().find(c => c.id === student.classId);
    const teacher  = cls?.teacherId ? DB.getUsers().find(u => u.id === cls.teacherId) : null;
    const school   = DB.getSchoolConfig();
    const grades   = DB.getStudentGrades(student.id);
    const units    = ['1ª Unidade', '2ª Unidade', '3ª Unidade', '4ª Unidade'];

    let subjects = (cls?.subjects && cls.subjects.length > 0) ? cls.subjects : [];
    if (subjects.length === 0 && grades.length > 0) {
      const seen = new Set(); grades.forEach(g => { if (g.subject) seen.add(g.subject); }); subjects = [...seen].sort();
    }

    const getG = (sub, u, av) => {
      const g = grades.find(g => g.subject === sub && (g.unit === `${u}|${av}` || g.period === `${u}|${av}`));
      if (g) return parseFloat(g.gradeValue ?? g.grade);
      const g2 = grades.find(g => g.subject === sub && (g.gradeType === av || g.unit === av) && (g.period || '').includes(u.replace('ª Unidade','').trim()));
      return g2 ? parseFloat(g2.gradeValue ?? g2.grade) : null;
    };
    const uAvg = (sub, u) => { const a1=getG(sub,u,'av1'), a2=getG(sub,u,'av2'); if(a1===null&&a2===null)return null; const v=[a1,a2].filter(x=>x!==null); return v.reduce((a,b)=>a+b,0)/v.length; };
    const eAvg = (sub, u) => { const ua=uAvg(sub,u); const r=getG(sub,u,'rec'); if(ua===null)return null; return (ua<6&&r!==null)?Math.max(ua,r):ua; };

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const mg = 14;
    let y = 0;

    // ── Cabeçalho azul ──────────────────────────────────────────────────────
    doc.setFillColor(26, 115, 232);
    doc.rect(0, 0, W, 38, 'F');

    let logoX = mg;
    if (school.logo) {
      try { doc.addImage(school.logo, 'PNG', mg, 5, 26, 26); logoX = mg + 30; } catch(_) {}
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont(undefined, 'bold');
    doc.text(school.name || 'GestEscolar', logoX, 16);
    doc.setFontSize(9);  doc.setFont(undefined, 'normal');
    if (school.cnpj) doc.text(`CNPJ: ${school.cnpj}`, logoX, 23);

    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('BOLETIM DE AVALIAÇÕES', W - mg, 15, { align: 'right' });
    doc.setFontSize(9);  doc.setFont(undefined, 'normal');
    doc.text(new Date().toLocaleDateString('pt-BR'), W - mg, 23, { align: 'right' });

    y = 46;

    // ── Dados do aluno ───────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 30); doc.setFontSize(9);
    const info = [
      ['Aluno:', student.name],
      ['Matrícula:', student.matricula || '–'],
      ['Turma:', cls?.name || '–'],
      ['Professor(a):', teacher?.name || '–'],
    ];
    let ix = mg;
    info.forEach(([label, val]) => {
      doc.setFont(undefined, 'bold');  doc.text(label, ix, y);
      doc.setFont(undefined, 'normal'); doc.text(val, ix + doc.getTextWidth(label) + 2, y);
      ix += 70;
    });
    y += 6;
    doc.setDrawColor(200); doc.line(mg, y, W - mg, y);
    y += 7;

    // ── Tabela ───────────────────────────────────────────────────────────────
    const CW = [58, 30, 30, 30, 30, 30, 28]; // mat,u1,u2,u3,u4,média,sit
    const headers = ['Matéria', '1ª Unidade', '2ª Unidade', '3ª Unidade', '4ª Unidade', 'Média Final', 'Situação'];
    const RH = 8;

    // header row
    doc.setFillColor(232, 240, 254);
    doc.rect(mg, y, CW.reduce((a,b)=>a+b,0), RH, 'F');
    doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 30, 30);
    let cx = mg;
    headers.forEach((h, i) => { doc.text(h, cx + CW[i]/2, y + 5.5, { align: 'center' }); cx += CW[i]; });
    y += RH;

    subjects.forEach((sub, idx) => {
      const notas = units.map(u => eAvg(sub, u));
      const valid = notas.filter(v => v !== null);
      const avg   = valid.length === 4 ? notas.reduce((a,b)=>a+b,0)/4 : valid.length > 0 ? valid.reduce((a,b)=>a+b,0)/valid.length : null;
      const aprov = avg !== null && parseFloat(avg.toFixed(1)) >= 6;

      if (idx % 2 === 1) { doc.setFillColor(248, 249, 252); doc.rect(mg, y, CW.reduce((a,b)=>a+b,0), RH, 'F'); }

      cx = mg;
      doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(30,30,30);
      doc.text(sub.length > 22 ? sub.substring(0,21)+'…' : sub, cx + 2, y + 5.5);
      cx += CW[0];

      doc.setFont(undefined, 'normal');
      notas.forEach((n, i) => {
        if (n !== null) doc.setTextColor(n>=6?34:200, n>=6?150:50, n>=6?60:50);
        else doc.setTextColor(160);
        doc.text(n !== null ? n.toFixed(1) : '–', cx + CW[i+1]/2, y + 5.5, { align: 'center' });
        cx += CW[i+1];
      });

      doc.setFont(undefined, 'bold');
      if (avg !== null) { doc.setTextColor(aprov?34:200, aprov?150:50, aprov?60:50); doc.text(avg.toFixed(1), cx + CW[5]/2, y + 5.5, { align: 'center' }); }
      else { doc.setTextColor(160); doc.text('–', cx + CW[5]/2, y + 5.5, { align: 'center' }); }
      cx += CW[5];

      doc.setFont(undefined, 'normal');
      if (avg !== null) { doc.setTextColor(aprov?34:200, aprov?150:50, aprov?60:50); doc.text(aprov?'Aprovado':'Reprovado', cx + CW[6]/2, y + 5.5, { align: 'center' }); }
      else { doc.setTextColor(160); doc.text('–', cx + CW[6]/2, y + 5.5, { align: 'center' }); }

      doc.setDrawColor(225); doc.line(mg, y + RH, W - mg, y + RH);
      y += RH;
    });

    // ── Rodapé ───────────────────────────────────────────────────────────────
    y += 8;
    doc.setTextColor(160); doc.setFontSize(7); doc.setFont(undefined, 'normal');
    doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} · GestEscolar`, W/2, y, { align: 'center' });

    doc.save(`boletim_${student.name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`);
  }
};

// --- Pagamentos (próximo + pendentes + pagos) ---
Router.register('parent-invoices', async () => {
  const user = Auth.require(); if (!user) return;
  const student  = DB.getStudents().find(s => s.id === user.studentId);
  if (!student) { Router.renderLayout(user, 'parent-invoices', `<div class="card"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i><p>Nenhum aluno vinculado.</p></div></div>`); return; }

  // Sincroniza com o Supabase para pegar pagamentos confirmados pelo webhook
  await DB.refreshInvoices?.();

  const invoices = DB.getStudentInvoices(student.id);
  const today      = new Date();
  const year       = today.getFullYear();
  const monthIdx   = today.getMonth();
  const monthKey   = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const MONTHS     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Classifica mensalidade vs avulsa pela descrição
  const isMensalidade = (i) => /mensalidade/i.test(i.description || '');

  // Mensalidades
  const mensalidades = invoices.filter(isMensalidade);
  const proximoPagamento = mensalidades.find(i => i.dueDate && i.dueDate.startsWith(monthKey) && i.status !== 'pago');

  // Ordenação: vencidas primeiro (mais antigas no topo) + futuras crescente
  // Ex: Abril (vencida) → Maio → Junho → ... → Dezembro
  const hojeRef = new Date(); hojeRef.setHours(0,0,0,0);
  const pendentes = mensalidades
    .filter(i => i.status !== 'pago' && i.dueDate && !i.dueDate.startsWith(monthKey))
    .sort((a, b) => {
      const da = new Date(a.dueDate + 'T00:00:00');
      const db = new Date(b.dueDate + 'T00:00:00');
      const aVencida = da < hojeRef;
      const bVencida = db < hojeRef;
      // Vencidas vêm antes de não vencidas
      if (aVencida && !bVencida) return -1;
      if (!aVencida && bVencida) return 1;
      // Dentro do mesmo grupo: ordem crescente (mais antigo/próximo primeiro)
      return da - db;
    });

  const pagos = mensalidades
    .filter(i => i.status === 'pago')
    .sort((a, b) => new Date(b.paidAt || b.dueDate) - new Date(a.paidAt || a.dueDate));

  // Cobranças extras (avulsas): do aluno OU da turma do aluno
  const allInvoices = DB.getInvoices ? DB.getInvoices() : invoices;
  const avulsas = allInvoices.filter(i =>
    !isMensalidade(i) &&
    (i.studentId === student.id || (student.classId && i.classId === student.classId))
  );
  const avulsasPendentes = avulsas
    .filter(i => i.status !== 'pago')
    .sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));
  const avulsasPagas = avulsas
    .filter(i => i.status === 'pago')
    .sort((a, b) => new Date(b.paidAt || b.dueDate || 0) - new Date(a.paidAt || a.dueDate || 0));

  // ── Helpers de renderização ──────────────────────
  function monthLabel(dateStr) {
    if (!dateStr) return '–';
    const [y, m] = dateStr.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]} / ${y}`;
  }

  function pendingRow(inv) {
    const overdue = Utils.isOverdue(inv.dueDate);
    const color = overdue ? 'var(--danger)' : '#f9a825';
    const bg    = overdue ? '#fdecea' : '#fff8e1';
    const icon  = overdue ? 'fa-triangle-exclamation' : 'fa-clock';
    const label = overdue ? 'Vencido' : 'Pendente';
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;
        border:1px solid ${color};border-radius:var(--radius);background:${bg};margin-bottom:8px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-weight:700;font-size:15px;">${monthLabel(inv.dueDate)}</span>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${color};">
            <i class="fa-solid ${icon}"></i> ${label}
          </span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(inv.description || '–')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Vencimento: ${Utils.date(inv.dueDate)}</div>
      </div>
      <div style="flex-shrink:0;text-align:right;">
        <div style="font-weight:800;font-size:18px;color:var(--primary);margin-bottom:6px;">${Utils.currency(inv.amount)}</div>
        <button class="btn btn-primary btn-sm" onclick="ParentInvoices.payPix('${inv.id}')">
          <i class="fa-solid fa-qrcode"></i> Gerar PIX
        </button>
      </div>
    </div>`;
  }

  function paidRow(inv) {
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;
        border:1px solid var(--secondary);border-radius:var(--radius);background:#e6f4ea;margin-bottom:8px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
          <span style="font-weight:700;font-size:15px;">${monthLabel(inv.dueDate)}</span>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--secondary);">
            <i class="fa-solid fa-circle-check"></i> Pago
          </span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(inv.description || '–')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Pago em ${Utils.date(inv.paidAt || inv.dueDate)}</div>
      </div>
      <div style="flex-shrink:0;text-align:right;">
        <div style="font-weight:800;font-size:18px;color:var(--secondary);margin-bottom:6px;">${Utils.currency(inv.amount)}</div>
        <button class="btn btn-outline btn-sm" onclick="ParentInvoices.emitirRecibo('${inv.id}')">
          <i class="fa-solid fa-receipt"></i> Emitir Nota
        </button>
        <button class="btn btn-outline btn-sm" style="margin-top:4px;" onclick="ParentInvoices.solicitarComprovante('${inv.id}')">
          <i class="fa-solid fa-file-invoice"></i> Comprovante
        </button>
      </div>
    </div>`;
  }

  // ── Caixa "Próximo Pagamento" ────────────────────
  const proximoBox = proximoPagamento ? `
    <div style="background:linear-gradient(135deg,#1a73e8 0%,#34a853 100%);border-radius:var(--radius);
                padding:20px 24px;margin-bottom:20px;color:#fff;box-shadow:var(--shadow);">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:12px;opacity:.9;text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:4px;">
            <i class="fa-solid fa-bolt"></i> Próximo Pagamento
          </div>
          <div style="font-size:20px;font-weight:800;">${monthLabel(proximoPagamento.dueDate)}</div>
          <div style="font-size:13px;opacity:.9;margin-top:2px;">${Utils.escape(proximoPagamento.description || '')}</div>
          <div style="font-size:12px;opacity:.85;margin-top:4px;">
            <i class="fa-solid fa-calendar"></i> Vencimento: ${Utils.date(proximoPagamento.dueDate)}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:900;line-height:1;">${Utils.currency(proximoPagamento.amount)}</div>
          <button class="btn btn-sm" style="background:#fff;color:#1a73e8;border:none;font-weight:700;margin-top:10px;"
                  onclick="ParentInvoices.payPix('${proximoPagamento.id}')">
            <i class="fa-solid fa-qrcode"></i> Pagar via PIX agora
          </button>
        </div>
      </div>
    </div>
  ` : `
    <div style="background:#e6f4ea;border:1px solid var(--secondary);border-radius:var(--radius);
                padding:16px 20px;margin-bottom:20px;color:var(--secondary);">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:4px;">
        <i class="fa-solid fa-bolt"></i> Próximo Pagamento
      </div>
      <div style="font-size:14px;font-weight:600;">
        <i class="fa-solid fa-circle-check"></i> Sem pagamento pendente para ${MONTHS[monthIdx]} / ${year}
      </div>
    </div>
  `;

  Router.renderLayout(user, 'parent-invoices', `
    <div style="display:flex;flex-direction:column;gap:16px;">

      ${proximoBox}

      ${pendentes.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-clock"></i> Mensalidades pendentes (${pendentes.length})</span>
          </div>
          <div style="padding:8px 0;">${pendentes.map(pendingRow).join('')}</div>
        </div>
      ` : ''}

      ${pagos.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-circle-check"></i> Mensalidades pagas (${pagos.length})</span>
          </div>
          <div style="padding:8px 0;">${pagos.map(paidRow).join('')}</div>
        </div>
      ` : ''}

      ${(avulsasPendentes.length + avulsasPagas.length) > 0 ? `
        <div class="card" style="border-top:4px solid #9c27b0;">
          <div class="card-header">
            <span class="card-title"><i class="fa-solid fa-receipt" style="color:#9c27b0;"></i> Cobranças Extras</span>
          </div>
          ${avulsasPendentes.length > 0 ? `
            <div style="padding:8px 16px 4px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Pendentes (${avulsasPendentes.length})</div>
            <div style="padding:0 0 8px;">${avulsasPendentes.map(pendingRow).join('')}</div>
          ` : ''}
          ${avulsasPagas.length > 0 ? `
            <div style="padding:8px 16px 4px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Pagas (${avulsasPagas.length})</div>
            <div style="padding:0 0 8px;">${avulsasPagas.map(paidRow).join('')}</div>
          ` : ''}
        </div>
      ` : ''}

      ${pendentes.length === 0 && pagos.length === 0 && !proximoPagamento && avulsasPendentes.length === 0 && avulsasPagas.length === 0 ? `
        <div class="card">
          <div class="empty-state">
            <i class="fa-solid fa-file-invoice"></i>
            <p>Nenhuma cobrança encontrada para ${Utils.escape(student.name)}.</p>
          </div>
        </div>
      ` : ''}

    </div>
  `);

  // Realtime: atualiza quando o webhook confirmar o pagamento
  if (student) {
    Realtime.subscribe('invoices', `student_id=eq.${student.id}`, async (payload) => {
      await DB.refreshInvoices?.();
      Router.go('parent-invoices');
      if (payload.eventType === 'UPDATE' && payload.new?.status === 'pago') {
        Utils.toast('Pagamento confirmado! ✓', 'success');
      }
    });
  }
});

const ParentInvoices = {
  _pollTimer: null,

  async payPix(invId) {
    const inv = DB.getInvoices().find(i => i.id === invId);
    if (!inv) return;

    // Se a fatura está vencida, NÃO reutiliza cobrança antiga:
    // o valor precisa ser recalculado com multa + juros atualizados.
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dueD = inv.dueDate ? new Date(inv.dueDate + 'T00:00:00') : null;
    const isOverdue = dueD && !isNaN(dueD.getTime()) && dueD < hoje;

    // Se já tem cobrança Asaas e NÃO está vencida, tenta buscar QR existente
    // (silent: true — evita toast "Acesso negado" caso cobrança seja de versão antiga)
    if (inv.asaasId && !isOverdue) {
      Utils.toast('Buscando QR Code...', 'info');
      const qr = await AsaasClient.getPixQrCode(inv.asaasId, { silent: true });
      if (qr && qr.payload) {
        this._showPixModal(inv, qr.payload, qr.encodedImage);
        this._startPaymentPolling(inv);
        return;
      }
      // QR existente inválido — limpa e regenera
      DB.updateInvoice(invId, { asaasId: null });
    } else if (inv.asaasId && isOverdue) {
      // Cobrança antiga para fatura vencida — descartar, será gerada nova com juros
      DB.updateInvoice(invId, { asaasId: null });
    }

    // Gerar nova cobrança Asaas
    const student = DB.getStudents().find(s => s.id === inv.studentId);
    const school = DB.getSchool(DB._schoolId);
    if (!student) { Utils.toast('Aluno não encontrado.', 'error'); return; }
    if (!school) { Utils.toast('Escola não encontrada.', 'error'); return; }

    Utils.toast('Gerando cobrança PIX...', 'info');
    const result = await AsaasClient.chargeInvoice(inv, student, school);
    if (!result) return; // erro já foi exibido pelo chargeInvoice

    // Recarrega a invoice com asaasId atualizado.
    // Expõe no objeto o valor efetivamente cobrado (com multa+juros) para
    // o modal mostrar o total correto quando a fatura estiver vencida.
    const updated = { ...(DB.getInvoices().find(i => i.id === invId) || inv), amountCharged: Number(result.value) || inv.amount };
    this._showPixModal(updated, result.pixCopiaECola, result.pixQrCodeBase64);
    this._startPaymentPolling(updated);
  },

  // Polling: verifica a cada 5s se o pagamento foi confirmado no Asaas.
  // Quando confirmar, atualiza o cache local e fecha o modal.
  _startPaymentPolling(inv) {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (!inv.asaasId) return;
    let tries = 0;
    const maxTries = 60; // 60 × 5s = 5 minutos
    this._pollTimer = setInterval(async () => {
      tries++;
      // Para se modal fechou ou excedeu limite
      if (tries > maxTries || !document.querySelector('.modal-overlay')) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
        return;
      }
      try {
        const payment = await AsaasClient.getPayment(inv.asaasId);
        if (payment && (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED')) {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
          // Atualiza cache local — webhook já atualizou Supabase
          DB.updateInvoice(inv.id, {
            status: 'pago',
            paidAt: payment.confirmedDate || payment.paymentDate || new Date().toISOString(),
          });
          // Recarrega invoices + transactions do Supabase
          await DB.refreshInvoices?.();
          document.querySelector('.modal-overlay')?.remove();
          Utils.toast('Pagamento confirmado! Obrigado.', 'success');
          Router.go('parent-invoices');
        }
      } catch (e) { /* silencioso */ }
    }, 5000);
  },

  // Gera recibo PDF do pagamento
  emitirRecibo(invId) {
    const inv = DB.getInvoices().find(i => i.id === invId);
    if (!inv) { Utils.toast('Cobrança não encontrada.', 'error'); return; }
    if (inv.status !== 'pago') { Utils.toast('Apenas pagamentos confirmados.', 'error'); return; }

    const student = DB.getStudents().find(s => s.id === inv.studentId);
    const school  = DB.getSchool(inv.schoolId || DB._schoolId);

    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      Utils.toast('Biblioteca PDF não carregada.', 'error');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = 210;

    // Cabeçalho
    doc.setFillColor(26, 115, 232);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('RECIBO DE PAGAMENTO', W / 2, 12, { align: 'center' });
    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    doc.text(school?.name || 'Escola', W / 2, 20, { align: 'center' });

    // Corpo
    doc.setTextColor(0);
    let y = 44;
    doc.setFontSize(10);
    const linha = (label, valor) => {
      doc.setFont(undefined, 'bold'); doc.text(label, 18, y);
      doc.setFont(undefined, 'normal'); doc.text(String(valor || '–'), 70, y);
      y += 7;
    };

    linha('Recibo nº:', inv.id.substring(0, 8).toUpperCase());
    linha('Data do pagamento:', Utils.date(inv.paidAt || inv.dueDate));
    linha('Aluno:', student?.name || inv.studentName);
    linha('Matrícula:', student?.matricula || '–');
    linha('Descrição:', inv.description || '–');
    linha('Vencimento:', Utils.date(inv.dueDate));
    linha('Forma de pagamento:', inv.paymentMethod === 'pix_asaas' ? 'PIX (Asaas)' : 'PIX');

    y += 4;
    doc.setDrawColor(220);
    doc.line(18, y, W - 18, y);
    y += 10;

    doc.setFontSize(12); doc.setFont(undefined, 'bold');
    doc.text('VALOR PAGO:', 18, y);
    doc.setFontSize(16); doc.setTextColor(26, 115, 232);
    doc.text(Utils.currency(inv.amount), W - 18, y, { align: 'right' });

    y += 18;
    doc.setTextColor(80); doc.setFontSize(9); doc.setFont(undefined, 'normal');
    const txtRecibo = `Recebemos de ${student?.parentName || student?.name || ''} a importância de ${Utils.currency(inv.amount)} referente a ${inv.description || 'serviços educacionais'}, dando plena, geral e irrevogável quitação.`;
    const lines = doc.splitTextToSize(txtRecibo, W - 36);
    doc.text(lines, 18, y);
    y += lines.length * 5 + 18;

    // Assinatura
    doc.line(W / 2 - 40, y, W / 2 + 40, y);
    y += 5;
    doc.setFontSize(9); doc.text(school?.name || 'Escola', W / 2, y, { align: 'center' });

    // Rodapé
    doc.setTextColor(160); doc.setFontSize(7);
    doc.text(`Documento gerado em ${new Date().toLocaleString('pt-BR')} · GestEscolar`, W / 2, 285, { align: 'center' });

    doc.save(`recibo_${(student?.name || 'aluno').replace(/\s+/g, '_')}_${(inv.paidAt || inv.dueDate).slice(0, 10)}.pdf`);
    Utils.toast('Recibo gerado!', 'success');
  },

  // Solicita à escola o envio do comprovante oficial de pagamento
  solicitarComprovante(invId) {
    const inv = DB.getInvoices().find(i => i.id === invId);
    if (!inv) { Utils.toast('Cobrança não encontrada.', 'error'); return; }
    if (inv.status !== 'pago') { Utils.toast('Apenas pagamentos confirmados.', 'error'); return; }

    Utils.modal(
      'Solicitar Comprovante de Pagamento',
      `<div>
        <p style="margin-bottom:12px;">Enviar solicitação à escola para emissão do comprovante oficial desta cobrança?</p>
        <div style="background:#f5f7fa;border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;">
          <div><b>Descrição:</b> ${Utils.escape(inv.description || '–')}</div>
          <div><b>Valor:</b> ${Utils.currency(inv.amount)}</div>
          <div><b>Pago em:</b> ${Utils.date(inv.paidAt || inv.dueDate)}</div>
        </div>
        <label class="form-label">Observação (opcional)</label>
        <textarea id="comprovanteObs" class="form-control" rows="3" placeholder="Ex.: Preciso do comprovante para reembolso."></textarea>
      </div>`,
      `<button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="ParentInvoices._enviarSolicitacaoComprovante('${inv.id}')">
         <i class="fa-solid fa-paper-plane"></i> Enviar Solicitação
       </button>`
    );
  },

  _enviarSolicitacaoComprovante(invId) {
    const user = Auth.current();
    const inv  = DB.getInvoices().find(i => i.id === invId);
    if (!inv || !user) return;

    const student = DB.getStudents().find(s => s.id === inv.studentId);
    const obs = document.getElementById('comprovanteObs')?.value.trim() || '';

    // Destinatário: primeiro gestor/administrativo/financeiro da escola
    const users = (DB.getUsers?.() || []).filter(u => u.schoolId === (inv.schoolId || DB._schoolId));
    const dest  = users.find(u => u.role === 'financeiro')
               || users.find(u => u.role === 'gestor')
               || users.find(u => u.role === 'administrativo');
    if (!dest) { Utils.toast('Nenhum responsável da escola encontrado.', 'error'); return; }

    const text =
      `Olá! Solicito o envio do comprovante oficial do seguinte pagamento:\n\n` +
      `• Descrição: ${inv.description || '–'}\n` +
      `• Valor: ${Utils.currency(inv.amount)}\n` +
      `• Pago em: ${Utils.date(inv.paidAt || inv.dueDate)}\n` +
      `• Vencimento: ${Utils.date(inv.dueDate)}\n` +
      `• Recibo nº: ${inv.id.substring(0, 8).toUpperCase()}\n` +
      (obs ? `\nObservação: ${obs}\n` : '') +
      `\nObrigado(a).`;

    DB.addMessage({
      fromUserId:  user.id,
      fromName:    `${user.name} (Responsável)`,
      toUserId:    dest.id,
      studentId:   inv.studentId || '',
      studentName: student?.name || '',
      matricula:   student?.matricula || '',
      classId:     student?.classId || '',
      subject:     'Solicitação de Comprovante de Pagamento',
      text,
    });

    document.querySelector('.modal-overlay')?.remove();
    Utils.toast('Solicitação enviada à escola!', 'success');
  },

  _showPixModal(inv, copiaECola, qrBase64) {
    // Se houver amountCharged (valor com multa+juros), exibe esse no topo
    // e mostra discreto o valor original + diferença.
    const valorExibir = Number(inv.amountCharged) || Number(inv.amount) || 0;
    const temJuros = inv.amountCharged && Number(inv.amountCharged) > Number(inv.amount);
    const diferenca = temJuros ? (Number(inv.amountCharged) - Number(inv.amount)) : 0;
    Utils.modal(
      `Pagar via PIX – ${Utils.escape(inv.description)}`,
      `<div style="text-align:center;">
        <div style="font-size:32px;font-weight:900;color:var(--secondary);margin-bottom:4px;">${Utils.currency(valorExibir)}</div>
        ${temJuros ? `<div style="font-size:12px;color:#d93025;margin-bottom:4px;">Original: ${Utils.currency(inv.amount)} + multa/juros: ${Utils.currency(diferenca)}</div>` : ''}
        <div class="text-muted">Vencimento: ${Utils.date(inv.dueDate)}</div>
        <div style="margin:20px 0;">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">QR CODE PIX</div>
          ${qrBase64
            ? `<img src="data:image/png;base64,${qrBase64}" style="width:160px;height:160px;margin:0 auto;display:block;border-radius:12px;" />`
            : `<div style="width:160px;height:160px;background:linear-gradient(135deg,#1a73e8,#34a853);border-radius:12px;margin:0 auto;display:flex;align-items:center;justify-content:center;">
                <i class="fa-solid fa-qrcode" style="font-size:80px;color:#fff;opacity:.9;"></i>
              </div>`}
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:4px;">Código PIX Copia e Cola</div>
        <div style="display:flex;gap:6px;align-items:stretch;">
          <input id="parentPixCode" class="form-control" value="${Utils.escape(copiaECola || '')}" readonly style="font-size:11px;font-family:monospace;flex:1;" />
          <button type="button" class="btn btn-outline btn-sm" onclick="Utils.copyText(document.getElementById('parentPixCode').value);Utils.toast('PIX copiado!','success');" title="Copiar">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
        <div class="alert alert-info" style="text-align:left;font-size:12px;margin-top:12px;">
          <i class="fa-solid fa-info-circle"></i>
          O saldo será creditado diretamente na conta individual da escola e ficará disponível automaticamente.
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" onclick="Utils.copyText(document.getElementById('parentPixCode').value);Utils.toast('PIX copiado!','success');">
         <i class="fa-solid fa-copy"></i> Copiar PIX
       </button>`
    );
  },
  confirmPix(invId) {
    const inv = DB.getInvoices().find(i => i.id === invId);
    DB.updateInvoice(invId, { status: 'pago', paidAt: new Date().toISOString() });
    DB.addTransaction('credit', inv.amount, `PIX – ${inv.studentName} – ${inv.description}`);
    Utils.toast('Pagamento PIX confirmado! Obrigado.','success');
    document.querySelector('.modal-overlay')?.remove();
    Router.go('parent-invoices');
  },
  copy(invId) {
    const inv     = DB.getInvoices().find(i => i.id === invId);
    const pixCode = Utils.generatePix(inv.amount, inv.studentName);
    Utils.modal(
      `2ª Via – ${Utils.escape(inv.description)}`,
      `<p style="margin-bottom:12px;">Segunda via do boleto gerada com sucesso.</p>
       <div class="pix-code-box">${pixCode}</div>
       <div class="text-muted">Use o código acima para pagamento via PIX ou internet banking.</div>`,
      `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );
  }
};

// --- Mensagens do pai (estilo messenger) ---
Router.register('parent-messages', () => {
  const user = Auth.require(); if (!user) return;
  const student  = DB.getStudents().find(s => s.id === user.studentId);
  const received = DB.getMessagesForUser(user.id);
  const sent     = DB.getMessages().filter(m => m.fromUserId === user.id);

  // Agrupar conversas pelo contato (professor/gestor)
  const convMap = {};
  received.forEach(m => {
    const key = m.fromUserId;
    if (!convMap[key]) convMap[key] = { contactId: key, contactName: m.fromName || 'Professor', msgs: [], unread: 0 };
    convMap[key].msgs.push({...m, _dir: 'in'});
    if (!m.read) convMap[key].unread++;
  });
  sent.forEach(m => {
    const key = m.toUserId;
    if (!convMap[key]) convMap[key] = { contactId: key, contactName: '–', msgs: [], unread: 0 };
    convMap[key].msgs.push({...m, _dir: 'out'});
  });

  const conversations = Object.values(convMap)
    .map(c => ({...c, msgs: c.msgs.sort((a,b) => new Date(a.sentAt)-new Date(b.sentAt))}))
    .sort((a,b) => new Date(b.msgs[b.msgs.length-1].sentAt) - new Date(a.msgs[a.msgs.length-1].sentAt));

  const convItem = (c) => {
    const last    = c.msgs[c.msgs.length-1];
    const preview = (last.text||'').length > 38 ? last.text.substring(0,38)+'…' : (last.text||'');
    const initials = (c.contactName||'?')[0].toUpperCase();
    return `<div class="pm-conv-item" data-cid="${c.contactId}"
      onclick="ParentMessages.openConv('${c.contactId}')"
      style="display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">${initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(c.contactName)}</div>
        <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(preview)}</div>
      </div>
      ${c.unread > 0 ? `<span style="min-width:20px;height:20px;border-radius:10px;background:var(--danger);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;">${c.unread>9?'9+':c.unread}</span>` : ''}
    </div>`;
  };

  const content = `
    <style>
      .pm-shell { display:flex; flex-direction:column; height:calc(100dvh - 120px); min-height:400px; border-radius:var(--radius); overflow:hidden; background:var(--card); box-shadow:var(--shadow); }
      .pm-header { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; flex-shrink:0; background:var(--card); }
      .pm-body { flex:1; display:flex; overflow:hidden; position:relative; }
      .pm-sidebar { width:280px; border-right:1px solid var(--border); overflow-y:auto; flex-shrink:0; display:flex; flex-direction:column; }
      .pm-chat-panel { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
      .pm-chat-messages { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px; display:flex; flex-direction:column; background:#efeae2; min-height:0; }
      .pm-chat-footer { border-top:1px solid var(--border); padding:10px 12px; display:flex; gap:8px; align-items:flex-end; background:var(--card); flex-shrink:0; }
      .pm-back-btn { display:none; background:none; border:none; cursor:pointer; padding:4px 8px 4px 0; color:var(--primary); font-size:20px; }
      @media (max-width: 600px) {
        .pm-shell { position:fixed; top:0; left:0; right:0; bottom:0; height:100%; height:100dvh; border-radius:0; z-index:100; }
        .pm-header { display:none; }
        .pm-body { height:100%; }
        .pm-sidebar { width:100%; position:absolute; top:0; left:0; right:0; bottom:0; z-index:2; background:var(--card); overflow-y:auto; -webkit-overflow-scrolling:touch; }
        .pm-sidebar.pm-hidden { display:none; }
        .pm-chat-panel { position:absolute; top:0; left:0; right:0; bottom:0; z-index:2; display:none; flex-direction:column; }
        .pm-chat-panel.pm-active { display:flex; }
        .pm-chat-messages { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; }
        .pm-chat-footer { padding:8px 10px; padding-bottom:env(safe-area-inset-bottom, 8px); }
        .pm-back-btn { display:block; }
      }
    </style>
    <div class="pm-shell">
      <div class="pm-header">
        <i class="fa-solid fa-comments" style="color:var(--primary);font-size:18px;"></i>
        <span style="font-weight:700;font-size:16px;">Mensagens</span>
      </div>
      <div class="pm-body">

        <!-- Lista de conversas -->
        <div class="pm-sidebar" id="pm-sidebar">
          ${conversations.length === 0
            ? `<div style="padding:32px 16px;text-align:center;color:var(--text-muted);"><i class="fa-solid fa-envelope" style="font-size:32px;margin-bottom:8px;display:block;"></i>Nenhuma mensagem.</div>`
            : conversations.map(c => convItem(c)).join('')}
        </div>

        <!-- Painel de chat -->
        <div class="pm-chat-panel" id="pm-chat-panel">
          <!-- Header do chat com nome e botão voltar (mobile) -->
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0;background:var(--card);">
            <button class="pm-back-btn" onclick="ParentMessages.goBack()"><i class="fa-solid fa-arrow-left"></i></button>
            <div id="pm-chat-name" style="font-weight:700;font-size:15px;flex:1;">Selecione uma conversa</div>
          </div>
          <div id="pm-chat-messages" class="pm-chat-messages">
            <div style="margin:auto;text-align:center;color:var(--text-muted);">
              <i class="fa-solid fa-comments" style="font-size:40px;margin-bottom:10px;display:block;"></i>
              Selecione uma conversa
            </div>
          </div>
          <div class="pm-chat-footer">
            <textarea id="pm-reply-text" class="form-control" rows="2"
              style="resize:none;flex:1;"
              placeholder="Selecione uma conversa para responder…"
              disabled></textarea>
            <button class="btn btn-primary" id="pm-send-btn" onclick="ParentMessages.sendReply()" disabled style="height:44px;width:44px;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  Router.renderLayout(user, 'parent-messages', content);
  received.forEach(m => DB.markMessageRead(m.id));

  // Realtime: nova mensagem recebida → re-renderiza a página
  Realtime.subscribe('messages', `to_user_id=eq.${user.id}`, () => {
    Router.go('parent-messages');
  });

  // Expõe dados para os métodos
  ParentMessages._conversations = conversations;
  ParentMessages._user          = user;
  ParentMessages._student       = student;
  ParentMessages._activeId      = null;

  // Abre primeira conversa automaticamente se existir
  if (conversations.length > 0) ParentMessages.openConv(conversations[0].contactId);
});

const ParentMessages = {
  _conversations: [],
  _user: null,
  _student: null,
  _activeId: null,

  openConv(contactId) {
    this._activeId = contactId;
    const conv = this._conversations.find(c => c.contactId === contactId);
    if (!conv) return;

    // Destaque na lista
    document.querySelectorAll('.pm-conv-item').forEach(el => {
      el.style.background = el.dataset.cid === contactId ? 'var(--bg)' : '';
    });

    // Atualiza nome no header do chat
    const nameEl = document.getElementById('pm-chat-name');
    if (nameEl) nameEl.textContent = conv.contactName;

    // Mobile: esconde sidebar, mostra chat primeiro
    const sidebar = document.getElementById('pm-sidebar');
    const panel   = document.getElementById('pm-chat-panel');
    if (sidebar) sidebar.classList.add('pm-hidden');
    if (panel)   panel.classList.add('pm-active');

    const box = document.getElementById('pm-chat-messages');
    if (box) {
      box.innerHTML = conv.msgs.length === 0
        ? `<div style="margin:auto;text-align:center;color:var(--text-muted);">Nenhuma mensagem ainda.</div>`
        : conv.msgs.map(m => this._bubble(m, m._dir)).join('');
      // Aguarda render para rolar até o final
      setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    }

    const ta  = document.getElementById('pm-reply-text');
    const btn = document.getElementById('pm-send-btn');
    if (ta)  { ta.disabled = false; ta.placeholder = `Responder a ${conv.contactName}…`; }
    if (btn) btn.disabled = false;
  },

  goBack() {
    const sidebar = document.getElementById('pm-sidebar');
    const panel   = document.getElementById('pm-chat-panel');
    if (sidebar) sidebar.classList.remove('pm-hidden');
    if (panel)   panel.classList.remove('pm-active');
  },

  sendReply() {
    const user    = this._user || Auth.current();
    const student = this._student || DB.getStudents().find(s => s.id === user.studentId);
    const text    = document.getElementById('pm-reply-text')?.value.trim();
    if (!text) { Utils.toast('Escreva uma mensagem.', 'error'); return; }

    const conv = this._conversations.find(c => c.contactId === this._activeId);
    if (!conv) return;

    // Assunto baseado na última mensagem recebida
    const lastIn = [...conv.msgs].reverse().find(m => m._dir === 'in');
    const subject = lastIn?.subject ? `Re: ${lastIn.subject}` : 'Resposta';

    const msg = {
      fromUserId:  user.id,
      fromName:    `${user.name} (Responsável)`,
      toUserId:    conv.contactId,
      studentId:   user.studentId || '',
      studentName: student?.name || user.name,
      matricula:   student?.matricula || user.matricula || '',
      classId:     student?.classId || '',
      subject,
      text,
    };
    DB.addMessage(msg);

    document.getElementById('pm-reply-text').value = '';

    const dummy = {...msg, sentAt: new Date().toISOString(), read: false, _dir: 'out'};
    conv.msgs.push(dummy);

    const box = document.getElementById('pm-chat-messages');
    if (box) {
      box.insertAdjacentHTML('beforeend', this._bubble(dummy, 'out'));
      setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    }
  },

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
    const statusBadge = isOut
      ? `<span style="color:${m.read?'var(--secondary)':'var(--text-muted)'};">${m.read?'✓✓ Visualizado':'✓ Enviado'}</span>`
      : '';
    const label = isOut
      ? '<span style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">Você</span>'
      : `<span style="font-size:11px;color:var(--text-muted);margin-bottom:3px;">${Utils.escape(m.fromName||'Professor')}</span>`;
    // Detecta PIX Copia e Cola no texto para exibir com botão de copiar
    const PIX_MARKER = '📱 PIX Copia e Cola:\n';
    let textHtml;
    if (!isOut && m.text && m.text.includes(PIX_MARKER)) {
      const idx     = m.text.indexOf(PIX_MARKER);
      const before  = m.text.substring(0, idx);
      const pixCode = m.text.substring(idx + PIX_MARKER.length).trim();
      const pixId   = 'pix-' + (m.id || Math.random().toString(36).slice(2));
      textHtml = `<div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${Utils.escape(before)}</div>
        <div style="margin-top:8px;background:#fff;border-radius:8px;padding:10px;border:1.5px solid #e0e0e0;">
          <div style="font-size:11px;font-weight:700;color:#1b5e20;margin-bottom:6px;display:flex;align-items:center;gap:4px;">
            <i class="fa-brands fa-pix" style="color:#00c853;"></i> PIX Copia e Cola
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <input id="${pixId}" class="form-control" value="${Utils.escape(pixCode)}" readonly
              style="font-size:10px;font-family:monospace;background:#f5f5f5;border:1px solid #ddd;color:#333;flex:1;" />
            <button class="btn btn-sm" onclick="Utils.copyText(document.getElementById('${pixId}').value);Utils.toast('Código PIX copiado!','success');"
              style="background:#00c853;color:#fff;border:none;white-space:nowrap;flex-shrink:0;">
              <i class="fa-solid fa-copy"></i> Copiar
            </button>
          </div>
        </div>`;
    } else {
      textHtml = `<div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${Utils.escape(m.text||'')}</div>`;
    }

    return `<div style="${wrapStyle}">
      ${label}
      <div style="${bubbleStyle}">
        ${m.subject?`<div style="font-size:11px;font-weight:700;margin-bottom:4px;${isOut?'color:rgba(255,255,255,0.8);':'color:var(--text-muted);'}">${Utils.escape(m.subject)}</div>`:''}
        ${textHtml}
      </div>
      <div style="${metaStyle}">${Utils.datetime(m.sentAt)} ${statusBadge}</div>
    </div>`;
  }
};
