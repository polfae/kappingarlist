const STORAGE_KEY = "kappingarklart-v1";

const defaultTemplates = [
  {
    id: "template-official",
    name: "Official kapping",
    tasks: {
      before: [
        {
          title: "Vátta dato og høli",
          responsible: "Kappingarleiðari",
          deadline: "4 vikur áðrenn",
          note: "Tryggja at hølið er tøkt og at dato ikki rakar aðrar kappingar."
        },
        {
          title: "Finna dómarar",
          responsible: "Kappingarleiðari",
          deadline: "3 vikur áðrenn",
          note: "Hav minst eina backup loysn."
        },
        {
          title: "Gera startlista",
          responsible: "Skriviborð",
          deadline: "2 dagar áðrenn",
          note: "Kanna vektbólkar, innvigan og bólkabýti."
        },
        {
          title: "Kanna útgerð",
          responsible: "Útgerðaransvarligur",
          deadline: "1 vika áðrenn",
          note: "Stong, skivur, lás, krít, klokku og teldu."
        }
      ],
      during: [
        {
          title: "Gjøgnumføra innvigan",
          responsible: "Innvigan",
          deadline: "Kappingardag",
          note: "Skráset kropsvekt og fyrstu royndir."
        },
        {
          title: "Briefa hjálparfólk",
          responsible: "Kappingarleiðari",
          deadline: "Áðrenn byrjan",
          note: "Dómarar, speakers, loaders og skriviborð vita sína uppgávu."
        },
        {
          title: "Halda úrslit dagførd",
          responsible: "Skriviborð",
          deadline: "Leikandi",
          note: "Kanna at royndir og samanlagt eru rætt."
        }
      ],
      after: [
        {
          title: "Goyma og senda úrslit",
          responsible: "Skriviborð",
          deadline: "Beint eftir kapping",
          note: "Goym PDF/Excel og send til viðkomandi persónar."
        },
        {
          title: "Rudda hølið",
          responsible: "Øll",
          deadline: "Eftir kapping",
          note: "Útgerð aftur á pláss, rusk burtur og hølið latið pent eftir."
        },
        {
          title: "Takki hjálparfólki og stuðlum",
          responsible: "Nevnd",
          deadline: "1 dag eftir",
          note: "Stutt boð ella postur á sosialum miðlum."
        }
      ]
    }
  }
];

let state = loadState();
let activeView = "dashboard";
let activeTemplateId = state.templates[0]?.id || null;
let activeCompetitionId = null;
let activeFilter = "all";

const navLinks = document.querySelectorAll(".nav-link");
const views = {
  dashboard: document.querySelector("#dashboardView"),
  templates: document.querySelector("#templatesView"),
  checklist: document.querySelector("#checklistView")
};

const competitionGrid = document.querySelector("#competitionGrid");
const templateList = document.querySelector("#templateList");
const templateEditor = document.querySelector("#templateEditor");

const modal = document.querySelector("#createCompetitionModal");
const openCreateCompetition = document.querySelector("#openCreateCompetition");
const closeCompetitionModal = document.querySelector("#closeCompetitionModal");
const competitionForm = document.querySelector("#competitionForm");
const competitionTemplate = document.querySelector("#competitionTemplate");

const createTemplateBtn = document.querySelector("#createTemplateBtn");
const backToDashboard = document.querySelector("#backToDashboard");
const filterButtons = document.querySelectorAll(".filter-btn");

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  return {
    templates: defaultTemplates,
    competitions: [
      {
        id: makeId(),
        name: "Skansi Cup 2026",
        date: "2026-09-12",
        venue: "Tvørmegi",
        password: "stoyt2026",
        tasks: cloneTasks(defaultTemplates[0].tasks)
      }
    ]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cloneTasks(tasks) {
  const cloned = { before: [], during: [], after: [] };

  ["before", "during", "after"].forEach(phase => {
    cloned[phase] = tasks[phase].map(task => ({
      id: makeId(),
      phase,
      title: task.title,
      responsible: task.responsible || "",
      deadline: task.deadline || "",
      note: task.note || "",
      done: false
    }));
  });

  return cloned;
}

function getAllTasks(competition) {
  return [
    ...competition.tasks.before,
    ...competition.tasks.during,
    ...competition.tasks.after
  ];
}

function getProgress(competition) {
  const tasks = getAllTasks(competition);
  if (tasks.length === 0) return 0;
  const done = tasks.filter(task => task.done).length;
  return Math.round((done / tasks.length) * 100);
}

function setView(viewName) {
  activeView = viewName;

  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle("active-view", name === viewName);
  });

  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.view === viewName);
  });

  render();
}

function render() {
  renderDashboard();
  renderTemplateList();
  renderTemplateEditor();
  renderCompetitionSelect();
  renderChecklist();
}

function renderDashboard() {
  competitionGrid.innerHTML = "";

  state.competitions.forEach(competition => {
    const progress = getProgress(competition);

    const card = document.createElement("article");
    card.className = "competition-card";

    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3>${competition.name}</h3>
          <p class="card-meta">${formatDate(competition.date)} · ${competition.venue || "Einki stað ásett"}</p>
        </div>
        <span class="status-badge">${progress === 100 ? "Klárt" : "Í gongd"}</span>
      </div>

      <div class="mini-progress">
        <strong>${progress}% liðugt</strong>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>

      <button class="secondary-btn">Opna checklist</button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      activeCompetitionId = competition.id;
      setView("checklist");
    });

    competitionGrid.appendChild(card);
  });
}

