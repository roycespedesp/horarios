const STAFF = [
  "Mayra",
  "Pamela",
  "Ximena",
  "Mariel",
  "Gabriela",
  "Maite",
  "Leady",
  "Miguel",
];

/** Personas que no pueden encadenar dos noches. */
const NO_CONSECUTIVE_NIGHTS = new Set(["Mariel"]);

/** Días libres leídos de las celdas resaltadas del cuaderno. */
const DEFAULT_DAYS_OFF = {
  Ximena: [1],
  Mayra: [5, 10, 18],
  Leady: [5],
  Maite: [7],
  Mariel: [10, 11, 19, 24],
  Gabriela: [11, 12, 19, 30, 31],
};

const HOLIDAY = 8;

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function octoberDays(year = 2026) {
  const days = [];
  for (let date = 1; date <= 31; date++) {
    const dt = new Date(year, 9, date);
    days.push({
      date,
      weekday: WEEKDAYS[dt.getDay()],
      dow: dt.getDay(),
      weekend: dt.getDay() === 0 || dt.getDay() === 6,
      holiday: date === HOLIDAY,
    });
  }
  return days;
}

/** Semanas de lunes a domingo, recortadas a octubre. */
function octoberWeeks(year = 2026) {
  const days = octoberDays(year).map((d) => d.date);
  const weeks = [];
  let current = [];
  for (const date of days) {
    const dow = new Date(year, 9, date).getDay();
    if (dow === 1 && current.length) {
      weeks.push(current);
      current = [];
    }
    current.push(date);
  }
  if (current.length) weeks.push(current);
  return weeks;
}

function quotaForWeek(dates) {
  if (dates.length <= 4) return { day: 1, night: 1 };
  return { day: 2, night: 2 };
}

