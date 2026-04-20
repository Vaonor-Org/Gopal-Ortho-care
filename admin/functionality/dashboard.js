/**
 * dashboard.js
 * Doctor / Admin dashboard — Firebase Auth guard + analytics + full dashboard logic.
 * Requires: firebase-init.js loaded first (provides `auth` and `db` globals).
 */

// Same admin UID map as auth.js
const ADMIN_UIDS = { 'iWsZCqgX5fgP0Uguf6vQ0tcS9nJ3': 'admin' };

/* ── Auth guard: only 'admin' role allowed ── */
auth.onAuthStateChanged(async user => {
  if (!user) { window.location.replace('login.html'); return; }

  // Check hardcoded map first, then DB
  let role = ADMIN_UIDS[user.uid];
  if (!role) {
    try {
      const snap = await db.ref('/users/' + user.uid + '/role').once('value');
      role = snap.val();
    } catch (e) { role = null; }
  }

  if (role !== 'admin') { window.location.replace('desk.html'); return; }
  initDashboard();
});

/* ── Logout ── */
function logout() {
  auth.signOut().then(() => window.location.replace('login.html'));
}

/* ── Constants ── */
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/* ── Helpers ── */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtDate(str) {
  if (!str) return '—';
  const [y,m,d] = str.split('-');
  const dt = new Date(y, m-1, d);
  return DAYS[dt.getDay()] + ', ' + d + ' ' + MONTHS[dt.getMonth()] + ' ' + y;
}
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show toast-' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
function badgeHtml(status) {
  const map = { pending:'badge-pending', confirmed:'badge-confirmed', cancelled:'badge-cancelled', completed:'badge-completed' };
  return `<span class="badge ${map[status]||''}">${status||'—'}</span>`;
}
function typeBadge(type) {
  return `<span class="badge ${type==='online'?'badge-online':'badge-walkin'}">${type||'—'}</span>`;
}
function generateSlots(start, end, duration) {
  const slots = [];
  let [sh, sm] = (start||'09:00').split(':').map(Number);
  let [eh, em] = (end||'19:00').split(':').map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + duration <= endMin) {
    const h = Math.floor(current / 60), m = current % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push(`${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`);
    current += duration;
  }
  return slots;
}

/* ── Clock ── */
function updateClock() {
  const d = new Date();
  document.getElementById('topbar-date').textContent =
    DAYS[d.getDay()] + ' · ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  const todayLabel = document.getElementById('today-label');
  if (todayLabel) todayLabel.textContent = fmtDate(todayStr());
}

/* ── Panel switching ── */
function showPanel(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const titles = {
    overview:'Dashboard Overview', availability:'Manage Availability',
    bookings:'All Bookings', slots:'Slot Monitor', analytics:'Analytics', settings:'Settings'
  };
  document.getElementById('page-title').textContent = titles[name] || name;
  if (name === 'bookings')     loadAllBookings();
  if (name === 'slots')        loadSlotMonitor();
  if (name === 'settings')     loadSettings();
  if (name === 'availability') loadAvailability();
  if (name === 'analytics')    loadAnalytics();
}

/* ── Today's bookings (real-time listener) ── */
let todayListener = null;
function initTodayListener() {
  const today = todayStr();
  if (todayListener) db.ref('/bookings').off('value', todayListener);
  todayListener = db.ref('/bookings').orderByChild('date').equalTo(today).on('value', snap => {
    const bookings = [];
    snap.forEach(child => bookings.push({ id: child.key, ...child.val() }));
    bookings.sort((a,b) => (a.tokenNumber||999) - (b.tokenNumber||999));

    document.getElementById('stat-total').textContent     = bookings.length;
    document.getElementById('stat-pending').textContent   = bookings.filter(b => b.status === 'pending').length;
    document.getElementById('stat-confirmed').textContent = bookings.filter(b => ['confirmed','completed'].includes(b.status)).length;
    document.getElementById('stat-cancelled').textContent = bookings.filter(b => b.status === 'cancelled').length;

    const tbody = document.getElementById('today-tbody');
    if (!bookings.length) {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="9"><div class="empty-state">No appointments for today</div></td></tr>';
      return;
    }
    tbody.innerHTML = bookings.map((b, i) => `
      <tr>
        <td style="color:#8A8A8A;">${i+1}</td>
        <td style="font-family:'DM Mono',monospace;font-size:.6875rem;background:#F0F7FF;border-radius:6px;padding:.3rem .5rem;">${b.tokenNumber||'—'}</td>
        <td><strong>${b.name||'—'}</strong><div style="font-size:.75rem;color:#8A8A8A;">${b.age||''} ${b.gender||''}</div></td>
        <td><a href="tel:${b.mobile}" style="color:#0A6EBD;font-family:'DM Mono',monospace;font-size:.8125rem;">${b.mobile||'—'}</a></td>
        <td style="font-family:'DM Mono',monospace;">${b.time||'—'}</td>
        <td style="font-size:.8125rem;max-width:140px;">${b.service||b.condition||'General'}</td>
        <td>${typeBadge(b.type)}</td>
        <td>${badgeHtml(b.status)}</td>
        <td>
          ${b.status==='pending'?`<button class="action-btn action-confirm" onclick="updateBookingStatus('${b.id}','confirmed')">Confirm</button>`:''}
          ${['pending','confirmed'].includes(b.status)?`<button class="action-btn action-complete" onclick="updateBookingStatus('${b.id}','completed')">Done</button>`:''}
          ${b.status!=='cancelled'&&b.status!=='completed'?`<button class="action-btn action-cancel" onclick="updateBookingStatus('${b.id}','cancelled')">Cancel</button>`:''}
        </td>
      </tr>`).join('');
  });
}

