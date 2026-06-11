const STORAGE_KEY = "kappingarklart-v3-fixed";

const PERSON_COLORS = [
  { border: "#2563eb", bg: "#dbeafe", text: "#1e3a8a" },
  { border: "#16a34a", bg: "#dcfce7", text: "#14532d" },
  { border: "#d97706", bg: "#fef3c7", text: "#78350f" },
  { border: "#7c3aed", bg: "#ede9fe", text: "#4c1d95" },
  { border: "#dc2626", bg: "#fee2e2", text: "#7f1d1d" },
  { border: "#0891b2", bg: "#cffafe", text: "#164e63" },
  { border: "#be185d", bg: "#fce7f3", text: "#831843" },
  { border: "#4f46e5", bg: "#e0e7ff", text: "#312e81" }
];

const ROLE_DEFINITIONS = [
  { key: "competitionLeader", label: "Competition leader", max: 2 },
  { key: "judges", label: "Judges", max: 3 },
  { key: "jury", label: "Jury", max: 5 },
  { key: "loaders", label: "Loaders", max: 6 },
  { key: "technicalController", label: "Technical controller", max: 1 },
  { key: "doctor", label: "Doctor", max: 1 },
  { key: "marshal", label: "Marshal", max: 1 },
  { key: "speaker", label: "Speaker", max: 1 },
  { key: "weighInOfficials", label: "Weigh-in officials", max: 2 },
  { key: "secretary", label: "Secretary", max: 2 },
  { key: "timekeeper", label: "Timekeeper", max: 1 },
  { key: "dj", label: "DJ", max: 1 }
];

