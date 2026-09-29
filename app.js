const H = globalThis.Horario;
const STORAGE_KEY = "horario-octubre-2026";

const weekMeta = [
  { from: 1, to: 4, label: "1–4 · 1 día y 1 noche" },
  { from: 5, to: 11, label: "5–11 · 2 día y 2 noche" },
  { from: 12, to: 18, label: "12–18 · 2 día y 2 noche" },
  { from: 19, to: 25, label: "19–25 · 2 día y 2 noche" },
  { from: 26, to: 31, label: "26–31 · 2 día y 2 noche" },
];

let board = null;

const gridEl = document.querySelector("#grid");
const rosterEl = document.querySelector("#roster");
const statusEl = document.querySelector("#status");
const generateBtn = document.querySelector("#generar");
const feriadoEl = document.querySelector("#feriado");

function blankBoard() {
  const next = {};
  for (const person of H.STAFF) {
    next[person] = {};
    for (let date = 1; date <= 31; date++) next[person][date] = "";
  }
  return next;
}

function applyDefaultOff(next) {
  for (const person of H.STAFF) {
    for (let date = 1; date <= 31; date++) {
      if (next[person][date] === "L") next[person][date] = "";
    }
    for (const date of H.DEFAULT_DAYS_OFF[person] || []) next[person][date] = "L";
  }
  return next;
}

function collectDaysOff(source) {
  const off = {};
  for (const person of H.STAFF) {
    off[person] = [];
    for (let date = 1; date <= 31; date++) {
      if (source[person][date] === "L") off[person].push(date);
    }
  }
  return off;
}

function locksFromForm() {
  const mode = feriadoEl.value;
  if (mode === "ND") return { Leady: { 8: "N" }, Ximena: { 8: "D" } };
  if (mode === "DD") return { Leady: { 8: "D" }, Ximena: { 8: "D" } };
  if (mode === "NN") return { Leady: { 8: "N" }, Ximena: { 8: "N" } };
  return { Leady: { 8: "D" }, Ximena: { 8: "N" } };
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ board, feriado: feriadoEl.value })
  );
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.board && parsed.board.Yeferson) return parsed;
  } catch (error) {
    return null;
  }
  return null;
}

function monthCounts(person) {
  let day = 0;
  let night = 0;
  for (let date = 1; date <= 31; date++) {
    if (board[person][date] === "D") day++;
    if (board[person][date] === "N") night++;
  }
  return { day, night };
}

function badCells() {
  const bad = new Set();
  for (const person of H.STAFF) {
    for (let date = 1; date < 31; date++) {
      if (board[person][date] === "N" && board[person][date + 1] === "D") {
        bad.add(`${person}|${date}`);
        bad.add(`${person}|${date + 1}`);
      }
    }
  }
  return bad;
}

function coverage() {
  const day = {};
  const night = {};
  for (let date = 1; date <= 31; date++) {
    day[date] = 0;
    night[date] = 0;
    for (const person of H.STAFF) {
      if (board[person][date] === "D") day[date]++;
      if (board[person][date] === "N") night[date]++;
    }
  }
  return { day, night };
}

