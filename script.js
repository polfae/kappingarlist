const STORAGE_KEY = "kappingarklart-v4.7.1";
const PREVIOUS_STORAGE_KEYS = ["kappingarklart-v4.7", "kappingarklart-v4.6", "kappingarklart-v4.5.2", "kappingarklart-v4.5.1", "kappingarklart-v4.5", "kappingarklart-v4.4.2", "kappingarklart-v4.4.1", "kappingarklart-v4.4", "kappingarklart-v4.3", "kappingarklart-v4.2", "kappingarklart-v4.1", "kappingarklart-v4.0", "kappingarklart-v3.9", "kappingarklart-v3.8", "kappingarklart-v3.7.1", "kappingarklart-v3.7", "kappingarklart-v3.6", "kappingarklart-v3.5", "kappingarklart-v3.4"];

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

const defaultTemplates = [];

let state = loadState();
let activeView = "dashboard";
let activeTemplateId = state.templates[0]?.id || null;
let activeCompetitionId = null;
let activeSectionFilters = [];
let showIncompleteOnly = false;
let activeResponsibleFilters = [];
let mobileMenuOpen = false;
let draftPeople = [];
let editingTask = null;
let editingCompetitionId = null;
let editDraftPeople = [];
let rolesVisible = false;
let roleInputCounts = {};
let draggedTask = null;
let draggedSectionId = null;
let suppressTaskClick = false;
let autoScrollFrame = null;
let autoScrollSpeed = 0;
let draggedTemplateTask = null;
let draggedTemplateSectionIndex = null;
let suppressTemplateClick = false;

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
    templates: [],
    competitions: []
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
  if (typeof activeTemplateId !== "undefined" && activeTemplateId && !state.templates.some(template => template.id === activeTemplateId)) {
    activeTemplateId = state.templates[0]?.id || null;
  }

  state.competitions.forEach(competition => {
    competition.people = uniqueNames(competition.people || []);
    competition.roles ||= makeEmptyRoles();

    ROLE_DEFINITIONS.forEach(role => {
      if (!Array.isArray(competition.roles[role.key])) {
        competition.roles[role.key] = [];
      }
      competition.roles[role.key] = uniqueNames(competition.roles[role.key]).slice(0, role.max);
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

function capitalizeNamePart(part) {
  return part
    .split("-")
    .map(piece => {
      if (!piece) return piece;
      return piece.charAt(0).toLocaleUpperCase("fo") + piece.slice(1).toLocaleLowerCase("fo");
    })
    .join("-");
}

function formatName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(capitalizeNamePart)
    .join(" ");
}

function sortNames(names) {
  return [...(names || [])]
    .map(formatName)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fo", { sensitivity: "base" }));
}

function uniqueNames(names) {
  const seen = new Set();
  return sortNames(names).filter(name => {
    const key = name.toLocaleLowerCase("fo");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const formattedPerson = formatName(person);
  return `<span class="person-pill person-color-pill" style="${colorStyle(competition, formattedPerson)}">${escapeHTML(formattedPerson)}</span>`;
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
      activeResponsibleFilters = [];
      activeSectionFilters = [];
      showIncompleteOnly = false;
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

  if (state.templates.length === 0) {
    templateList.innerHTML = `<div class="empty-list-message">Ongir templates enn.</div>`;
    return;
  }

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
      <button id="deleteTemplateBtn" class="danger-btn" type="button">Strika template</button>
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

  setupTemplateDragAndDrop(template, templateEditor);

  templateEditor.querySelectorAll("[data-section-title]").forEach(input => {
    input.addEventListener("input", () => {
      const sectionIndex = Number(input.dataset.sectionTitle);
      template.sections[sectionIndex].title = input.value;
      saveState();
    });

    input.addEventListener("dragover", event => {
      event.preventDefault();
      event.stopPropagation();
    });

    input.addEventListener("drop", event => {
      event.preventDefault();
      event.stopPropagation();
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


function setupTemplateDragAndDrop(template, templateEditor) {
  templateEditor.querySelectorAll("[data-template-task]").forEach(taskElement => {
    taskElement.addEventListener("dragstart", event => {
      if (event.target.matches("input, button")) {
        event.preventDefault();
        return;
      }

      draggedTemplateTask = {
        sectionIndex: Number(taskElement.dataset.sectionIndex),
        taskIndex: Number(taskElement.dataset.taskIndex)
      };
      taskElement.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({ type: "template-task", ...draggedTemplateTask }));
    });

    taskElement.addEventListener("dragend", () => {
      draggedTemplateTask = null;
      taskElement.classList.remove("dragging");
      templateEditor.querySelectorAll(".template-drop-before, .template-drop-after, .template-task-list-drop-target").forEach(item => {
        item.classList.remove("template-drop-before", "template-drop-after", "template-task-list-drop-target");
      });
    });
  });

  templateEditor.querySelectorAll("[data-template-task-list]").forEach(taskList => {
    taskList.addEventListener("dragover", event => {
      if (!draggedTemplateTask) return;

      event.preventDefault();
      event.stopPropagation();

      const targetTask = event.target.closest("[data-template-task]");
      templateEditor.querySelectorAll(".template-drop-before, .template-drop-after").forEach(item => {
        item.classList.remove("template-drop-before", "template-drop-after");
      });

      if (!targetTask || !taskList.contains(targetTask)) {
        taskList.classList.add("template-task-list-drop-target");
        return;
      }

      taskList.classList.remove("template-task-list-drop-target");
      const rect = targetTask.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      targetTask.classList.add(placeAfter ? "template-drop-after" : "template-drop-before");
    });

    taskList.addEventListener("dragenter", event => {
      if (!draggedTemplateTask) return;
      event.preventDefault();
      taskList.classList.add("template-task-list-drop-target");
    });

    taskList.addEventListener("dragleave", event => {
      if (!taskList.contains(event.relatedTarget)) {
        taskList.classList.remove("template-task-list-drop-target");
      }
    });

    taskList.addEventListener("drop", event => {
      if (!draggedTemplateTask) return;

      event.preventDefault();
      event.stopPropagation();

      const targetSectionIndex = Number(taskList.dataset.templateTaskList);
      const targetTask = event.target.closest("[data-template-task]");
      let targetIndex = template.sections[targetSectionIndex].tasks.length;

      if (targetTask && taskList.contains(targetTask)) {
        const rect = targetTask.getBoundingClientRect();
        const placeAfter = event.clientY > rect.top + rect.height / 2;
        targetIndex = Number(targetTask.dataset.taskIndex) + (placeAfter ? 1 : 0);
      }

      moveTemplateTask(template, draggedTemplateTask.sectionIndex, draggedTemplateTask.taskIndex, targetSectionIndex, targetIndex);
    });
  });

  templateEditor.querySelectorAll("[data-template-section-drag]").forEach(handle => {
    const sectionElement = handle.closest("[data-template-section-index]");
    const sectionIndex = Number(handle.dataset.templateSectionDrag);

    handle.addEventListener("dragstart", event => {
      draggedTemplateSectionIndex = sectionIndex;
      sectionElement.classList.add("section-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", JSON.stringify({ type: "template-section", sectionIndex }));
    });

    handle.addEventListener("dragend", () => {
      draggedTemplateSectionIndex = null;
      sectionElement.classList.remove("section-dragging");
      templateEditor.querySelectorAll(".section-drop-before, .section-drop-after").forEach(item => {
        item.classList.remove("section-drop-before", "section-drop-after");
      });
    });

    sectionElement.addEventListener("dragover", event => {
      if (draggedTemplateSectionIndex === null || draggedTemplateSectionIndex === sectionIndex) return;
      event.preventDefault();

      const rect = sectionElement.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      templateEditor.querySelectorAll(".section-drop-before, .section-drop-after").forEach(item => {
        item.classList.remove("section-drop-before", "section-drop-after");
      });
      sectionElement.classList.add(placeAfter ? "section-drop-after" : "section-drop-before");
    });

    sectionElement.addEventListener("drop", event => {
      if (draggedTemplateSectionIndex === null || draggedTemplateSectionIndex === sectionIndex) return;
      event.preventDefault();

      const rect = sectionElement.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      moveTemplateSection(template, draggedTemplateSectionIndex, sectionIndex + (placeAfter ? 1 : 0));
    });
  });
}

function moveTemplateTask(template, fromSectionIndex, fromTaskIndex, toSectionIndex, targetIndex) {
  const fromSection = template.sections[fromSectionIndex];
  const toSection = template.sections[toSectionIndex];

  if (!fromSection || !toSection) return;
  const [task] = fromSection.tasks.splice(fromTaskIndex, 1);
  if (!task) return;

  if (fromSectionIndex === toSectionIndex && fromTaskIndex < targetIndex) {
    targetIndex -= 1;
  }

  targetIndex = Math.max(0, Math.min(targetIndex, toSection.tasks.length));
  toSection.tasks.splice(targetIndex, 0, task);

  saveState();
  renderTemplateEditor();
}

function moveTemplateSection(template, fromIndex, targetIndex) {
  const [section] = template.sections.splice(fromIndex, 1);
  if (!section) return;

  if (fromIndex < targetIndex) {
    targetIndex -= 1;
  }

  targetIndex = Math.max(0, Math.min(targetIndex, template.sections.length));
  template.sections.splice(targetIndex, 0, section);

  saveState();
  renderTemplateEditor();
}

function renderTemplateSection(section, sectionIndex, template) {
  return `
    <section class="template-section" data-template-section-index="${sectionIndex}">
      <div class="template-section-header" data-template-section-drop="${sectionIndex}">
        <button class="section-drag-handle template-section-drag-handle" type="button" draggable="true" data-template-section-drag="${sectionIndex}" title="Flyt sektion" aria-label="Flyt sektion">⋮⋮</button>
        <label>
          Sektion navn
          <input data-section-title="${sectionIndex}" value="${escapeHTML(section.title)}" placeholder="T.d. Fyrireiking" />
        </label>
        <button class="delete-small template-delete-icon" data-delete-section data-section-index="${sectionIndex}" type="button" title="Strika sektion">×</button>
      </div>

      <div class="template-grid-header template-grid-header-simple">
        <span>Uppgáva</span>
        <span>Viðmerking</span>
        <span></span>
      </div>

      <div class="template-task-list ${section.tasks.length === 0 ? "template-task-list-empty" : ""}" data-template-task-list="${sectionIndex}">
        ${section.tasks.map((task, taskIndex) => `
          <div class="template-task template-task-simple" draggable="true" data-template-task data-section-index="${sectionIndex}" data-task-index="${taskIndex}">
            <span class="template-task-drag-handle" title="Flyt uppgávu">⋮⋮</span>
            <input data-task-field="title" data-section-index="${sectionIndex}" data-task-index="${taskIndex}" value="${escapeHTML(task.title)}" placeholder="Navn á uppgávu" />
            <input data-task-field="note" data-section-index="${sectionIndex}" data-task-index="${taskIndex}" value="${escapeHTML(task.note || "")}" placeholder="Viðmerking" />
            <button class="delete-small" data-delete-task data-section-index="${sectionIndex}" data-task-index="${taskIndex}" type="button">×</button>
          </div>
        `).join("")}
      </div>
      <button class="secondary-btn" data-add-task data-section-index="${sectionIndex}" type="button">+ Legg uppgávu afturat</button>
    </section>
  `;
}

function renderCompetitionSelect() {
  const competitionTemplate = $("#competitionTemplate");
  competitionTemplate.innerHTML = "";

  const noTemplateOption = document.createElement("option");
  noTemplateOption.value = "";
  noTemplateOption.textContent = "Eingin template";
  noTemplateOption.selected = true;
  competitionTemplate.appendChild(noTemplateOption);

  if (state.templates.length === 0) {
    templateList.innerHTML = `<div class="empty-list-message">Ongir templates enn.</div>`;
    return;
  }

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

  draftPeople = uniqueNames(draftPeople);
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

  editDraftPeople = uniqueNames(editDraftPeople);
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
  const validSectionIds = new Set((competition.sections || []).map(section => section.id));
  activeSectionFilters = activeSectionFilters.filter(sectionId => validSectionIds.has(sectionId));

  container.innerHTML = `
    <button class="filter-btn ${showIncompleteOnly ? "active" : ""}" data-status-filter="todo">Ikki liðugt</button>
    ${competition.sections.map(section => `
      <button
        class="filter-btn section-filter-btn ${activeSectionFilters.includes(section.id) ? "active" : ""}"
        data-section-filter="${section.id}"
      >${escapeHTML(section.title)}</button>
    `).join("")}
  `;

  container.querySelector("[data-status-filter='todo']")?.addEventListener("click", () => {
    showIncompleteOnly = !showIncompleteOnly;
    renderChecklist();
  });

  container.querySelectorAll("[data-section-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.sectionFilter;

      if (activeSectionFilters.includes(sectionId)) {
        activeSectionFilters = activeSectionFilters.filter(item => item !== sectionId);
      } else {
        activeSectionFilters.push(sectionId);
      }

      renderChecklist();
    });
  });
}

function renderResponsibleFilter(competition) {
  const container = $("#responsibleFilterPills");
  const people = sortNames(competition.people || []);
  const validPeople = new Set(people);

  activeResponsibleFilters = activeResponsibleFilters.filter(person => validPeople.has(person));

  if (people.length === 0) {
    container.innerHTML = "";
    activeResponsibleFilters = [];
    return;
  }

  container.innerHTML = people.map(person => `
    <button
      type="button"
      class="responsible-filter-pill ${activeResponsibleFilters.includes(person) ? "active" : ""}"
      style="${colorStyle(competition, person)}"
      data-person="${escapeHTML(person)}"
    >${escapeHTML(person)}</button>
  `).join("");

  container.querySelectorAll("[data-person]").forEach(button => {
    button.addEventListener("click", () => {
      const person = button.dataset.person;

      if (activeResponsibleFilters.includes(person)) {
        activeResponsibleFilters = activeResponsibleFilters.filter(item => item !== person);
      } else {
        activeResponsibleFilters.push(person);
      }

      renderChecklist();
    });
  });
}

function sectionMatchesFilter(section) {
  return activeSectionFilters.length === 0 || activeSectionFilters.includes(section.id);
}

function taskMatchesFilters(task) {
  const matchesStatus = showIncompleteOnly ? !task.done : true;
  const taskPeople = taskResponsibles(task);
  const matchesResponsible =
    activeResponsibleFilters.length === 0 ||
    activeResponsibleFilters.some(person => taskPeople.includes(person));

  return matchesStatus && matchesResponsible;
}

function renderChecklistSections(competition) {
  const container = $("#checklistColumns");
  container.innerHTML = "";

  const filteringTasks =
    showIncompleteOnly ||
    activeResponsibleFilters.length > 0;

  competition.sections
    .filter(sectionMatchesFilter)
    .forEach(section => {
      const visibleTasks = section.tasks.filter(taskMatchesFilters);

      if (filteringTasks && visibleTasks.length === 0) {
        return;
      }

      const sectionElement = document.createElement("section");
      sectionElement.className = "phase-column";
      sectionElement.dataset.sectionId = section.id;

      sectionElement.innerHTML = `
        <div class="phase-heading competition-section-heading" data-section-drop-target="${section.id}">
          <button class="section-drag-handle" type="button" draggable="true" data-section-drag="${section.id}" title="Flyt sektion" aria-label="Flyt sektion">⋮⋮</button>
          <input class="section-title-input" data-section-title="${section.id}" value="${escapeHTML(section.title)}" aria-label="Sektion navn" />
          <button class="delete-section-btn" data-delete-section="${section.id}" type="button" title="Strika sektion">×</button>
        </div>
        <div class="task-list" data-task-drop-section="${section.id}"></div>
        <button class="add-phase-task secondary-btn" data-section-id="${section.id}" type="button">+ Legg uppgávu afturat</button>
      `;

      const taskList = sectionElement.querySelector(".task-list");

      if (visibleTasks.length === 0) {
        taskList.classList.add("task-list-empty");
      }

      visibleTasks.forEach(task => {
        taskList.appendChild(renderTaskCard(competition, section.id, task));
      });

      setupTaskDropZone(taskList, section.id);
      setupSectionDragHandlers(sectionElement, section.id);

      sectionElement.querySelector("[data-section-title]").addEventListener("input", event => {
        section.title = event.target.value;
        saveState();
        renderSectionFilters(competition);
      });

      sectionElement.querySelector("[data-section-title]").addEventListener("dragover", event => {
        event.preventDefault();
        event.stopPropagation();
      });

      sectionElement.querySelector("[data-section-title]").addEventListener("drop", event => {
        event.preventDefault();
        event.stopPropagation();
      });

      sectionElement.querySelector("[data-delete-section]").addEventListener("click", () => {
        deleteCompetitionSection(section.id);
      });

      sectionElement.querySelector("[data-section-id]").addEventListener("click", () => {
        addTaskToCompetition(section.id);
      });

      container.appendChild(sectionElement);
    });

  const addSectionCard = document.createElement("section");
  addSectionCard.className = "phase-column add-section-panel";
  addSectionCard.innerHTML = `
    <button id="addCompetitionSectionBtn" class="primary-btn full-width" type="button">+ Nýggj sektion</button>
    ${competition.sections.length === 0 ? `<p class="empty-section-hint">Hendan kappingin hevur ongar sektionir enn. Legg eina sektion afturat fyri at byrja.</p>` : ""}
  `;
  addSectionCard.addEventListener("dragover", event => {
    if (!draggedSectionId) return;
    updateDragAutoScroll(event);
    event.preventDefault();
    addSectionCard.classList.add("section-drop-target");
  });

  addSectionCard.addEventListener("dragleave", () => {
    addSectionCard.classList.remove("section-drop-target");
  });

  addSectionCard.addEventListener("drop", event => {
    if (!draggedSectionId) return;
    event.preventDefault();
    stopDragAutoScroll();
    addSectionCard.classList.remove("section-drop-target");
    moveSection(draggedSectionId, competition.sections.length);
  });

  addSectionCard.querySelector("#addCompetitionSectionBtn").addEventListener("click", addCompetitionSection);
  container.appendChild(addSectionCard);
}

function addCompetitionSection() {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const section = {
    id: makeId(),
    title: "Nýggj sektion",
    tasks: []
  };

  competition.sections.push(section);
  activeSectionFilters = [];
  showIncompleteOnly = false;
  saveState();
  renderChecklist();
}

function deleteCompetitionSection(sectionId) {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const section = competition.sections.find(item => item.id === sectionId);
  if (!section) return;

  const hasTasks = (section.tasks || []).length > 0;
  const message = hasTasks
    ? `Vilt tú strika sektionina "${section.title}"? Allar uppgávur í sektionini verða eisini strikaðar.`
    : `Vilt tú strika sektionina "${section.title}"?`;

  const confirmed = window.confirm(message);
  if (!confirmed) return;

  competition.sections = competition.sections.filter(item => item.id !== sectionId);

  activeSectionFilters = activeSectionFilters.filter(item => item !== sectionId);

  saveState();
  renderDashboard();
  renderChecklist();
}


function updateDragAutoScroll(event) {
  // Auto-scroll while dragging was intentionally disabled in v4.6.
}

function runDragAutoScroll() {
  // Auto-scroll while dragging was intentionally disabled in v4.6.
}

function stopDragAutoScroll() {
  autoScrollSpeed = 0;

  if (autoScrollFrame !== null) {
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }
}

function findSection(competition, sectionId) {
  return competition.sections.find(section => section.id === sectionId);
}

function setupTaskDropZone(taskList, targetSectionId) {
  taskList.addEventListener("dragover", event => {
    if (!draggedTask) return;

    updateDragAutoScroll(event);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const targetCard = event.target.closest(".task-card");
    $$(".task-drop-before, .task-drop-after").forEach(item => item.classList.remove("task-drop-before", "task-drop-after"));

    if (!targetCard || !taskList.contains(targetCard)) {
      taskList.classList.add("task-list-drop-target");
      return;
    }

    taskList.classList.remove("task-list-drop-target");
    const rect = targetCard.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    targetCard.classList.add(placeAfter ? "task-drop-after" : "task-drop-before");
  });

  taskList.addEventListener("dragenter", event => {
    if (!draggedTask) return;

    event.preventDefault();
    event.stopPropagation();
    taskList.classList.add("task-list-drop-target");
  });

  taskList.addEventListener("dragleave", event => {
    if (!taskList.contains(event.relatedTarget)) {
      taskList.classList.remove("task-list-drop-target");
      $$(".task-drop-before, .task-drop-after").forEach(item => item.classList.remove("task-drop-before", "task-drop-after"));
    }
  });

  taskList.addEventListener("drop", event => {
    if (!draggedTask) return;

    event.preventDefault();
    event.stopPropagation();
    stopDragAutoScroll();
    taskList.classList.remove("task-list-drop-target");

    const competition = state.competitions.find(item => item.id === activeCompetitionId);
    if (!competition) return;

    const targetSection = findSection(competition, targetSectionId);
    if (!targetSection) return;

    const targetCard = event.target.closest(".task-card");
    let targetIndex = targetSection.tasks.length;

    if (targetCard && taskList.contains(targetCard)) {
      const targetTaskId = targetCard.dataset.taskId;
      const rect = targetCard.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      const foundIndex = targetSection.tasks.findIndex(task => task.id === targetTaskId);
      targetIndex = foundIndex + (placeAfter ? 1 : 0);
    }

    moveTask(draggedTask.sectionId, draggedTask.taskId, targetSectionId, targetIndex);
  });
}

function restoreTaskOrder(section, orderedTaskIds) {
  if (!section || !Array.isArray(section.tasks) || !Array.isArray(orderedTaskIds)) return;

  const orderMap = new Map(orderedTaskIds.map((id, index) => [id, index]));
  section.tasks.sort((a, b) => {
    const aIndex = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

function moveTask(fromSectionId, taskId, toSectionId, targetIndex) {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const fromSection = findSection(competition, fromSectionId);
  const toSection = findSection(competition, toSectionId);
  if (!fromSection || !toSection) return;

  const currentIndex = fromSection.tasks.findIndex(task => task.id === taskId);
  if (currentIndex === -1) return;

  const [task] = fromSection.tasks.splice(currentIndex, 1);

  if (fromSectionId === toSectionId && currentIndex < targetIndex) {
    targetIndex -= 1;
  }

  targetIndex = Math.max(0, Math.min(targetIndex, toSection.tasks.length));
  toSection.tasks.splice(targetIndex, 0, task);

  saveState();
  renderDashboard();
  renderChecklist();
}

function setupSectionDragHandlers(sectionElement, sectionId) {
  const handle = sectionElement.querySelector("[data-section-drag]");

  handle.addEventListener("dragstart", event => {
    draggedSectionId = sectionId;
    sectionElement.classList.add("section-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "section", sectionId }));
  });

  handle.addEventListener("dragend", () => {
    stopDragAutoScroll();
    draggedSectionId = null;
    sectionElement.classList.remove("section-dragging");
    $$(".section-drop-before, .section-drop-after, .section-drop-target").forEach(item => {
      item.classList.remove("section-drop-before", "section-drop-after", "section-drop-target");
    });
  });

  sectionElement.addEventListener("dragover", event => {
    if (!draggedSectionId || draggedSectionId === sectionId) return;

    updateDragAutoScroll(event);
    event.preventDefault();
    const rect = sectionElement.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;

    $$(".section-drop-before, .section-drop-after").forEach(item => item.classList.remove("section-drop-before", "section-drop-after"));
    sectionElement.classList.add(placeAfter ? "section-drop-after" : "section-drop-before");
  });

  sectionElement.addEventListener("drop", event => {
    if (!draggedSectionId || draggedSectionId === sectionId) return;

    event.preventDefault();
    stopDragAutoScroll();
    const competition = state.competitions.find(item => item.id === activeCompetitionId);
    if (!competition) return;

    const rect = sectionElement.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    const targetIndex = competition.sections.findIndex(section => section.id === sectionId) + (placeAfter ? 1 : 0);

    moveSection(draggedSectionId, targetIndex);
  });
}

function moveSection(sectionId, targetIndex) {
  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  const currentIndex = competition.sections.findIndex(section => section.id === sectionId);
  if (currentIndex === -1) return;

  const [section] = competition.sections.splice(currentIndex, 1);

  if (currentIndex < targetIndex) {
    targetIndex -= 1;
  }

  targetIndex = Math.max(0, Math.min(targetIndex, competition.sections.length));
  competition.sections.splice(targetIndex, 0, section);

  saveState();
  renderChecklist();
}

function renderTaskCard(competition, sectionId, task) {
  const responsiblePills = sortNames(taskResponsibles(task))
    .map(person => personPillHTML(competition, person))
    .join("");

  const card = document.createElement("article");
  card.className = `task-card ${task.done ? "done" : ""}`;
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.dataset.sectionId = sectionId;

  card.innerHTML = `
    <label class="task-check" title="Merk sum liðugt">
      <input type="checkbox" ${task.done ? "checked" : ""} />
    </label>

    <div class="task-content task-row-content">
      <div class="task-title-cell">
        <span class="task-cell-label">Uppgáva</span>
        <h4>${escapeHTML(task.title)}</h4>
      </div>

      <div class="task-people-cell">
        <span class="task-cell-label">Ábyrgd</span>
        <div class="task-meta">${responsiblePills || `<span class="task-empty-cell">—</span>`}</div>
      </div>

      <div class="task-deadline-cell">
        <span class="task-cell-label">Freist</span>
        ${task.hasDeadline && task.deadlineDate ? `<span class="pill deadline">Freist: ${formatDeadline(task)}</span>` : `<span class="task-empty-cell">—</span>`}
      </div>

      <div class="task-comment-cell">
        <span class="task-cell-label">Viðmerking</span>
        ${task.note ? `<p class="task-note">${escapeHTML(task.note)}</p>` : `<span class="task-empty-cell">—</span>`}
      </div>
    </div>

    <div class="task-actions">
      <button class="delete-task-btn" title="Strika uppgávu">×</button>
    </div>
  `;

  card.addEventListener("click", event => {
    if (suppressTaskClick) {
      event.preventDefault();
      return;
    }

    openTaskEditor(competition.id, sectionId, task.id);
  });

  card.addEventListener("dragstart", event => {
    draggedTask = { competitionId: competition.id, sectionId, taskId: task.id };
    suppressTaskClick = true;
    card.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "task", taskId: task.id, sectionId }));
  });

  card.addEventListener("dragend", () => {
    stopDragAutoScroll();
    draggedTask = null;
    card.classList.remove("dragging");
    $$(".task-drop-before, .task-drop-after").forEach(item => item.classList.remove("task-drop-before", "task-drop-after"));
    setTimeout(() => {
      suppressTaskClick = false;
    }, 0);
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
  const selected = new Set(sortNames(taskResponsibles(task)));

  if (!competition.people || competition.people.length === 0) {
    container.innerHTML = `<p class="roles-empty">Ongir ábyrgdarpersónar eru lagdir afturat hesi kappingini.</p>`;
    return;
  }

  container.innerHTML = sortNames(competition.people).map(person => {
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

  $("#taskPersonAddRow").classList.add("hidden");
  $("#taskPersonAddRow").hidden = true;
  $("#taskPersonNameInput").value = "";
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
    const values = uniqueNames(competition.roles[role.key] || []);
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
            <div class="role-input-row">
              <input
                data-role-key="${role.key}"
                data-role-index="${index}"
                value="${escapeHTML(values[index] || "")}"
                placeholder="Navn ${index + 1}"
              />
              <button class="remove-role-field-btn" type="button" data-remove-role-field="${role.key}" data-role-index="${index}" title="Strika teig">×</button>
            </div>
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

  rolesEditor.querySelectorAll("[data-remove-role-field]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.removeRoleField;
      const index = Number(button.dataset.roleIndex);
      const inputs = Array.from(rolesEditor.querySelectorAll(`[data-role-key="${key}"]`));
      const values = inputs.map(input => input.value);
      values.splice(index, 1);

      const competition = state.competitions.find(item => item.id === activeCompetitionId);
      if (competition) {
        competition.roles[key] = uniqueNames(values);
      }

      roleInputCounts[key] = Math.max(0, (roleInputCounts[key] || 0) - 1);
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
    const value = formatName(input.value);
    if (value) {
      competition.roles[key].push(value);
    }
  });

  ROLE_DEFINITIONS.forEach(role => {
    competition.roles[role.key] = uniqueNames(competition.roles[role.key]).slice(0, role.max);
  });

  rolesVisible = true;
  saveState();
  renderChecklist();
}

document.addEventListener("dragenter", event => {
  if (!draggedTask && !draggedSectionId) return;
  updateDragAutoScroll(event);
});

document.addEventListener("dragover", event => {
  if (!draggedTask && !draggedSectionId) return;

  updateDragAutoScroll(event);

  const overSidebar = event.target.closest(".sidebar");
  if (!overSidebar) {
    event.preventDefault();
  }

  const blockedTarget = event.target.closest("input, textarea, select, [contenteditable='true']");
  if (blockedTarget) {
    event.preventDefault();
    event.stopPropagation();
  }
});

document.addEventListener("drop", event => {
  if (!draggedTask && !draggedSectionId) return;

  stopDragAutoScroll();

  const validDropTarget = event.target.closest("[data-task-drop-section], .phase-column, .add-section-panel");
  const blockedTarget = event.target.closest("input, textarea, select, [contenteditable='true']");

  if (blockedTarget || !validDropTarget) {
    event.preventDefault();
    event.stopPropagation();
  }
});

document.addEventListener("dragend", stopDragAutoScroll);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    stopDragAutoScroll();
  }
});

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
  const name = formatName(input.value);
  if (!name || draftPeople.some(person => person.toLocaleLowerCase("fo") === name.toLocaleLowerCase("fo"))) return;

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
  const name = formatName(input.value);
  if (!name || editDraftPeople.some(person => person.toLocaleLowerCase("fo") === name.toLocaleLowerCase("fo"))) return;

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
  competition.people = uniqueNames(editDraftPeople);

  activeResponsibleFilters = activeResponsibleFilters
    .map(formatName)
    .filter(person => competition.people.includes(person));

  getAllTasks(competition).forEach(task => {
    task.responsibles = uniqueNames(taskResponsibles(task)).filter(person => competition.people.includes(person));
    task.responsible = task.responsibles[0] || "";
  });

  saveState();
  $("#editCompetitionModal").close();
  renderDashboard();
  renderChecklist();
});

$("#competitionForm").addEventListener("submit", event => {
  event.preventDefault();

  const selectedTemplateId = $("#competitionTemplate").value;
  const selectedTemplate = selectedTemplateId
    ? state.templates.find(template => template.id === selectedTemplateId)
    : null;

  const competition = {
    id: makeId(),
    name: $("#competitionName").value,
    date: $("#competitionDate").value,
    venue: $("#competitionVenue").value,
    password: $("#competitionPassword").value,
    people: uniqueNames(draftPeople),
    roles: makeEmptyRoles(),
    sections: selectedTemplate ? cloneSections(selectedTemplate.sections) : []
  };

  state.competitions.push(competition);
  activeCompetitionId = competition.id;
  activeResponsibleFilters = [];
  activeSectionFilters = [];
  showIncompleteOnly = false;
  rolesVisible = false;
  saveState();

  $("#competitionForm").reset();
  $("#competitionTemplate").value = "";
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

$("#closeTaskEditModal").addEventListener("click", () => $("#taskEditModal").close());

$("#showAddTaskPersonBtn").addEventListener("click", () => {
  const row = $("#taskPersonAddRow");
  const shouldShow = row.classList.contains("hidden") || row.hidden;
  row.classList.toggle("hidden", !shouldShow);
  row.hidden = !shouldShow;

  if (shouldShow) {
    $("#taskPersonNameInput").focus();
  }
});

function addPersonFromTaskEditor() {
  const result = getEditingTask();
  if (!result) return;

  const { competition, section, task } = result;
  const originalOrder = section.tasks.map(item => item.id);
  const input = $("#taskPersonNameInput");
  const name = formatName(input.value);

  if (!name) return;

  competition.people = uniqueNames([...(competition.people || []), name]);
  task.responsibles = uniqueNames([...taskResponsibles(task), name]);
  task.responsible = task.responsibles[0] || "";
  restoreTaskOrder(section, originalOrder);

  input.value = "";
  $("#taskPersonAddRow").classList.add("hidden");
  $("#taskPersonAddRow").hidden = true;
  saveState();
  renderResponsibleChoices(competition, task);
  renderDashboard();
}

$("#addTaskPersonBtn").addEventListener("click", addPersonFromTaskEditor);

$("#taskPersonNameInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    addPersonFromTaskEditor();
  }
});

$("#editTaskHasDeadline").addEventListener("change", () => {
  $("#deadlineFields").classList.toggle("hidden", !$("#editTaskHasDeadline").checked);
});

$("#taskEditForm").addEventListener("submit", event => {
  event.preventDefault();

  const result = getEditingTask();
  if (!result) return;

  const { section, task } = result;
  const originalOrder = section.tasks.map(item => item.id);
  const selectedResponsibles = uniqueNames($$("#editTaskResponsibleList input:checked").map(input => input.value));

  task.title = $("#editTaskTitle").value;
  task.responsibles = selectedResponsibles;
  task.responsible = selectedResponsibles[0] || "";
  task.hasDeadline = $("#editTaskHasDeadline").checked;
  task.deadlineDate = task.hasDeadline ? $("#editTaskDeadlineDate").value : "";
  task.deadlineTime = task.hasDeadline ? $("#editTaskDeadlineTime").value : "";
  task.note = $("#editTaskNote").value;
  restoreTaskOrder(section, originalOrder);

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