const defaultTemplates = [
  {
    id: "template-official",
    name: "Official kapping",
    tasks: {
      before: [
        { title: "Vátta dato og høli", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Tryggja at hølið er tøkt og at dato ikki rakar aðrar kappingar." },
        { title: "Finna dómarar", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Hav minst eina backup loysn." },
        { title: "Gera startlista", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Kanna vektbólkar, innvigan og bólkabýti." },
        { title: "Kanna útgerð", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Stong, skivur, lás, krít, klokku og teldu." }
      ],
      during: [
        { title: "Gjøgnumføra innvigan", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Skráset kropsvekt og fyrstu royndir." },
        { title: "Briefa hjálparfólk", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Dómarar, speakers, loaders og skriviborð vita sína uppgávu." },
        { title: "Halda úrslit dagførd", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Kanna at royndir og samanlagt eru rætt." }
      ],
      after: [
        { title: "Goyma og senda úrslit", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Goym PDF/Excel og send til viðkomandi persónar." },
        { title: "Rudda hølið", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Útgerð aftur á pláss, rusk burtur og hølið latið pent eftir." },
        { title: "Takki hjálparfólki og stuðlum", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Stutt boð ella postur á sosialum miðlum." }
      ]
    }
  }
];

let state = loadState();
let activeView = "dashboard";
let activeTemplateId = state.templates?.[0]?.id || null;
let activeCompetitionId = null;
let activeFilter = "all";
let activeResponsibleFilter = "all";
let draftPeople = [];
let editingTask = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function makeEmptyRoles() {
  const roles = {};
  ROLE_DEFINITIONS.forEach(role => {
    roles[role.key] = Array(role.max).fill("");
  });
  return roles;
}

function cloneTasks(tasks) {
  const cloned = { before: [], during: [], after: [] };
  ["before", "during", "after"].forEach(phase => {
    cloned[phase] = (tasks?.[phase] || []).map(task => ({
      id: makeId(),
      phase,
      title: task.title || "",
      responsible: task.responsible || "",
      hasDeadline: Boolean(task.hasDeadline && task.deadlineDate),
      deadlineDate: task.deadlineDate || "",
      deadlineTime: task.deadlineTime || "",
      note: task.note || "",
      done: false
    }));
  });
  return cloned;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    sidebarCollapsed: false,
    templates: defaultTemplates,
    competitions: [
      {
        id: makeId(),
        name: "Skansi Cup 2026",
        date: "2026-09-12",
        venue: "Tvørmegi",
        password: "stoyt2026",
        people: ["Pól", "Jens", "Herborg", "Niels Áki"],
        roles: {
          ...makeEmptyRoles(),
          competitionLeader: ["Pól", ""],
          speaker: ["Herborg"]
        },
        tasks: cloneTasks(defaultTemplates[0].tasks)
      }
    ]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState() {
  state.sidebarCollapsed = Boolean(state.sidebarCollapsed);
  state.templates ||= [];
  state.competitions ||= [];

  state.templates.forEach(template => {
    template.tasks ||= { before: [], during: [], after: [] };
    ["before", "during", "after"].forEach(phase => {
      template.tasks[phase] ||= [];
      template.tasks[phase].forEach(task => {
        task.responsible ||= "";
        task.hasDeadline = Boolean(task.hasDeadline && task.deadlineDate);
        task.deadlineDate ||= "";
        task.deadlineTime ||= "";
        task.note ||= "";
      });
    });
  });

  state.competitions.forEach(competition => {
    competition.people ||= [];
    competition.roles ||= makeEmptyRoles();
    ROLE_DEFINITIONS.forEach(role => {
      if (!Array.isArray(competition.roles[role.key])) competition.roles[role.key] = [];
      while (competition.roles[role.key].length < role.max) competition.roles[role.key].push("");
      competition.roles[role.key] = competition.roles[role.key].slice(0, role.max);
    });

    competition.tasks ||= { before: [], during: [], after: [] };
    ["before", "during", "after"].forEach(phase => {
      competition.tasks[phase] ||= [];
      competition.tasks[phase].forEach(task => {
        task.id ||= makeId();
        task.phase ||= phase;
        task.responsible ||= "";
        task.hasDeadline = Boolean(task.hasDeadline && task.deadlineDate);
        task.deadlineDate ||= "";
        task.deadlineTime ||= "";
        task.note ||= "";
        task.done = Boolean(task.done);
      });
    });
  });
}

function getAllTasks(competition) {
  return [
    ...(competition.tasks.before || []),
    ...(competition.tasks.during || []),
    ...(competition.tasks.after || [])
  ];
}

function getProgress(competition) {
  const tasks = getAllTasks(competition);
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter(task => task.done).length / tasks.length) * 100);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(value) {
  if (!value) return "Eingin dato";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fo-FO", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatDeadline(task) {
  if (!task.deadlineDate) return "";
  const dateText = formatDate(task.deadlineDate);
  return task.deadlineTime ? `${dateText} kl. ${task.deadlineTime}` : dateText;
}

function getPersonColor(competition, person) {
  const index = (competition.people || []).indexOf(person);
  return PERSON_COLORS[index >= 0 ? index % PERSON_COLORS.length : 0];
}

function personPillHTML(competition, person, removable = false, index = null) {
  const color = getPersonColor(competition, person);
  return `<span class="person-pill person-color-pill" style="--person-color:${color.border};--person-bg:${color.bg};--person-text:${color.text};">${escapeHTML(person)}${removable ? ` <button type="button" data-remove-person="${index}">×</button>` : ""}</span>`;
}

function getActiveCompetition() {
  return state.competitions.find(item => item.id === activeCompetitionId) || null;
}

function applySidebarState() {
  $("#appShell").classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
}

function closeMobileMenu() {
  $("#appShell").classList.remove("mobile-menu-open");
  $("#mobileMenuButton").setAttribute("aria-expanded", "false");
}

function setView(viewName) {
  activeView = viewName;
  Object.entries({ dashboard: $("#dashboardView"), templates: $("#templatesView"), checklist: $("#checklistView") }).forEach(([name, view]) => {
    view.classList.toggle("active-view", name === viewName);
  });
  $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === viewName));
  closeMobileMenu();
  render();
}

function render() {
  applySidebarState();
  renderDashboard();
  renderTemplateList();
  renderTemplateEditor();
  renderCompetitionSelect();
  renderChecklist();
}

function renderDashboard() {
  const competitionGrid = $("#competitionGrid");
  competitionGrid.innerHTML = "";

  state.competitions.forEach(competition => {
    const progress = getProgress(competition);
    const card = document.createElement("article");
    card.className = "competition-card";
    card.innerHTML = `
      <div class="card-top">
        <div><h3>${escapeHTML(competition.name)}</h3><p class="card-meta">${formatDate(competition.date)} · ${escapeHTML(competition.venue || "Einki stað ásett")}</p></div>
        <span class="status-badge">${progress === 100 ? "Klárt" : "Í gongd"}</span>
      </div>
      <div class="mini-progress"><strong>${progress}% liðugt</strong><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
      <button class="secondary-btn" type="button">Opna checklist</button>
    `;
    card.addEventListener("click", () => {
      activeCompetitionId = competition.id;
      activeResponsibleFilter = "all";
      setView("checklist");
    });
    competitionGrid.appendChild(card);
  });
}

function renderTemplateList() {
  const templateList = $("#templateList");
  templateList.innerHTML = "";

  state.templates.forEach(template => {
    const button = document.createElement("button");
    button.className = "list-item";
    button.type = "button";
    button.textContent = template.name || "Ónevndur template";
    button.classList.toggle("active", template.id === activeTemplateId);
    button.addEventListener("click", () => {
      activeTemplateId = template.id;
      renderTemplateList();
      renderTemplateEditor();
    });
    templateList.appendChild(button);
  });
}

function renderTemplateEditor() {
  const templateEditor = $("#templateEditor");
  const template = state.templates.find(item => item.id === activeTemplateId);

  if (!template) {
    templateEditor.className = "panel editor-panel empty-panel";
    templateEditor.innerHTML = `<div class="empty-message"><h3>Vel ein template</h3><p>Vel ein template til vinstru, ella stovna ein nýggjan.</p></div>`;
    return;
  }

  templateEditor.className = "panel editor-panel";
  templateEditor.innerHTML = `
    <div class="editor-top"><label>Template navn<input id="templateNameInput" value="${escapeHTML(template.name)}" /></label><p class="page-description">Hetta er template-mode. Her byggir tú listan, men uppgávurnar verða fyrst merktar lidnar inni á sjálvari kappingini.</p></div>
    <div class="editor-grid">${renderTemplateSection("before", "Áðrenn kapping", template)}${renderTemplateSection("during", "Undir kapping", template)}${renderTemplateSection("after", "Eftir kapping", template)}</div>
  `;

  $("#templateNameInput").addEventListener("input", event => {
    template.name = event.target.value;
    saveState();
    renderTemplateList();
    renderCompetitionSelect();
  });

  templateEditor.querySelectorAll("[data-add-task]").forEach(button => {
    button.addEventListener("click", () => {
      const phase = button.dataset.addTask;
      template.tasks[phase].push({ title: "Nýggj uppgáva", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "" });
      saveState();
      renderTemplateEditor();
    });
  });

  templateEditor.querySelectorAll("[data-task-field]").forEach(input => {
    input.addEventListener("input", () => {
      template.tasks[input.dataset.phase][Number(input.dataset.index)][input.dataset.taskField] = input.value;
      saveState();
    });
  });

  templateEditor.querySelectorAll("[data-delete-task]").forEach(button => {
    button.addEventListener("click", () => {
      template.tasks[button.dataset.phase].splice(Number(button.dataset.index), 1);
      saveState();
      renderTemplateEditor();
    });
  });
}

function renderTemplateSection(phase, title, template) {
  const tasks = template.tasks[phase] || [];
  return `
    <section class="template-section"><h3>${title}</h3>
      <div class="template-grid-header"><span>Uppgáva</span><span>Ábyrgd / leiklutur</span><span>Freist</span><span>Viðmerking</span><span></span></div>
      ${tasks.map((task, index) => `
        <div class="template-task">
          <input data-task-field="title" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.title)}" placeholder="Navn á uppgávu" />
          <input data-task-field="responsible" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.responsible || "")}" placeholder="Hvør er ábyrgdari?" />
          <input data-task-field="deadlineDate" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.deadlineDate || "")}" placeholder="Freist, valfrítt" />
          <input data-task-field="note" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.note || "")}" placeholder="Viðmerking" />
          <button class="delete-small" data-delete-task data-phase="${phase}" data-index="${index}" type="button">×</button>
        </div>`).join("")}
      <button class="secondary-btn" data-add-task="${phase}" type="button">+ Legg afturat</button>
    </section>`;
}

