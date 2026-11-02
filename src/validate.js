const STATUSES = ['Present', 'Absent', 'Late'];

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function validateStudent(b, { partial = false } = {}) {
  const errors = [];
  if (!partial) {
    if (!b.studentId || !/^[A-Za-z0-9_-]{2,20}$/.test(b.studentId))
      errors.push('studentId is required (2-20 letters, digits, _ or -)');
  }
  if (!partial || b.name !== undefined)
    if (!b.name || typeof b.name !== 'string' || b.name.trim().length < 2)
      errors.push('name is required (min 2 characters)');
  if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) errors.push('email is invalid');
  if (b.year !== undefined && b.year !== '' && !(Number(b.year) >= 1 && Number(b.year) <= 6))
    errors.push('year must be between 1 and 6');
  return errors;
}

function validateAttendance(b, { partial = false } = {}) {
  const errors = [];
  if (!partial) {
    if (!b.studentId) errors.push('studentId is required');
    if (!isValidDate(b.date)) errors.push('date is required in YYYY-MM-DD format');
  }
  if (!partial || b.status !== undefined)
    if (!STATUSES.includes(b.status)) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
  if (b.remarks && String(b.remarks).length > 200) errors.push('remarks must be under 200 characters');
  return errors;
}

module.exports = { isValidDate, validateStudent, validateAttendance, STATUSES };