function combinations(items, k) {
  const out = [];
  const n = items.length;
  if (k < 0 || k > n) return out;
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k === 0) return [[]];
  while (true) {
    out.push(idx.map((i) => items[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

function patternKey(pat) {
  return `${pat.D.join(".")}|${pat.N.join(".")}`;
}

function generatePatterns(days, offSet, locks, quotaD, quotaN, banDay, options = {}) {
  const banNight = options.banNight || new Set();
  const splitNights = Boolean(options.splitNights);
  const lockedD = days.filter((d) => locks[d] === "D");
  const lockedN = days.filter((d) => locks[d] === "N");
  if (lockedD.length > quotaD || lockedN.length > quotaN) return [];
  for (const d of lockedD) {
    if (offSet.has(d) || banDay.has(d)) return [];
  }
  for (const d of lockedN) {
    if (offSet.has(d) || banNight.has(d)) return [];
  }
  const used = new Set([...lockedD, ...lockedN]);
  const free = days.filter((d) => !offSet.has(d) && !used.has(d));
  const needD = quotaD - lockedD.length;
  const needN = quotaN - lockedN.length;
  const out = [];
  const seen = new Set();
  for (const dComb of combinations(free, needD)) {
    const rest = free.filter((d) => !dComb.includes(d));
    for (const nComb of combinations(rest, needN)) {
      const D = [...lockedD, ...dComb].sort((a, b) => a - b);
      const N = [...lockedN, ...nComb].sort((a, b) => a - b);
      if (D.some((d) => banDay.has(d))) continue;
      if (N.some((n) => banNight.has(n))) continue;
      const dset = new Set(D);
      const nset = new Set(N);
      if (N.some((n) => dset.has(n + 1))) continue;
      if (splitNights && N.some((n) => nset.has(n + 1))) continue;
      const pat = { D, N };
      const key = patternKey(pat);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pat);
    }
  }
  return out;
}

function shuffle(list, rnd) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Arma una semana.
 * off: { persona: number[] }
 * locks: { persona: { [dia]: "D"|"N" } }
 * carryNight: { persona: boolean } noche el día anterior al inicio
 */
function solveWeek(days, off, locks, carryNight, quota, seed = 1) {
  const rnd = mulberry32(seed);
  const maxPerShift = 3;
  const people = STAFF.slice();
  const patterns = {};
  for (const person of people) {
    const offSet = new Set(off[person] || []);
    const personLocks = (locks && locks[person]) || {};
    const ban = new Set();
    const banNight = new Set();
    if (carryNight && carryNight[person]) ban.add(days[0]);
    if (NO_CONSECUTIVE_NIGHTS.has(person) && carryNight && carryNight[person]) {
      banNight.add(days[0]);
    }
    patterns[person] = generatePatterns(
      days,
      offSet,
      personLocks,
      quota.day,
      quota.night,
      ban,
      { banNight, splitNights: NO_CONSECUTIVE_NIGHTS.has(person) }
    );
    if (!patterns[person].length) {
      return {
        ok: false,
        reason: `${person} no tiene una combinación válida en esta semana.`,
      };
    }
  }

  people.sort((a, b) => patterns[a].length - patterns[b].length);

  function search(orderSeed) {
    const local = mulberry32(orderSeed);
    const countD = Object.fromEntries(days.map((d) => [d, 0]));
    const countN = Object.fromEntries(days.map((d) => [d, 0]));
    const chosen = {};
    let nodes = 0;
    const MAX_NODES = 250000;

    function score(pat) {
      let s = local() * 0.15;
      for (const d of pat.D) {
        const c = countD[d];
        if (c < 2) s += 5 - c;
        else if (c >= maxPerShift) s -= 8;
        else s -= 0.4;
      }
      for (const n of pat.N) {
        const c = countN[n];
        if (c < 2) s += 5 - c;
        else if (c >= maxPerShift) s -= 8;
        else s -= 0.4;
      }
      return s;
    }

    function feasible(pat) {
      for (const d of pat.D) if (countD[d] + 1 > maxPerShift) return false;
      for (const n of pat.N) if (countN[n] + 1 > maxPerShift) return false;
      return true;
    }

    function apply(pat, sign) {
      for (const d of pat.D) countD[d] += sign;
      for (const n of pat.N) countN[n] += sign;
    }

    function stillPossible(idx) {
      let needD = 0;
      let needN = 0;
      for (const d of days) {
        needD += Math.max(0, 2 - countD[d]);
        needN += Math.max(0, 2 - countN[d]);
      }
      const left = people.length - idx;
      if (needD > left * quota.day) return false;
      if (needN > left * quota.night) return false;
      for (const d of days) {
        if (countD[d] > maxPerShift || countN[d] > maxPerShift) return false;
      }
      return true;
    }

    function bt(idx) {
      if (nodes++ > MAX_NODES) return false;
      if (idx === people.length) {
        return days.every((d) => countD[d] >= 2 && countN[d] >= 2);
      }
      if (!stillPossible(idx)) return false;
      const person = people[idx];
      const ranked = patterns[person]
        .map((pat) => ({ pat, s: score(pat) }))
        .sort((a, b) => b.s - a.s);
      const beam = Math.min(ranked.length, patterns[person].length < 30 ? ranked.length : 18);
      for (let k = 0; k < beam; k++) {
        const pat = ranked[k].pat;
        if (!feasible(pat)) continue;
        apply(pat, 1);
        chosen[person] = pat;
        if (bt(idx + 1)) return true;
        apply(pat, -1);
        delete chosen[person];
      }
      return false;
    }

    if (!bt(0)) return null;
    return { chosen, countD, countN };
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const found = search(seed + attempt * 97 + Math.floor(rnd() * 1000));
    if (found) return { ok: true, ...found, quota };
  }
  return { ok: false, reason: "No encontré una combinación que cubra todos los turnos." };
}

function holidayLocks() {
  return {
    Leady: { [HOLIDAY]: "D" },
    Ximena: { [HOLIDAY]: "N" },
  };
}

function emptyBoard() {
  const board = {};
  for (const person of STAFF) {
    board[person] = {};
    for (let d = 1; d <= 31; d++) board[person][d] = "";
  }
  return board;
}

function applyDaysOff(board, daysOff) {
  for (const person of STAFF) {
    for (const date of daysOff[person] || []) {
      board[person][date] = "L";
    }
  }
  return board;
}

/**
 * Genera el mes completo.
 * daysOff: { persona: number[] }
 */
function solveMonth(daysOff, year = 2026, locks = null) {
  const board = emptyBoard();
  applyDaysOff(board, daysOff);
  const weeks = octoberWeeks(year);
  const carry = Object.fromEntries(STAFF.map((p) => [p, false]));
  const report = [];
  if (!locks) locks = holidayLocks();

  for (const dates of weeks) {
    const quota = quotaForWeek(dates);
    const weekLocks = {};
    for (const person of STAFF) {
      weekLocks[person] = {};
      for (const date of dates) {
        if (locks[person] && locks[person][date]) {
          if ((daysOff[person] || []).includes(date)) {
            return {
              ok: false,
              board,
              report,
              reason: `${person} está libre el ${date} y también debe trabajar el feriado.`,
            };
          }
          weekLocks[person][date] = locks[person][date];
        }
      }
    }
    const solved = solveWeek(dates, daysOff, weekLocks, carry, quota, 40 + dates[0] * 13);
    if (!solved.ok) {
      return {
        ok: false,
        board,
        report,
        reason: `Semana del ${dates[0]} al ${dates[dates.length - 1]}: ${solved.reason}`,
      };
    }
    for (const person of STAFF) {
      const pat = solved.chosen[person];
      for (const d of pat.D) board[person][d] = "D";
      for (const n of pat.N) board[person][n] = "N";
      const last = dates[dates.length - 1];
      carry[person] = pat.N.includes(last);
    }
    report.push({
      from: dates[0],
      to: dates[dates.length - 1],
      quota,
      countD: solved.countD,
      countN: solved.countN,
    });
  }

  return { ok: true, board, report, reason: "" };
}

function validateBoard(board, daysOff, year = 2026) {
  const issues = [];
  const weeks = octoberWeeks(year);
  for (const person of STAFF) {
    for (let date = 1; date <= 31; date++) {
      const shift = board[person][date];
      if ((daysOff[person] || []).includes(date) && shift && shift !== "L") {
        issues.push(`${person} tiene turno el ${date}, pero ese día está libre.`);
      }
      if (shift === "D" && board[person][date] === "N") {
        issues.push(`${person} tiene día y noche el ${date}.`);
      }
      if (date < 31 && board[person][date] === "N" && board[person][date + 1] === "D") {
        issues.push(`${person} pasa de noche el ${date} a día el ${date + 1} (24 horas).`);
      }
      if (
        NO_CONSECUTIVE_NIGHTS.has(person) &&
        date < 31 &&
        board[person][date] === "N" &&
        board[person][date + 1] === "N"
      ) {
        issues.push(`${person} tiene noches seguidas el ${date} y el ${date + 1}.`);
      }
    }
    const onHoliday = board[person][HOLIDAY];
    if ((person === "Leady" || person === "Ximena") && onHoliday !== "D" && onHoliday !== "N") {
      issues.push(`${person} debe trabajar el 8 de octubre (feriado).`);
    }
  }

  for (const dates of weeks) {
    const quota = quotaForWeek(dates);
    for (const person of STAFF) {
      let d = 0;
      let n = 0;
      for (const date of dates) {
        if (board[person][date] === "D") d++;
        if (board[person][date] === "N") n++;
      }
      if (d !== quota.day || n !== quota.night) {
        issues.push(
          `${person} en la semana del ${dates[0]} al ${dates[dates.length - 1]} tiene ${d} día y ${n} noche (corresponde ${quota.day} y ${quota.night}).`
        );
      }
    }
    for (const date of dates) {
      let d = 0;
      let n = 0;
      for (const person of STAFF) {
        if (board[person][date] === "D") d++;
        if (board[person][date] === "N") n++;
      }
      if (d < 2) issues.push(`El ${date} el turno día tiene ${d} persona(s); el mínimo es 2.`);
      if (n < 2) issues.push(`El ${date} el turno noche tiene ${n} persona(s); el mínimo es 2.`);
      if (d > 3) issues.push(`El ${date} el turno día tiene ${d} personas; el máximo previsto es 3.`);
      if (n > 3) issues.push(`El ${date} el turno noche tiene ${n} personas; el máximo previsto es 3.`);
    }
  }
  return issues;
}

globalThis.Horario = {
  STAFF,
  DEFAULT_DAYS_OFF,
  HOLIDAY,
  octoberDays,
  octoberWeeks,
  quotaForWeek,
  solveMonth,
  validateBoard,
};
