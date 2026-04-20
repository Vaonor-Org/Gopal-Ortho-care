/**
 * auth.js
 * Login page: sign-in with email + password via Firebase Auth,
 * role lookup from Realtime DB (/users/{uid}/role), and redirect.
 *
 * Requires: firebase-init.js loaded first (provides `auth` and `db` globals).
 */

// UID → role map for pre-defined admin accounts
// Add more admins here if needed
const ADMIN_UIDS = {
  'iWsZCqgX5fgP0Uguf6vQ0tcS9nJ3': 'admin'
};

/* ── If already signed in, skip the login page ── */
auth.onAuthStateChanged(async user => {
  if (!user) return; // not logged in — stay on login page
  const role = await resolveRole(user);
  window.location.replace(role === 'admin' ? 'dashboard.html' : 'desk.html');
});

/* ── Resolve role: check hardcoded map first, then DB ── */
async function resolveRole(user) {
  // 1. Check hardcoded admin UID map
  if (ADMIN_UIDS[user.uid]) {
    // Ensure it's persisted in DB as well
    await db.ref('/users/' + user.uid).update({
      role: ADMIN_UIDS[user.uid],
      email: user.email,
      updatedAt: Date.now()
    });
    return ADMIN_UIDS[user.uid];
  }
  // 2. Fall back to DB role
  try {
    const snap = await db.ref('/users/' + user.uid + '/role').once('value');
    return snap.val() || 'nurse';
  } catch (e) {
    return 'nurse';
  }
}

/* ── Helpers ── */
function togglePwd() {
  const inp = document.getElementById('password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
  document.getElementById('login-error').classList.add('show');
}

function setLoading(v) {
  document.getElementById('login-btn').disabled = v;
  document.getElementById('spinner').style.display     = v ? 'block'  : 'none';
  document.getElementById('login-text').style.display  = v ? 'none'   : 'inline';
  document.getElementById('login-arrow').style.display = v ? 'none'   : 'inline';
}

/* ── Login ── */
async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const pwd   = document.getElementById('password').value;
  document.getElementById('login-error').classList.remove('show');

  if (!email) { showError('Please enter your email address.'); return; }
  if (!pwd)   { showError('Please enter your password.'); return; }

  setLoading(true);
  try {
    const cred = await auth.signInWithEmailAndPassword(email, pwd);
    const role = await resolveRole(cred.user);
    window.location.replace(role === 'admin' ? 'dashboard.html' : 'desk.html');

  } catch (err) {
    setLoading(false);
    const msgs = {
      'auth/user-not-found':        'No account found with this email.',
      'auth/wrong-password':        'Incorrect password. Please try again.',
      'auth/invalid-email':         'Invalid email address format.',
      'auth/too-many-requests':     'Too many failed attempts. Try again later.',
      'auth/network-request-failed':'Network error. Check your connection.',
      'auth/invalid-credential':    'Invalid email or password.',
    };
    showError(msgs[err.code] || err.message || 'Login failed. Please try again.');
  }
}

/* ── Enter key submits ── */
document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
