const STORAGE_KEY = "kappingarklart-v3.6";
const PREVIOUS_STORAGE_KEYS = ["kappingarklart-v3.5", "kappingarklart-v3.4"];

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
    sections: [
      {
        id: "before",
        title: "Áðrenn kapping",
        tasks: [
          { title: "Vátta dato og høli", note: "Tryggja at hølið er tøkt og at dato ikki rakar aðrar kappingar." },
          { title: "Finna dómarar", note: "Hav minst eina backup loysn." },
          { title: "Gera startlista", note: "Kanna vektbólkar, innvigan og bólkabýti." },
          { title: "Kanna útgerð", note: "Stong, skivur, lás, krít, klokku og teldu." }
        ]
      },
      {
        id: "during",
        title: "Undir kapping",
        tasks: [
          { title: "Gjøgnumføra innvigan", note: "Skráset kropsvekt og fyrstu royndir." },
          { title: "Briefa hjálparfólk", note: "Dómarar, speakers, loaders og skriviborð vita sína uppgávu." },
          { title: "Halda úrslit dagførd", note: "Kanna at royndir og samanlagt eru rætt." }
        ]
      },
      {
        id: "after",
        title: "Eftir kapping",
        tasks: [
          { title: "Goyma og senda úrslit", note: "Goym PDF/Excel og send til viðkomandi persónar." },
          { title: "Rudda hølið", note: "Útgerð aftur á pláss, rusk burtur og hølið latið pent eftir." },
          { title: "Takki hjálparfólki og stuðlum", note: "Stutt boð ella postur á sosialum miðlum." }
        ]
      }
    ]
  }
];

let state = loadState();
let activeView = "dashboard";
let activeTemplateId = state.templates[0]?.id || null;
let activeCompetitionId = null;
let activeFilter = "all";
let activeResponsibleFilter = "";
let mobileMenuOpen = false;
let draftPeople = [];
let editingTask = null;
let editingCompetitionId = null;
let editDraftPeople = [];
let rolesVisible = false;
let roleInputCounts = {};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const appShell = $("#appShell");
const navLinks = $$(".nav-link");
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
    roles[role.key] = [];
  });
  return roles;
}

function taskResponsibles(task) {
  if (Array.isArray(task.responsibles)) return task.responsibles.filter(Boolean);
  if (task.responsible) return [task.responsible];
  return [];
}

function migrateTasksObjectToSections(tasksObject) {
  const sectionInfo = [
    ["before", "Áðrenn kapping"],
    ["during", "Undir kapping"],
    ["after", "Eftir kapping"]
  ];

  return sectionInfo.map(([key, title]) => ({
    id: key,
    title,
    tasks: (tasksObject?.[key] || []).map(task => ({
      title: task.title || "",
      note: task.note || "",
      responsible: task.responsible || "",
      responsibles: taskResponsibles(task),
      hasDeadline: Boolean(task.hasDeadline && task.deadlineDate),
      deadlineDate: task.deadlineDate || "",
      deadlineTime: task.deadlineTime || "",
      done: Boolean(task.done)
    }))
  }));
}

function normalizeTemplateSections(template) {
  if (!Array.isArray(template.sections)) {
    template.sections = migrateTasksObjectToSections(template.tasks);
    delete template.tasks;
  }

  template.sections.forEach((section, index) => {
    section.id ||= makeId();
    section.title ||= `Sektion ${index + 1}`;
    section.tasks ||= [];
    section.tasks.forEach(task => {
      task.title ||= "";
      task.note ||= "";
      delete task.responsible;
      delete task.responsibles;
      delete task.hasDeadline;
      delete task.deadlineDate;
      delete task.deadlineTime;
      delete task.done;
    });
  });
}

function normalizeCompetitionSections(competition) {
  if (!Array.isArray(competition.sections)) {
    competition.sections = migrateTasksObjectToSections(competition.tasks);
    delete competition.tasks;
  }

  competition.sections.forEach((section, index) => {
    section.id ||= makeId();
    section.title ||= `Sektion ${index + 1}`;
    section.tasks ||= [];
    section.tasks.forEach(task => {
      task.id ||= makeId();
      task.title ||= "";
      task.note ||= "";
      task.responsibles = taskResponsibles(task);
      task.responsible = task.responsibles[0] || "";
      task.hasDeadline = Boolean(task.hasDeadline && task.deadlineDate);
      task.deadlineDate ||= "";
      task.deadlineTime ||= "";
      task.done = Boolean(task.done);
    });
  });
}

