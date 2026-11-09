"use strict";

const KEY = "college-dashboard-v1";
const THEME_KEY = "college-dashboard-theme";
const TIP_KEY = "college-dashboard-install-tip";
const PALETTE = ["#4f6bed", "#d0568f", "#e07b2a", "#14998a", "#8b5cf6", "#c99a12", "#3b9fd6", "#df5050"];
const NEWS_KEY = "college-dashboard-news";
const NEWS_TTL = 30 * 60 * 1000;
const CNBC = id => `https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=${id}`;
// Public RSS feeds that allow cross-origin reads, so no API key or server is needed.
const FEEDS = [
  { topic: "Investing", source: "CNBC", url: CNBC(15839069) },
  { topic: "Economy", source: "CNBC", url: CNBC(20910258) },
  { topic: "Finance", source: "CNBC", url: CNBC(10000664) },
  { topic: "Money", source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
];

// ---------- state ----------
let state;
let view = "home";
let calMonth = startOfMonth(new Date());
let aFilter = { course: "all", status: "open" };
let cQuery = "";
let news = { items: [], at: 0, status: "idle" }; // status: idle | loading | ok | error
let newsTopic = "all";

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.assignments) return s;
  } catch (e) {}
  return sample();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
function uid() { return crypto.randomUUID(); }

function sample() {
  const at = (days, h = 23, m = 59) => { const x = addDays(new Date(), days); x.setHours(h, m, 0, 0); return toLocalInput(x); };
  const on = days => ymd(addDays(new Date(), days));
  const tag = list => list.map(x => ({ id: uid(), ...x, sample: true }));
  return {
    assignments: tag([
      { title: "DCF valuation case", course: "Corporate Finance", due: at(2), priority: "high", status: "in progress", notes: "Build the model in Excel and write a 2-page memo." },
      { title: "Problem set 5", course: "Econometrics", due: at(4, 17, 0), priority: "medium", status: "not started", notes: "" },
      { title: "Chapter 9 quiz", course: "Financial Accounting", due: at(-1, 9, 0), priority: "medium", status: "not started", notes: "" },
      { title: "Midterm review sheet", course: "Financial Accounting", due: at(6, 12, 0), priority: "low", status: "not started", notes: "" },
      { title: "Portfolio optimization project", course: "Investments", due: at(11), priority: "high", status: "not started", notes: "Group project with Priya." },
      { title: "Bond pricing homework", course: "Investments", due: at(-3), priority: "medium", status: "done", notes: "" },
    ]),
    todos: tag([
      { text: "Book a study room for Thursday", due: at(0, 20, 0), done: false },
      { text: "Update resume before the career fair", due: at(1, 17, 0), done: false },
      { text: "Email professor about office hours", due: "", done: false },
      { text: "Buy batteries for the financial calculator", due: "", done: true },
    ]),
    contacts: tag([
      { name: "Prof. Elena Marsh", role: "Professor", org: "Corporate Finance", email: "emarsh@example.edu", phone: "", notes: "Office hours Tue 2–4pm. Offered to write a recommendation letter.", last: on(-12) },
      { name: "Jordan Lee", role: "Recruiter", org: "Example Capital", email: "jordan@example.com", phone: "(555) 010-2231", notes: "Met at the fall career fair. Summer analyst applications open in January.", last: on(-52) },
      { name: "Priya Shah", role: "Classmate", org: "Investments", email: "priya@example.edu", phone: "(555) 010-8842", notes: "Project partner.", last: on(-2) },
      { name: "Sam Ortiz", role: "Mentor", org: "Alumni network", email: "sam@example.com", phone: "", notes: "Works in equity research. Monthly coffee chat.", last: "" },
    ]),
  };
}

