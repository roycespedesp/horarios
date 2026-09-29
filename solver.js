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

/** Solo turno día. */
const DAY_ONLY = new Set(["Ximena"]);

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

/** 28, 29 y 30 de setiembre, leídos del cuaderno (sin Yeferson). */
const LEAD_DAYS = [
  { date: 28, weekday: "lun", setiembre: true },
  { date: 29, weekday: "mar", setiembre: true },
  { date: 30, weekday: "mié", setiembre: true },
];

const NOTEBOOK_LEAD = {
  Mayra: { 28: "D", 30: "N" },
  Pamela: { 28: "N", 30: "D" },
  Ximena: { 29: "D", 30: "D" },
  Mariel: { 28: "N", 30: "N" },
  Gabriela: { 29: "N" },
  Maite: { 29: "N" },
  Leady: { 29: "D", 30: "D" },
  Miguel: { 28: "D", 29: "D" },
};

function leadShift(person, date) {
  return (NOTEBOOK_LEAD[person] && NOTEBOOK_LEAD[person][date]) || "";
}

function openingCarry() {
  const carry = Object.fromEntries(STAFF.map((person) => [person, false]));
  for (const person of STAFF) {
    if (leadShift(person, 30) === "N") carry[person] = true;
  }
  return carry;
}

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

function quotaForWeek() {
  return { day: 2, night: 2 };
}

function quotaForPerson(person, dates, daysOff) {
  if (!DAY_ONLY.has(person)) return quotaForWeek();
  const off = new Set((daysOff && daysOff[person]) || []);
  const available = dates.filter((date) => !off.has(date)).length;
  return { day: Math.min(4, available), night: 0 };
}

function quotasForWeek(dates, daysOff) {
  const quotas = {};
  for (const person of STAFF) quotas[person] = quotaForPerson(person, dates, daysOff);
  return quotas;
}

/** Semanas reales: la primera arranca el lunes 28 de setiembre. */
function scheduleWeeks(year = 2026) {
  const first = [
    { id: 10028, month: 9, date: 28 },
    { id: 10029, month: 9, date: 29 },
    { id: 10030, month: 9, date: 30 },
    { id: 10031, month: 10, date: 1 },
    { id: 10032, month: 10, date: 2 },
    { id: 10033, month: 10, date: 3 },
    { id: 10034, month: 10, date: 4 },
  ];
  const rest = octoberWeeks(year)
    .slice(1)
    .map((dates) => dates.map((date) => ({ id: date, month: 10, date })));
  return [first, ...rest];
}

function octoberDateForSlot(slot) {
  if (slot.month === 10) return slot.date;
  return null;
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
function solveWeek(days, off, locks, carryNight, quotas, seed = 1) {
  const rnd = mulberry32(seed);
  const people = STAFF.slice();
  const nightBudget = people.reduce((sum, person) => sum + quotas[person].night, 0);
  const dayBudget = people.reduce((sum, person) => sum + quotas[person].day, 0);
  const maxNight = nightBudget === days.length * 2 ? 2 : 3;
  const maxDay = dayBudget <= days.length * 2 ? 2 : 3;
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
      quotas[person].day,
      quotas[person].night,
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
        else if (c >= maxDay) s -= 8;
        else s -= 0.4;
      }
      for (const n of pat.N) {
        const c = countN[n];
        if (c < 2) s += 5 - c;
        else if (c >= maxNight) s -= 8;
        else s -= 0.4;
      }
      return s;
    }

    function feasible(pat) {
      for (const d of pat.D) if (countD[d] + 1 > maxDay) return false;
      for (const n of pat.N) if (countN[n] + 1 > maxNight) return false;
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
      let capD = 0;
      let capN = 0;
      for (let i = idx; i < people.length; i++) {
        capD += quotas[people[i]].day;
        capN += quotas[people[i]].night;
      }
      if (needD > capD) return false;
      if (needN > capN) return false;
      for (const d of days) {
        if (countD[d] > maxDay || countN[d] > maxNight) return false;
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
      const beam = Math.min(ranked.length, patterns[person].length < 40 ? ranked.length : 28);
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
    if (found) return { ok: true, ...found, quotas };
  }
  return { ok: false, reason: "No encontré una combinación que cubra todos los turnos." };
}

