// ── Instant Live Patient Search & Autocomplete ──
// High-performance client-side + server-side hybrid search with instant live suggestions

let searchDebounceTimer = null;
let activeSuggestionIndex = -1;
let currentSuggestions = [];
let cachedPatients = [];
let lastCacheTime = 0;

/**
 * Escapes HTML characters
 */
const esc = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Highlights matching portion of string
 */
const highlightMatch = (text, query) => {
  if (!text || !query) return esc(text || '');
  const str = String(text);
  const q = String(query).trim();
  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return esc(str);
  const before = esc(str.slice(0, idx));
  const match = esc(str.slice(idx, idx + q.length));
  const after = esc(str.slice(idx + q.length));
  return `${before}<span style="background:rgba(200,151,58,0.3);color:var(--primary);font-weight:700;border-radius:2px;padding:0 2px;">${match}</span>${after}`;
};

/**
 * Pre-fetches or refreshes the local patient cache
 */
export async function refreshPatientCache(db, fs) {
  const { collection, getDocs, orderBy, query } = fs;
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'patients'), orderBy('opNo', 'desc')));
    } catch(e) {
      snap = await getDocs(collection(db, 'patients'));
    }
    cachedPatients = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p && p.name && p.name.trim().length > 0);
    lastCacheTime = Date.now();
    return cachedPatients;
  } catch (err) {
    console.warn('Cache refresh failed:', err);
    return cachedPatients;
  }
}

/**
 * Searches in-memory cache instantly for matching patients
 */
export function searchLocalPatients(queryStr, maxResults = 8) {
  const q = String(queryStr || '').trim().toLowerCase();
  if (!q) return cachedPatients;

  const digitsOnly = q.replace(/\D/g, '');

  return cachedPatients.filter(p => {
    const name = String(p.name || '').toLowerCase();
    const phone = String(p.phone || '').replace(/\D/g, '');
    const opNo = String(p.opNo ?? '');
    const diagnosis = String(p.diagnosis || '').toLowerCase();
    const doctor = String(p.doctor || '').toLowerCase();

    // Match name anywhere (first name, last name, substring)
    if (name.includes(q)) return true;

    // Match OP number
    if (opNo === q || (digitsOnly && opNo.startsWith(digitsOnly))) return true;

    // Match phone number
    if (digitsOnly && phone.includes(digitsOnly)) return true;

    // Match doctor or diagnosis
    if (doctor.includes(q) || diagnosis.includes(q)) return true;

    return false;
  }).slice(0, maxResults);
}

/**
 * Executes patient search with instant local results and fallback
 */
