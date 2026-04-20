/**
 * desk.js
 * Nurse desk — Firebase Auth guard + real-time queue + walk-in form logic.
 *
 * Requires: firebase-init.js loaded first (provides `auth` and `db` globals).
 */

/* ── Auth guard: admin OR nurse allowed ── */
auth.onAuthStateChanged(user => {
  if (!user) { window.location.replace('login.html'); return; }
  // Any authenticated user (admin or nurse) can access the desk
  initDesk();
});

/* ── Logout ── */
function logout() {
  auth.signOut().then(() => window.location.replace('login.html'));
}

/* ── State ── */
let allBookings   = [];
let currentFilter = 'all';
let todayConfig   = {};
let selectedSlot  = null;
let bookedSlots   = new Set();

/* ── Clock ── */
function updateClock() {
  const d = new Date();
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('clock').textContent =
    days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] +
    ' · ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('today-label').textContent =
    'Today: ' + d.getDate() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

/* ── Today string ── */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

/* ── Toast ── */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  t.innerHTML = `<span>${icon}</span> ${msg}`;
  t.className = 'toast show toast-' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ── 12-hour formatter ── */
function fmt12(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
}

/* ── Slot generator ── */
function generateSlots(start, end, duration) {
  const slots = [];
  let [sh, sm] = (start||'09:00').split(':').map(Number);
  let [eh, em] = (end||'19:00').split(':').map(Number);
  let cur = sh * 60 + sm, endMin = eh * 60 + em;
  while (cur + duration <= endMin) {
    const h = Math.floor(cur / 60), m = cur % 60;
    const ampm = h >= 12 ? 'PM' : 'AM', hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push(`${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`);
    cur += duration;
  }
  return slots;
}

/* ── Load & listen to availability ── */
function watchAvailability() {
  db.ref('/availability/' + todayStr()).on('value', snap => {
    const config  = snap.val() || { isOpen:true, allowWalkin:true };
    todayConfig   = config;
    const isOpen      = config.isOpen !== false;
    const allowWalkin = config.allowWalkin !== false;

    document.getElementById('op-closed-msg').classList.toggle('show', !isOpen);
    document.getElementById('op-open-msg').classList.toggle('show',  isOpen);
    if (isOpen) {
      document.getElementById('op-open-text').textContent =
        `OP open today · ${fmt12(config.opStart||'09:00')} – ${fmt12(config.opEnd||'19:00')} · ${config.slotDuration||30}-min slots`;
    }
    document.getElementById('walkin-closed-msg').style.display = (isOpen && !allowWalkin) ? 'block' : 'none';
    document.getElementById('wi-submit').disabled = !isOpen || !allowWalkin;
    renderSlots();
  });
}

/* ── Render slot picker ── */
function renderSlots() {
  const grid = document.getElementById('wi-slots');
  if (!todayConfig.isOpen) {
    grid.innerHTML = '<p style="color:#8A8A8A;font-size:.8125rem;">OP closed today</p>';
    return;
  }
  const slots = generateSlots(todayConfig.opStart, todayConfig.opEnd, todayConfig.slotDuration||30);
  if (!slots.length) {
    grid.innerHTML = '<p style="color:#8A8A8A;font-size:.8125rem;">No slots configured</p>';
    return;
  }
  grid.innerHTML = slots.map(s => {
    const disabled = bookedSlots.has(s);
    const sel      = s === selectedSlot;
    return `<button class="slot-btn ${disabled?'slot-disabled':''} ${sel?'slot-selected':''}"
      ${disabled ? 'disabled' : ''}
      data-slot="${s}">${s}</button>`;
  }).join('');
  grid.querySelectorAll('.slot-btn:not(.slot-disabled)').forEach(btn => {
    btn.onclick = () => selectSlot(btn.dataset.slot, btn);
  });
}

function selectSlot(slot, btn) {
  selectedSlot = slot;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-selected'));
  btn.classList.add('slot-selected');
}

