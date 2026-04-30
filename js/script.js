const STORAGE_ATT = 'att_records_v2';
const STORAGE_PART = 'att_participants_v2';

let attendances = [];
let participants = [];
let editingAttId = null;
let editingPartId = null;
let pendingDelete = null;

/* ── PERSISTENCE ── */
function loadData() {
  try { attendances = JSON.parse(localStorage.getItem(STORAGE_ATT)) || []; } catch(e) { attendances = []; }
  try { participants = JSON.parse(localStorage.getItem(STORAGE_PART)) || []; } catch(e) { participants = []; }
}
function saveData() {
  localStorage.setItem(STORAGE_ATT, JSON.stringify(attendances));
  localStorage.setItem(STORAGE_PART, JSON.stringify(participants));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* ── NAVIGATION ── */
function showView(v) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  const items = document.querySelectorAll('.nav-item');
  const map = { dashboard: 0, attendance: 1, participants: 2 };
  if (map[v] !== undefined) items[map[v]].classList.add('active');
  if (v === 'dashboard') renderDashboard();
  if (v === 'attendance') { renderAttendance(); populateSessionFilter(); }
  if (v === 'participants') { renderParticipants(); populateGroupFilter(); }
}

/* ── CLOCK ── */
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000); updateClock();

/* ── TODAY ── */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch(e) { return d; }
}
function fmtStatus(s) {
  const map = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
  return map[s] || s;
}

/* ── ESCAPE ── */
function escH(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── DASHBOARD ── */
function renderDashboard() {
  document.getElementById('today-label').textContent = fmtDate(todayStr());
  const total = attendances.length;
  const present = attendances.filter(r => r.status === 'present').length;
  const absent = attendances.filter(r => r.status === 'absent').length;
  const todayRecs = attendances.filter(r => r.date === todayStr()).length;
  const rate = total ? Math.round(present / total * 100) : 0;

  document.getElementById('stats').innerHTML = `
    <div class="stat-card gold"><div class="stat-value">${participants.length}</div><div class="stat-label">Participants</div></div>
    <div class="stat-card blue"><div class="stat-value">${total}</div><div class="stat-label">Total Records</div></div>
    <div class="stat-card green"><div class="stat-value">${rate}%</div><div class="stat-label">Presence Rate</div></div>
    <div class="stat-card red"><div class="stat-value">${absent}</div><div class="stat-label">Absences</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--yellow-text)">${todayRecs}</div><div class="stat-label">Today's Records</div></div>`;

  const recent = [...attendances].sort((a,b) => b.createdAt - a.createdAt).slice(0, 8);
  const tbody = document.getElementById('recent-tbody');
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty"><div class="empty-icon">◎</div>No records yet</div></td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(r => {
    const p = participants.find(x => x.id === r.participantId);
    return `<tr>
      <td><div class="participant-name">${escH(p ? p.name : '—')}</div></td>
      <td>${fmtDate(r.date)}</td>
      <td>${escH(r.session)}</td>
      <td><span class="badge badge-${r.status}">${fmtStatus(r.status)}</span></td>
      <td style="color:var(--text3)">${escH(r.notes || '—')}</td>
    </tr>`;
  }).join('');
}