/* ── All bookings ── */
let allBookingsRef = null;
function loadAllBookings() {
  const date   = document.getElementById('filter-date').value;
  const status = document.getElementById('filter-status').value;
  const type   = document.getElementById('filter-type').value;
  const tbody  = document.getElementById('all-bookings-tbody');
  tbody.innerHTML = '<tr class="loading-row"><td colspan="9">Loading…</td></tr>';
  let query = date
    ? db.ref('/bookings').orderByChild('date').equalTo(date)
    : db.ref('/bookings').orderByChild('date');
  if (allBookingsRef) allBookingsRef.off();
  allBookingsRef = query;
  query.on('value', snap => {
    let bookings = [];
    snap.forEach(child => bookings.push({ id: child.key, ...child.val() }));
    if (status) bookings = bookings.filter(b => b.status === status);
    if (type)   bookings = bookings.filter(b => b.type === type);
    bookings.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    if (!bookings.length) {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="9"><div class="empty-state">No bookings found</div></td></tr>';
      return;
    }
    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td style="font-family:'DM Mono',monospace;font-size:.75rem;background:#F0F7FF;border-radius:6px;padding:.3rem .5rem;">${b.tokenNumber||'—'}</td>
        <td><strong>${b.name||'—'}</strong><br><span style="font-size:.75rem;color:#8A8A8A;">${b.age||''} ${b.gender||''}</span></td>
        <td><a href="tel:${b.mobile}" style="color:#0A6EBD;font-family:'DM Mono',monospace;font-size:.8125rem;">${b.mobile||'—'}</a></td>
        <td style="font-size:.8125rem;">${b.date||'—'}</td>
        <td style="font-family:'DM Mono',monospace;font-size:.8125rem;">${b.time||'—'}</td>
        <td style="font-size:.8125rem;">${b.service||b.condition||'General'}</td>
        <td>${typeBadge(b.type)}</td>
        <td>${badgeHtml(b.status)}</td>
        <td>
          ${b.status==='pending'?`<button class="action-btn action-confirm" onclick="updateBookingStatus('${b.id}','confirmed')">Confirm</button>`:''}
          ${['pending','confirmed'].includes(b.status)?`<button class="action-btn action-complete" onclick="updateBookingStatus('${b.id}','completed')">Done</button>`:''}
          ${b.status!=='cancelled'&&b.status!=='completed'?`<button class="action-btn action-cancel" onclick="updateBookingStatus('${b.id}','cancelled')">Cancel</button>`:''}
        </td>
      </tr>`).join('');
  });
}

/* ── Booking status update ── */
async function updateBookingStatus(id, status) {
  await db.ref('/bookings/' + id).update({ status, updatedAt: Date.now() });
  showToast(`Booking ${status} successfully`, 'success');
}

/* ── Availability ── */
let currentAvailData = {};
async function loadAvailability() {
  const date = document.getElementById('avail-date').value || todayStr();
  const snap = await db.ref('/availability/' + date).once('value');
  const data = snap.val() || { isOpen:true, allowWalkin:true, allowOnline:true, opStart:'09:00', opEnd:'19:00', slotDuration:30, maxPatients:40 };
  currentAvailData = data;
  document.getElementById('toggle-open').checked   = data.isOpen !== false;
  document.getElementById('toggle-walkin').checked = data.allowWalkin !== false;
  document.getElementById('toggle-online').checked = data.allowOnline !== false;
  document.getElementById('op-start').value = data.opStart || '09:00';
  document.getElementById('op-end').value   = data.opEnd   || '19:00';
  document.getElementById('op-slot').value  = data.slotDuration || 30;
  document.getElementById('op-max').value   = data.maxPatients  || 40;
  renderSlotPreview(date, data);
}

async function saveAvailabilityField(field, value) {
  const date = document.getElementById('avail-date').value || todayStr();
  await db.ref('/availability/' + date).update({ [field]: value });
  currentAvailData[field] = value;
  showToast('Availability updated', 'success');
}

async function saveFullAvailability() {
  const date = document.getElementById('avail-date').value || todayStr();
  const config = {
    isOpen:       document.getElementById('toggle-open').checked,
    allowWalkin:  document.getElementById('toggle-walkin').checked,
    allowOnline:  document.getElementById('toggle-online').checked,
    opStart:      document.getElementById('op-start').value,
    opEnd:        document.getElementById('op-end').value,
    slotDuration: parseInt(document.getElementById('op-slot').value),
    maxPatients:  parseInt(document.getElementById('op-max').value),
    updatedAt:    Date.now()
  };
  await db.ref('/availability/' + date).set(config);
  showToast('Configuration saved for ' + date, 'success');
  renderSlotPreview(date, config);
}

async function copyConfig() {
  const sourceDate = document.getElementById('avail-date').value || todayStr();
  const sourceSnap = await db.ref('/availability/' + sourceDate).once('value');
  const config = sourceSnap.val();
  if (!config) { showToast('Save current date config first', 'error'); return; }
  const updates = {};
  for (let i = 1; i <= 7; i++) {
    const d = new Date(sourceDate);
    d.setDate(d.getDate() + i);
    const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    updates['/availability/' + ds] = { ...config, updatedAt: Date.now() };
  }
  await db.ref().update(updates);
  showToast('Config copied to next 7 days', 'success');
}

async function renderSlotPreview(date, config) {
  const grid = document.getElementById('slot-preview-grid');
  document.getElementById('slot-preview-label').textContent = fmtDate(date);
  if (!config.isOpen) {
    grid.innerHTML = '<div class="slot-chip closed" style="grid-column:1/-1;">OP Closed on this date</div>';
    return;
  }
  const slots = generateSlots(config.opStart, config.opEnd, config.slotDuration);
  const snap  = await db.ref('/bookings').orderByChild('date').equalTo(date).once('value');
  const booked = new Set();
  snap.forEach(child => { const b = child.val(); if (b.status !== 'cancelled') booked.add(b.time); });
  grid.innerHTML = slots.map(s =>
    `<div class="slot-chip ${booked.has(s)?'booked':'available'}">${s}${booked.has(s)?' ●':''}</div>`
  ).join('');
}

/* ── Slot monitor ── */
async function loadSlotMonitor() {
  const today = todayStr();
  const snap  = await db.ref('/availability/' + today).once('value');
  const config = snap.val() || { isOpen:true, opStart:'09:00', opEnd:'19:00', slotDuration:30 };
  const grid = document.getElementById('monitor-slot-grid');
  if (!config.isOpen) { grid.innerHTML = '<div style="color:#8A8A8A;font-size:.875rem;">OP is closed today</div>'; return; }
  const slots = generateSlots(config.opStart, config.opEnd, config.slotDuration);
  db.ref('/bookings').orderByChild('date').equalTo(today).on('value', bSnap => {
    const bm = {};
    bSnap.forEach(child => { const b = child.val(); if (b.status !== 'cancelled') bm[b.time] = b.name; });
    const g = document.getElementById('monitor-slot-grid');
    if (g) g.innerHTML = slots.map(s => {
      const n = bm[s];
      return `<div class="slot-chip ${n?'booked':'available'}" title="${n?'Booked: '+n:'Available'}">${s}${n?'<br><span style="font-size:.5625rem;opacity:0.8;">'+n.split(' ')[0]+'</span>':''}</div>`;
    }).join('');
  });
}

/* ── ANALYTICS ── */
let analyticsChart = null;
let statusChart = null;
let typeChart = null;

async function loadAnalytics() {
  const snap = await db.ref('/bookings').once('value');
  const all = [];
  snap.forEach(child => all.push({ id: child.key, ...child.val() }));

  // ── Summary stats ──
  const totalPatients = all.length;
  const walkins  = all.filter(b => b.type === 'walkin').length;
  const online   = all.filter(b => b.type === 'online').length;
  const completed = all.filter(b => b.status === 'completed').length;
  const cancelled = all.filter(b => b.status === 'cancelled').length;
  const completionRate = totalPatients > 0 ? Math.round((completed / totalPatients) * 100) : 0;

  document.getElementById('an-total').textContent    = totalPatients;
  document.getElementById('an-walkin').textContent   = walkins;
  document.getElementById('an-online').textContent   = online;
  document.getElementById('an-completed').textContent = completed;
  document.getElementById('an-cancelled').textContent = cancelled;
  document.getElementById('an-rate').textContent     = completionRate + '%';

  // ── Last 7 days bar chart ──
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const label = d.getDate() + '/' + (d.getMonth()+1);
    const count = all.filter(b => b.date === ds).length;
    last7.push({ label, count, date: ds });
  }

  // Destroy old charts if they exist
  if (analyticsChart) analyticsChart.destroy();
  if (statusChart) statusChart.destroy();
  if (typeChart) typeChart.destroy();

  const ctx1 = document.getElementById('daily-chart').getContext('2d');
  analyticsChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: last7.map(d => d.label),
      datasets: [{
        label: 'Patients',
        data: last7.map(d => d.count),
        backgroundColor: last7.map((d, i) => i === 6 ? '#0A6EBD' : 'rgba(10,110,189,0.25)'),
        borderColor: '#0A6EBD',
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} patients` } } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'DM Sans' }, color: '#8A8A8A' }, grid: { color: '#F0F7FF' } },
        x: { ticks: { font: { family: 'DM Mono', size: 11 }, color: '#4A4A4A' }, grid: { display: false } }
      }
    }
  });

  // ── Status donut chart ──
  const pending   = all.filter(b => b.status === 'pending').length;
  const confirmed = all.filter(b => b.status === 'confirmed').length;
  const ctx2 = document.getElementById('status-chart').getContext('2d');
  statusChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
      datasets: [{
        data: [pending, confirmed, completed, cancelled],
        backgroundColor: ['#FDE68A','#86EFAC','#7DD3FC','#FCA5A5'],
        borderColor: ['#F59E0B','#22C55E','#0EA5E9','#EF4444'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 12 }, padding: 16 } } }
    }
  });

  // ── Type pie chart ──
  const ctx3 = document.getElementById('type-chart').getContext('2d');
  typeChart = new Chart(ctx3, {
    type: 'doughnut',
    data: {
      labels: ['Walk-in', 'Online'],
      datasets: [{
        data: [walkins, online],
        backgroundColor: ['rgba(124,58,237,0.2)','rgba(10,110,189,0.2)'],
        borderColor: ['#7C3AED','#0A6EBD'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 12 }, padding: 16 } } }
    }
  });

  // ── Service breakdown ──
  const serviceMap = {};
  all.forEach(b => {
    const svc = b.service || b.condition || 'General';
    serviceMap[svc] = (serviceMap[svc] || 0) + 1;
  });
  const sorted = Object.entries(serviceMap).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const maxVal = sorted[0] ? sorted[0][1] : 1;
  document.getElementById('service-breakdown').innerHTML = sorted.map(([svc, cnt]) => `
    <div style="margin-bottom:.75rem;">
      <div style="display:flex;justify-content:space-between;font-family:'DM Sans',sans-serif;font-size:.8125rem;margin-bottom:.3rem;">
        <span style="color:#1A1A1A;text-transform:capitalize;">${svc.replace(/-/g,' ')}</span>
        <span style="font-family:'DM Mono',monospace;color:#0A6EBD;font-weight:500;">${cnt}</span>
      </div>
      <div style="height:6px;background:#E8F0FA;border-radius:9999px;overflow:hidden;">
        <div style="height:100%;width:${(cnt/maxVal)*100}%;background:linear-gradient(90deg,#0A6EBD,#38BDF8);border-radius:9999px;transition:width .6s ease;"></div>
      </div>
    </div>`).join('') || '<p style="color:#8A8A8A;font-size:.875rem;">No data yet</p>';
}

/* ── Settings ── */
async function loadSettings() {
  const user = auth.currentUser;
  document.getElementById('current-creds').innerHTML =
    `Signed in as: <strong>${user ? user.email : '—'}</strong><br>
     Role: <strong>Admin</strong><br>
     <small style="color:#8A8A8A;">To manage users or change nurse passwords, use the <a href="https://console.firebase.google.com/project/gopal-8f354/authentication/users" target="_blank" style="color:#0A6EBD;">Firebase Console → Authentication</a>.</small>`;
}
async function changePassword(role, inputId) {
  const newPwd = document.getElementById(inputId).value.trim();
  if (!newPwd || newPwd.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  if (role === 'admin') {
    try {
      await auth.currentUser.updatePassword(newPwd);
      document.getElementById(inputId).value = '';
      showToast('Password updated in Firebase Auth', 'success');
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
  } else {
    showToast('Nurse password must be changed in Firebase Console', 'info');
  }
}

/* ── Main init ── */
function initDashboard() {
  updateClock();
  setInterval(updateClock, 30000);
  document.getElementById('avail-date').value  = todayStr();
  document.getElementById('filter-date').value = todayStr();
  initTodayListener();
  loadAvailability();
}