function renderCompetitionSelect() {
  const competitionTemplate = $("#competitionTemplate");
  competitionTemplate.innerHTML = "";
  state.templates.forEach(template => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    competitionTemplate.appendChild(option);
  });
}

function renderPeopleDraft() {
  const personList = $("#personList");
  personList.innerHTML = "";
  draftPeople.forEach((person, index) => {
    const color = PERSON_COLORS[index % PERSON_COLORS.length];
    const pill = document.createElement("span");
    pill.className = "person-pill person-color-pill";
    pill.style.setProperty("--person-color", color.border);
    pill.style.setProperty("--person-bg", color.bg);
    pill.style.setProperty("--person-text", color.text);
    pill.innerHTML = `${escapeHTML(person)} <button type="button">×</button>`;
    pill.querySelector("button").addEventListener("click", () => {
      draftPeople.splice(index, 1);
      renderPeopleDraft();
    });
    personList.appendChild(pill);
  });
}

function getResponsibleOptions(competition) {
  const names = new Set(competition.people || []);
  getAllTasks(competition).forEach(task => {
    if (task.responsible) names.add(task.responsible);
  });
  return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b, "fo"));
}

function renderResponsibleFilter(competition) {
  const select = $("#responsibleFilter");
  const people = getResponsibleOptions(competition);
  if (activeResponsibleFilter !== "all" && !people.includes(activeResponsibleFilter)) {
    activeResponsibleFilter = "all";
  }
  select.innerHTML = `<option value="all">Allir persónar</option>${people.map(person => `<option value="${escapeHTML(person)}">${escapeHTML(person)}</option>`).join("")}`;
  select.value = activeResponsibleFilter;
}