function holidayLocks() {
  return {
    Leady: { [HOLIDAY]: "D" },
    Ximena: { [HOLIDAY]: "D" },
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
  const weeks = scheduleWeeks(year);
  let carry = Object.fromEntries(STAFF.map((person) => [person, false]));
  const report = [];
  if (!locks) locks = holidayLocks();
  for (const person of STAFF) {
    if (!DAY_ONLY.has(person)) continue;
    for (const date of Object.keys((locks && locks[person]) || {})) {
      if (locks[person][date] === "N") {
        return {
          ok: false,
          board,
          report,
          reason: `${person} no hace turno noche. En el feriado va de día.`,
        };
      }
    }
  }

  function placeWeek(sourceBoard, sourceCarry, slots) {
    const ids = slots.map((slot) => slot.id);
    const off = {};
    const weekLocks = {};
    for (const person of STAFF) {
      off[person] = [];
      weekLocks[person] = {};
      for (const slot of slots) {
        if (slot.month === 9) {
          const shift = leadShift(person, slot.date);
          if (shift === "D" || shift === "N") weekLocks[person][slot.id] = shift;
          else off[person].push(slot.id);
        } else if ((daysOff[person] || []).includes(slot.date)) {
          off[person].push(slot.id);
        } else if (locks[person] && locks[person][slot.date]) {
          weekLocks[person][slot.id] = locks[person][slot.date];
        }
      }
    }
    const quotas = quotasForWeek(ids, off);
    const solved = solveWeek(ids, off, weekLocks, sourceCarry, quotas, 40 + slots[0].id);
    if (!solved.ok) {
      const from = slots[0];
      const to = slots[slots.length - 1];
      const fromLabel = from.month === 9 ? `${from.date} set` : String(from.date);
      const toLabel = to.month === 9 ? `${to.date} set` : String(to.date);
      return { ok: false, reason: `Semana del ${fromLabel} al ${toLabel}: ${solved.reason}` };
    }
    const nextBoard = emptyBoard();
    const idToDate = Object.fromEntries(slots.map((slot) => [slot.id, octoberDateForSlot(slot)]));
    for (const person of STAFF) {
      for (let date = 1; date <= 31; date++) nextBoard[person][date] = sourceBoard[person][date];
      const pat = solved.chosen[person];
      for (const id of pat.D) {
        const date = idToDate[id];
        if (date) nextBoard[person][date] = "D";
      }
      for (const id of pat.N) {
        const date = idToDate[id];
        if (date) nextBoard[person][date] = "N";
      }
    }
    const nextCarry = {};
    const last = slots[slots.length - 1].id;
    for (const person of STAFF) nextCarry[person] = solved.chosen[person].N.includes(last);
    return { ok: true, board: nextBoard, carry: nextCarry };
  }

  let current = { board, carry };
  for (const slots of weeks) {
    const step = placeWeek(current.board, current.carry, slots);
    if (!step.ok) return { ok: false, board, report, reason: step.reason };
    current = step;
  }

  return { ok: true, board: current.board, report, reason: "" };
}

function slotShift(board, person, slot) {
  if (slot.month === 9) return leadShift(person, slot.date);
  return board[person][slot.date] || "";
}

function slotLabel(slot) {
  return slot.month === 9 ? `${slot.date} set` : String(slot.date);
}

function validateBoard(board, daysOff, year = 2026) {
  const issues = [];
  for (const person of STAFF) {
    for (let date = 1; date <= 31; date++) {
      const shift = board[person][date];
      if (DAY_ONLY.has(person) && shift === "N") {
        issues.push(`${person} no hace turno noche.`);
      }
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
    if (person === "Ximena" && onHoliday !== "D") {
      issues.push("Ximena debe trabajar el 8 de octubre de día.");
    }
    if (person === "Leady" && onHoliday !== "D" && onHoliday !== "N") {
      issues.push("Leady debe trabajar el 8 de octubre (feriado).");
    }
    const leadDates = LEAD_DAYS.map((day) => day.date);
    for (let i = 0; i < leadDates.length - 1; i++) {
      const from = leadDates[i];
      const to = leadDates[i + 1];
      if (leadShift(person, from) === "N" && leadShift(person, to) === "D") {
        issues.push(`${person} pasa de noche el ${from} de setiembre a día el ${to}.`);
      }
      if (
        NO_CONSECUTIVE_NIGHTS.has(person) &&
        leadShift(person, from) === "N" &&
        leadShift(person, to) === "N"
      ) {
        issues.push(`${person} tiene noches seguidas el ${from} y el ${to} de setiembre.`);
      }
    }
    if (leadShift(person, 30) === "N" && board[person][1] === "D") {
      issues.push(`${person} pasa de noche el 30 de setiembre a día el 1 de octubre.`);
    }
    if (NO_CONSECUTIVE_NIGHTS.has(person) && leadShift(person, 30) === "N" && board[person][1] === "N") {
      issues.push(`${person} tiene noche el 30 de setiembre y también el 1 de octubre.`);
    }
  }

  for (const slots of scheduleWeeks(year)) {
    const ids = slots.map((slot) => slot.id);
    const off = {};
    for (const person of STAFF) {
      off[person] = [];
      for (const slot of slots) {
        if (slot.month === 9 && !leadShift(person, slot.date)) off[person].push(slot.id);
        if (slot.month === 10 && (daysOff[person] || []).includes(slot.date)) off[person].push(slot.id);
      }
    }
    const from = slotLabel(slots[0]);
    const to = slotLabel(slots[slots.length - 1]);
    for (const person of STAFF) {
      let d = 0;
      let n = 0;
      for (const slot of slots) {
        const shift = slotShift(board, person, slot);
        if (shift === "D") d++;
        if (shift === "N") n++;
      }
      const quota = quotaForPerson(person, ids, off);
      if (d !== quota.day || n !== quota.night) {
        issues.push(
          `${person} en la semana del ${from} al ${to} tiene ${d} día y ${n} noche (corresponde ${quota.day} día y ${quota.night} noche).`
        );
      }
    }
    for (const slot of slots) {
      let d = 0;
      let n = 0;
      for (const person of STAFF) {
        const shift = slotShift(board, person, slot);
        if (shift === "D") d++;
        if (shift === "N") n++;
      }
      const label = slotLabel(slot);
      if (d < 2) issues.push(`El ${label} el turno día tiene ${d} persona(s); el mínimo es 2.`);
      if (n < 2) issues.push(`El ${label} el turno noche tiene ${n} persona(s); el mínimo es 2.`);
      if (d > 3) issues.push(`El ${label} el turno día tiene ${d} personas; el máximo previsto es 3.`);
      if (n > 3) issues.push(`El ${label} el turno noche tiene ${n} personas; el máximo previsto es 3.`);
    }
  }
  return issues;
}

globalThis.Horario = {
  STAFF,
  DAY_ONLY,
  DEFAULT_DAYS_OFF,
  HOLIDAY,
  LEAD_DAYS,
  NOTEBOOK_LEAD,
  octoberDays,
  octoberWeeks,
  quotaForWeek,
  solveMonth,
  validateBoard,
};
