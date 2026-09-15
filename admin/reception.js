// ── Reception & Walk-in Management Module ──
// Handles Walk-in New Patient registration, Existing Patient Return Visits, and Live Queue Management

export function initReceptionModule({ db, fs, authFB }) {
  const {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    runTransaction,
    serverTimestamp,
    arrayUnion
  } = fs;

  const normalizePhone = s => {
    let d = String(s || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    else if (d.length > 10 && d.startsWith('0')) d = d.replace(/^0+/, '');
    return d;
  };

  const esc = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtDate = dStr => {
    if (!dStr) return '—';
    try {
      const d = dStr.toDate ? dStr.toDate() : new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dStr;
    }
  };

  const fmtTime = (timeStr, createdAt) => {
    if (timeStr && timeStr.trim()) return timeStr;
    if (createdAt) {
      try {
        const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      } catch (e) {}
    }
    return '';
  };

  // Toast
  const showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const msgEl = document.getElementById('toast-msg');
    if (!toast) return;
    toast.className = `toast show ${type}`;
    if (msgEl) msgEl.textContent = msg;
    if (icon) {
      icon.innerHTML = type === 'success'
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
    }
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
  };

  // Live Real-Time Clock for Visiting Time Inputs
  const updateLiveClockInputs = () => {
    const liveTime = getCurrentTimeIST(false);
    const nTime = document.getElementById('new-walkin-time');
    const eTime = document.getElementById('ext-visit-time');

    if (nTime && document.activeElement !== nTime && (!nTime.dataset.manual || !nTime.value)) {
      nTime.value = liveTime;
    }
    if (eTime && document.activeElement !== eTime && (!eTime.dataset.manual || !eTime.value)) {
      eTime.value = liveTime;
    }
  };
  setInterval(updateLiveClockInputs, 1000);

  // Sync Doctor and Department defaults
  window.syncDoctorDept = (prefix, changedField) => {
    const docSelect = document.getElementById(prefix === 'new-walkin' ? 'new-walkin-doctor' : 'ext-visit-doctor');
    const typeSelect = document.getElementById(prefix === 'new-walkin' ? 'new-walkin-type' : 'ext-visit-type');

    if (!docSelect || !typeSelect) return;

    if (changedField === 'doctor') {
      if (docSelect.value.includes('Gopala')) {
        typeSelect.value = 'Orthopaedic';
      } else if (docSelect.value.includes('Shiny')) {
        typeSelect.value = 'General';
      }
    } else if (changedField === 'dept') {
      if (typeSelect.value === 'Orthopaedic') {
        docSelect.value = 'Dr. N. Gopala Krishnan';
      } else if (typeSelect.value === 'General') {
        docSelect.value = 'Dr. R. Shiny';
      }
    }
  };

  // Fetch Next OP Number atomically
  const getNextOpNo = async () => {
    const counterRef = doc(db, 'meta', 'opNoCounter');
    return await runTransaction(db, async transaction => {
      const snap = await transaction.get(counterRef);
      let nextVal = 20001;
      if (snap.exists()) {
        const cur = snap.data().current;
        nextVal = (typeof cur === 'number' && cur >= 20001) ? cur + 1 : 20001;
      }
      transaction.set(counterRef, { current: nextVal }, { merge: true });
      return nextVal;
    });
  };

  // State
  let todayPatients = [];
  let todayActivePatients = [];
  let todayArchivePatients = [];
  let allPatientsList = [];
  let selectedExistingPatient = null;
  let currentMode = 'new'; // 'new' | 'existing'
  let queueTab = 'active'; // 'active' | 'archive'
  let isSubmitting = false;

  // IST Helpers
  const getTodayIST = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const getCurrentTimeIST = (includeSeconds = false) => {
    const d = new Date(Date.now() + 5.5 * 3600000);
    let hours = d.getUTCHours();
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    if (includeSeconds) {
      return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    }
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const isDateToday = (dVal) => {
    if (!dVal) return false;
    const today = getTodayIST();
    const s = String(dVal).trim();
    if (s === today || s.startsWith(today)) return true;
    const parts = today.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (s === `${d}-${m}-${y}` || s === `${d}/${m}/${y}`) return true;
    }
    return false;
  };

  const isPatientForToday = (p) => {
    // Check if the patient's LATEST visit is today
    if (Array.isArray(p.visits) && p.visits.length > 0) {
      const latestVisit = p.visits[p.visits.length - 1];
      if (latestVisit && isDateToday(latestVisit.date || latestVisit.visitDate)) return true;
    }
    if (isDateToday(p.visitDate)) return true;
    if (p.createdAt) {
      try {
        const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        const istStr = new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
        if (istStr === getTodayIST()) return true;
      } catch(e) {}
    }
    return false;
  };

  // Pre-fetch all patients for instant typeahead search in Existing Patient mode
  const loadAllPatientsCache = async () => {
    try {
      const snap = await getDocs(collection(db, 'patients'));
      allPatientsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Could not cache all patients for typeahead:', e);
    }
  };

  // Load Today's Walk-in & Reception Records
  const loadTodayQueue = async () => {
    const today = getTodayIST();
    try {
      const snap = await getDocs(collection(db, 'patients'));
      const rawList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Strictly filter patients whose latest visit/registration is strictly today in IST
      const todayList = rawList.filter(isPatientForToday);

      // Separate into Active Queue vs Today's Archive
      todayArchivePatients = todayList.filter(p => (
        p.isArchivedToday === true ||
        p.archivedDate === today ||
        p.queueStatus === 'Archived'
      ));

      todayActivePatients = todayList.filter(p => !(
        p.isArchivedToday === true ||
        p.archivedDate === today ||
        p.queueStatus === 'Archived'
      ));

      // Priority sort for Active Queue:
      // 1. In Consultation (Top)
      // 2. Waiting (Middle)
      // 3. Completed (Bottom)
      const getStatusRank = status => {
        if (status === 'In Consultation') return 1;
        if (status === 'Waiting') return 2;
        if (status === 'Completed') return 3;
        return 4;
      };

      todayActivePatients.sort((a, b) => {
        const rankA = getStatusRank(a.queueStatus || 'Waiting');
        const rankB = getStatusRank(b.queueStatus || 'Waiting');
        if (rankA !== rankB) return rankA - rankB;

        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        if (timeA !== timeB) return timeA - timeB;
        return (Number(a.opNo) || 0) - (Number(b.opNo) || 0);
      });

      // Sort Archive list by archived time / created time descending
      todayArchivePatients.sort((a, b) => {
        const timeA = a.archivedAt?.seconds || a.createdAt?.seconds || 0;
        const timeB = b.archivedAt?.seconds || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      todayPatients = todayActivePatients;
      renderQueueTable();
      renderArchiveTable();
      renderReceptionStats();
    } catch (err) {
      console.error('Error fetching today queue:', err);
      showToast('Error loading queue: ' + err.message, 'error');
    }
  };

  // Switch between Active Queue and Archive Tabs
  window.setQueueTab = tab => {
    queueTab = tab;
    const btnActive = document.getElementById('btn-tab-active-queue');
    const btnArchive = document.getElementById('btn-tab-archive-queue');
    const viewActive = document.getElementById('view-active-queue');
    const viewArchive = document.getElementById('view-archive-queue');

    if (tab === 'active') {
      btnActive?.classList.add('active');
      btnArchive?.classList.remove('active');
      if (viewActive) viewActive.style.display = 'block';
      if (viewArchive) viewArchive.style.display = 'none';
    } else {
      btnActive?.classList.remove('active');
      btnArchive?.classList.add('active');
      if (viewActive) viewActive.style.display = 'none';
      if (viewArchive) viewArchive.style.display = 'block';
    }
  };

  // Mark Patient Done and Move to Today's Archive
  window.markPatientDone = async (patientId) => {
    try {
      const today = getTodayIST();
      const nowTime = getCurrentTimeIST(false);
      await updateDoc(doc(db, 'patients', patientId), {
        queueStatus: 'Completed',
        isArchivedToday: true,
        archivedDate: today,
        archivedTime: nowTime,
        archivedAt: serverTimestamp()
      });
      showToast('Patient marked as Done and moved to Archive.');
      await loadTodayQueue();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Restore Patient from Archive back to Active Queue
  window.restorePatientFromArchive = async (patientId) => {
    try {
      await updateDoc(doc(db, 'patients', patientId), {
        isArchivedToday: false,
        archivedDate: null,
        queueStatus: 'Waiting'
      });
      showToast('Patient restored to active queue.');
      await loadTodayQueue();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Render Stats
  const renderReceptionStats = () => {
    const totalEl = document.getElementById('stat-today-total');
    const newEl = document.getElementById('stat-today-new');
    const returnEl = document.getElementById('stat-today-return');
    const waitingEl = document.getElementById('stat-today-waiting');
    const badgeActive = document.getElementById('badge-active-count');
    const badgeArchive = document.getElementById('badge-archive-count');

    const total = todayActivePatients.length + todayArchivePatients.length;
    let newCount = 0;
    let returnCount = 0;
    let waitingCount = 0;

    [...todayActivePatients, ...todayArchivePatients].forEach(p => {
      if (p.isReturnVisit || (p.visits && p.visits.length > 1)) {
        returnCount++;
      } else {
        newCount++;
      }
    });

    todayActivePatients.forEach(p => {
      const status = p.queueStatus || 'Waiting';
      if (status === 'Waiting') waitingCount++;
    });

    if (totalEl) totalEl.textContent = total;
    if (newEl) newEl.textContent = newCount;
    if (returnEl) returnEl.textContent = returnCount;
    if (waitingEl) waitingEl.textContent = waitingCount;
    if (badgeActive) badgeActive.textContent = todayActivePatients.length;
    if (badgeArchive) badgeArchive.textContent = todayArchivePatients.length;
  };

  // Render Live Queue Table
  const renderQueueTable = () => {
    const tbody = document.getElementById('queue-table-body');
    if (!tbody) return;

    if (!todayActivePatients.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:3.5rem 1rem;color:var(--text-light);">
            <div style="width:48px;height:48px;border-radius:50%;background:var(--primary-ul);color:var(--primary);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h4 style="font-size:1.05rem;font-weight:600;color:var(--text-dark);margin-bottom:.35rem;">No Active Patients in Queue</h4>
            <p style="font-size:.85rem;">All registered patients have been completed or no walk-ins yet today.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = todayActivePatients.map((p, idx) => {
      const tokenNo = idx + 1;
      const isReturn = p.isReturnVisit || (p.visits && p.visits.length > 1);
      const vTime = fmtTime(p.visitTime, p.createdAt) || '—';
      const status = p.queueStatus || 'Waiting';

      let statusBadge = 'badge-waiting';
      if (status === 'In Consultation') statusBadge = 'badge-consulting';
      if (status === 'Completed') statusBadge = 'badge-completed';

      return `
        <tr>
          <td>
            <div class="token-pill">#${tokenNo}</div>
          </td>
          <td>
            <span class="op-tag">${p.opNo ?? '—'}</span>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:.6rem;">
              <div>
                <div class="patient-queue-name" style="font-weight:700;color:var(--text-dark);word-break:break-word;">${esc(p.name)}</div>
                <div style="font-size:.75rem;color:var(--text-light);margin-top:2px;">
                  ${p.age ? p.age + 'y • ' : ''}${p.gender || ''} ${p.phone ? '• ' + p.phone : ''}
                </div>
              </div>
              <span class="visit-type-badge ${isReturn ? 'return' : 'new'}">${isReturn ? 'Return' : 'New Walk-in'}</span>
            </div>
          </td>
          <td>
            <div style="font-weight:600;color:var(--text-dark);font-size:.85rem;">${esc(p.doctor) || 'Dr. N. Gopala Krishnan'}</div>
            <div style="font-size:.75rem;color:var(--text-light);">${esc(p.consultationType) || 'Orthopaedic'}</div>
          </td>
          <td>
            <div style="font-size:.8rem;color:var(--primary);font-weight:600;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${vTime}
            </div>
          </td>
          <td>
            <select class="status-select ${statusBadge}" onchange="window.updatePatientStatus('${p.id}', this.value)">
              <option value="Waiting" ${status === 'Waiting' ? 'selected' : ''}>Waiting</option>
              <option value="In Consultation" ${status === 'In Consultation' ? 'selected' : ''}>In Consultation</option>
              <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
            </select>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:.35rem;">
              <a href="bill.html?patientId=${p.id}&op=${p.opNo || ''}&name=${encodeURIComponent(p.name || '')}" class="action-btn-sm bill" title="Create Bill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                Bill
              </a>
              <button type="button" class="action-btn-sm done" onclick="window.markPatientDone('${p.id}')" title="Mark Done & Move to Archive">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Done
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Render Today's Archive Table
  const renderArchiveTable = () => {
    const tbody = document.getElementById('archive-table-body');
    if (!tbody) return;

    if (!todayArchivePatients.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:3.5rem 1rem;color:var(--text-light);">
            <div style="width:48px;height:48px;border-radius:50%;background:rgba(34,197,94,.1);color:#16a34a;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h4 style="font-size:1.05rem;font-weight:600;color:var(--text-dark);margin-bottom:.35rem;">No Completed Patients Archived Yet Today</h4>
            <p style="font-size:.85rem;">When you click "Done" on any patient in the live queue, they will appear here.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = todayArchivePatients.map(p => {
      const doneTime = p.archivedTime || fmtTime(p.visitTime, p.createdAt) || '—';
      const isPaid = p.lastBillPaid === true;

      return `
        <tr>
          <td>
            <span class="op-tag">${p.opNo ?? '—'}</span>
          </td>
          <td>
            <div>
              <div style="font-weight:700;color:var(--text-dark);">${esc(p.name)}</div>
              <div style="font-size:.75rem;color:var(--text-light);margin-top:2px;">
                ${p.age ? p.age + 'y • ' : ''}${p.gender || ''} ${p.phone ? '• ' + p.phone : ''}
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight:600;color:var(--text-dark);font-size:.85rem;">${esc(p.doctor) || 'Dr. N. Gopala Krishnan'}</div>
            <div style="font-size:.75rem;color:var(--text-light);">${esc(p.consultationType) || 'Orthopaedic'}</div>
          </td>
          <td>
            <div style="font-size:.8rem;color:#16a34a;font-weight:600;display:flex;align-items:center;gap:3px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              ${doneTime}
            </div>
          </td>
          <td>
            ${p.lastBillNumber ? `
              <span style="font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:4px;background:${isPaid ? 'rgba(34,197,94,.15);color:#16a34a;' : 'rgba(219,119,6,.15);color:#d97706;'}">
                ${isPaid ? 'Paid' : 'Billed'}
              </span>
            ` : `
              <span style="font-size:.72rem;color:var(--text-light);">No Bill</span>
            `}
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:.35rem;">
              <a href="bill.html?patientId=${p.id}&op=${p.opNo || ''}&name=${encodeURIComponent(p.name || '')}" class="action-btn-sm bill" title="Create / View Bill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                Bill
              </a>
              <button type="button" class="action-btn-sm restore" onclick="window.restorePatientFromArchive('${p.id}')" title="Restore to active queue">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                Restore
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Switch Registration Mode (New Walk-in vs Existing Patient Return)
  window.setReceptionMode = mode => {
    currentMode = mode;
    const btnNew = document.getElementById('tab-mode-new');
    const btnExt = document.getElementById('tab-mode-existing');
    const formNew = document.getElementById('section-form-new');
    const formExt = document.getElementById('section-form-existing');

    if (mode === 'new') {
      btnNew.classList.add('active');
      btnExt.classList.remove('active');
      formNew.style.display = 'block';
      formExt.style.display = 'none';
      selectedExistingPatient = null;
    } else {
      btnNew.classList.remove('active');
      btnExt.classList.add('active');
      formNew.style.display = 'none';
      formExt.style.display = 'block';
      document.getElementById('existing-search-input').focus();
    }
  };

  // Instant Search & Auto-Fill for Existing Patients by OP Number / Name / Phone
  window.searchExistingPatients = (queryText) => {
    const resultsBox = document.getElementById('existing-search-results');
    if (!resultsBox) return;

    const q = (queryText || '').trim().toLowerCase();
    if (!q) {
      resultsBox.style.display = 'none';
      return;
    }

    const digitsOnly = q.replace(/\D/g, '');

    // Filter patients
    const matches = allPatientsList.filter(p => {
      const name = String(p.name || '').toLowerCase();
      const phone = String(p.phone || '').replace(/\D/g, '');
      const opNo = String(p.opNo ?? '');
      return name.includes(q) || (opNo === q || (digitsOnly && opNo.startsWith(digitsOnly)) || (digitsOnly && opNo.includes(digitsOnly))) || (digitsOnly && phone.includes(digitsOnly));
    }).slice(0, 8);

    if (!matches.length) {
      resultsBox.innerHTML = `
        <div style="padding:1rem;text-align:center;color:var(--text-light);font-size:.85rem;">
          No matching existing patient found. Switch to <strong>New Patient</strong> to register.
        </div>
      `;
      resultsBox.style.display = 'block';
      return;
    }

    resultsBox.innerHTML = matches.map(p => `
      <div class="search-match-item" onclick="window.selectExistingPatient('${p.id}')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;">
          <div style="font-weight:700;color:var(--text-dark);font-size:.92rem;word-break:break-word;white-space:normal;line-height:1.35;flex:1;min-width:0;">${esc(p.name)}</div>
          <span class="op-tag" style="flex-shrink:0;">${p.opNo ?? '—'}</span>
        </div>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;font-size:.775rem;color:var(--text-light);">
          <span>${p.age ? p.age + ' yrs' : ''} ${p.gender || ''}</span>
          <span>• Phone: ${p.phone || '—'}</span>
          <span>• Last Visit: ${fmtDate(p.visitDate)}</span>
        </div>
      </div>
    `).join('');
    resultsBox.style.display = 'block';
  };

  // Select an existing patient from search results & auto-fill details
  window.selectExistingPatient = (patientId) => {
    const patient = allPatientsList.find(p => p.id === patientId);
    if (!patient) return;
    selectedExistingPatient = patient;

    document.getElementById('existing-search-results').style.display = 'none';
    document.getElementById('existing-search-input').value = `${patient.opNo ?? '—'} - ${patient.name}`;

    const preview = document.getElementById('existing-patient-preview');
    preview.style.display = 'block';
    preview.innerHTML = `
      <div style="background:var(--primary-ul);border:1.5px solid var(--border-focus);border-radius:12px;padding:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
        <div>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <strong style="font-size:1.05rem;color:var(--primary);">${esc(patient.name)}</strong>
            <span class="op-tag" style="background:#fff;">${patient.opNo ?? '—'}</span>
          </div>
          <div style="font-size:.8rem;color:var(--text-med);margin-top:.25rem;">
            ${patient.age ? patient.age + ' yrs • ' : ''}${patient.gender || ''} • Phone: ${patient.phone || 'No phone'} • Blood: ${patient.bloodGroup || 'Unknown'}
          </div>
          <div style="font-size:.75rem;color:var(--text-light);margin-top:.15rem;">
            Address: ${esc(patient.address) || 'Not recorded'} • Last Visit: ${fmtDate(patient.visitDate)}
          </div>
        </div>
        <button type="button" class="action-btn-sm" onclick="window.clearExistingSelection()" style="background:#fff;">Change</button>
      </div>
    `;

    // Auto-populate return visit fields with patient's previous doctor/department if available
    const docSelect = document.getElementById('ext-visit-doctor');
    const typeSelect = document.getElementById('ext-visit-type');
    if (docSelect && patient.doctor) docSelect.value = patient.doctor;
    if (typeSelect && patient.consultationType) typeSelect.value = patient.consultationType;

    // Show visit details form for today
    document.getElementById('existing-visit-form-fields').style.display = 'block';
  };

  window.clearExistingSelection = () => {
    selectedExistingPatient = null;
    document.getElementById('existing-search-input').value = '';
    document.getElementById('existing-patient-preview').style.display = 'none';
    document.getElementById('existing-visit-form-fields').style.display = 'none';
    document.getElementById('existing-search-input').focus();
  };

  // Register New Walk-in Patient
  window.saveNewWalkin = async () => {
    if (isSubmitting) return;

    const name = document.getElementById('new-walkin-name').value.trim();
    const phone = document.getElementById('new-walkin-phone').value.trim();
    const age = document.getElementById('new-walkin-age').value.trim();
    const gender = document.getElementById('new-walkin-gender').value;
    const bloodGroup = document.getElementById('new-walkin-blood').value;
    const address = document.getElementById('new-walkin-address').value.trim();
    const doctor = document.getElementById('new-walkin-doctor').value;
    const consultationType = document.getElementById('new-walkin-type').value;
    const reason = document.getElementById('new-walkin-reason').value.trim();
    const diagnosis = document.getElementById('new-walkin-diagnosis').value.trim();
    const visitDate = document.getElementById('new-walkin-date').value || getTodayIST();
    const visitTime = document.getElementById('new-walkin-time').value || getCurrentTimeIST();

    if (!name) {
      showToast('Please enter the patient name', 'error');
      document.getElementById('new-walkin-name').focus();
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit phone number', 'error');
      document.getElementById('new-walkin-phone').focus();
      return;
    }

    let parsedAge = null;
    if (age) {
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 100) {
        showToast('Please enter a valid age between 1 and 100', 'error');
        document.getElementById('new-walkin-age').focus();
        return;
      }
      parsedAge = Math.min(100, Math.max(1, ageNum));
    }

    isSubmitting = true;
    const btn = document.getElementById('btn-submit-new-walkin');
    if (btn) { btn.disabled = true; btn.textContent = 'Registering…'; }

    try {
      const assignedOpNo = await getNextOpNo();

      const newPatientData = {
        name,
        nameLower: name.toLowerCase(),
        opNo: assignedOpNo,
        phone,
        phoneNormalized: normalizePhone(phone),
        age: parsedAge,
        gender,
        bloodGroup,
        address,
        doctor,
        consultationType,
        visitDate,
        visitTime,
        reason,
        diagnosis,
        queueStatus: 'Waiting',
        isReturnVisit: false,
        createdAt: serverTimestamp(),
        visits: [
          {
            date: visitDate,
            time: visitTime,
            doctor,
            consultationType,
            reason,
            diagnosis,
            timestamp: new Date().toISOString()
          }
        ]
      };

      const docRef = doc(collection(db, 'patients'));
      await setDoc(docRef, newPatientData);

      showToast(`Patient registered successfully! Assigned OP ${assignedOpNo}`);

      // Reset form
      document.getElementById('form-new-walkin').reset();
      document.getElementById('new-walkin-date').value = getTodayIST();
      document.getElementById('new-walkin-time').value = getCurrentTimeIST();

      await loadAllPatientsCache();
      await loadTodayQueue();
    } catch (err) {
      console.error('Error saving new walkin:', err);
      showToast('Registration failed: ' + err.message, 'error');
    } finally {
      isSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Register & Add to Queue'; }
    }
  };

  // Check-in Existing Patient for a Return Visit (Does NOT increase unique patient count)
  window.saveExistingReturnVisit = async () => {
    if (isSubmitting) return;
    if (!selectedExistingPatient) {
      showToast('Please select an existing patient first', 'error');
      return;
    }

    const doctor = document.getElementById('ext-visit-doctor').value;
    const consultationType = document.getElementById('ext-visit-type').value;
    const reason = document.getElementById('ext-visit-reason').value.trim();
    const diagnosis = document.getElementById('ext-visit-diagnosis').value.trim();
    const visitDate = document.getElementById('ext-visit-date').value || getTodayIST();
    const visitTime = document.getElementById('ext-visit-time').value || getCurrentTimeIST();

    isSubmitting = true;
    const btn = document.getElementById('btn-submit-ext-walkin');
    if (btn) { btn.disabled = true; btn.textContent = 'Checking in…'; }

    try {
      const patientRef = doc(db, 'patients', selectedExistingPatient.id);

      const newVisitEntry = {
        date: visitDate,
        time: visitTime,
        doctor,
        consultationType,
        reason,
        diagnosis: diagnosis || selectedExistingPatient.diagnosis || '',
        timestamp: new Date().toISOString()
      };

      await updateDoc(patientRef, {
        visitDate,
        visitTime,
        doctor,
        consultationType,
        reason: reason || selectedExistingPatient.reason || '',
        diagnosis: diagnosis || selectedExistingPatient.diagnosis || '',
        queueStatus: 'Waiting',
        isReturnVisit: true,
        isArchivedToday: false,
        archivedDate: null,
        visits: arrayUnion(newVisitEntry)
      });

      showToast(`Return visit logged for ${selectedExistingPatient.name} (OP ${selectedExistingPatient.opNo || '—'})`);

      window.clearExistingSelection();
      document.getElementById('form-ext-walkin').reset();
      document.getElementById('ext-visit-date').value = getTodayIST();
      document.getElementById('ext-visit-time').value = getCurrentTimeIST();

      await loadAllPatientsCache();
      await loadTodayQueue();
    } catch (err) {
      console.error('Error logging return visit:', err);
      showToast('Check-in failed: ' + err.message, 'error');
    } finally {
      isSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Log Return Visit & Add to Queue'; }
    }
  };

  // Update Status in Queue with One-Doctor-One-Consultation Guard
  window.updatePatientStatus = async (patientId, newStatus) => {
    const targetPatient = todayPatients.find(p => p.id === patientId);
    if (!targetPatient) return;

    if (newStatus === 'In Consultation') {
      const targetDoctor = targetPatient.doctor || 'Dr. N. Gopala Krishnan';
      const existingInConsultation = todayPatients.find(p => p.id !== patientId && (p.doctor || 'Dr. N. Gopala Krishnan') === targetDoctor && p.queueStatus === 'In Consultation');

      if (existingInConsultation) {
        showToast(`${targetDoctor} is already in consultation with ${existingInConsultation.name}. Please complete that consultation first.`, 'error');
        renderQueueTable(); // Reverts dropdown selection
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'patients', patientId), {
        queueStatus: newStatus
      });
      showToast(`Status updated to ${newStatus}`);
      await loadTodayQueue();
    } catch (e) {
      showToast('Could not update status: ' + e.message, 'error');
    }
  };

  // Print Token Slip
  window.printToken = (name, opNo, tokenNo, doctor) => {
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Token Slip #${tokenNo} — Gopal Ortho Care</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; color: #000; }
            .h { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
            .sub { font-size: 12px; margin-bottom: 12px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .token { font-size: 40px; font-weight: bold; margin: 10px 0; }
            .info { font-size: 13px; text-align: left; margin: 8px 0; }
            .info div { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="h">GOPAL ORTHO CARE</div>
          <div class="sub">Advanced Orthopaedic & General Care Centre</div>
          <div class="divider"></div>
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;">Today's Token</div>
          <div class="token">#${tokenNo}</div>
          <div class="divider"></div>
          <div class="info">
            <div><strong>Patient:</strong> ${name}</div>
            <div><strong>OP No:</strong> OP ${opNo || '—'}</div>
            <div><strong>Doctor:</strong> ${doctor || 'Dr. N. Gopala Krishnan'}</div>
            <div><strong>Date & Time:</strong> ${getTodayIST()} ${getCurrentTimeIST()}</div>
          </div>
          <div class="divider"></div>
          <div style="font-size:11px;">Please wait for your token number to be called.<br>Get well soon!</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Initialize
  const init = async () => {
    const today = getTodayIST();
    const time = getCurrentTimeIST();
    const nDate = document.getElementById('new-walkin-date');
    const nTime = document.getElementById('new-walkin-time');
    const eDate = document.getElementById('ext-visit-date');
    const eTime = document.getElementById('ext-visit-time');

    if (nDate) nDate.value = today;
    if (nTime) nTime.value = time;
    if (eDate) eDate.value = today;
    if (eTime) eTime.value = time;

    await loadAllPatientsCache();
    await loadTodayQueue();
  };

  init();

  return {
    refreshQueue: loadTodayQueue
  };
}