function cloneSections(sections) {
  return (sections || []).map(section => ({
    id: makeId(),
    title: section.title || "Nýggj sektion",
    tasks: (section.tasks || []).map(task => ({
      id: makeId(),
      title: task.title || "",
      note: task.note || "",
      responsible: "",
      responsibles: [],
      hasDeadline: false,
      deadlineDate: "",
      deadlineTime: "",
      done: false
    }))
  }));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  for (const key of PREVIOUS_STORAGE_KEYS) {
    const previous = localStorage.getItem(key);
    if (previous) return JSON.parse(previous);
  }

  return {
    sidebarCollapsed: false,
    templates: structuredClone(defaultTemplates),
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
          competitionLeader: ["Pól"],
          speaker: ["Herborg"]
        },
        sections: cloneSections(defaultTemplates[0].sections)
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

  state.templates.forEach(normalizeTemplateSections);

  state.competitions.forEach(competition => {
    competition.people ||= [];
    competition.roles ||= makeEmptyRoles();

    ROLE_DEFINITIONS.forEach(role => {
      if (!Array.isArray(competition.roles[role.key])) {
        competition.roles[role.key] = [];
      }
      competition.roles[role.key] = competition.roles[role.key].filter(name => String(name).trim()).slice(0, role.max);
    });

    normalizeCompetitionSections(competition);
  });
}

function getAllTasks(competition) {
  return (competition.sections || []).flatMap(section => section.tasks || []);
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
      activeResponsibleFilter = "";
      activeFilter = "all";
      rolesVisible = false;
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
      <p class="page-description">Her byggir tú template-sektionir og uppgávur. Ábyrgd og freistir verða sett inni á sjálvari kappingini.</p>
    </div>

    <div class="template-editor-actions">
      <button id="addTemplateSectionBtn" class="secondary-btn" type="button">+ Nýggj sektion</button>
      <button id="deleteTemplateBtn" class="danger-btn" type="button" ${state.templates.length <= 1 ? "disabled" : ""}>Strika template</button>
    </div>

    <div class="editor-grid">
      ${template.sections.map((section, sectionIndex) => renderTemplateSection(section, sectionIndex, template)).join("")}
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

  $("#addTemplateSectionBtn")?.addEventListener("click", () => {
    template.sections.push({
      id: makeId(),
      title: "Nýggj sektion",
      tasks: []
    });
    saveState();
    renderTemplateEditor();
  });

  templateEditor.querySelectorAll("[data-section-title]").forEach(input => {
    input.addEventListener("input", () => {
      const sectionIndex = Number(input.dataset.sectionTitle);
      template.sections[sectionIndex].title = input.value;
      saveState();
    });
  });

  templateEditor.querySelectorAll("[data-add-task]").forEach(button => {
    button.addEventListener("click", () => {
      const sectionIndex = Number(button.dataset.sectionIndex);
      template.sections[sectionIndex].tasks.push({
        title: "Nýggj uppgáva",
        note: ""
      });
      saveState();
      renderTemplateEditor();
    });
  });

  templateEditor.querySelectorAll("[data-delete-section]").forEach(button => {
    button.addEventListener("click", () => {
      const sectionIndex = Number(button.dataset.sectionIndex);
      if (template.sections.length <= 1) {
        window.alert("Ein template skal hava minst eina sektion.");
        return;
      }
      const section = template.sections[sectionIndex];
      const confirmed = window.confirm(`Vilt tú strika sektionina "${section.title}"?`);
      if (!confirmed) return;
      template.sections.splice(sectionIndex, 1);
      saveState();
      renderTemplateEditor();
    });
  });

  templateEditor.querySelectorAll("[data-task-field]").forEach(input => {
    input.addEventListener("input", () => {
      const sectionIndex = Number(input.dataset.sectionIndex);
      const taskIndex = Number(input.dataset.taskIndex);
      const field = input.dataset.taskField;
      template.sections[sectionIndex].tasks[taskIndex][field] = input.value;
      saveState();
    });
  });

  templateEditor.querySelectorAll("[data-delete-task]").forEach(button => {
    button.addEventListener("click", () => {
      const sectionIndex = Number(button.dataset.sectionIndex);
      const taskIndex = Number(button.dataset.taskIndex);
      template.sections[sectionIndex].tasks.splice(taskIndex, 1);
      saveState();
      renderTemplateEditor();
    });
  });
}