export async function executePatientSearch(db, fs, searchQ, maxResults = 8) {
  const q = String(searchQ || '').trim();
  if (!q) return [];

  // If cache is empty or older than 2 minutes, refresh it
  if (!cachedPatients.length || Date.now() - lastCacheTime > 120000) {
    await refreshPatientCache(db, fs);
  }

  const localResults = searchLocalPatients(q, maxResults);
  if (localResults.length > 0) {
    return localResults;
  }

  // Fallback direct server query
  try {
    const { collection, query, where, getDocs, limit } = fs;
    const isNum = /^\d+$/.test(q);
    let snap;
    if (isNum) {
      snap = await getDocs(query(collection(db, 'patients'), where('opNo', '==', Number(q)), limit(maxResults)));
    } else {
      const lower = q.toLowerCase();
      const PREFIX_END = String.fromCharCode(0xf8ff);
      snap = await getDocs(query(collection(db, 'patients'), where('nameLower', '>=', lower), where('nameLower', '<=', lower + PREFIX_END), limit(maxResults)));
    }
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
}

/**
 * Initializes instant search listeners on the search input
 */
export function setupInstantPatientSearch({
  searchInput,
  dropdownContainer,
  db,
  fs,
  onSelectPatient,
  onTableFilter
}) {
  if (!searchInput || !dropdownContainer) return;

  // Preload cache immediately in background
  refreshPatientCache(db, fs);

  // Render dropdown results
  const renderDropdown = (items, q) => {
    currentSuggestions = items;
    activeSuggestionIndex = -1;

    if (!items.length || !q.trim()) {
      dropdownContainer.style.display = 'none';
      dropdownContainer.innerHTML = '';
      return;
    }

    const html = `
      <div style="padding:.5rem .75rem;font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-light);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface-card);">
        <span>Matching Patients (${items.length})</span>
        <span style="font-size:.6rem;font-weight:500;text-transform:none;color:var(--text-light);">&uarr;&darr; navigate &bull; Enter to view</span>
      </div>
      <div class="search-suggestions-list" style="max-height:340px;overflow-y:auto;">
        ${items.map((p, idx) => `
          <div class="search-suggestion-item" data-index="${idx}" data-id="${p.id}" style="padding:.7rem .875rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(214,230,245,.4);transition:background .15s;gap:.75rem;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:.5rem;">
                <span style="font-family:'DM Mono',monospace;font-size:.7rem;font-weight:700;color:var(--primary);background:var(--primary-ul);padding:.15rem .45rem;border-radius:4px;">OP ${p.opNo ?? '—'}</span>
                <span style="font-weight:600;font-size:.875rem;color:var(--text-dark);">${highlightMatch(p.name, q)}</span>
              </div>
              <div style="font-size:.75rem;color:var(--text-light);margin-top:.25rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                <span>${p.age ? p.age + ' yrs' : ''} ${p.gender ? '&bull; ' + p.gender : ''}</span>
                ${p.phone ? `&bull; <span>Tel: ${highlightMatch(p.phone, q)}</span>` : ''}
                ${p.doctor ? `&bull; <span style="color:var(--text-med);">${esc(p.doctor)}</span>` : ''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <span style="font-size:.7rem;font-weight:600;color:${(p.consultationType||'').includes('Ortho')?'var(--primary)':'var(--gold)'};display:block;">${esc(p.consultationType || 'General')}</span>
              <span style="font-size:.65rem;color:var(--text-light);font-family:monospace;">${p.visitDate || ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    dropdownContainer.innerHTML = html;
    dropdownContainer.style.display = 'block';

    // Add click listeners to items
    dropdownContainer.querySelectorAll('.search-suggestion-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        const p = currentSuggestions.find(x => x.id === id) || cachedPatients.find(x => x.id === id);
        if (p && onSelectPatient) {
          onSelectPatient(p);
        }
        dropdownContainer.style.display = 'none';
      });

      el.addEventListener('mouseenter', () => {
        const idx = Number(el.getAttribute('data-index'));
        highlightActiveItem(idx);
      });
    });
  };

  const highlightActiveItem = (index) => {
    activeSuggestionIndex = index;
    const items = dropdownContainer.querySelectorAll('.search-suggestion-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.style.background = 'var(--primary-ul)';
      } else {
        item.style.background = 'transparent';
      }
    });
  };

  // Instant typing input handler (0ms local search + fast debounce table sync)
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;

    if (!val || !val.trim()) {
      dropdownContainer.style.display = 'none';
      dropdownContainer.innerHTML = '';
      if (onTableFilter) onTableFilter('');
      return;
    }

    // Instant local suggestion render (0 delay)
    const instantMatches = searchLocalPatients(val, 8);
    renderDropdown(instantMatches, val);

    // Filter table in sync
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      if (onTableFilter) onTableFilter(val);
    }, 60);
  });

  // Focus event: if input has value, show suggestions again
  searchInput.addEventListener('focus', () => {
    const val = searchInput.value;
    if (val && val.trim()) {
      const instantMatches = searchLocalPatients(val, 8);
      renderDropdown(instantMatches, val);
    }
  });

  // Keyboard navigation for suggestions
  searchInput.addEventListener('keydown', (e) => {
    if (dropdownContainer.style.display !== 'block' || !currentSuggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = activeSuggestionIndex + 1 >= currentSuggestions.length ? 0 : activeSuggestionIndex + 1;
      highlightActiveItem(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = activeSuggestionIndex - 1 < 0 ? currentSuggestions.length - 1 : activeSuggestionIndex - 1;
      highlightActiveItem(prev);
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestions.length) {
        e.preventDefault();
        const p = currentSuggestions[activeSuggestionIndex];
        if (p && onSelectPatient) {
          onSelectPatient(p);
        }
        dropdownContainer.style.display = 'none';
      }
    } else if (e.key === 'Escape') {
      dropdownContainer.style.display = 'none';
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdownContainer.contains(e.target) && e.target !== searchInput) {
      dropdownContainer.style.display = 'none';
    }
  });
}
