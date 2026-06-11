const STORAGE_KEY = "kappingarklart-v3.5";

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
        { title: "Vátta dato og høli", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Tryggja at hølið er tøkt og at dato ikki rakar aðrar kappingar." },
        { title: "Finna dómarar", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Hav minst eina backup loysn." },
        { title: "Gera startlista", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Kanna vektbólkar, innvigan og bólkabýti." },
        { title: "Kanna útgerð", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Stong, skivur, lás, krít, klokku og teldu." }
      ],
      during: [
        { title: "Gjøgnumføra innvigan", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Skráset kropsvekt og fyrstu royndir." },
        { title: "Briefa hjálparfólk", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Dómarar, speakers, loaders og skriviborð vita sína uppgávu." },
        { title: "Halda úrslit dagførd", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Kanna at royndir og samanlagt eru rætt." }
      ],
      after: [
        { title: "Goyma og senda úrslit", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Goym PDF/Excel og send til viðkomandi persónar." },
        { title: "Rudda hølið", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Útgerð aftur á pláss, rusk burtur og hølið latið pent eftir." },
        { title: "Takki hjálparfólki og stuðlum", responsible: "", responsibles: [], hasDeadline: false, deadlineDate: "", deadlineTime: "", note: "Stutt boð ella postur á sosialum miðlum." }
      ]
    }
  }
];

let state = loadState();
let activeView = "dashboard";
let activeTemplateId = state.templates[0]?.id || null;
let activeCompetitionId = null;
let activeFilter = "all";
let activeResponsibleFilter = "all";
let mobileMenuOpen = false;
let draftPeople = [];
let editingTask = null;
let editingCompetitionId = null;
let editDraftPeople = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const appShell = $("#appShell");
const navLinks = $$(".nav-link");
const filterButtons = $$(".filter-btn");
const views = {
  dashboard: $("#dashboardView"),
  templates: $("#templatesView"),
  checklist: $("#checklistView")
};

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

function taskResponsibles(task) {
  if (Array.isArray(task.responsibles)) return task.responsibles.filter(Boolean);
  if (task.responsible) return [task.responsible];
  return [];
}

function cloneTasks(tasks) {
  const cloned = { before: [], during: [], after: [] };

  ["before", "during", "after"].forEach(phase => {
    cloned[phase] = (tasks[phase] || []).map(task => ({
      id: makeId(),
      phase,
      title: task.title || "",
      responsible: task.responsible || "",
      responsibles: taskResponsibles(task),
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
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

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
        task.responsibles = taskResponsibles(task);
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
      if (!Array.isArray(competition.roles[role.key])) {
        competition.roles[role.key] = Array(role.max).fill("");
      }
      while (competition.roles[role.key].length < role.max) {
        competition.roles[role.key].push("");
      }
      competition.roles[role.key] = competition.roles[role.key].slice(0, role.max);
    });

    competition.tasks ||= { before: [], during: [], after: [] };
    ["before", "during", "after"].forEach(phase => {
      competition.tasks[phase] ||= [];
      competition.tasks[phase].forEach(task => {
        task.id ||= makeId();
        task.phase ||= phase;
        task.responsible ||= "";
        task.responsibles = taskResponsibles(task);
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
  return new Intl.DateTimeFormat("fo-FO", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
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

function colorStyle(competition, person) {
  const color = getPersonColor(competition, person);
  return `--person-color:${color.border};--person-bg:${color.bg};--person-text:${color.text};`;
}

function personPillHTML(competition, person) {
  return `<span class="person-pill person-color-pill" style="${colorStyle(competition, person)}">${escapeHTML(person)}</span>`;
}

function applySidebarState() {
  appShell.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  appShell.classList.toggle("mobile-menu-open", mobileMenuOpen);
  $("#mobileMenuToggle")?.setAttribute("aria-expanded", mobileMenuOpen ? "true" : "false");
}

function setView(viewName) {
  activeView = viewName;
  mobileMenuOpen = false;
  applySidebarState();

  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle("active-view", name === viewName);
  });

  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });

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
        <div>
          <h3>${escapeHTML(competition.name)}</h3>
          <p class="card-meta">${formatDate(competition.date)} · ${escapeHTML(competition.venue || "Einki stað ásett")}</p>
        </div>
        <span class="status-badge">${progress === 100 ? "Klárt" : "Í gongd"}</span>
      </div>

      <div class="mini-progress">
        <strong>${progress}% liðugt</strong>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>

      <div class="competition-actions">
        <button class="secondary-btn" data-open-competition>Opna checklist</button>
        <button class="icon-action-btn" data-edit-competition title="Redigera kapping">✎</button>
        <button class="icon-action-btn danger" data-delete-competition title="Strika kapping">×</button>
      </div>
    `;

    const openCompetition = () => {
      activeCompetitionId = competition.id;
      activeResponsibleFilter = "all";
      setView("checklist");
    };

    card.addEventListener("click", openCompetition);

    card.querySelector("[data-open-competition]").addEventListener("click", event => {
      event.stopPropagation();
      openCompetition();
    });

    card.querySelector("[data-edit-competition]").addEventListener("click", event => {
      event.stopPropagation();
      openCompetitionEditor(competition.id);
    });

    card.querySelector("[data-delete-competition]").addEventListener("click", event => {
      event.stopPropagation();
      deleteCompetitionWithConfirmation(competition.id);
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
    button.textContent = template.name || "Ónevndur template";

    if (template.id === activeTemplateId) button.classList.add("active");

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
    templateEditor.innerHTML = `
      <div class="empty-message">
        <h3>Vel ein template</h3>
        <p>Vel ein template til vinstru, ella stovna ein nýggjan.</p>
      </div>
    `;
    return;
  }

  templateEditor.className = "panel editor-panel";
  templateEditor.innerHTML = `
    <div class="editor-top">
      <label>
        Template navn
        <input id="templateNameInput" value="${escapeHTML(template.name)}" />
      </label>
      <p class="page-description">Hetta er template-mode. Her byggir tú listan, men uppgávurnar verða fyrst merktar lidnar inni á sjálvari kappingini.</p>
    </div>

    <div class="template-editor-actions">
      <button id="deleteTemplateBtn" class="danger-btn" type="button" ${state.templates.length <= 1 ? "disabled" : ""}>Strika template</button>
    </div>

    <div class="editor-grid">
      ${renderTemplateSection("before", "Áðrenn kapping", template)}
      ${renderTemplateSection("during", "Undir kapping", template)}
      ${renderTemplateSection("after", "Eftir kapping", template)}
    </div>
  `;

  $("#templateNameInput").addEventListener("input", event => {
    template.name = event.target.value;
    saveState();
    renderTemplateList();
    renderCompetitionSelect();
  });

  $("#deleteTemplateBtn")?.addEventListener("click", () => {
    deleteTemplateWithConfirmation(template.id);
  });

  templateEditor.querySelectorAll("[data-add-task]").forEach(button => {
    button.addEventListener("click", () => {
      const phase = button.dataset.addTask;
      template.tasks[phase].push({
        title: "Nýggj uppgáva",
        responsible: "",
        responsibles: [],
        hasDeadline: false,
        deadlineDate: "",
        deadlineTime: "",
        note: ""
      });
      saveState();
      renderTemplateEditor();
    });
  });

  templateEditor.querySelectorAll("[data-task-field]").forEach(input => {
    input.addEventListener("input", () => {
      const phase = input.dataset.phase;
      const index = Number(input.dataset.index);
      const field = input.dataset.taskField;
      template.tasks[phase][index][field] = input.value;
      saveState();
    });
  });

  templateEditor.querySelectorAll("[data-delete-task]").forEach(button => {
    button.addEventListener("click", () => {
      const phase = button.dataset.phase;
      const index = Number(button.dataset.index);
      template.tasks[phase].splice(index, 1);
      saveState();
      renderTemplateEditor();
    });
  });
}

function renderTemplateSection(phase, title, template) {
  const tasks = template.tasks[phase];

  return `
    <section class="template-section">
      <h3>${title}</h3>

      <div class="template-grid-header">
        <span>Uppgáva</span>
        <span>Ábyrgd / leiklutur</span>
        <span>Freist</span>
        <span>Viðmerking</span>
        <span></span>
      </div>

      ${tasks.map((task, index) => `
        <div class="template-task">
          <input data-task-field="title" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.title)}" placeholder="Navn á uppgávu" />
          <input data-task-field="responsible" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.responsible || "")}" placeholder="Hvør er ábyrgdari?" />
          <input data-task-field="deadlineDate" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.deadlineDate || "")}" placeholder="Freist, valfrítt" />
          <input data-task-field="note" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.note || "")}" placeholder="Viðmerking" />
          <button class="delete-small" data-delete-task data-phase="${phase}" data-index="${index}">×</button>
        </div>
      `).join("")}
      <button class="secondary-btn" data-add-task="${phase}" type="button">+ Legg afturat</button>
    </section>
  `;
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


function renderEditPeopleDraft() {
  const personList = $("#editPersonList");
  personList.innerHTML = "";

  editDraftPeople.forEach((person, index) => {
    const color = PERSON_COLORS[index % PERSON_COLORS.length];
    const pill = document.createElement("span");
    pill.className = "person-pill person-color-pill";
    pill.style.setProperty("--person-color", color.border);
    pill.style.setProperty("--person-bg", color.bg);
    pill.style.setProperty("--person-text", color.text);
    pill.innerHTML = `${escapeHTML(person)} <button type="button">×</button>`;

    pill.querySelector("button").addEventListener("click", () => {
      editDraftPeople.splice(index, 1);
      renderEditPeopleDraft();
    });

    personList.appendChild(pill);
  });
}

function openCompetitionEditor(competitionId) {
  const competition = state.competitions.find(item => item.id === competitionId);
  if (!competition) return;

  editingCompetitionId = competitionId;
  editDraftPeople = [...(competition.people || [])];

  $("#editCompetitionName").value = competition.name || "";
  $("#editCompetitionDate").value = competition.date || "";
  $("#editCompetitionVenue").value = competition.venue || "";
  $("#editCompetitionPassword").value = competition.password || "";
  $("#editPersonNameInput").value = "";

  renderEditPeopleDraft();
  $("#editCompetitionModal").showModal();
}

function deleteCompetitionWithConfirmation(competitionId) {
  const competition = state.competitions.find(item => item.id === competitionId);
  if (!competition) return;

  const confirmed = window.confirm(`Vilt tú strika kappingina "${competition.name}"?`);
  if (!confirmed) return;

  state.competitions = state.competitions.filter(item => item.id !== competitionId);

  if (activeCompetitionId === competitionId) {
    activeCompetitionId = null;
    activeView = "dashboard";
  }

  saveState();
  setView("dashboard");
}

function deleteTemplateWithConfirmation(templateId) {
  if (state.templates.length <= 1) {
    window.alert("Tað ber ikki til at strika síðsta template.");
    return;
  }

  const template = state.templates.find(item => item.id === templateId);
  if (!template) return;

  const confirmed = window.confirm(`Vilt tú strika template "${template.name}"?`);
  if (!confirmed) return;

  state.templates = state.templates.filter(item => item.id !== templateId);
  activeTemplateId = state.templates[0]?.id || null;

  saveState();
  render();
}

function renderChecklist() {
  if (activeView !== "checklist") return;

  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  $("#checklistTitle").textContent = competition.name;
  $("#checklistMeta").textContent = `${formatDate(competition.date)} · ${competition.venue || "Einki stað ásett"} · Lykilorð: ${competition.password || "einki"}`;

  renderRolesSummary(competition);
  renderResponsibleFilter(competition);

  const progress = getProgress(competition);
  $("#progressLabel").textContent = `${progress}% liðugt`;
  $("#progressFill").style.width = `${progress}%`;

  renderPhaseTasks("before", competition);
  renderPhaseTasks("during", competition);
  renderPhaseTasks("after", competition);

  $$(".phase-column").forEach(column => {
    const shouldShow =
      activeFilter === "all" ||
      activeFilter === "todo" ||
      column.dataset.phase === activeFilter;

    column.style.display = shouldShow ? "" : "none";
  });
}


function renderResponsibleFilter(competition) {
  const select = $("#responsibleFilter");
  if (!select) return;

  const previousValue = activeResponsibleFilter;
  const people = competition.people || [];

  select.innerHTML = `
    <option value="all">Allir persónar</option>
    ${people.map(person => `<option value="${escapeHTML(person)}">${escapeHTML(person)}</option>`).join("")}
  `;

  if (previousValue !== "all" && people.includes(previousValue)) {
    select.value = previousValue;
  } else {
    activeResponsibleFilter = "all";
    select.value = "all";
  }
}

function renderRolesSummary(competition) {
  const rolesSummary = $("#rolesSummary");

  const filledRoles = ROLE_DEFINITIONS
    .map(role => ({
      ...role,
      names: (competition.roles?.[role.key] || []).filter(name => name.trim())
    }))
    .filter(role => role.names.length > 0);

  rolesSummary.classList.add("compact");

  if (filledRoles.length === 0) {
    rolesSummary.innerHTML = `<p class="roles-empty">Ongir kappingarleiklutur eru ásettir enn.</p>`;
    return;
  }

  rolesSummary.innerHTML = filledRoles.map(role => `
    <div class="role-compact-chip">
      <span class="role-compact-label">${role.label}:</span>
      <span class="role-compact-names">${role.names.map(escapeHTML).join(", ")}</span>
    </div>
  `).join("");
}

function renderPhaseTasks(phase, competition) {
  const container = $(`#${phase}Tasks`);
  container.innerHTML = "";

  const tasks = competition.tasks[phase].filter(task => {
    const matchesStatus = activeFilter === "todo" ? !task.done : true;
    const matchesResponsible =
      activeResponsibleFilter === "all" ||
      taskResponsibles(task).includes(activeResponsibleFilter);

    return matchesStatus && matchesResponsible;
  });

  tasks.forEach(task => {
    const responsiblePills = taskResponsibles(task)
      .map(person => personPillHTML(competition, person))
      .join("");

    const card = document.createElement("article");
    card.className = `task-card ${task.done ? "done" : ""}`;

    card.innerHTML = `
      <label class="task-check" title="Merk sum liðugt">
        <input type="checkbox" ${task.done ? "checked" : ""} />
      </label>

      <div class="task-content">
        <h4>${escapeHTML(task.title)}</h4>
        <div class="task-meta">
          
          ${responsiblePills}
          ${task.hasDeadline && task.deadlineDate ? `<span class="pill deadline">Freist: ${formatDeadline(task)}</span>` : ""}
        </div>
        ${task.note ? `<p class="task-note">${escapeHTML(task.note)}</p>` : ""}
      </div>

      <div class="task-actions">
        <button class="delete-task-btn" title="Strika uppgávu">×</button>
      </div>
    `;

    card.addEventListener("click", () => {
      openTaskEditor(competition.id, phase, task.id);
    });

    card.querySelector("input[type='checkbox']").addEventListener("click", event => {
      event.stopPropagation();
    });

    card.querySelector("input[type='checkbox']").addEventListener("change", event => {
      task.done = event.target.checked;
      saveState();
      renderDashboard();
      renderChecklist();
    });

    card.querySelector(".delete-task-btn").addEventListener("click", event => {
      event.stopPropagation();
      deleteTaskWithConfirmation(competition.id, phase, task.id);
    });

    container.appendChild(card);
  });
}

function deleteTaskWithConfirmation(competitionId, phase, taskId) {
  const competition = state.competitions.find(item => item.id === competitionId);
  if (!competition) return;

  const task = competition.tasks[phase].find(item => item.id === taskId);
  if (!task) return;

  const confirmed = window.confirm(`Vilt tú strika uppgávuna "${task.title}"?`);
  if (!confirmed) return;

  competition.tasks[phase] = competition.tasks[phase].filter(item => item.id !== taskId);
  saveState();
  renderDashboard();
  renderChecklist();
}

function renderResponsibleChoices(competition, task) {
  const container = $("#editTaskResponsibleList");
  const selected = new Set(taskResponsibles(task));

  if (!competition.people || competition.people.length === 0) {
    container.innerHTML = `<p class="roles-empty">Ongir ábyrgdarpersónar eru lagdir afturat hesi kappingini.</p>`;
    return;
  }

  container.innerHTML = competition.people.map(person => {
    const checked = selected.has(person) ? "checked" : "";
    return `
      <label class="responsible-choice" style="${colorStyle(competition, person)}">
        <input type="checkbox" value="${escapeHTML(person)}" ${checked} />
        <span>${escapeHTML(person)}</span>
      </label>
    `;
  }).join("");
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

  renderResponsibleChoices(competition, task);

  $("#taskEditModal").showModal();
}

function getEditingTask() {
  if (!editingTask) return null;
  const competition = state.competitions.find(item => item.id === editingTask.competitionId);
  const task = competition.tasks[editingTask.phase].find(item => item.id === editingTask.taskId);
  return { competition, task };
}

function addTaskToCompetition(phase) {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const task = {
    id: makeId(),
    phase,
    title: "Nýggj uppgáva",
    responsible: "",
    responsibles: [],
    hasDeadline: false,
    deadlineDate: "",
    deadlineTime: "",
    note: "",
    done: false
  };

  competition.tasks[phase].push(task);
  saveState();
  renderChecklist();
  openTaskEditor(competition.id, phase, task.id);
}

function openRolesEditor() {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const rolesEditor = $("#rolesEditor");
  rolesEditor.innerHTML = ROLE_DEFINITIONS.map(role => {
    const values = competition.roles[role.key] || Array(role.max).fill("");
    return `
      <section class="role-editor-card">
        <div class="role-editor-heading">
          <strong>${role.label}</strong>
          <span>Max ${role.max}</span>
        </div>
        <div class="role-inputs">
          ${Array.from({ length: role.max }).map((_, index) => `
            <input
              data-role-key="${role.key}"
              data-role-index="${index}"
              value="${escapeHTML(values[index] || "")}"
              placeholder="Navn ${index + 1}"
            />
          `).join("")}
        </div>
      </section>
    `;
  }).join("");

  $("#rolesModal").showModal();
}

function saveRolesFromEditor() {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  ROLE_DEFINITIONS.forEach(role => {
    competition.roles[role.key] = Array(role.max).fill("");
  });

  $("#rolesEditor").querySelectorAll("[data-role-key]").forEach(input => {
    const key = input.dataset.roleKey;
    const index = Number(input.dataset.roleIndex);
    competition.roles[key][index] = input.value.trim();
  });

  saveState();
  renderChecklist();
}

$("#toggleSidebar").addEventListener("click", () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  saveState();
  applySidebarState();
});

$("#mobileMenuToggle")?.addEventListener("click", () => {
  mobileMenuOpen = !mobileMenuOpen;
  applySidebarState();
});

$("#responsibleFilter")?.addEventListener("change", event => {
  activeResponsibleFilter = event.target.value;
  renderChecklist();
});


navLinks.forEach(link => {
  link.addEventListener("click", () => setView(link.dataset.view));
});

$("#openTemplatesFromDashboard").addEventListener("click", () => setView("templates"));

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

$("#closeEditCompetitionModal").addEventListener("click", () => $("#editCompetitionModal").close());

$("#editAddPersonBtn").addEventListener("click", () => {
  const input = $("#editPersonNameInput");
  const name = input.value.trim();
  if (!name || editDraftPeople.includes(name)) return;

  editDraftPeople.push(name);
  input.value = "";
  renderEditPeopleDraft();
});

$("#editPersonNameInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    $("#editAddPersonBtn").click();
  }
});

$("#editCompetitionForm").addEventListener("submit", event => {
  event.preventDefault();

  const competition = state.competitions.find(item => item.id === editingCompetitionId);
  if (!competition) return;

  competition.name = $("#editCompetitionName").value;
  competition.date = $("#editCompetitionDate").value;
  competition.venue = $("#editCompetitionVenue").value;
  competition.password = $("#editCompetitionPassword").value;
  competition.people = [...editDraftPeople];

  if (activeResponsibleFilter !== "all" && !competition.people.includes(activeResponsibleFilter)) {
    activeResponsibleFilter = "all";
  }

  getAllTasks(competition).forEach(task => {
    task.responsibles = taskResponsibles(task).filter(person => competition.people.includes(person));
    task.responsible = task.responsibles[0] || "";
  });

  saveState();
  $("#editCompetitionModal").close();
  renderDashboard();
  renderChecklist();
});

$("#competitionForm").addEventListener("submit", event => {
  event.preventDefault();

  const selectedTemplate = state.templates.find(template => template.id === $("#competitionTemplate").value);
  if (!selectedTemplate) return;

  const competition = {
    id: makeId(),
    name: $("#competitionName").value,
    date: $("#competitionDate").value,
    venue: $("#competitionVenue").value,
    password: $("#competitionPassword").value,
    people: [...draftPeople],
    roles: makeEmptyRoles(),
    tasks: cloneTasks(selectedTemplate.tasks)
  };

  state.competitions.push(competition);
  activeCompetitionId = competition.id;
  saveState();

  $("#competitionForm").reset();
  draftPeople = [];
  renderPeopleDraft();
  $("#createCompetitionModal").close();
  setView("checklist");
});

$("#createTemplateBtn").addEventListener("click", () => {
  const template = {
    id: makeId(),
    name: "Nýggjur template",
    tasks: {
      before: [],
      during: [],
      after: []
    }
  };

  state.templates.push(template);
  activeTemplateId = template.id;
  saveState();
  render();
});

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    filterButtons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    renderChecklist();
  });
});

$$(".add-phase-task").forEach(button => {
  button.addEventListener("click", () => addTaskToCompetition(button.dataset.phase));
});

$("#closeTaskEditModal").addEventListener("click", () => $("#taskEditModal").close());

$("#editTaskHasDeadline").addEventListener("change", () => {
  $("#deadlineFields").classList.toggle("hidden", !$("#editTaskHasDeadline").checked);
});

$("#taskEditForm").addEventListener("submit", event => {
  event.preventDefault();

  const result = getEditingTask();
  if (!result) return;

  const { task } = result;
  const selectedResponsibles = $$("#editTaskResponsibleList input:checked").map(input => input.value);

  task.title = $("#editTaskTitle").value;
  task.responsibles = selectedResponsibles;
  task.responsible = selectedResponsibles[0] || "";
  task.hasDeadline = $("#editTaskHasDeadline").checked;
  task.deadlineDate = task.hasDeadline ? $("#editTaskDeadlineDate").value : "";
  task.deadlineTime = task.hasDeadline ? $("#editTaskDeadlineTime").value : "";
  task.note = $("#editTaskNote").value;

  saveState();
  $("#taskEditModal").close();
  renderDashboard();
  renderChecklist();
});

$("#deleteTaskBtn").addEventListener("click", () => {
  const result = getEditingTask();
  if (!result) return;

  deleteTaskWithConfirmation(result.competition.id, editingTask.phase, editingTask.taskId);
  $("#taskEditModal").close();
});

$("#editRolesBtn").addEventListener("click", openRolesEditor);
$("#closeRolesModal").addEventListener("click", () => $("#rolesModal").close());

$("#rolesForm").addEventListener("submit", event => {
  event.preventDefault();
  saveRolesFromEditor();
  $("#rolesModal").close();
});

normalizeState();
applySidebarState();
saveState();
render();