function renderTemplateSection(section, sectionIndex, template) {
  return `
    <section class="template-section">
      <div class="template-section-header">
        <label>
          Sektion navn
          <input data-section-title="${sectionIndex}" value="${escapeHTML(section.title)}" placeholder="T.d. Fyrireiking" />
        </label>
        <button class="delete-small" data-delete-section data-section-index="${sectionIndex}" type="button" title="Strika sektion" ${template.sections.length <= 1 ? "disabled" : ""}>×</button>
      </div>

      <div class="template-grid-header template-grid-header-simple">
        <span>Uppgáva</span>
        <span>Viðmerking</span>
        <span></span>
      </div>

      ${section.tasks.map((task, taskIndex) => `
        <div class="template-task template-task-simple">
          <input data-task-field="title" data-section-index="${sectionIndex}" data-task-index="${taskIndex}" value="${escapeHTML(task.title)}" placeholder="Navn á uppgávu" />
          <input data-task-field="note" data-section-index="${sectionIndex}" data-task-index="${taskIndex}" value="${escapeHTML(task.note || "")}" placeholder="Viðmerking" />
          <button class="delete-small" data-delete-task data-section-index="${sectionIndex}" data-task-index="${taskIndex}" type="button">×</button>
        </div>
      `).join("")}
      <button class="secondary-btn" data-add-task data-section-index="${sectionIndex}" type="button">+ Legg uppgávu afturat</button>
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
  renderSectionFilters(competition);
  renderResponsibleFilter(competition);
  renderChecklistSections(competition);
}

function renderRolesSummary(competition) {
  const rolesSummary = $("#rolesSummary");
  const toggleButton = $("#toggleRolesBtn");

  rolesSummary.hidden = !rolesVisible;
  toggleButton.textContent = rolesVisible ? "Fjal leiklutir" : "Vís leiklutir";

  if (!rolesVisible) {
    rolesSummary.innerHTML = "";
    return;
  }

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

function renderSectionFilters(competition) {
  const container = $("#sectionFilterRow");
  container.innerHTML = `
    <button class="filter-btn ${activeFilter === "all" ? "active" : ""}" data-filter="all">Alt</button>
    <button class="filter-btn ${activeFilter === "todo" ? "active" : ""}" data-filter="todo">Ikki liðugt</button>
    ${competition.sections.map(section => `
      <button class="filter-btn ${activeFilter === section.id ? "active" : ""}" data-filter="${section.id}">${escapeHTML(section.title)}</button>
    `).join("")}
  `;

  container.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      renderChecklist();
    });
  });
}

function renderResponsibleFilter(competition) {
  const container = $("#responsibleFilterPills");
  const people = competition.people || [];

  if (people.length === 0) {
    container.innerHTML = "";
    activeResponsibleFilter = "";
    return;
  }

  container.innerHTML = people.map(person => `
    <button
      type="button"
      class="responsible-filter-pill ${activeResponsibleFilter === person ? "active" : ""}"
      style="${colorStyle(competition, person)}"
      data-person="${escapeHTML(person)}"
    >${escapeHTML(person)}</button>
  `).join("");

  container.querySelectorAll("[data-person]").forEach(button => {
    button.addEventListener("click", () => {
      activeResponsibleFilter = activeResponsibleFilter === button.dataset.person ? "" : button.dataset.person;
      renderChecklist();
    });
  });
}

function sectionMatchesFilter(section) {
  return activeFilter === "all" || activeFilter === "todo" || activeFilter === section.id;
}

function taskMatchesFilters(task) {
  const matchesStatus = activeFilter === "todo" ? !task.done : true;
  const matchesResponsible =
    !activeResponsibleFilter ||
    taskResponsibles(task).includes(activeResponsibleFilter);

  return matchesStatus && matchesResponsible;
}

function renderChecklistSections(competition) {
  const container = $("#checklistColumns");
  container.innerHTML = "";

  competition.sections
    .filter(sectionMatchesFilter)
    .forEach(section => {
      const sectionElement = document.createElement("section");
      sectionElement.className = "phase-column";
      sectionElement.dataset.sectionId = section.id;

      sectionElement.innerHTML = `
        <div class="phase-heading"><h3>${escapeHTML(section.title)}</h3></div>
        <div class="task-list"></div>
        <button class="add-phase-task secondary-btn" data-section-id="${section.id}" type="button">+ Legg uppgávu afturat</button>
      `;

      const taskList = sectionElement.querySelector(".task-list");
      section.tasks.filter(taskMatchesFilters).forEach(task => {
        taskList.appendChild(renderTaskCard(competition, section.id, task));
      });

      sectionElement.querySelector("[data-section-id]").addEventListener("click", () => {
        addTaskToCompetition(section.id);
      });

      container.appendChild(sectionElement);
    });
}

function renderTaskCard(competition, sectionId, task) {
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
    openTaskEditor(competition.id, sectionId, task.id);
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
    deleteTaskWithConfirmation(competition.id, sectionId, task.id);
  });

  return card;
}

function deleteTaskWithConfirmation(competitionId, sectionId, taskId) {
  const competition = state.competitions.find(item => item.id === competitionId);
  if (!competition) return;

  const section = competition.sections.find(item => item.id === sectionId);
  if (!section) return;

  const task = section.tasks.find(item => item.id === taskId);
  if (!task) return;

  const confirmed = window.confirm(`Vilt tú strika uppgávuna "${task.title}"?`);
  if (!confirmed) return;

  section.tasks = section.tasks.filter(item => item.id !== taskId);
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

function openTaskEditor(competitionId, sectionId, taskId) {
  const competition = state.competitions.find(item => item.id === competitionId);
  const section = competition.sections.find(item => item.id === sectionId);
  const task = section.tasks.find(item => item.id === taskId);

  editingTask = { competitionId, sectionId, taskId };

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
  const section = competition.sections.find(item => item.id === editingTask.sectionId);
  const task = section.tasks.find(item => item.id === editingTask.taskId);
  return { competition, section, task };
}

function addTaskToCompetition(sectionId) {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const section = competition.sections.find(item => item.id === sectionId);
  if (!section) return;

  const task = {
    id: makeId(),
    title: "Nýggj uppgáva",
    responsible: "",
    responsibles: [],
    hasDeadline: false,
    deadlineDate: "",
    deadlineTime: "",
    note: "",
    done: false
  };

  section.tasks.push(task);
  saveState();
  renderChecklist();
  openTaskEditor(competition.id, section.id, task.id);
}

function openRolesEditor() {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  roleInputCounts = {};
  ROLE_DEFINITIONS.forEach(role => {
    const filled = (competition.roles[role.key] || []).filter(name => name.trim()).length;
    roleInputCounts[role.key] = filled;
  });

  renderRolesEditor();
  $("#rolesModal").showModal();
}

function renderRolesEditor() {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const rolesEditor = $("#rolesEditor");
  rolesEditor.innerHTML = ROLE_DEFINITIONS.map(role => {
    const values = competition.roles[role.key] || [];
    const visibleCount = Math.min(role.max, roleInputCounts[role.key] || 0);
    const canAdd = visibleCount < role.max;

    return `
      <section class="role-editor-card">
        <div class="role-editor-heading">
          <div>
            <strong>${role.label}</strong>
            <span>Max ${role.max}</span>
          </div>
          ${canAdd ? `<button class="role-add-btn" type="button" data-add-role-field="${role.key}" title="Legg persón afturat">+</button>` : ""}
        </div>
        <div class="role-inputs">
          ${Array.from({ length: visibleCount }).map((_, index) => `
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

  rolesEditor.querySelectorAll("[data-add-role-field]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.addRoleField;
      const role = ROLE_DEFINITIONS.find(item => item.key === key);
      roleInputCounts[key] = Math.min(role.max, (roleInputCounts[key] || 0) + 1);
      renderRolesEditor();
    });
  });
}

function saveRolesFromEditor() {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  ROLE_DEFINITIONS.forEach(role => {
    competition.roles[role.key] = [];
  });

  $("#rolesEditor").querySelectorAll("[data-role-key]").forEach(input => {
    const key = input.dataset.roleKey;
    const value = input.value.trim();
    if (value) {
      competition.roles[key].push(value);
    }
  });

  ROLE_DEFINITIONS.forEach(role => {
    competition.roles[role.key] = competition.roles[role.key].slice(0, role.max);
  });

  rolesVisible = true;
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

  if (activeResponsibleFilter && !competition.people.includes(activeResponsibleFilter)) {
    activeResponsibleFilter = "";
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
    sections: cloneSections(selectedTemplate.sections)
  };

  state.competitions.push(competition);
  activeCompetitionId = competition.id;
  activeResponsibleFilter = "";
  activeFilter = "all";
  rolesVisible = false;
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
    sections: [
      {
        id: makeId(),
        title: "Nýggj sektion",
        tasks: []
      }
    ]
  };

  state.templates.push(template);
  activeTemplateId = template.id;
  saveState();
  render();
});

$$(".add-phase-task").forEach(button => {
  button.addEventListener("click", () => addTaskToCompetition(button.dataset.sectionId));
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

  deleteTaskWithConfirmation(result.competition.id, editingTask.sectionId, editingTask.taskId);
  $("#taskEditModal").close();
});

$("#toggleRolesBtn").addEventListener("click", () => {
  rolesVisible = !rolesVisible;
  renderChecklist();
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
