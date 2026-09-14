// ── Overview Statistics Aggregator ──
// Standalone ES module for querying and processing hospital operational metrics

/**
 * Returns the current date in IST formatted as YYYY-MM-DD
 */
export const getTodayIST = () => {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
};

/**
 * Format date string into human readable Indian format
 */
export const formatDisplayDate = (dStr) => {
  if (!dStr) return '—';
  const d = new Date(dStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Normalizes start and end timestamps for a given IST date string (YYYY-MM-DD)
 */
export const getDateTimestampRange = (dateStr) => {
  // IST is UTC+5:30. 00:00 IST = previous day 18:30 UTC
  const [y, m, d] = dateStr.split('-').map(Number);
  const startUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 5.5 * 3600000);
  const endUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 5.5 * 3600000);
  return { startUTC, endUTC };
};

/**
 * Main function to fetch and aggregate overview statistics for a given date.
 * @param {object} db - Firestore instance
 * @param {object} fs - Firestore SDK methods
 * @param {string} targetDate - Target date in YYYY-MM-DD format (defaults to today)
 */
export async function fetchOverviewMetrics(db, fs, targetDate = getTodayIST()) {
  const { collection, query, where, getDocs, orderBy, limit } = fs;

  // 1. Fetch Patients for the target date
  let patientsList = [];
  try {
    const patientsQ = query(
      collection(db, 'patients'),
      where('visitDate', '==', targetDate)
    );
    const snap = await getDocs(patientsQ);
    patientsList = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p && p.name && p.name.trim().length > 0);
  } catch (err) {
    console.warn('Patients fetch for overview failed:', err);
  }

  // 2. Fetch Live Rooms
  let roomsList = [];
  try {
    const roomsSnap = await getDocs(collection(db, 'rooms'));
    roomsList = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Rooms fetch for overview failed:', err);
  }

  // 3. Fetch Room Logs for the target date (check-ins on this date)
  let todayRoomLogs = [];
  try {
    const { startUTC, endUTC } = getDateTimestampRange(targetDate);
    const logsSnap = await getDocs(query(collection(db, 'roomLogs'), orderBy('createdAt', 'desc'), limit(100)));
    todayRoomLogs = logsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(log => {
        if (!log.checkInTime && !log.createdAt) return false;
        const ts = log.checkInTime || log.createdAt;
        const dateObj = ts.toDate ? ts.toDate() : new Date(ts);
        return dateObj >= startUTC && dateObj <= endUTC;
      });
  } catch (err) {
    console.warn('Room logs fetch for overview failed:', err);
  }

  // 4. Fetch Bills for the target date
  let billsList = [];
  try {
    const billsQ = query(
      collection(db, 'bills'),
      where('billDate', '==', targetDate)
    );
    const snap = await getDocs(billsQ);
    billsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('Bills fetch for overview failed:', err);
  }

  // ── Aggregations ──

  // Patient counts & breakdowns
  const totalPatients = patientsList.length;
  let orthoCount = 0;
  let generalCount = 0;
  let docGopalCount = 0;
  let docShinyCount = 0;
  let otherDocCount = 0;
  let maleCount = 0;
  let femaleCount = 0;
  let otherGenderCount = 0;

  const ageGroups = {
    child: 0,   // 0-12
    teen: 0,    // 13-19
    adult: 0,   // 20-59
    senior: 0   // 60+
  };

  // Hourly patient traffic (8 AM to 9 PM, 14 hours)
  const hourlySlots = {
    '08:00': 0, '09:00': 0, '10:00': 0, '11:00': 0, '12:00': 0, '13:00': 0,
    '14:00': 0, '15:00': 0, '16:00': 0, '17:00': 0, '18:00': 0, '19:00': 0, '20:00': 0, '21:00': 0
  };

  patientsList.forEach(p => {
    // Consultation type
    const cType = (p.consultationType || '').toLowerCase();
    if (cType.includes('ortho')) orthoCount++;
    else generalCount++;

    // Doctor
    const doc = p.doctor || '';
    if (doc.includes('Gopala') || doc.includes('Gopal')) docGopalCount++;
    else if (doc.includes('Shiny')) docShinyCount++;
    else otherDocCount++;

    // Gender
    const g = (p.gender || '').toLowerCase();
    if (g === 'male') maleCount++;
    else if (g === 'female') femaleCount++;
    else otherGenderCount++;

    // Age
    const age = Number(p.age);
    if (!isNaN(age)) {
      if (age <= 12) ageGroups.child++;
      else if (age <= 19) ageGroups.teen++;
      else if (age <= 59) ageGroups.adult++;
      else ageGroups.senior++;
    }

    // Hourly distribution from createdAt timestamp if available
    if (p.createdAt) {
      try {
        const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        // Convert to IST hour
        const istHour = new Date(d.getTime() + 5.5 * 3600000).getUTCHours();
        const slotKey = `${String(istHour).padStart(2, '0')}:00`;
        if (hourlySlots[slotKey] !== undefined) {
          hourlySlots[slotKey]++;
        }
      } catch (e) {}
    }
  });

  // Rooms breakdown
  const totalRooms = roomsList.length;
  const occupiedRooms = roomsList.filter(r => r.occupied);
  const occupiedCount = occupiedRooms.length;
  const availableCount = totalRooms - occupiedCount;
  const roomsBookedTodayCount = todayRoomLogs.length;

  // Financial summary from bills
  let totalBilledAmount = 0;
  let totalPaidAmount = 0;
  billsList.forEach(b => {
    totalBilledAmount += Number(b.totalAmount || b.grandTotal || 0);
    totalPaidAmount += Number(b.paidAmount || b.totalAmount || 0);
  });

  // 5. Fetch 7-Day Trend for historical context
  const trend7Days = await fetch7DayTrend(db, fs, targetDate);

  return {
    targetDate,
    patients: {
      total: totalPatients,
      ortho: orthoCount,
      general: generalCount,
      doctorGopal: docGopalCount,
      doctorShiny: docShinyCount,
      doctorOther: otherDocCount,
      male: maleCount,
      female: femaleCount,
      otherGender: otherGenderCount,
      ageGroups,
      hourlySlots,
      list: patientsList
    },
    rooms: {
      total: totalRooms,
      occupied: occupiedCount,
      available: availableCount,
      bookedToday: roomsBookedTodayCount,
      occupiedList: occupiedRooms,
      todayLogs: todayRoomLogs
    },
    billing: {
      totalBills: billsList.length,
      totalBilled: totalBilledAmount,
      totalPaid: totalPaidAmount
    },
    trend7Days
  };
}

/**
 * Computes 7-day trend up to the target date
 */
async function fetch7DayTrend(db, fs, targetDate) {
  const { collection, query, where, getDocs } = fs;
  const targetObj = new Date(targetDate + 'T00:00:00');
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(targetObj.getTime() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
    days.push({ dateStr, dayLabel, patients: 0, roomsBooked: 0 });
  }

  // Bounded parallel queries for the 7 dates
  try {
    await Promise.all(
      days.map(async day => {
        try {
          const pSnap = await getDocs(
            query(collection(db, 'patients'), where('visitDate', '==', day.dateStr))
          );
          day.patients = pSnap.docs.filter(d => {
            const data = d.data();
            return data && data.name && data.name.trim().length > 0;
          }).length;
        } catch (e) {
          day.patients = 0;
        }
      })
    );
  } catch (e) {
    console.warn('7-day trend fetch warning:', e);
  }

  return days;
}
