// ── Patient Profile Logic & Template Controller ──
// Standalone ES module for rendering detailed patient profile with pre-fixed medical template

/**
 * Escapes HTML characters
 */
export const esc = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Formats date string to human-readable Indian format
 */
export const fmtDate = dStr => {
  if (!dStr) return '—';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Formats time string or Firestore timestamp into human-readable IST time (e.g. 07:30 PM)
 */
export const fmtTime = (tStr, createdAt) => {
  if (tStr && String(tStr).trim()) return String(tStr).trim();
  if (createdAt) {
    try {
      const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return new Date(d.getTime() + 5.5 * 3600000).toLocaleTimeString('en-IN', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch(e) {}
  }
  return '';
};

/**
 * Normalizes phone numbers
 */
export const normalizePhone = p => (p || '').replace(/\D/g, '').slice(-10);

/**
 * Gender SVGs: High-quality SVG icons
 */
export const GENDER_SVGS = {
  Male: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="14" r="5"/>
      <line x1="19" y1="5" x2="13.6" y2="10.4"/>
      <polyline points="15 5 19 5 19 9"/>
    </svg>
  `,
  Female: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="9" r="5"/>
      <line x1="12" y1="14" x2="12" y2="21"/>
      <line x1="8.5" y1="17.5" x2="15.5" y2="17.5"/>
    </svg>
  `,
  Other: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
    </svg>
  `
};

/**
 * Loads patient profile and renders the pre-fixed template
 */
export async function loadPatientProfile({ db, fs, patientId, opNo, containerId }) {
  const { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, limit } = fs;
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!patientId && !opNo) {
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;background:var(--surface);border-radius:16px;border:1px solid var(--border);">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--primary-ul);color:var(--primary);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <h3 style="font-size:1.25rem;font-weight:700;color:var(--text-dark);margin-bottom:.5rem;">No Patient Selected</h3>
        <p style="color:var(--text-med);margin-bottom:1.5rem;">Please select a patient from the records list to view their complete profile.</p>
        <a href="dashboard.html" class="btn-primary" style="display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1.25rem;border-radius:8px;text-decoration:none;font-weight:600;background:var(--primary);color:#fff;">
          Back to Patient Records
        </a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="text-align:center;padding:4rem 2rem;">
      <div class="loading-spinner" style="width:36px;height:36px;margin:0 auto 1rem;"></div>
      <p style="color:var(--text-med);font-weight:500;">Loading patient profile…</p>
    </div>`;

  try {
    // 1. Fetch Target Patient
    let patient = null;
    if (patientId) {
      const docRef = doc(db, 'patients', patientId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        patient = { id: snap.id, ...snap.data() };
      }
    }

    if (!patient && opNo) {
      const q = query(collection(db, 'patients'), where('opNo', '==', Number(opNo) || opNo), limit(1));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        patient = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
      }
    }

    if (!patient) {
      container.innerHTML = `
        <div style="text-align:center;padding:4rem 2rem;background:var(--surface);border-radius:16px;border:1px solid var(--border);">
          <div style="width:52px;height:52px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h3 style="font-size:1.25rem;font-weight:700;color:var(--text-dark);margin-bottom:.5rem;">Patient Not Found</h3>
          <p style="color:var(--text-med);margin-bottom:1.5rem;">The requested patient record could not be found or has been removed.</p>
          <a href="dashboard.html" class="btn-primary" style="display:inline-flex;align-items:center;gap:.5rem;padding:.6rem 1.25rem;border-radius:8px;text-decoration:none;font-weight:600;background:var(--primary);color:#fff;">
            Back to Patient Records
          </a>
        </div>`;
      return;
    }
    const normPhone = normalizePhone(patient.phone);

    // 2. Fetch All Patients to discover visit history
    let allPatientsSnap;
    try {
      allPatientsSnap = await getDocs(collection(db, 'patients'));
    } catch(e) {
      allPatientsSnap = { docs: [] };
    }

    const allPatients = allPatientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Find all matching patient docs (by OP No, phone, or name)
    const matchingDocs = allPatients.filter(p => (
      (patient.opNo && p.opNo === patient.opNo) ||
      (normPhone && normalizePhone(p.phone) === normPhone) ||
      (p.name && patient.name && p.name.trim().toLowerCase() === patient.name.trim().toLowerCase())
    ));

    // Compile all visit entries from matching docs and their internal visits array
    const visitList = [];
    const seenVisitKeys = new Set();

    matchingDocs.forEach(docItem => {
      // 1. If doc has nested visits array
      if (Array.isArray(docItem.visits) && docItem.visits.length > 0) {
        docItem.visits.forEach(v => {
          const vDate = v.date || v.visitDate || '';
          const vTime = v.time || v.visitTime || '';
          const key = `${vDate}_${vTime}_${v.reason || ''}`;
          if (!seenVisitKeys.has(key)) {
            seenVisitKeys.add(key);
            visitList.push({
              visitDate: vDate,
              visitTime: vTime,
              doctor: v.doctor || docItem.doctor,
              consultationType: v.consultationType || docItem.consultationType,
              reason: v.reason || '',
              diagnosis: v.diagnosis || '',
              createdAt: v.timestamp || docItem.createdAt
            });
          }
        });
      }

      // 2. Also ensure document's root visitDate is represented
      const rootDate = docItem.visitDate || '';
      const rootTime = docItem.visitTime || '';
      const rootKey = `${rootDate}_${rootTime}_${docItem.reason || ''}`;
      if (rootDate && !seenVisitKeys.has(rootKey)) {
        seenVisitKeys.add(rootKey);
        visitList.push({
          visitDate: rootDate,
          visitTime: rootTime,
          doctor: docItem.doctor,
          consultationType: docItem.consultationType,
          reason: docItem.reason || '',
          diagnosis: docItem.diagnosis || '',
          createdAt: docItem.createdAt
        });
      }
    });

    // Sort newest visits first
    visitList.sort((a, b) => {
      const dateCmp = (b.visitDate || '').localeCompare(a.visitDate || '');
      if (dateCmp !== 0) return dateCmp;
      return (b.visitTime || '').localeCompare(a.visitTime || '');
    });

    const allVisits = visitList;

    // 3. Fetch Billing records for this patient
    let billsList = [];
    try {
      const billsSnap = await getDocs(collection(db, 'bills'));
      billsList = billsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => (
          b.patientId === patient.id ||
          (patient.opNo && (b.patientOpNo === patient.opNo || b.opNo === patient.opNo || Number(b.patientOpNo) === Number(patient.opNo))) ||
          (normPhone && normalizePhone(b.patientPhone) === normPhone) ||
          (b.patientName && patient.name && b.patientName.trim().toLowerCase() === patient.name.trim().toLowerCase())
        ))
        .sort((a, b) => (b.date || b.billDate || '').localeCompare(a.date || a.billDate || ''));
    // Extract surgeries, implants, and procedures from bills and visits
    const surgeryAndImplants = [];
    billsList.forEach(b => {
      (b.items || []).forEach(it => {
        const desc = (it.desc || '').trim();
        if (!desc) return;
        const lower = desc.toLowerCase();
        // Check if item is a surgery, implant, procedure, xray, dressing or clinical intervention
        const isProcedure = 
          lower.includes('surgeon') ||
          lower.includes('implant') ||
          lower.includes('procedure') ||
          lower.includes('surgery') ||
          lower.includes('operation') ||
          lower.includes('repair') ||
          lower.includes('arthro') ||
          lower.includes('replacement') ||
          lower.includes('fixation') ||
          lower.includes('dressing') ||
          lower.includes('x-ray') ||
          lower.includes('c-arm');

        if (isProcedure && !surgeryAndImplants.some(s => s.desc.toLowerCase() === lower && s.date === (b.date || b.billDate))) {
          surgeryAndImplants.push({
            desc,
            amount: it.amount,
            date: b.date || b.billDate,
            billNumber: b.billNumber || b.billNo
          });
        }
      });
    });

    // Determine Gender Colors and SVGs
    const gender = (patient.gender || 'Male').trim();
    const isFemale = gender.toLowerCase() === 'female';
    const isMale = gender.toLowerCase() === 'male';
    const genderSvg = isFemale ? GENDER_SVGS.Female : (isMale ? GENDER_SVGS.Male : GENDER_SVGS.Other);
    const genderBadgeClass = isFemale ? 'badge-female' : (isMale ? 'badge-male' : 'badge-other');
    const genderAccentColor = isFemale ? '#e11d48' : (isMale ? 'var(--primary)' : '#8b5cf6');
    const avatarBg = isFemale ? 'linear-gradient(135deg, #fb7185, #e11d48)' : (isMale ? 'linear-gradient(135deg, #38bdf8, #0a6ebd)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)');

    const initials = (patient.name || '?')
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const isCustom = window.location.hostname === 'admin.gopalorthocare.com';
    const billUrl = (isCustom ? '/bill' : 'bill.html') + `?patientId=${patient.id}`;
    const returnUrl = isCustom ? '/dashboard' : 'dashboard.html';

    // 4. Render Pre-Fixed Medical Profile Template
    container.innerHTML = `
      <!-- TOP NAVIGATION BAR -->
      <div class="profile-topbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <a href="${returnUrl}" class="btn-back" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .875rem;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--text-dark);text-decoration:none;font-size:.85rem;font-weight:600;transition:all .2s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Patient Records
          </a>
          <span style="color:var(--text-light);font-size:.9rem;">/</span>
          <span style="font-weight:700;color:var(--text-dark);font-size:.95rem;">${esc(patient.name)} (OP ${patient.opNo ?? '—'})</span>
        </div>

        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
          <button onclick="window.openEditProfileModal()" class="btn-outline-action" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .875rem;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--text-dark);font-size:.85rem;font-weight:600;cursor:pointer;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button onclick="window.openDeleteProfileModal()" class="btn-outline-action" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .875rem;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:.85rem;font-weight:600;cursor:pointer;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Delete
          </button>
          <button onclick="window.printProfile()" class="btn-outline-action" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .875rem;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--text-dark);font-size:.85rem;font-weight:600;cursor:pointer;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <a href="${billUrl}" class="btn-primary-action" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border-radius:8px;background:var(--primary);color:#fff;text-decoration:none;font-size:.85rem;font-weight:600;box-shadow:0 2px 8px rgba(10,110,189,.3);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Generate Bill
          </a>
        </div>
      </div>

      <!-- HERO PATIENT PROFILE CARD -->
      <div class="patient-hero-card" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;margin-bottom:1.5rem;box-shadow:0 2px 12px rgba(4,28,48,.04);">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1.25rem;">
          <div style="display:flex;align-items:center;gap:1.25rem;">
            <!-- Large Avatar with Gender icon badge -->
            <div style="position:relative;width:68px;height:68px;border-radius:18px;background:${avatarBg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:700;box-shadow:0 6px 16px rgba(0,0,0,.15);flex-shrink:0;">
              ${initials}
              <div style="position:absolute;bottom:-4px;right:-4px;width:24px;height:24px;border-radius:50%;background:var(--surface);border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;color:${genderAccentColor};box-shadow:0 2px 5px rgba(0,0,0,.1);">
                ${genderSvg}
              </div>
            </div>

            <div>
              <div style="display:flex;align-items:center;gap:.625rem;flex-wrap:wrap;margin-bottom:.25rem;">
                <h1 style="font-family:'DM Sans',sans-serif;font-size:1.45rem;font-weight:700;color:var(--text-dark);margin:0;">
                  ${esc(patient.name)}
                </h1>
                <span class="op-tag" style="font-family:'DM Mono',monospace;font-size:.8rem;font-weight:700;color:var(--primary);background:var(--primary-ul);padding:.2rem .6rem;border-radius:6px;">
                  OP ${patient.opNo ?? '—'}
                </span>
                <span class="badge ${genderBadgeClass}" style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;font-weight:700;padding:.2rem .55rem;border-radius:6px;">
                  ${genderSvg} ${gender}
                </span>
              </div>
              <div style="font-size:.85rem;color:var(--text-med);display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
                <span><strong>Age:</strong> ${patient.age ? patient.age + ' yrs' : 'Not recorded'}</span>
                <span>•</span>
                <span><strong>Blood:</strong> <span style="color:var(--primary);font-weight:700;">${patient.bloodGroup || 'Unknown'}</span></span>
                <span>•</span>
                <span><strong>Phone:</strong> ${patient.phone ? `<a href="tel:${patient.phone}" style="color:var(--primary);text-decoration:none;font-weight:600;">${esc(patient.phone)}</a>` : '—'}</span>
              </div>
            </div>
          </div>

          <!-- Quick KPI Cards -->
          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
            <div style="background:var(--surface-card);border:1px solid var(--border);border-radius:12px;padding:.75rem 1.25rem;text-align:center;min-width:110px;">
              <div style="font-size:1.35rem;font-weight:800;color:var(--primary);font-family:'DM Mono',monospace;">${allVisits.length}</div>
              <div style="font-size:.7rem;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;">Total Visits</div>
            </div>
            <div style="background:var(--surface-card);border:1px solid var(--border);border-radius:12px;padding:.75rem 1.25rem;text-align:center;min-width:140px;">
              <div style="font-size:.9rem;font-weight:700;color:var(--text-dark);font-family:'DM Mono',monospace;">
                ${fmtDate(patient.visitDate)} ${fmtTime(patient.visitTime, patient.createdAt) ? `<span style="font-size:.75rem;color:var(--primary);display:block;font-weight:600;">${fmtTime(patient.visitTime, patient.createdAt)}</span>` : ''}
              </div>
              <div style="font-size:.7rem;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.05em;margin-top:2px;">Last Visit Date & Time</div>
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN 2-COLUMN PROFILE GRID -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:1.5rem;">
        
        <!-- LEFT COLUMN: Personal Info & Consultation Notes -->
        <div style="display:flex;flex-direction:column;gap:1.5rem;">
          
          <!-- PERSONAL INFORMATION CARD -->
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;box-shadow:0 2px 8px rgba(4,28,48,.03);">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);">
              <div style="width:28px;height:28px;border-radius:8px;background:var(--primary-ul);color:var(--primary);display:flex;align-items:center;justify-content:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <h3 style="font-size:1rem;font-weight:700;color:var(--text-dark);margin:0;">Personal & Contact Details</h3>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;font-size:.875rem;">
              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Full Name</div>
                <div style="font-weight:700;color:var(--text-dark);">${esc(patient.name)}</div>
              </div>
              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">OP Number</div>
                <div style="font-family:'DM Mono',monospace;font-weight:700;color:var(--primary);">OP ${patient.opNo ?? '—'}</div>
              </div>
              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Phone Number</div>
                <div style="font-weight:600;color:var(--text-dark);">
                  ${patient.phone ? `<a href="tel:${patient.phone}" style="color:var(--primary);text-decoration:none;">${esc(patient.phone)}</a>` : '—'}
                </div>
              </div>
              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Age & Gender</div>
                <div style="font-weight:600;color:var(--text-dark);display:flex;align-items:center;gap:.35rem;">
                  ${patient.age ? patient.age + ' yrs' : '—'}, <span style="color:${genderAccentColor};font-weight:700;">${gender}</span>
                </div>
              </div>
              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Blood Group</div>
                <div style="font-weight:700;color:var(--primary);">${patient.bloodGroup || 'Not recorded'}</div>
              </div>
              <div style="grid-column:1/-1;">
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Residential Address</div>
                <div style="font-weight:500;color:var(--text-dark);line-height:1.4;">${esc(patient.address) || 'No address on file'}</div>
              </div>
            </div>
          </div>

          <!-- LATEST CONSULTATION DETAILS -->
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;box-shadow:0 2px 8px rgba(4,28,48,.03);">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);">
              <div style="width:28px;height:28px;border-radius:8px;background:rgba(200,151,58,.15);color:var(--gold);display:flex;align-items:center;justify-content:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3 style="font-size:1rem;font-weight:700;color:var(--text-dark);margin:0;">Active Consultation Notes</h3>
            </div>

            <div style="display:flex;flex-direction:column;gap:1.1rem;font-size:.875rem;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                  <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Doctor</div>
                  <div style="font-weight:700;color:var(--text-dark);">${esc(patient.doctor || 'Dr. N. Gopala Krishnan')}</div>
                </div>
                <div>
                  <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.2rem;">Consultation Type</div>
                  <div style="font-weight:600;color:${(patient.consultationType||'').includes('Ortho') ? 'var(--primary)' : 'var(--gold)'};">
                    ${esc(patient.consultationType || 'Orthopedic')}
                  </div>
                </div>
              </div>

              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.35rem;">Visit Date & Time</div>
                <div style="font-weight:600;color:var(--text-dark);font-family:'DM Mono',monospace;display:flex;align-items:center;gap:.5rem;">
                  <span>${fmtDate(patient.visitDate)}</span>
                  ${fmtTime(patient.visitTime, patient.createdAt) ? `<span style="color:var(--primary);background:var(--primary-ul);padding:.15rem .45rem;border-radius:4px;font-size:.8rem;">${fmtTime(patient.visitTime, patient.createdAt)}</span>` : ''}
                </div>
              </div>

              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.35rem;">Reason for Visit / Symptoms</div>
                <div style="background:var(--surface-card);padding:.75rem 1rem;border-radius:10px;border:1px solid var(--border);color:var(--text-dark);line-height:1.45;">
                  ${esc(patient.reason) || 'No specific complaints recorded'}
                </div>
              </div>

              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.35rem;">Diagnosis / Clinical Assessment</div>
                <div style="background:var(--surface-card);padding:.75rem 1rem;border-radius:10px;border:1px solid var(--border);color:var(--text-dark);line-height:1.45;font-weight:600;">
                  ${esc(patient.diagnosis) || (allVisits[0]?.diagnosis ? esc(allVisits[0].diagnosis) : 'No diagnosis recorded')}
                </div>
              </div>

              <div>
                <div style="font-size:.7rem;color:var(--text-light);text-transform:uppercase;font-weight:600;margin-bottom:.35rem;">Surgeries, Implants &amp; Procedures</div>
                <div style="background:var(--surface-card);padding:.75rem 1rem;border-radius:10px;border:1px solid var(--border);">
                  ${surgeryAndImplants.length === 0 ? `
                    <div style="font-size:.825rem;color:var(--text-light);font-weight:500;">No surgeries or implants recorded yet. (Add surgeon fee or implant fee in bill to display here)</div>
                  ` : `
                    <div style="display:flex;flex-direction:column;gap:.5rem;">
                      ${surgeryAndImplants.map(s => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:.35rem 0;border-bottom:1px dashed var(--border);font-size:.825rem;">
                          <div style="display:flex;align-items:center;gap:.5rem;">
                            <span style="width:7px;height:7px;border-radius:50%;background:var(--primary);flex-shrink:0;"></span>
                            <span style="font-weight:700;color:var(--text-dark);">${esc(s.desc)}</span>
                          </div>
                          <div style="display:flex;align-items:center;gap:.6rem;">
                            <span style="font-family:'DM Mono',monospace;font-weight:600;color:var(--primary);">₹${Number(s.amount || 0).toLocaleString('en-IN')}</span>
                            <span style="font-size:.75rem;color:var(--text-light);font-family:'DM Mono',monospace;">${fmtDate(s.date)}</span>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Visit History & Invoices -->
        <div style="display:flex;flex-direction:column;gap:1.5rem;">
          
          <!-- VISIT HISTORY TIMELINE -->
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;box-shadow:0 2px 8px rgba(4,28,48,.03);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:.5rem;">
                <div style="width:28px;height:28px;border-radius:8px;background:rgba(14,165,233,.12);color:#0ea5e9;display:flex;align-items:center;justify-content:center;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h3 style="font-size:1rem;font-weight:700;color:var(--text-dark);margin:0;">Visit History (${allVisits.length})</h3>
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:.875rem;max-height:420px;overflow-y:auto;padding-right:.25rem;">
              ${allVisits.length === 0 ? `
                <div style="text-align:center;padding:2rem;color:var(--text-light);font-size:.85rem;">No previous visits recorded</div>
              ` : allVisits.map((v, idx) => `
                <div style="padding:1rem;background:var(--surface-card);border:1px solid var(--border);border-radius:12px;font-size:.85rem;position:relative;transition:all .2s;" class="visit-card-hover">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
                    <div style="display:flex;align-items:center;gap:.4rem;">
                      <span style="font-family:'DM Mono',monospace;font-weight:700;color:var(--text-dark);font-size:.85rem;">
                        ${fmtDate(v.visitDate)} ${fmtTime(v.visitTime, v.createdAt) ? `<span style="font-weight:600;color:var(--primary);font-size:.75rem;margin-left:.3rem;">· ${fmtTime(v.visitTime, v.createdAt)}</span>` : ''}
                      </span>
                      ${idx === 0 ? `<span style="font-size:.65rem;background:var(--primary);color:#fff;font-weight:700;padding:1px 6px;border-radius:4px;">Latest</span>` : ''}
                    </div>
                    <span style="font-size:.75rem;font-weight:700;color:${(v.consultationType||'').includes('Ortho') ? 'var(--primary)' : 'var(--gold)'};">
                      ${esc(v.consultationType || 'Consultation')}
                    </span>
                  </div>
                  <div style="font-size:.8rem;color:var(--text-med);margin-bottom:.25rem;">
                    <strong style="color:var(--text-dark);">Doctor:</strong> ${esc(v.doctor || '—')}
                  </div>
                  ${v.reason ? `
                    <div style="font-size:.8rem;color:var(--text-med);margin-bottom:.25rem;">
                      <strong style="color:var(--text-dark);">Reason:</strong> ${esc(v.reason)}
                    </div>
                  ` : ''}
                  ${v.diagnosis ? `
                    <div style="font-size:.8rem;color:var(--text-dark);background:var(--surface);padding:.4rem .6rem;border-radius:6px;border:1px solid var(--border);margin-top:.4rem;">
                      <strong>Diagnosis:</strong> ${esc(v.diagnosis)}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- BILLING & PAYMENT HISTORY -->
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;box-shadow:0 2px 8px rgba(4,28,48,.03);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;padding-bottom:.75rem;border-bottom:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:.5rem;">
                <div style="width:28px;height:28px;border-radius:8px;background:rgba(34,197,94,.12);color:#16a34a;display:flex;align-items:center;justify-content:center;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                </div>
                <h3 style="font-size:1rem;font-weight:700;color:var(--text-dark);margin:0;">Billing History (${billsList.length})</h3>
              </div>
              <a href="${billUrl}" style="font-size:.8rem;font-weight:600;color:var(--primary);text-decoration:none;">+ New Bill</a>
            </div>

            <div style="display:flex;flex-direction:column;gap:.75rem;max-height:300px;overflow-y:auto;">
              ${billsList.length === 0 ? `
                <div style="text-align:center;padding:1.5rem;color:var(--text-light);font-size:.85rem;">No bills generated yet for this patient.</div>
              ` : billsList.map(b => {
                const isPaid = b.paid === true || (b.paymentStatus || '').toLowerCase() === 'paid';
                const billNum = b.billNumber || b.billNo || 'Bill #' + b.id.slice(0,6);
                const billDt = b.date || b.billDate || b.createdAt;
                const amt = Number(b.total || b.totalAmount || b.grandTotal || 0);
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--surface-card);border:1px solid var(--border);border-radius:10px;font-size:.85rem;">
                    <div>
                      <div style="font-family:'DM Mono',monospace;font-weight:700;color:var(--text-dark);">${esc(billNum)}</div>
                      <div style="font-size:.75rem;color:var(--text-light);">${fmtDate(billDt)}</div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-weight:700;color:var(--text-dark);font-family:'DM Mono',monospace;">₹${amt.toLocaleString('en-IN')}</div>
                      <span style="font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:2px;background:${isPaid ? 'rgba(34,197,94,.15);color:#16a34a;' : 'rgba(239,68,68,.15);color:#dc2626;'}">
                        ${isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- ── EDIT PATIENT MODAL ── -->
      <div id="modal-edit-profile" class="modal-overlay" style="display:none;">
        <div class="modal-card" style="max-width:560px;width:95%;">
          <div style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--surface-card);">
            <h3 style="font-size:1.1rem;font-weight:700;color:var(--text-dark);margin:0;">Edit Patient Details</h3>
            <button onclick="window.closeEditProfileModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-light);">✕</button>
          </div>
          <form id="edit-patient-form" onsubmit="return false;" style="padding:1.5rem;max-height:75vh;overflow-y:auto;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
              <div style="grid-column:1/-1;">
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Patient Name *</label>
                <input type="text" id="edit-p-name" value="${esc(patient.name)}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;" required>
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Phone Number *</label>
                <input type="tel" id="edit-p-phone" maxlength="10" pattern="[0-9]{10}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,10)" value="${esc(patient.phone || '')}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;" required>
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Age</label>
                <input type="number" id="edit-p-age" value="${patient.age || ''}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Gender</label>
                <select id="edit-p-gender" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
                  <option value="Male" ${patient.gender==='Male'?'selected':''}>Male</option>
                  <option value="Female" ${patient.gender==='Female'?'selected':''}>Female</option>
                  <option value="Other" ${patient.gender==='Other'?'selected':''}>Other</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Blood Group</label>
                <select id="edit-p-blood" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
                  <option value="">Unknown</option>
                  <option ${patient.bloodGroup==='A+'?'selected':''}>A+</option>
                  <option ${patient.bloodGroup==='A-'?'selected':''}>A-</option>
                  <option ${patient.bloodGroup==='B+'?'selected':''}>B+</option>
                  <option ${patient.bloodGroup==='B-'?'selected':''}>B-</option>
                  <option ${patient.bloodGroup==='AB+'?'selected':''}>AB+</option>
                  <option ${patient.bloodGroup==='AB-'?'selected':''}>AB-</option>
                  <option ${patient.bloodGroup==='O+'?'selected':''}>O+</option>
                  <option ${patient.bloodGroup==='O-'?'selected':''}>O-</option>
                </select>
              </div>
              <div style="grid-column:1/-1;">
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Residential Address</label>
                <input type="text" id="edit-p-address" value="${esc(patient.address || '')}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Doctor</label>
                <select id="edit-p-doctor" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
                  <option ${patient.doctor==='Dr. N. Gopala Krishnan'?'selected':''}>Dr. N. Gopala Krishnan</option>
                  <option ${patient.doctor==='Dr. R. Shiny'?'selected':''}>Dr. R. Shiny</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Consultation Type</label>
                <select id="edit-p-type" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
                  <option value="Orthopedic" ${(patient.consultationType||'').includes('Ortho')?'selected':''}>Orthopaedic</option>
                  <option value="General" ${(patient.consultationType||'').includes('General')?'selected':''}>General / Diabetology</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Visit Date</label>
                <input type="date" id="edit-p-date" value="${patient.visitDate || ''}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Visit Time</label>
                <input type="text" id="edit-p-time" value="${esc(patient.visitTime || '')}" placeholder="e.g. 07:30 PM" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
              </div>
              <div style="grid-column:1/-1;">
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Chief Complaint / Reason</label>
                <input type="text" id="edit-p-reason" value="${esc(patient.reason || '')}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
              </div>
              <div style="grid-column:1/-1;">
                <label style="display:block;font-size:.75rem;font-weight:700;color:var(--text-med);margin-bottom:.35rem;">Diagnosis / Assessment</label>
                <input type="text" id="edit-p-diagnosis" value="${esc(patient.diagnosis || '')}" style="width:100%;height:38px;padding:0 .75rem;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:.875rem;background:var(--surface);color:var(--text-dark);outline:none;">
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:.75rem;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);">
              <button type="button" onclick="window.closeEditProfileModal()" style="padding:.5rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-weight:600;font-size:.85rem;cursor:pointer;">Cancel</button>
              <button type="button" id="btn-save-profile-edit" onclick="window.saveProfileEdit('${patient.id}')" style="padding:.5rem 1.25rem;border-radius:8px;border:none;background:var(--primary);color:#fff;font-weight:600;font-size:.85rem;cursor:pointer;box-shadow:0 2px 8px rgba(10,110,189,.3);">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ── DELETE WARNING MODAL ── -->
      <div id="modal-delete-profile" class="modal-overlay" style="display:none;">
        <div class="modal-card" style="max-width:440px;width:90%;">
          <div style="padding:1.5rem;">
            <div style="width:50px;height:50px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;margin-bottom:1rem;">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style="font-size:1.15rem;font-weight:700;color:var(--text-dark);margin-bottom:.4rem;">Delete Patient Record?</h3>
            <p style="font-size:.875rem;color:var(--text-med);line-height:1.45;margin-bottom:1.5rem;">
              Are you sure you want to delete <strong>${esc(patient.name)}</strong> (OP ${patient.opNo ?? '—'})? This will permanently delete this patient record and cannot be undone.
            </p>
            <div style="display:flex;justify-content:flex-end;gap:.75rem;">
              <button onclick="window.closeDeleteProfileModal()" style="padding:.5rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-weight:600;font-size:.85rem;cursor:pointer;">Cancel</button>
              <button id="btn-confirm-delete-patient" onclick="window.executeDeletePatient('${patient.id}')" style="padding:.5rem 1.25rem;border-radius:8px;border:none;background:#dc2626;color:#fff;font-weight:600;font-size:.85rem;cursor:pointer;box-shadow:0 2px 8px rgba(220,38,38,.35);">Yes, Delete Patient</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Modal Control Functions
    window.openEditProfileModal = () => {
      const m = document.getElementById('modal-edit-profile');
      if (m) {
        m.classList.add('show');
        m.style.display = 'flex';
      }
    };
    window.closeEditProfileModal = () => {
      const m = document.getElementById('modal-edit-profile');
      if (m) {
        m.classList.remove('show');
        m.style.display = 'none';
      }
    };

    window.openDeleteProfileModal = () => {
      const m = document.getElementById('modal-delete-profile');
      if (m) {
        m.classList.add('show');
        m.style.display = 'flex';
      }
    };
    window.closeDeleteProfileModal = () => {
      const m = document.getElementById('modal-delete-profile');
      if (m) {
        m.classList.remove('show');
        m.style.display = 'none';
      }
    };

    window.saveProfileEdit = async (docId) => {
      const btn = document.getElementById('btn-save-profile-edit');
      const name = document.getElementById('edit-p-name').value.trim();
      const phone = document.getElementById('edit-p-phone').value.trim();
      const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
      if (!name || !cleanPhone || cleanPhone.length !== 10) {
        alert('Please enter patient name and a valid 10-digit phone number.');
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      try {
        const updateData = {
          name,
          nameLower: name.toLowerCase(),
          phone: cleanPhone,
          age: Number(document.getElementById('edit-p-age').value) || null,
          gender: document.getElementById('edit-p-gender').value,
          bloodGroup: document.getElementById('edit-p-blood').value,
          address: document.getElementById('edit-p-address').value.trim(),
          doctor: document.getElementById('edit-p-doctor').value,
          consultationType: document.getElementById('edit-p-type').value,
          visitDate: document.getElementById('edit-p-date').value,
          visitTime: document.getElementById('edit-p-time').value.trim(),
          reason: document.getElementById('edit-p-reason').value.trim(),
          diagnosis: document.getElementById('edit-p-diagnosis').value.trim()
        };

        if (updateDoc) {
          await updateDoc(doc(db, 'patients', docId), updateData);
        }

        window.closeEditProfileModal();
        // Reload profile view
        await loadPatientProfile({ db, fs, patientId: docId, containerId });
      } catch(err) {
        alert('Failed to save changes: ' + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
      }
    };

    window.executeDeletePatient = async (docId) => {
      const btn = document.getElementById('btn-confirm-delete-patient');
      if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
      try {
        if (deleteDoc) {
          await deleteDoc(doc(db, 'patients', docId));
        }
        window.location.href = returnUrl;
      } catch(err) {
        alert('Failed to delete patient: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Yes, Delete Patient'; }
      }
    };

  } catch(err) {
    console.error('Error loading patient profile:', err);
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;background:var(--surface);border-radius:16px;border:1px solid var(--border);">
        <p style="color:var(--error);font-weight:600;">Failed to load patient profile: ${esc(err.message)}</p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top:1rem;padding:.5rem 1rem;border-radius:8px;background:var(--primary);color:#fff;">Retry</button>
      </div>`;
  }
}

/**
 * Trigger print dialog
 */
window.printProfile = () => {
  window.print();
};