function renderChecklist() {
  if (activeView !== "checklist") return;
  const competition = getActiveCompetition();
  if (!competition) return;

  $("#checklistTitle").textContent = competition.name;
  $("#checklistMeta").textContent = `${formatDate(competition.date)} · ${competition.venue || "Einki stað ásett"} · Lykilorð: ${competition.password || "einki"}`;
  renderRolesSummary(competition);
  renderResponsibleFilter(competition);

  const progress = getProgress(competition);
  $("#progressLabel").textContent = `${progress}% liðugt`;
  $("#progressFill").style.width = `${progress}%`;

  ["before", "during", "after"].forEach(phase => renderPhaseTasks(phase, competition));

  $$(".phase-column").forEach(column => {
    const shouldShow = activeFilter === "all" || activeFilter === "todo" || column.dataset.phase === activeFilter;
    column.style.display = shouldShow ? "" : "none";
  });
}

function renderRolesSummary(competition) {
  const filledRoles = ROLE_DEFINITIONS
    .map(role => ({ ...role, names: (competition.roles?.[role.key] || []).filter(name => name.trim()) }))
    .filter(role => role.names.length > 0);

  $("#rolesSummary").innerHTML = filledRoles.length
    ? filledRoles.map(role => `<div class="role-summary-row"><div class="role-label">${role.label}</div><div class="role-names">${role.names.map(name => `<span class="person-pill">${escapeHTML(name)}</span>`).join("")}</div></div>`).join("")
    : `<p class="roles-empty">Ongir kappingarleiklutur eru ásettir enn.</p>`;
}

function taskMatchesFilters(task) {
  if (activeFilter === "todo" && task.done) return false;
  if (activeResponsibleFilter !== "all" && task.responsible !== activeResponsibleFilter) return false;
  return true;
}