function render() {
  const days = H.octoberDays();
  const bad = badCells();
  const counts = coverage();
  const table = document.createElement("table");
  const colgroup = document.createElement("colgroup");
  const nameCol = document.createElement("col");
  nameCol.className = "name-col";
  colgroup.appendChild(nameCol);
  for (let date = 1; date <= 31; date++) {
    colgroup.appendChild(document.createElement("col"));
  }
  table.appendChild(colgroup);

  const weekRow = document.createElement("tr");
  weekRow.className = "week-row";
  const corner = document.createElement("th");
  corner.className = "corner";
  corner.textContent = "Octubre";
  weekRow.appendChild(corner);
  for (const week of weekMeta) {
    const th = document.createElement("th");
    th.colSpan = week.to - week.from + 1;
    th.textContent = week.label;
    if (week.from !== 1) th.className = "week-start";
    weekRow.appendChild(th);
  }

  const dayRow = document.createElement("tr");
  dayRow.className = "day-row";
  const nameHead = document.createElement("th");
  nameHead.className = "corner";
  nameHead.textContent = "Persona";
  dayRow.appendChild(nameHead);
  for (const day of days) {
    const th = document.createElement("th");
    th.className = [
      day.date === 5 || day.date === 12 || day.date === 19 || day.date === 26 ? "week-start" : "",
      day.weekend ? "weekend" : "",
      day.holiday ? "holiday" : "",
    ].filter(Boolean).join(" ");
    th.innerHTML = `<span class="dow">${day.weekday}</span><span class="dom">${day.date}</span>${
      day.holiday ? '<span class="tag">fer.</span>' : ""
    }`;
    dayRow.appendChild(th);
  }

  const head = document.createElement("thead");
  head.appendChild(weekRow);
  head.appendChild(dayRow);
  table.appendChild(head);

  const body = document.createElement("tbody");
  for (const person of H.STAFF) {
    const tr = document.createElement("tr");
    const totals = monthCounts(person);
    const name = document.createElement("td");
    name.className = "name";
    const expected = totals.day === 9 && totals.night === 9;
    name.innerHTML = `<b>${person}</b><span class="${expected ? "" : "warn"}">${totals.day} día · ${totals.night} noche</span>`;
    tr.appendChild(name);

    for (const day of days) {
      const td = document.createElement("td");
      const shift = board[person][day.date];
      const classes = [];
      if (day.date === 5 || day.date === 12 || day.date === 19 || day.date === 26) classes.push("week-start");
      if (day.weekend) classes.push("weekend");
      if (day.holiday) classes.push("holiday");
      if (shift === "D") classes.push("mark-d");
      if (shift === "N") classes.push("mark-n");
      if (shift === "L") classes.push("mark-l");
      if (bad.has(`${person}|${day.date}`)) classes.push("bad-cell");
      td.className = classes.join(" ");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.textContent = shift === "D" ? "D" : shift === "N" ? "N" : shift === "L" ? "L" : "";
      const label = shift === "D" ? "turno día" : shift === "N" ? "turno noche" : shift === "L" ? "libre" : "sin turno";
      button.title = `${person}, ${day.date} de octubre: ${label}. Clic para cambiar.`;
      button.addEventListener("click", () => cycle(person, day.date));
      td.appendChild(button);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  const foot = document.createElement("tbody");
  foot.appendChild(countRow("Día", counts.day, "day"));
  foot.appendChild(countRow("Noche", counts.night, "night"));
  table.appendChild(body);
  table.appendChild(foot);
  gridEl.replaceChildren(table);
  renderRoster(days, counts);
  renderStatus();
}

function countRow(label, map, kind) {
  const tr = document.createElement("tr");
  tr.className = `count-row ${kind}`;
  const name = document.createElement("td");
  name.className = "name count-label";
  name.textContent = label;
  tr.appendChild(name);
  for (let date = 1; date <= 31; date++) {
    const td = document.createElement("td");
    const value = map[date];
    const cls = ["count-num"];
    if (value < 2 || value > 3) cls.push("low");
    else if (value === 3) cls.push("high");
    if (date === 5 || date === 12 || date === 19 || date === 26) td.classList.add("week-start");
    td.innerHTML = `<span class="${cls.join(" ")}">${value}</span>`;
    tr.appendChild(td);
  }
  return tr;
}

function renderRoster(days) {
  rosterEl.replaceChildren();
  for (const day of days) {
    const card = document.createElement("article");
    card.className = "card";
    const dayNames = [];
    const nightNames = [];
    for (const person of H.STAFF) {
      if (board[person][day.date] === "D") dayNames.push(person);
      if (board[person][day.date] === "N") nightNames.push(person);
    }
    card.innerHTML = `<header><span>${day.weekday} ${day.date}</span>${
      day.holiday ? "<em>feriado</em>" : ""
    }</header>
      <div class="line day"><b>Día</b><span>${dayNames.join(", ") || "—"}</span></div>
      <div class="line night"><b>Noche</b><span>${nightNames.join(", ") || "—"}</span></div>`;
    rosterEl.appendChild(card);
  }
}

function renderStatus() {
  const off = collectDaysOff(board);
  const issues = H.validateBoard(board, off);
  statusEl.classList.toggle("bad", issues.length > 0);
  if (!issues.length) {
    statusEl.textContent = "El horario cumple las reglas: cobertura, días libres y el descanso entre noche y día.";
    return;
  }
  statusEl.innerHTML = `<strong>Hay ${issues.length} aviso${issues.length === 1 ? "" : "s"}.</strong><ul>${issues
    .slice(0, 8)
    .map((issue) => `<li>${issue}</li>`)
    .join("")}</ul>${issues.length > 8 ? `<p>Y ${issues.length - 8} más.</p>` : ""}`;
}

function cycle(person, date) {
  const order = ["", "D", "N", "L"];
  const current = board[person][date] || "";
  const next = order[(order.indexOf(current) + 1) % order.length];
  board[person][date] = next;
  save();
  render();
}

function generate() {
  generateBtn.disabled = true;
  generateBtn.textContent = "Armando…";
  window.setTimeout(() => {
    const off = collectDaysOff(board);
    const result = H.solveMonth(off, 2026, locksFromForm());
    generateBtn.disabled = false;
    generateBtn.textContent = "Generar horario";
    if (!result.ok) {
      statusEl.classList.add("bad");
      statusEl.textContent = result.reason + " Prueba quitando algún libre o cambiando el feriado.";
      return;
    }
    board = result.board;
    save();
    render();
  }, 30);
}

function clearShifts() {
  for (const person of H.STAFF) {
    for (let date = 1; date <= 31; date++) {
      if (board[person][date] === "D" || board[person][date] === "N") board[person][date] = "";
    }
  }
  save();
  render();
}

function resetOff() {
  board = applyDefaultOff(blankBoard());
  feriadoEl.value = "DN";
  generate();
}

document.querySelector("#generar").addEventListener("click", generate);
document.querySelector("#limpiar").addEventListener("click", clearShifts);
document.querySelector("#restablecer").addEventListener("click", resetOff);
document.querySelector("#imprimir").addEventListener("click", () => window.print());

const stored = load();
if (stored) {
  board = stored.board;
  if (stored.feriado) feriadoEl.value = stored.feriado;
  for (const person of H.STAFF) {
    for (let date = 1; date <= 31; date++) {
      if (!board[person][date]) board[person][date] = "";
    }
  }
  render();
} else {
  board = applyDefaultOff(blankBoard());
  generate();
}