/* ── ATTENDANCE ── */
function renderAttendance() {
  const q = (document.getElementById('att-search').value || '').toLowerCase();
  const fs = document.getElementById('att-filter-status').value;
  const fsess = document.getElementById('att-filter-session').value;
  const fd = document.getElementById('att-filter-date').value;
  let rows = [...attendances].sort((a,b) => b.createdAt - a.createdAt);
  rows = rows.filter(r => {
    const p = participants.find(x => x.id === r.participantId);
    const name = p ? p.name.toLowerCase() : '';
    if (q && !name.includes(q) && !r.session.toLowerCase().includes(q)) return false;
    if (fs && r.status !== fs) return false;
    if (fsess && r.session !== fsess) return false;
    if (fd && r.date !== fd) return false;
    return true;
  });
  const tbody = document.getElementById('att-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon">✓</div>${attendances.length ? 'No matching records.' : 'No attendance records yet.'}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const p = participants.find(x => x.id === r.participantId);
    return `<tr>
      <td>
        <div class="participant-name">${escH(p ? p.name : 'Unknown')}</div>
        <div class="participant-id">${escH(p ? p.pid : '')}</div>
      </td>
      <td>${fmtDate(r.date)}</td>
      <td>${escH(r.session)}</td>
      <td><span class="badge badge-${r.status}">${fmtStatus(r.status)}</span></td>
      <td style="color:var(--text3);max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(r.notes || '—')}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="openAttModal('${r.id}')">Edit</button>
          <button class="btn btn-sm btn-red" onclick="askDelete('att','${r.id}')">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateSessionFilter() {
  const sessions = [...new Set(attendances.map(r => r.session).filter(Boolean))].sort();
  const sel = document.getElementById('att-filter-session');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All sessions</option>' + sessions.map(s => `<option value="${escH(s)}"${s===cur?' selected':''}>${escH(s)}</option>`).join('');
}

function openAttModal(id) {
  editingAttId = id || null;
  const rec = id ? attendances.find(r => r.id === id) : null;
  document.getElementById('att-modal-title').textContent = rec ? 'Edit Attendance Record' : 'Add Attendance Record';
  // Populate participant select
  const sel = document.getElementById('f-participant');
  sel.innerHTML = participants.length
    ? participants.map(p => `<option value="${p.id}">${escH(p.name)} (${escH(p.pid)})</option>`).join('')
    : '<option value="">— Add participants first —</option>';
  if (rec) {
    sel.value = rec.participantId;
    document.getElementById('f-att-date').value = rec.date;
    document.getElementById('f-session').value = rec.session;
    document.getElementById('f-status').value = rec.status;
    document.getElementById('f-timein').value = rec.timeIn || '';
    document.getElementById('f-att-notes').value = rec.notes || '';
  } else {
    document.getElementById('f-att-date').value = todayStr();
    document.getElementById('f-session').value = '';
    document.getElementById('f-status').value = 'present';
    document.getElementById('f-timein').value = '';
    document.getElementById('f-att-notes').value = '';
  }
  document.getElementById('att-modal').style.display = 'flex';
}
function closeAttModal() { document.getElementById('att-modal').style.display = 'none'; editingAttId = null; }

function saveAttRecord() {
  const participantId = document.getElementById('f-participant').value;
  const date = document.getElementById('f-att-date').value;
  const session = document.getElementById('f-session').value.trim();
  if (!participantId || !date || !session) { toast('Participant, date, and session are required.', 'error'); return; }
  const rec = {
    id: editingAttId || uid(),
    participantId, date, session,
    status: document.getElementById('f-status').value,
    timeIn: document.getElementById('f-timein').value,
    notes: document.getElementById('f-att-notes').value.trim(),
    createdAt: editingAttId ? (attendances.find(r=>r.id===editingAttId)||{}).createdAt || Date.now() : Date.now()
  };
  if (editingAttId) { const i = attendances.findIndex(r => r.id === editingAttId); attendances[i] = rec; }
  else { attendances.unshift(rec); }
  saveData();
  closeAttModal();
  renderAttendance();
  populateSessionFilter();
  toast(editingAttId ? 'Record updated.' : 'Record added.', 'success');
}

/* ── PARTICIPANTS ── */
function renderParticipants() {
  const q = (document.getElementById('part-search').value || '').toLowerCase();
  const fg = document.getElementById('part-filter-group').value;
  let rows = [...participants];
  rows = rows.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !p.pid.toLowerCase().includes(q) && !(p.group||'').toLowerCase().includes(q)) return false;
    if (fg && p.group !== fg) return false;
    return true;
  });
  const tbody = document.getElementById('part-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon">◉</div>${participants.length ? 'No matching participants.' : 'No participants yet.'}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => {
    const total = attendances.filter(r => r.participantId === p.id).length;
    const present = attendances.filter(r => r.participantId === p.id && r.status === 'present').length;
    const rate = total ? Math.round(present / total * 100) : 0;
    const color = rate >= 80 ? 'var(--green-text)' : rate >= 50 ? 'var(--yellow-text)' : 'var(--red-text)';
    return `<tr>
      <td style="color:var(--text3)">${escH(p.pid)}</td>
      <td class="participant-name">${escH(p.name)}</td>
      <td style="color:var(--text2)">${escH(p.group || '—')}</td>
      <td style="color:var(--text3)">${escH(p.email || '—')}</td>
      <td>
        <div class="rate-bar"><div class="rate-fill" style="width:${rate}%;background:${color}"></div></div>
        <span style="color:${color};font-size:12px">${rate}%</span>
        <span style="color:var(--text3);font-size:11px"> (${total} sessions)</span>
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="openPartModal('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-red" onclick="askDelete('part','${p.id}')">Del</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateGroupFilter() {
  const groups = [...new Set(participants.map(p => p.group).filter(Boolean))].sort();
  const sel = document.getElementById('part-filter-group');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All groups</option>' + groups.map(g => `<option value="${escH(g)}"${g===cur?' selected':''}>${escH(g)}</option>`).join('');
}

function openPartModal(id) {
  editingPartId = id || null;
  const p = id ? participants.find(x => x.id === id) : null;
  document.getElementById('part-modal-title').textContent = p ? 'Edit Participant' : 'Add Participant';
  document.getElementById('f-pid').value = p ? p.pid : '';
  document.getElementById('f-fullname').value = p ? p.name : '';
  document.getElementById('f-group').value = p ? p.group || '' : '';
  document.getElementById('f-email').value = p ? p.email || '' : '';
  document.getElementById('f-part-notes').value = p ? p.notes || '' : '';
  document.getElementById('part-modal').style.display = 'flex';
}
function closePartModal() { document.getElementById('part-modal').style.display = 'none'; editingPartId = null; }

function savePartRecord() {
  const name = document.getElementById('f-fullname').value.trim();
  const pid = document.getElementById('f-pid').value.trim();
  if (!name || !pid) { toast('Name and Participant ID are required.', 'error'); return; }
  // Check duplicate PID (skip self when editing)
  if (participants.some(p => p.pid === pid && p.id !== editingPartId)) { toast('Participant ID already exists.', 'error'); return; }
  const rec = {
    id: editingPartId || uid(),
    pid, name,
    group: document.getElementById('f-group').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    notes: document.getElementById('f-part-notes').value.trim()
  };
  if (editingPartId) { const i = participants.findIndex(p => p.id === editingPartId); participants[i] = rec; }
  else { participants.push(rec); }
  saveData();
  closePartModal();
  renderParticipants();
  populateGroupFilter();
  toast(editingPartId ? 'Participant updated.' : 'Participant added.', 'success');
}

/* ── DELETE ── */
function askDelete(type, id) {
  pendingDelete = { type, id };
  const msgs = { att: 'Delete this attendance record? This cannot be undone.', part: 'Delete this participant? All their attendance records will remain but become unlinked.' };
  document.getElementById('confirm-msg').textContent = msgs[type];
  document.getElementById('confirm-modal').style.display = 'flex';
}
function closeConfirm() { document.getElementById('confirm-modal').style.display = 'none'; pendingDelete = null; }
function doDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  if (type === 'att') { attendances = attendances.filter(r => r.id !== id); }
  if (type === 'part') { participants = participants.filter(p => p.id !== id); }
  saveData();
  closeConfirm();
  if (type === 'att') { renderAttendance(); populateSessionFilter(); }
  if (type === 'part') { renderParticipants(); populateGroupFilter(); }
  toast('Deleted.', 'success');
}

/* ── EXPORT EXCEL ── */
function exportExcel() {
  if (!attendances.length) { toast('No records to export.', 'error'); return; }
  const rows = attendances.map(r => {
    const p = participants.find(x => x.id === r.participantId);
    return {
      'Participant ID': p ? p.pid : '—',
      'Name': p ? p.name : 'Unknown',
      'Group': p ? (p.group || '—') : '—',
      'Date': r.date,
      'Session': r.session,
      'Status': fmtStatus(r.status),
      'Time In': r.timeIn || '—',
      'Notes': r.notes || ''
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths
  ws['!cols'] = [12,22,14,12,16,10,10,30].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  // Participants sheet
  if (participants.length) {
    const partRows = participants.map(p => {
      const total = attendances.filter(r => r.participantId === p.id).length;
      const present = attendances.filter(r => r.participantId === p.id && r.status === 'present').length;
      return { 'ID': p.pid, 'Name': p.name, 'Group': p.group||'', 'Email': p.email||'', 'Sessions': total, 'Present': present, 'Rate': total ? (Math.round(present/total*100)+'%') : 'N/A' };
    });
    const ws2 = XLSX.utils.json_to_sheet(partRows);
    ws2['!cols'] = [10,22,14,24,10,10,8].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Participants');
  }
  XLSX.writeFile(wb, `attendance_${todayStr()}.xlsx`);
  toast('Excel exported!', 'success');
}

/* ── EXPORT PDF ── */
function exportPDF() {
  if (!attendances.length) { toast('No records to export.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title
  doc.setFillColor(15, 14, 12);
  doc.rect(0, 0, 297, 297, 'F');
  doc.setTextColor(212, 168, 71);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('AttendanceOS — Research Report', 14, 18);
  doc.setTextColor(154, 148, 136);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}   |   Total Records: ${attendances.length}   |   Participants: ${participants.length}`, 14, 25);

  const rows = [...attendances].sort((a,b) => a.date.localeCompare(b.date)).map(r => {
    const p = participants.find(x => x.id === r.participantId);
    return [p ? p.pid : '—', p ? p.name : 'Unknown', p ? (p.group||'—') : '—', fmtDate(r.date), r.session, fmtStatus(r.status), r.timeIn||'—', r.notes||''];
  });

  doc.autoTable({
    startY: 30,
    head: [['ID', 'Name', 'Group', 'Date', 'Session', 'Status', 'Time In', 'Notes']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3, textColor: [232,228,220], fillColor: [26,25,22], lineColor: [46,44,40], lineWidth: 0.2 },
    headStyles: { fillColor: [35,34,32], textColor: [212,168,71], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [20,19,17] },
    columnStyles: {
      0: { cellWidth: 16 }, 1: { cellWidth: 40 }, 2: { cellWidth: 22 },
      3: { cellWidth: 28 }, 4: { cellWidth: 28 }, 5: { cellWidth: 20 },
      6: { cellWidth: 18 }, 7: { cellWidth: 'auto' }
    },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const status = data.cell.raw;
        const colors = { Present: [74,124,89], Absent: [124,74,74], Late: [124,109,74], Excused: [74,94,124] };
        const col = colors[status];
        if (col) { doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); }
      }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = { Present: [126,201,154], Absent: [201,126,126], Late: [201,180,126], Excused: [126,163,201] }[data.cell.raw] || [232,228,220];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  doc.save(`attendance_${todayStr()}.pdf`);
  toast('PDF exported!', 'success');
}

/* ── TOAST ── */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${escH(msg)}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ── INIT ── */
loadData();
renderDashboard();
document.getElementById('today-label').textContent = fmtDate(todayStr());