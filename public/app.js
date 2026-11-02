const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let editingStudent = false;

function show(text, ok = true) {
  const m = $('msg'); m.textContent = text; m.className = ok ? 'ok' : 'err'; m.style.display = 'block';
  setTimeout(() => (m.style.display = 'none'), 4000);
}

async function api(url, method = 'GET', body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error((data.errors && data.errors.join('; ')) || data.error || 'Request failed');
  return data;
}

/* ---------- Students ---------- */
async function loadStudents() {
  try {
    const list = await api('/api/students');
    $('students').innerHTML = list.map((s) => `<tr>
      <td>${esc(s.studentId)}</td><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.department)}</td><td>${esc(s.year)}</td>
      <td><button class="edit" onclick='editStudent(${JSON.stringify(s).replace(/'/g, "&#39;")})'>Edit</button>
          <button class="del" onclick="deleteStudent('${esc(s.studentId)}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No students yet</td></tr>';
  } catch (e) { show(e.message, false); }
}

$('studentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { studentId: $('sId').value.trim(), name: $('sName').value, email: $('sEmail').value, department: $('sDept').value, year: $('sYear').value };
  try {
    if (editingStudent) await api('/api/students/' + encodeURIComponent(body.studentId), 'PUT', body);
    else await api('/api/students', 'POST', body);
    show(editingStudent ? 'Student updated' : 'Student registered');
    resetStudentForm(); loadStudents();
  } catch (err) { show(err.message, false); }
});

function editStudent(s) {
  editingStudent = true; $('sId').value = s.studentId; $('sId').disabled = true;
  $('sName').value = s.name; $('sEmail').value = s.email || ''; $('sDept').value = s.department || ''; $('sYear').value = s.year || '';
}
function resetStudentForm() { editingStudent = false; $('studentForm').reset(); $('sId').disabled = false; }
async function deleteStudent(id) {
  if (!confirm(`Delete ${id} and all their attendance records?`)) return;
  try { const r = await api('/api/students/' + encodeURIComponent(id), 'DELETE'); show(r.message); loadStudents(); loadAttendance(); }
  catch (e) { show(e.message, false); }
}

/* ---------- Attendance ---------- */
async function loadAttendance() {
  const p = new URLSearchParams();
  if ($('qId').value.trim()) p.set('studentId', $('qId').value.trim());
  if ($('qDate').value) p.set('date', $('qDate').value);
  try {
    const list = await api('/api/attendance?' + p);
    $('attendance').innerHTML = list.map((a) => `<tr>
      <td>${esc(a.studentId)}</td><td>${esc(a.studentName)}</td><td>${esc(a.date)}</td><td>${esc(a.status)}</td><td>${esc(a.remarks)}</td>
      <td><button class="edit" onclick='editAttendance(${JSON.stringify(a).replace(/'/g, "&#39;")})'>Edit</button>
          <button class="del" onclick="deleteAttendance('${esc(a.studentId)}','${esc(a.date)}')">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No records found</td></tr>';
  } catch (e) { show(e.message, false); }
}

$('attForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { studentId: $('aId').value.trim(), date: $('aDate').value, status: $('aStatus').value, remarks: $('aRemarks').value };
  try {
    try { await api('/api/attendance', 'POST', body); show('Attendance marked'); }
    catch (err) {
      if (!err.message.includes('already marked')) throw err;
      await api(`/api/attendance/${encodeURIComponent(body.studentId)}/${body.date}`, 'PUT', { status: body.status, remarks: body.remarks });
      show('Existing attendance record updated');
    }
    loadAttendance();
  } catch (err) { show(err.message, false); }
});

function editAttendance(a) { $('aId').value = a.studentId; $('aDate').value = a.date; $('aStatus').value = a.status; $('aRemarks').value = a.remarks || ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function deleteAttendance(id, date) {
  if (!confirm('Delete this record?')) return;
  try { await api(`/api/attendance/${encodeURIComponent(id)}/${date}`, 'DELETE'); show('Record deleted'); loadAttendance(); }
  catch (e) { show(e.message, false); }
}

loadStudents(); loadAttendance();