function renderPhaseTasks(phase, competition) {
  const container = $(`#${phase}Tasks`);
  container.innerHTML = "";
  const tasks = (competition.tasks[phase] || []).filter(taskMatchesFilters);

  if (tasks.length === 0) {
    container.innerHTML = `<div class="empty-task-message">Ongar uppgávur at vísa.</div>`;
    return;
  }

  tasks.forEach(task => {
    const responsiblePill = task.responsible ? personPillHTML(competition, task.responsible) : "";
    const card = document.createElement("article");
    card.className = `task-card ${task.done ? "done" : ""}`;
    card.innerHTML = `
      <label class="task-check"><input type="checkbox" ${task.done ? "checked" : ""} /></label>
      <div class="task-content"><h4>${escapeHTML(task.title)}</h4><div class="task-meta">${task.done ? `<span class="pill done">Liðugt</span>` : ""}${responsiblePill}${task.hasDeadline && task.deadlineDate ? `<span class="pill deadline">Freist: ${formatDeadline(task)}</span>` : ""}</div>${task.note ? `<p class="task-note">${escapeHTML(task.note)}</p>` : ""}</div>
      <button class="edit-task-btn" title="Redigera" type="button">✎</button>`;

    card.querySelector("input[type='checkbox']").addEventListener("change", event => {
      task.done = event.target.checked;
      saveState();
      renderDashboard();
      renderChecklist();
    });
    card.querySelector(".edit-task-btn").addEventListener("click", event => {
      event.stopPropagation();
      openTaskEditor(competition.id, phase, task.id);
    });
    container.appendChild(card);
  });
}

function openTaskEditor(competitionId, phase, taskId) {
  const competition = state.competitions.find(item => item.id === competitionId);
  const task = competition.tasks[phase].find(item => item.id === taskId);
  editingTask = { competitionId, phase, taskId };

  $("#editTaskTitle").value = task.title;
  $("#editTaskNote").value = task.note || "";
  $("#editTaskHasDeadline").checked = Boolean(task.hasDeadline);
  $("#editTaskDeadlineDate").value = task.deadlineDate || "";
  $("#editTaskDeadlineTime").value = task.deadlineTime || "";
  $("#deadlineFields").classList.toggle("hidden", !$("#editTaskHasDeadline").checked);

  const select = $("#editTaskResponsible");
  select.innerHTML = `<option value="">Vel ábyrgdarpersón</option>`;
  getResponsibleOptions(competition).forEach(person => {
    const option = document.createElement("option");
    option.value = person;
    option.textContent = person;
    select.appendChild(option);
  });
  select.value = task.responsible || "";
  $("#taskEditModal").showModal();
}

function getEditingTask() {
  if (!editingTask) return null;
  const competition = state.competitions.find(item => item.id === editingTask.competitionId);
  const task = competition?.tasks?.[editingTask.phase]?.find(item => item.id === editingTask.taskId);
  return competition && task ? { competition, task } : null;
}

function addTaskToCompetition(phase) {
  const competition = getActiveCompetition();
  if (!competition) return;
  const task = { id: makeId(), phase, title: "Nýggj uppgáva", responsible: "", hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "", done: false };
  competition.tasks[phase].push(task);
  saveState();
  renderChecklist();
  openTaskEditor(competition.id, phase, task.id);
}

function openRolesEditor() {
  const competition = getActiveCompetition();
  if (!competition) return;
  $("#rolesEditor").innerHTML = ROLE_DEFINITIONS.map(role => {
    const values = competition.roles[role.key] || Array(role.max).fill("");
    return `<section class="role-editor-card"><div class="role-editor-heading"><strong>${role.label}</strong><span>Max ${role.max}</span></div><div class="role-inputs">${Array.from({ length: role.max }).map((_, index) => `<input data-role-key="${role.key}" data-role-index="${index}" value="${escapeHTML(values[index] || "")}" placeholder="Navn ${index + 1}" />`).join("")}</div></section>`;
  }).join("");
  $("#rolesModal").showModal();
}

function saveRolesFromEditor() {
  const competition = getActiveCompetition();
  if (!competition) return;
  ROLE_DEFINITIONS.forEach(role => competition.roles[role.key] = Array(role.max).fill(""));
  $("#rolesEditor").querySelectorAll("[data-role-key]").forEach(input => {
    competition.roles[input.dataset.roleKey][Number(input.dataset.roleIndex)] = input.value.trim();
  });
  saveState();
  renderChecklist();
}

normalizeState();

$("#toggleSidebar").addEventListener("click", () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  saveState();
  applySidebarState();
});