/* ── Real-time bookings listener ── */
function watchBookings() {
  db.ref('/bookings').orderByChild('date').equalTo(todayStr()).on('value', snap => {
    allBookings = [];
    bookedSlots = new Set();
    snap.forEach(child => {
      const b = { id: child.key, ...child.val() };
      allBookings.push(b);
      if (b.status !== 'cancelled' && b.time) bookedSlots.add(b.time);
    });
    allBookings.sort((a,b) => (a.tokenNumber||999) - (b.tokenNumber||999));

    document.getElementById('s-total').textContent     = allBookings.length;
    document.getElementById('s-walkin').textContent    = allBookings.filter(b => b.type === 'walkin').length;
    document.getElementById('s-online').textContent    = allBookings.filter(b => b.type === 'online').length;
    document.getElementById('s-pending').textContent   = allBookings.filter(b => b.status === 'pending').length;
    document.getElementById('s-completed').textContent = allBookings.filter(b => b.status === 'completed').length;
    document.getElementById('s-cancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;

    renderQueue();
    renderSlots();
  });
}

/* ── Render queue ── */
function renderQueue() {
  const search = document.getElementById('queue-search').value.toLowerCase();
  let list = allBookings;
  if (currentFilter !== 'all') list = list.filter(b => b.status === currentFilter);
  if (search) list = list.filter(b =>
    (b.name||'').toLowerCase().includes(search) || (b.mobile||'').includes(search)
  );
  const container = document.getElementById('queue-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty-q">
      <svg viewBox="0 0 24 24" fill="none" width="40" height="40" style="display:block;margin:0 auto 1rem;stroke:#C0C0C0;stroke-width:1.25;">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke-linecap="round"/><circle cx="9" cy="7" r="4"/>
      </svg>No appointments found</div>`;
    return;
  }
  container.innerHTML = list.map(b => `
    <div class="appt-card status-${b.status}">
      <div class="appt-card-top">
        <div>
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;">
            <span class="appt-token">T-${b.tokenNumber||'—'}</span>
            <span class="appt-name">${b.name||'Unknown'}</span>
          </div>
          <div class="appt-meta">${b.age?b.age+' yrs':''} ${b.gender?'· '+b.gender:''} · <a href="tel:${b.mobile}" style="color:#0A6EBD;">${b.mobile||'—'}</a></div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="appt-time">${b.time||'—'}</div>
          <div style="margin-top:.3rem;">${badgeHtml(b.status)} ${typeBadge(b.type)}</div>
        </div>
      </div>
      <div class="appt-info-row">
        ${b.service?`<span class="appt-chip chip-service">${b.service}</span>`:''}
        ${b.notes?`<span class="appt-chip chip-service" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${b.notes}">📝 ${b.notes}</span>`:''}
        ${b.patientType==='emergency'?'<span class="appt-chip" style="background:#FEE2E2;border-color:#FCA5A5;color:#DC2626;">🚨 Emergency</span>':''}
      </div>
      <div class="appt-actions">
        ${b.status==='pending'?`<button class="action-btn btn-confirm" onclick="setStatus('${b.id}','confirmed')">✓ Confirm</button>`:''}
        ${['pending','confirmed'].includes(b.status)?`<button class="action-btn btn-arrive" onclick="setStatus('${b.id}','arrived')">→ Arrived</button>`:''}
        ${['pending','confirmed','arrived'].includes(b.status)?`<button class="action-btn btn-done" onclick="setStatus('${b.id}','completed')">✓ Done</button>`:''}
        ${!['cancelled','completed'].includes(b.status)?`<button class="action-btn btn-cancel" onclick="setStatus('${b.id}','cancelled')">✕ Cancel</button>`:''}
      </div>
    </div>`).join('');
}

function badgeHtml(s) {
  const m = { pending:'badge-pending', confirmed:'badge-confirmed', cancelled:'badge-cancelled', completed:'badge-completed', arrived:'badge-arrived' };
  return `<span class="badge ${m[s]||''}">${s||'—'}</span>`;
}
function typeBadge(t) {
  return `<span class="badge ${t==='online'?'badge-online':'badge-walkin'}">${t||'—'}</span>`;
}

function filterQueue(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.queue-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderQueue();
}

async function setStatus(id, status) {
  await db.ref('/bookings/' + id).update({ status, updatedAt: Date.now() });
  showToast(`Patient ${status}`, 'success');
}

/* ── Add Walk-in ── */
async function addWalkin() {
  const name   = document.getElementById('wi-name').value.trim();
  const mobile = document.getElementById('wi-mobile').value.trim();
  if (!name)   { showToast('Please enter patient name', 'error'); return; }
  if (!mobile || !/^[6-9][0-9]{9}$/.test(mobile)) { showToast('Enter valid 10-digit mobile', 'error'); return; }
  if (!selectedSlot)                { showToast('Please select a time slot', 'error'); return; }
  if (bookedSlots.has(selectedSlot)){ showToast('This slot is already booked', 'error'); return; }

  const btn = document.getElementById('wi-submit');
  const txt = document.getElementById('wi-btn-text');
  btn.disabled = true; txt.textContent = 'Adding…';

  // Calculate token based on live count
  const snap   = await db.ref('/bookings').orderByChild('date').equalTo(todayStr()).once('value');
  const tokens = [];
  snap.forEach(c => { const b = c.val(); if (b.tokenNumber) tokens.push(b.tokenNumber); });
  const token  = tokens.length ? Math.max(...tokens) + 1 : 1;

  const booking = {
    name, mobile,
    age:         parseInt(document.getElementById('wi-age').value) || null,
    gender:      document.getElementById('wi-gender').value || null,
    service:     document.getElementById('wi-service').value || 'General',
    patientType: document.getElementById('wi-ptype').value  || 'new',
    notes:       document.getElementById('wi-notes').value.trim() || null,
    condition:   document.getElementById('wi-service').value || '',
    time:        selectedSlot,
    date:        todayStr(),
    type:        'walkin',
    status:      'confirmed',
    tokenNumber: token,
    doctor:      'Dr. Gopal',
    createdAt:   Date.now(),
    addedBy:     auth.currentUser ? auth.currentUser.email : 'nurse'
  };

  try {
    await db.ref('/bookings').push(booking);
    showToast(`Walk-in added — Token T-${token} — ${selectedSlot}`, 'success');
    ['wi-name','wi-mobile','wi-age','wi-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('wi-gender').value  = '';
    document.getElementById('wi-service').value = '';
    document.getElementById('wi-ptype').value   = 'new';
    selectedSlot = null;
    renderSlots();
  } catch (e) {
    showToast('Error adding patient: ' + e.message, 'error');
  }
  btn.disabled = false; txt.textContent = 'Add to Queue';
}

/* ── Main init (called after auth confirmed) ── */
function initDesk() {
  updateClock();
  setInterval(updateClock, 30000);
  watchAvailability();
  watchBookings();
}