function renderTemplateList() {
  templateList.innerHTML = "";

  state.templates.forEach(template => {
    const button = document.createElement("button");
    button.className = "list-item";
    button.textContent = template.name;

    if (template.id === activeTemplateId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeTemplateId = template.id;
      renderTemplateList();
      renderTemplateEditor();
    });

    templateList.appendChild(button);
  });
}

function renderTemplateEditor() {
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
      <p class="page-description">Hetta er template-mode. Her byggir tú listan, men tú merkir ikki uppgávur sum lidnar.</p>
    </div>

    <div class="editor-grid">
      ${renderTemplateSection("before", "Áðrenn kapping", template)}
      ${renderTemplateSection("during", "Undir kapping", template)}
      ${renderTemplateSection("after", "Eftir kapping", template)}
    </div>
  `;

  document.querySelector("#templateNameInput").addEventListener("input", event => {
    template.name = event.target.value;
    saveState();
    renderTemplateList();
    renderCompetitionSelect();
  });

  templateEditor.querySelectorAll("[data-add-task]").forEach(button => {
    button.addEventListener("click", () => {
      const phase = button.dataset.addTask;
      template.tasks[phase].push({
        title: "Nýggj uppgáva",
        responsible: "",
        deadline: "",
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
      ${tasks.map((task, index) => `
        <div class="template-task">
          <input data-task-field="title" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.title)}" placeholder="Uppgáva" />
          <input data-task-field="responsible" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.responsible || "")}" placeholder="Ábyrgd" />
          <input data-task-field="deadline" data-phase="${phase}" data-index="${index}" value="${escapeHTML(task.deadline || "")}" placeholder="Freist" />
          <button class="delete-small" data-delete-task data-phase="${phase}" data-index="${index}">×</button>
        </div>
      `).join("")}
      <button class="secondary-btn" data-add-task="${phase}" type="button">+ Legg afturat</button>
    </section>
  `;
}

function renderCompetitionSelect() {
  competitionTemplate.innerHTML = "";
  state.templates.forEach(template => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    competitionTemplate.appendChild(option);
  });
}

function renderChecklist() {
  if (activeView !== "checklist") return;

  const competition = state.competitions.find(item => item.id === activeCompetitionId);
  if (!competition) return;

  document.querySelector("#checklistTitle").textContent = competition.name;
  document.querySelector("#checklistMeta").textContent = `${formatDate(competition.date)} · ${competition.venue || "Einki stað ásett"} · Lykilorð: ${competition.password || "einki"}`;

  const progress = getProgress(competition);
  document.querySelector("#progressLabel").textContent = `${progress}% liðugt`;
  document.querySelector("#progressFill").style.width = `${progress}%`;

  renderPhaseTasks("before", competition);
  renderPhaseTasks("during", competition);
  renderPhaseTasks("after", competition);

  document.querySelectorAll(".phase-column").forEach(column => {
    const shouldShow =
      activeFilter === "all" ||
      activeFilter === "todo" ||
      column.dataset.phase === activeFilter;

    column.style.display = shouldShow ? "" : "none";
  });
}

function renderPhaseTasks(phase, competition) {
  const container = document.querySelector(`#${phase}Tasks`);
  container.innerHTML = "";

  const tasks = competition.tasks[phase].filter(task => {
    if (activeFilter === "todo") return !task.done;
    return true;
  });

  tasks.forEach(task => {
    const template = document.querySelector("#taskCardTemplate");
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".task-card");
    const checkbox = clone.querySelector("input");
    const title = clone.querySelector("h4");
    const meta = clone.querySelector(".task-meta");
    const note = clone.querySelector(".task-note");

    card.classList.toggle("done", task.done);
    checkbox.checked = task.done;
    title.textContent = task.title;

    meta.innerHTML = `
      <span class="pill ${task.done ? "done" : ""}">${task.done ? "Liðugt" : "Ikki liðugt"}</span>
      ${task.responsible ? `<span class="pill">Ábyrgd: ${task.responsible}</span>` : ""}
      ${task.deadline ? `<span class="pill">Freist: ${task.deadline}</span>` : ""}
    `;

    note.textContent = task.note || "";

    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveState();
      renderDashboard();
      renderChecklist();
    });

    container.appendChild(clone);
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

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

navLinks.forEach(link => {
  link.addEventListener("click", () => {
    setView(link.dataset.view);
  });
});

openCreateCompetition.addEventListener("click", () => modal.showModal());
closeCompetitionModal.addEventListener("click", () => modal.close());
backToDashboard.addEventListener("click", () => setView("dashboard"));

competitionForm.addEventListener("submit", event => {
  event.preventDefault();

  const selectedTemplate = state.templates.find(template => template.id === competitionTemplate.value);

  const competition = {
    id: makeId(),
    name: document.querySelector("#competitionName").value,
    date: document.querySelector("#competitionDate").value,
    venue: document.querySelector("#competitionVenue").value,
    password: document.querySelector("#competitionPassword").value,
    tasks: cloneTasks(selectedTemplate.tasks)
  };

  state.competitions.push(competition);
  activeCompetitionId = competition.id;
  saveState();

  competitionForm.reset();
  modal.close();
  setView("checklist");
});

createTemplateBtn.addEventListener("click", () => {
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

saveState();
render();