// ---------- date helpers (all local time) ----------
const pad = n => String(n).padStart(2, "0");
function toLocalInput(d) { return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parse(s) { return s ? new Date(s.length === 10 ? s + "T00:00" : s) : null; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfToday() { return startOfDay(new Date()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a, b) { return ymd(a) === ymd(b); }
function dayDiff(d) { return Math.round((startOfDay(d) - startOfToday()) / 864e5); }
const byDue = (a, b) => parse(a.due) - parse(b.due);
const timeOf = d => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fullDate = d => d.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

function whenText(d) {
  const days = dayDiff(d);
  if (days === 0) return `Today · ${timeOf(d)}`;
  if (days === 1) return `Tomorrow · ${timeOf(d)}`;
  if (days === -1) return `Yesterday · ${timeOf(d)}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString(undefined, { weekday: "short" })} · ${timeOf(d)}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function dueLabel(a) {
  const d = parse(a.due);
  if (a.status === "done") return { text: whenText(d), cls: "" };
  if (d < new Date()) { const late = -dayDiff(d); return { text: late > 0 ? `${late}d overdue` : "Overdue", cls: "danger" }; }
  return { text: whenText(d), cls: dayDiff(d) <= 1 ? "warn" : "" };
}
function isOverdue(a) { return a.status !== "done" && parse(a.due) < new Date(); }
function semester(d) {
  const m = d.getMonth();
  return `${m <= 4 ? "Spring" : m <= 6 ? "Summer" : "Fall"} ${d.getFullYear()}`;
}
function lastText(days) {
  if (days === null) return "Not contacted yet";
  if (days <= 0) return "Talked today";
  if (days === 1) return "Talked yesterday";
  if (days < 7) return `Talked ${days} days ago`;
  if (days < 60) return `Talked ${plural(Math.round(days / 7), "week")} ago`;
  return `Talked ${plural(Math.round(days / 30), "month")} ago`;
}

// ---------- small render helpers ----------
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ic = name => `<svg class="i"><use href="#i-${name}"/></svg>`;
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function courseList() { return [...new Set(state.assignments.map(a => a.course))].sort(); }
function courseColor(name) { return PALETTE[Math.max(0, courseList().indexOf(name)) % PALETTE.length]; }
function hashColor(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
function initials(name) {
  const parts = name.replace(/^(prof|dr|mr|mrs|ms)\.?\s+/i, "").trim().split(/\s+/);
  return ((parts[0] || "")[0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
const head = (eyebrow, title, lede, actions = "") => `<header class="page-head"><div>
  <div class="eyebrow">${eyebrow}</div><h1 class="title">${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div>
  <div class="head-actions">${actions}</div></header>`;
const empty = (icon, title, text) => `<div class="empty"><span class="empty-ic">${ic(icon)}</span><strong>${title}</strong><span>${text}</span></div>`;
const newAssignmentBtn = `<button class="btn primary" data-action="new-a">${ic("plus")}New assignment</button>`;

// ---------- dialog ----------
function field(f, values) {
  const v = values[f.name] ?? "";
  const cls = `field ${f.half ? "" : "full"}`;
  if (f.type === "seg") {
    return `<div class="${cls}"><span>${f.label}</span><div class="seg">${f.options.map(([val, label]) =>
      `<label><input type="radio" name="${f.name}" value="${val}" ${val === v ? "checked" : ""}>${label}</label>`).join("")}</div></div>`;
  }
  let input;
  if (f.type === "select") input = `<select class="input" name="${f.name}">${f.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  else if (f.type === "textarea") input = `<textarea class="input" name="${f.name}" rows="3" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
  else input = `<input class="input" name="${f.name}" type="${f.type || "text"}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}"
    autocomplete="off" ${f.required ? "required" : ""} ${f.list ? `list="${f.list}"` : ""}>`;
  return `<label class="${cls}"><span>${f.label}</span>${input}</label>`;
}

function openForm(title, fields, values, onSave, onDelete) {
  const dlg = document.getElementById("dlg");
  const form = document.getElementById("dlg-form");
  form.innerHTML = `<div class="dlg-head"><h2>${title}</h2>
      <button type="button" class="btn ghost icon sm" data-close aria-label="Close">${ic("x")}</button></div>
    <div class="dlg-body">${fields.map(f => field(f, values)).join("")}</div>
    <div class="dlg-foot">${onDelete ? `<button type="button" class="btn ghost danger" data-del>${ic("trash")}Delete</button>` : ""}
      <span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button>
      <button class="btn primary">${onDelete ? "Save changes" : "Add"}</button></div>
    <datalist id="courses">${courseList().map(c => `<option value="${esc(c)}">`).join("")}</datalist>`;
  form.onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    for (const k in data) data[k] = data[k].trim();
    onSave(data); save(); dlg.close(); render();
    toast(onDelete ? "Changes saved" : "Added");
  };
  form.querySelectorAll("[data-close]").forEach(b => b.onclick = () => dlg.close());
  if (onDelete) form.querySelector("[data-del]").onclick = () => {
    const snap = JSON.stringify(state);
    onDelete(); save(); dlg.close(); render();
    toast("Deleted", snap);
  };
  dlg.showModal();
  form.querySelector(".dlg-body .input").focus();
}
document.getElementById("dlg").addEventListener("click", e => { if (e.target.id === "dlg") e.target.close(); });

let toastTimer;
function toast(msg, undoSnap) {
  const el = document.getElementById("toast");
  el.innerHTML = `<span>${esc(msg)}</span>${undoSnap ? "<button>Undo</button>" : ""}`;
  if (undoSnap) el.querySelector("button").onclick = () => { state = JSON.parse(undoSnap); save(); render(); el.classList.remove("show"); };
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), undoSnap ? 5000 : 2000);
}

// ---------- assignments ----------
const aFields = [
  { name: "title", label: "Title", required: true, placeholder: "e.g. Problem set 6" },
  { name: "course", label: "Course", required: true, list: "courses", half: true, placeholder: "e.g. Investments" },
  { name: "due", label: "Due", type: "datetime-local", required: true, half: true },
  { name: "priority", label: "Priority", type: "seg", options: [["low", "Low"], ["medium", "Medium"], ["high", "High"]] },
  { name: "status", label: "Status", type: "seg", options: [["not started", "Not started"], ["in progress", "In progress"], ["done", "Done"]] },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "Anything to remember…" },
];
function editAssignment(a, presetDue) {
  const isNew = !a;
  openForm(isNew ? "New assignment" : "Edit assignment", aFields, a || { priority: "medium", status: "not started", due: presetDue || "" },
    data => { if (isNew) state.assignments.push({ id: uid(), ...data }); else Object.assign(a, data); },
    isNew ? null : () => { state.assignments = state.assignments.filter(x => x !== a); });
}
function aRow(a) {
  const due = dueLabel(a), done = a.status === "done";
  const lvl = { low: 1, medium: 2, high: 3 }[a.priority] || 2;
  return `<div class="arow ${done ? "done" : ""}" style="--c:${courseColor(a.course)}" data-action="edit-a" data-id="${a.id}">
    <input type="checkbox" class="cb" data-action="toggle-a" data-id="${a.id}" ${done ? "checked" : ""} aria-label="Mark done">
    <div><span class="t">${esc(a.title)}</span>
      <div class="meta"><span class="course">${esc(a.course)}</span>
        ${a.status === "in progress" ? '<span class="badge">In progress</span>' : ""}
        <span class="pri" data-l="${lvl}" title="${a.priority} priority"><i></i><i></i><i></i></span></div></div>
    <span class="pill ${due.cls}" title="${esc(fullDate(parse(a.due)))}">${due.text}</span></div>`;
}
function viewAssignments() {
  const courses = courseList();
  if (aFilter.course !== "all" && !courses.includes(aFilter.course)) aFilter.course = "all";
  const list = state.assignments.filter(a => aFilter.course === "all" || a.course === aFilter.course).sort(byDue);
  const open = list.filter(a => a.status !== "done");
  const tomorrow = addDays(startOfToday(), 1), weekEnd = addDays(startOfToday(), 7);
  const groups = [];
  if (aFilter.status !== "done") {
    groups.push(["Overdue", open.filter(isOverdue)]);
    groups.push(["Today", open.filter(a => !isOverdue(a) && parse(a.due) < tomorrow)]);
    groups.push(["This week", open.filter(a => { const d = parse(a.due); return d >= tomorrow && d < weekEnd; })]);
    groups.push(["Later", open.filter(a => parse(a.due) >= weekEnd)]);
  }
  if (aFilter.status !== "open") groups.push(["Completed", list.filter(a => a.status === "done").reverse()]);
  const body = groups.filter(g => g[1].length)
    .map(([name, items]) => `<div class="group"><span>${name}</span><span class="n">${items.length}</span></div>${items.map(aRow).join("")}`).join("");
  const allOpen = state.assignments.filter(a => a.status !== "done").length;

  return head("Coursework", "Assignments", `${plural(allOpen, "open assignment")} across ${plural(courses.length, "course")}.`, newAssignmentBtn) + `
    <div class="toolbar">
      <div class="seg">${[["open", "Open"], ["done", "Done"], ["all", "All"]].map(([v, l]) =>
        `<button class="${aFilter.status === v ? "on" : ""}" data-action="f-status" data-value="${v}">${l}</button>`).join("")}</div>
      <div class="chips"><button class="chip-btn ${aFilter.course === "all" ? "on" : ""}" data-action="f-course" data-value="all">All courses</button>
        ${courses.map(c => `<button class="chip-btn ${aFilter.course === c ? "on" : ""}" style="--c:${courseColor(c)}" data-action="f-course" data-value="${esc(c)}"><i class="dot"></i>${esc(c)}</button>`).join("")}</div>
    </div>
    <div class="card rows">${body || empty("check", aFilter.status === "done" ? "Nothing finished yet" : "You're all caught up",
      aFilter.status === "done" ? "Completed assignments will show up here." : "No open assignments. Enjoy it.")}</div>`;
}

// ---------- calendar ----------
function viewCalendar() {
  const first = calMonth;
  const gridStart = addDays(first, -first.getDay());
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const todayKey = ymd(new Date());
  let cells = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(gridStart, i), key = ymd(d);
    const items = state.assignments.filter(a => a.due.slice(0, 10) === key).sort(byDue);
    const cls = [d.getMonth() !== first.getMonth() && "other", key === todayKey && "today", d.getDay() % 6 === 0 && "weekend"].filter(Boolean).join(" ");
    cells += `<div class="cday ${cls}" data-action="day" data-value="${key}">
      <span class="n">${d.getDate()}</span>
      ${items.slice(0, 3).map(a => `<button class="ev ${a.status === "done" ? "done" : ""}" style="--c:${courseColor(a.course)}"
        data-action="edit-a" data-id="${a.id}" title="${esc(a.title)} · ${esc(timeOf(parse(a.due)))}">${esc(a.title)}</button>`).join("")}
      ${items.length > 3 ? `<span class="more">+${items.length - 3} more</span>` : ""}</div>`;
  }
  const inMonth = state.assignments.filter(a => a.status !== "done" && a.due.slice(0, 7) === ymd(first).slice(0, 7)).length;
  const courses = courseList();
  return head(String(first.getFullYear()), first.toLocaleDateString(undefined, { month: "long" }),
    `${plural(inMonth, "open deadline")} this month.`,
    `<div class="btn-group"><button class="btn icon" data-action="cal-prev" aria-label="Previous month">${ic("chev-l")}</button>
      <button class="btn" data-action="cal-today">Today</button>
      <button class="btn icon" data-action="cal-next" aria-label="Next month">${ic("chev-r")}</button></div>${newAssignmentBtn}`) + `
    <div class="cal">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="dow">${d}</div>`).join("")}${cells}</div>
    ${courses.length ? `<div class="legend">${courses.map(c => `<span><i class="dot" style="--c:${courseColor(c)}"></i>${esc(c)}</span>`).join("")}</div>` : ""}`;
}

// ---------- todos ----------
function tRow(t) {
  const d = parse(t.due);
  const cls = !d || t.done ? "" : d < new Date() ? "danger" : dayDiff(d) <= 1 ? "warn" : "";
  return `<div class="trow ${t.done ? "done" : ""}">
    <input type="checkbox" class="cb" data-action="toggle-t" data-id="${t.id}" ${t.done ? "checked" : ""} aria-label="Done">
    <div class="tmain"><span class="t">${esc(t.text)}</span>
      ${d ? `<span class="pill ${cls}" title="${esc(fullDate(d))}">${whenText(d)}</span>` : ""}</div>
    <button class="btn ghost icon sm del" data-action="del-t" data-id="${t.id}" aria-label="Delete">${ic("x")}</button></div>`;
}
const byTodo = (a, b) => (a.due ? parse(a.due) : Infinity) - (b.due ? parse(b.due) : Infinity);
function viewTodos() {
  const open = state.todos.filter(t => !t.done).sort(byTodo);
  const done = state.todos.filter(t => t.done);
  return head("Tasks", "To-do", open.length ? `${plural(open.length, "thing")} left to do.` : "Nothing left. Nice work.") + `
    <form class="card composer" id="todo-form">${ic("plus")}
      <input id="todo-text" class="bare" placeholder="Add a task and press Enter" autocomplete="off" required>
      <input id="todo-due" type="datetime-local" class="input sm" aria-label="Due (optional)">
      <button class="btn primary sm">Add</button></form>
    <div class="card rows">${open.map(tRow).join("") || empty("check", "All clear", "Add a task above to get started.")}</div>
    ${done.length ? `<div class="sub-head"><span>Completed · ${done.length}</span>
      <button class="btn ghost sm" data-action="clear-done">Clear completed</button></div>
      <div class="card rows">${done.map(tRow).join("")}</div>` : ""}`;
}

// ---------- contacts ----------
const cFields = [
  { name: "name", label: "Name", required: true, placeholder: "Full name" },
  { name: "role", label: "Role", type: "select", half: true, options: ["Classmate", "Professor", "TA", "Recruiter", "Mentor", "Other"] },
  { name: "org", label: "Course / Company", half: true, placeholder: "e.g. Goldman Sachs" },
  { name: "email", label: "Email", type: "email", half: true },
  { name: "phone", label: "Phone", type: "tel", half: true },
  { name: "last", label: "Last contacted", type: "date" },
  { name: "notes", label: "Notes", type: "textarea", placeholder: "How you met, what you talked about…" },
];
function editContact(c) {
  const isNew = !c;
  openForm(isNew ? "New contact" : "Edit contact", cFields, c || { role: "Classmate" },
    data => { if (isNew) state.contacts.push({ id: uid(), ...data }); else Object.assign(c, data); },
    isNew ? null : () => { state.contacts = state.contacts.filter(x => x !== c); });
}
const daysSince = c => c.last ? -dayDiff(parse(c.last)) : null;
function personCard(c) {
  const days = daysSince(c);
  return `<div class="card person" style="--c:${hashColor(c.name)}" data-action="edit-c" data-id="${c.id}">
    <div class="person-top"><span class="avatar">${esc(initials(c.name))}</span>
      <div class="who"><div class="name">${esc(c.name)}</div><div class="role">${esc(c.role)}${c.org ? ` · ${esc(c.org)}` : ""}</div></div></div>
    ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ""}
    <div class="person-foot"><span class="last ${days === null || days > 45 ? "warn" : ""}">${ic("clock")}${lastText(days)}</span>
      <span class="acts">
        ${c.email ? `<a class="btn ghost icon sm" href="mailto:${esc(c.email)}" data-action="link" title="${esc(c.email)}">${ic("mail")}</a>` : ""}
        ${c.phone ? `<a class="btn ghost icon sm" href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}" data-action="link" title="${esc(c.phone)}">${ic("phone")}</a>` : ""}
        <button class="btn ghost icon sm" data-action="touch-c" data-id="${c.id}" title="Mark as contacted today">${ic("check")}</button>
      </span></div></div>`;
}
function viewContacts() {
  const q = cQuery.toLowerCase();
  const list = state.contacts.filter(c => !q || [c.name, c.role, c.org, c.email, c.notes].join(" ").toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const n = state.contacts.length;
  return head("Network", "Contacts", `${n} ${n === 1 ? "person" : "people"} in your network.`,
    `<div class="search">${ic("search")}<input id="c-search" class="input" placeholder="Search people…" value="${esc(cQuery)}" autocomplete="off"></div>
     <button class="btn primary" data-action="new-c">${ic("plus")}New contact</button>`) +
    (list.length ? `<div class="people">${list.map(personCard).join("")}</div>`
      : `<div class="card">${q ? empty("search", "No matches", `Nobody matches “${esc(cQuery)}”.`) : empty("users", "No contacts yet", "Add classmates, professors and recruiters you meet.")}</div>`);
}

// ---------- home ----------
function viewHome() {
  const now = new Date(), today = startOfToday(), weekEnd = addDays(today, 7);
  const open = state.assignments.filter(a => a.status !== "done");
  const overdue = open.filter(isOverdue).sort(byDue);
  const upcoming = open.filter(a => !isOverdue(a)).sort(byDue);
  const week = upcoming.filter(a => parse(a.due) < weekEnd);
  const total = state.assignments.length, pct = total ? Math.round((total - open.length) / total * 100) : 0;
  const openT = state.todos.filter(t => !t.done).sort(byTodo);
  const todoPct = state.todos.length ? Math.round((state.todos.length - openT.length) / state.todos.length * 100) : 0;
  const todayT = openT.filter(t => t.due && parse(t.due) < addDays(today, 1)).length;

  const h = now.getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const summary = week.length || overdue.length
    ? `You have ${plural(week.length, "assignment")} due this week${overdue.length ? ` and ${overdue.length} overdue` : ""}.`
    : "Nothing due this week. Enjoy the breather.";

  const stat = (icon, label, value, meta, extra = "", cls = "") =>
    `<div class="card stat ${cls}"><div class="label"><span class="ib">${ic(icon)}</span>${label}</div>
      <div class="value">${value}</div>${extra}<div class="meta">${meta}</div></div>`;
  const bar = p => `<div class="bar"><i style="width:${p}%"></i></div>`;

  const strip = [...Array(7)].map((_, i) => {
    const d = addDays(today, i);
    const items = open.filter(a => sameDay(parse(a.due), d));
    return `<button class="wday ${i === 0 ? "today" : ""}" data-action="day" data-value="${ymd(d)}"
      title="${esc(items.map(a => a.title).join(", ") || "Nothing due")}">
      <span class="dname">${d.toLocaleDateString(undefined, { weekday: "short" })}</span>
      <span class="dnum">${d.getDate()}</span>
      <span class="dots">${items.map(a => `<i class="dot" style="--c:${courseColor(a.course)}"></i>`).join("")}</span></button>`;
  }).join("");

  const people = [...state.contacts].sort((a, b) => (daysSince(b) ?? 1e9) - (daysSince(a) ?? 1e9)).slice(0, 4);
  const next = [...overdue, ...upcoming].slice(0, 6);

  return head(now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), `${greet}<em>.</em>`, summary, newAssignmentBtn) + `
    ${showInstallTip() ? `<div class="card install-tip"><span class="ib">${ic("share")}</span>
      <div><strong>Put Semester on your Home Screen</strong><span>In Safari, tap Share, then “Add to Home Screen”.</span></div>
      <button class="btn ghost icon sm" data-action="dismiss-tip" aria-label="Dismiss">${ic("x")}</button></div>` : ""}
    <section class="stats">
      ${stat("calendar", "Due this week", week.length, week[0] ? `Next: ${esc(week[0].title)}` : "Clear week ahead")}
      ${stat("alert", "Overdue", overdue.length, overdue.length ? "Catch up on these first" : "You're all caught up", "", overdue.length ? "alert" : "")}
      ${stat("check-square", "Open tasks", openT.length, todayT ? `${todayT} due today` : "None due today", bar(todoPct))}
      ${stat("target", "Progress", `${pct}<small>%</small>`, `${total - open.length} of ${plural(total, "assignment")} done`, bar(pct))}
    </section>
    <section class="card">
      <div class="card-head"><span class="card-title">Next 7 days</span>
        <button class="btn ghost sm" data-action="nav" data-value="calendar">Calendar${ic("chev-r")}</button></div>
      <div class="card-body"><div class="week">${strip}</div></div>
    </section>
    <section class="split">
      <div class="card">
        <div class="card-head"><span class="card-title">Up next <span class="n">${open.length}</span></span>
          <button class="btn ghost sm" data-action="nav" data-value="assignments">All assignments${ic("chev-r")}</button></div>
        <div class="rows">${next.map(aRow).join("") || empty("check", "Nothing coming up", "Add an assignment to start tracking deadlines.")}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><span class="card-title">Tasks <span class="n">${openT.length}</span></span>
            <button class="btn ghost sm" data-action="nav" data-value="todos">View all${ic("chev-r")}</button></div>
          <div class="rows">${openT.slice(0, 5).map(tRow).join("") || empty("check", "All clear", "No open tasks.")}</div>
        </div>
        <div class="card">
          <div class="card-head"><span class="card-title">Keep in touch</span>
            <button class="btn ghost sm" data-action="nav" data-value="contacts">Contacts${ic("chev-r")}</button></div>
          <div class="rows">${people.map(c => { const days = daysSince(c); return `
            <div class="mini" style="--c:${hashColor(c.name)}" data-action="edit-c" data-id="${c.id}">
              <span class="avatar sm">${esc(initials(c.name))}</span>
              <div class="who"><div class="name">${esc(c.name)}</div>
                <div class="sub ${days === null || days > 45 ? "warn" : ""}">${esc(c.role)} · ${lastText(days)}</div></div></div>`; }).join("")
            || empty("users", "No contacts yet", "Add people you meet.")}</div>
        </div>
      </div>
    </section>
    <section class="card news-inline"><div class="card-body" id="news-inline">${newsPanel(8)}</div></section>
    <div class="card data-card mobile-only">${dataTools()}</div>`;
}

// ---------- finance news ----------
function loadNewsCache() {
  try {
    const c = JSON.parse(localStorage.getItem(NEWS_KEY));
    if (c && c.items) news = { items: c.items, at: c.at, status: "ok" };
  } catch (e) {}
}
async function fetchFeed(feed) {
  const res = await fetch(feed.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  return [...xml.querySelectorAll("item")].map(item => {
    const get = tag => (item.getElementsByTagName(tag)[0]?.textContent || "").trim();
    return {
      title: get("title"), link: get("link"), at: Date.parse(get("pubDate")) || 0,
      summary: get("description").replace(/<[^>]*>/g, "").trim(), source: feed.source, topic: feed.topic,
    };
  }).filter(i => i.title && /^https?:\/\//.test(i.link));
}
async function fetchNews(force) {
  if (news.status === "loading") return;
  if (!force && news.items.length && Date.now() - news.at < NEWS_TTL) return;
  news.status = "loading";
  renderNews();
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const seen = new Set();
  const items = results.flatMap(r => r.status === "fulfilled" ? r.value : [])
    .sort((a, b) => b.at - a.at)
    .filter(i => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 80);
  if (items.length) {
    news = { items, at: Date.now(), status: "ok" };
    try { localStorage.setItem(NEWS_KEY, JSON.stringify({ items, at: news.at })); } catch (e) {}
  } else {
    news.status = "error";
  }
  renderNews();
}
function ago(t) {
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}
function newsItems() {
  const fresh = list => {
    const today = list.filter(i => Date.now() - i.at < 36 * 3600e3);
    return today.length >= 6 ? today : list; // fall back to older headlines on slow news days
  };
  if (newsTopic !== "all") return fresh(news.items.filter(i => i.topic === newsTopic));
  // Take turns between topics so one busy feed doesn't crowd out the rest.
  const byTopic = FEEDS.map(f => fresh(news.items.filter(i => i.topic === f.topic)));
  const out = [];
  for (let r = 0; byTopic.some(l => l[r]); r++) byTopic.forEach(l => { if (l[r]) out.push(l[r]); });
  return out;
}
function newsPanel(limit) {
  const topics = ["all", ...new Set(FEEDS.map(f => f.topic))];
  const list = newsItems().slice(0, limit);
  const item = (n, lead) => `<a class="news-item ${lead ? "lead" : ""}" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer" data-action="link">
      <div class="news-src"><span class="src">${esc(n.source)}</span><span>${ago(n.at)}</span>${newsTopic === "all" ? `<span class="topic">${esc(n.topic)}</span>` : ""}</div>
      <div class="news-h">${esc(n.title)}</div>
      ${lead && n.summary ? `<p class="news-sum">${esc(n.summary)}</p>` : ""}</a>`;
  let body;
  if (list.length) body = list.map((n, i) => item(n, i === 0)).join("");
  else if (news.status === "loading" || news.status === "idle") body = '<div class="sk"><i></i><i></i><i></i></div>'.repeat(6);
  else body = empty("alert", "Couldn't load the news", "Check your connection, then try again.");
  const meta = news.status === "loading" ? "Fetching the latest headlines…"
    : news.status === "error" ? (news.items.length ? "Couldn't refresh · showing saved headlines" : "Offline")
    : news.at ? `Updated ${Date.now() - news.at < 6e4 ? "just now" : ago(news.at)}` : "";
  return `<div class="news-head"><div>
      <div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
      <h2 class="news-title">Today in finance</h2></div>
      <button class="btn ghost icon sm ${news.status === "loading" ? "spin" : ""}" data-action="news-refresh" aria-label="Refresh news" title="Refresh">${ic("refresh")}</button></div>
    <div class="news-meta">${meta}</div>
    <div class="chips news-chips">${topics.map(t => `<button class="chip-btn ${newsTopic === t ? "on" : ""}" data-action="news-topic" data-value="${t}">${t === "all" ? "All" : t}</button>`).join("")}</div>
    <div class="news-list">${body}</div>
    <p class="news-foot">Headlines from CNBC and MarketWatch. Stories open in a new tab.</p>`;
}
function renderNews() {
  document.getElementById("rail").innerHTML = newsPanel(30);
  const inline = document.getElementById("news-inline");
  if (inline) inline.innerHTML = newsPanel(8);
}

// ---------- chrome ----------
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}
function showInstallTip() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let dismissed = false;
  try { dismissed = localStorage.getItem(TIP_KEY) === "1"; } catch (e) {}
  return ios && !navigator.standalone && !dismissed;
}
async function exportBackup() {
  const name = `semester-backup-${ymd(new Date())}.json`;
  const file = new File([JSON.stringify(state, null, 2)], name, { type: "application/json" });
  // On a phone, the share sheet lets him save the file to Files, iCloud Drive or AirDrop.
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Semester backup" }); toast("Backup saved"); }
    catch (err) { if (err.name !== "AbortError") toast("Couldn't share the backup"); }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup downloaded");
}
function dataTools() {
  const hasSample = [...state.assignments, ...state.todos, ...state.contacts].some(x => x.sample);
  return `<div class="side-label">Data</div>
    <button class="side-link" data-action="export">${ic("download")}Back up</button>
    <button class="side-link" data-action="import">${ic("upload")}Restore from backup</button>
    ${hasSample ? `<button class="side-link" data-action="clear-sample">${ic("trash")}Remove sample data</button>` : ""}
    <button class="side-link" data-action="theme">${ic(isDark() ? "sun" : "moon")}${isDark() ? "Light mode" : "Dark mode"}</button>`;
}
function renderChrome() {
  const counts = {
    assignments: state.assignments.filter(a => a.status !== "done").length,
    todos: state.todos.filter(t => !t.done).length,
    contacts: state.contacts.length,
  };
  document.querySelectorAll("#nav [data-action=nav], #tabbar [data-action=nav]").forEach(b => {
    b.classList.toggle("active", b.dataset.value === view);
    const c = b.querySelector(".count");
    if (c) c.textContent = counts[b.dataset.value] || "";
  });
  document.getElementById("side-foot").innerHTML = dataTools();
  document.getElementById("semester").textContent = semester(new Date());
  document.getElementById("theme-color").content = isDark() ? "#0d0e12" : "#f6f5f1";
}

const views = { home: viewHome, assignments: viewAssignments, calendar: viewCalendar, todos: viewTodos, contacts: viewContacts };
function render() {
  const focusId = document.activeElement && document.activeElement.id;
  document.getElementById("main").innerHTML = views[view]();
  renderChrome();
  if (focusId === "c-search" || focusId === "todo-text") {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
}
function go(v) {
  view = v;
  const main = document.getElementById("main");
  main.classList.remove("enter"); void main.offsetWidth; main.classList.add("enter");
  setTimeout(() => main.classList.remove("enter"), 700);
  window.scrollTo(0, 0);
  render();
}

// ---------- events ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, id: key, value } = el.dataset;
  const findA = () => state.assignments.find(x => x.id === key);
  const findT = () => state.todos.find(x => x.id === key);
  const findC = () => state.contacts.find(x => x.id === key);
  const commit = msg => { save(); render(); if (msg) toast(msg); };
  switch (action) {
    case "nav": go(value); break;
    case "new-a": editAssignment(); break;
    case "day": editAssignment(null, value + "T23:59"); break;
    case "edit-a": editAssignment(findA()); break;
    case "toggle-a": findA().status = el.checked ? "done" : "not started"; commit(el.checked && "Marked as done"); break;
    case "toggle-t": findT().done = el.checked; commit(); break;
    case "del-t": { const snap = JSON.stringify(state); state.todos = state.todos.filter(x => x.id !== key); save(); render(); toast("Task deleted", snap); break; }
    case "clear-done": { const snap = JSON.stringify(state); state.todos = state.todos.filter(x => !x.done); save(); render(); toast("Cleared completed tasks", snap); break; }
    case "new-c": editContact(); break;
    case "edit-c": editContact(findC()); break;
    case "touch-c": { const c = findC(); c.last = ymd(new Date()); commit(`Logged a catch-up with ${c.name}`); break; }
    case "cal-prev": calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); render(); break;
    case "cal-next": calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); render(); break;
    case "cal-today": calMonth = startOfMonth(new Date()); render(); break;
    case "f-status": aFilter.status = value; render(); break;
    case "f-course": aFilter.course = value; render(); break;
    case "export": exportBackup(); break;
    case "dismiss-tip": try { localStorage.setItem(TIP_KEY, "1"); } catch (err) {} render(); break;
    case "import": document.getElementById("import").click(); break;
    case "clear-sample": {
      const snap = JSON.stringify(state);
      for (const k of ["assignments", "todos", "contacts"]) state[k] = state[k].filter(x => !x.sample);
      save(); render(); toast("Sample data removed", snap);
      break;
    }
    case "theme": {
      const t = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem(THEME_KEY, t); } catch (err) {}
      render();
      break;
    }
    case "news-refresh": fetchNews(true); break;
    case "news-topic": newsTopic = value; renderNews(); break;
    case "link": break; // let mailto:/tel:/news links open normally
  }
});

document.addEventListener("input", e => {
  if (e.target.id === "c-search") { cQuery = e.target.value; render(); }
});

document.addEventListener("submit", e => {
  if (e.target.id !== "todo-form") return;
  e.preventDefault();
  const text = document.getElementById("todo-text").value.trim();
  if (!text) return;
  state.todos.push({ id: uid(), text, due: document.getElementById("todo-due").value, done: false });
  save(); render();
});

document.getElementById("import").onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const s = JSON.parse(await f.text());
    if (!s.assignments || !s.todos || !s.contacts) throw new Error("bad file");
    state = s; save(); render(); toast("Backup restored");
  } catch (err) { toast("That file isn't a valid backup"); }
  e.target.value = "";
};

state = load();
loadNewsCache();
go("home");
renderNews();
fetchNews();
setInterval(() => { if (!document.hidden) { renderNews(); fetchNews(); } }, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) fetchNews(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