$("#mobileMenuButton").addEventListener("click", () => {
  const isOpen = $("#appShell").classList.toggle("mobile-menu-open");
  $("#mobileMenuButton").setAttribute("aria-expanded", String(isOpen));
});

$$(".nav-link").forEach(link => link.addEventListener("click", () => setView(link.dataset.view)));

$("#openCreateCompetition").addEventListener("click", () => {
  draftPeople = [];
  $("#personNameInput").value = "";
  renderPeopleDraft();
  $("#createCompetitionModal").showModal();
});

$("#closeCompetitionModal").addEventListener("click", () => $("#createCompetitionModal").close());
$("#backToDashboard").addEventListener("click", () => setView("dashboard"));

$("#addPersonBtn").addEventListener("click", () => {
  const input = $("#personNameInput");
  const name = input.value.trim();
  if (!name || draftPeople.includes(name)) return;
  draftPeople.push(name);
  input.value = "";
  renderPeopleDraft();
});

$("#personNameInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("#addPersonBtn").click();
  }
});

$("#competitionForm").addEventListener("submit", event => {
  event.preventDefault();
  const template = state.templates.find(item => item.id === $("#competitionTemplate").value);
  if (!template) return;
  const competition = {
    id: makeId(),
    name: $("#competitionName").value,
    date: $("#competitionDate").value,
    venue: $("#competitionVenue").value,
    password: $("#competitionPassword").value,
    people: [...draftPeople],
    roles: makeEmptyRoles(),
    tasks: cloneTasks(template.tasks)
  };
  state.competitions.push(competition);
  activeCompetitionId = competition.id;
  activeResponsibleFilter = "all";
  saveState();
  $("#competitionForm").reset();
  draftPeople = [];
  renderPeopleDraft();
  $("#createCompetitionModal").close();
  setView("checklist");
});

$("#createTemplateBtn").addEventListener("click", () => {
  const template = { id: makeId(), name: "Nýggjur template", tasks: { before: [], during: [], after: [] } };
  state.templates.push(template);
  activeTemplateId = template.id;
  saveState();
  setView("templates");
});

$$(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    $$(".filter-btn").forEach(item => item.classList.toggle("active", item === button));
    renderChecklist();
  });
});

$("#responsibleFilter").addEventListener("change", event => {
  activeResponsibleFilter = event.target.value || "all";
  renderChecklist();
});

$$(".add-phase-task").forEach(button => button.addEventListener("click", () => addTaskToCompetition(button.dataset.phase)));

$("#editRolesBtn").addEventListener("click", openRolesEditor);
$("#closeRolesModal").addEventListener("click", () => $("#rolesModal").close());
$("#rolesForm").addEventListener("submit", event => {
  event.preventDefault();
  saveRolesFromEditor();
  $("#rolesModal").close();
});

$("#closeTaskEditModal").addEventListener("click", () => $("#taskEditModal").close());
$("#editTaskHasDeadline").addEventListener("change", event => {
  $("#deadlineFields").classList.toggle("hidden", !event.target.checked);
});

$("#taskEditForm").addEventListener("submit", event => {
  event.preventDefault();
  const current = getEditingTask();
  if (!current) return;
  current.task.title = $("#editTaskTitle").value.trim();
  current.task.responsible = $("#editTaskResponsible").value;
  current.task.hasDeadline = $("#editTaskHasDeadline").checked;
  current.task.deadlineDate = current.task.hasDeadline ? $("#editTaskDeadlineDate").value : "";
  current.task.deadlineTime = current.task.hasDeadline ? $("#editTaskDeadlineTime").value : "";
  current.task.note = $("#editTaskNote").value.trim();
  saveState();
  $("#taskEditModal").close();
  renderChecklist();
});

$("#deleteTaskBtn").addEventListener("click", () => {
  const current = getEditingTask();
  if (!current) return;
  current.competition.tasks[editingTask.phase] = current.competition.tasks[editingTask.phase].filter(task => task.id !== editingTask.taskId);
  saveState();
  $("#taskEditModal").close();
  renderChecklist();
});

render();
