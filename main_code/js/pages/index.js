"use strict";

/* Dashboard data and defaults */
const DASHBOARD_KEY = "focusflowDashboardData";
const SETTINGS_KEY = "focusflowDashboardSettings";
const NOTIFICATIONS_KEY = "focusflowNotifications";

const defaultSettings = {
  focusDuration: 25,
  focusMode: false,
  notifications: true,
  soundAlerts: true,
  darkMode: false,
  autoStartBreaks: true,
  showStatsOnHome: true
};

const checkIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 6 9 17l-5-5"></path>
  </svg>
`;

/* Date helpers */
function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* Data loading and persistence */
function createDefaultData() {
  return {
    profile: {
      name: "Huan Qi",
      username: "huanqi",
      country: "New Zealand",
      year: "Year 12",
      industry: "High School Student",
      avatar: "HQ"
    },
    tasks: [
      { id: 1, name: "Math Homework", dueDate: localDate(), status: "todo" },
      { id: 2, name: "Science Revision", dueDate: localDate(1), status: "todo" },
      { id: 3, name: "English Essay", dueDate: localDate(2), status: "todo" },
      { id: 4, name: "History Notes", dueDate: localDate(-1), status: "todo" }
    ],
    progress: {
      focusMinutesToday: 0,
      dailyGoalMinutes: 60,
      streak: 0
    },
    settings: { ...defaultSettings }
  };
}

function loadData() {
  const defaults = createDefaultData();
  const savedData = FocusFlowShared.readStorage(DASHBOARD_KEY, {});
  const savedSettings = FocusFlowShared.readStorage(SETTINGS_KEY, {});

  return {
    profile: { ...defaults.profile, ...(savedData.profile || {}) },
    tasks: Array.isArray(savedData.tasks) ? savedData.tasks : defaults.tasks,
    progress: { ...defaults.progress, ...(savedData.progress || {}) },
    settings: {
      ...defaults.settings,
      ...(savedData.settings || {}),
      ...savedSettings
    }
  };
}

let dashboardData = loadData();

function saveData() {
  localStorage.setItem(DASHBOARD_KEY, JSON.stringify(dashboardData));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(dashboardData.settings));
}

/* Dashboard formatting and rendering */
function formatDate(dateString) {
  if (!dateString) return "No date";

  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function fillProfile() {
  FocusFlowShared.fillProfile(dashboardData.profile);
}

function createTaskRow(task, isOverdue = false) {
  const checked = task.status === "done";

  return `
    <div class="list-item ${isOverdue ? "overdue-item" : ""}">
      <div class="task-line">
        <button
          class="checkbox ${checked ? "checked" : ""}"
          type="button"
          data-task-id="${FocusFlowShared.escapeHtml(task.id)}"
          aria-label="Toggle ${FocusFlowShared.escapeHtml(task.name)}"
        >
          ${checked ? checkIcon : ""}
        </button>

        <div>
          <div class="task-title">${FocusFlowShared.escapeHtml(task.name)}</div>
          <div class="task-sub">Due: ${formatDate(task.dueDate)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTasks() {
  const taskList = document.getElementById("dashboardTaskList");
  const today = localDate();

  const todaysTasks = dashboardData.tasks.filter(task => {
    return task.status !== "done" && task.dueDate === today;
  });

  const overdueTasks = dashboardData.tasks.filter(task => {
    return task.status !== "done" && task.dueDate && task.dueDate < today;
  });

  let html = todaysTasks.length
    ? todaysTasks.map(task => createTaskRow(task)).join("")
    : '<div class="empty">No tasks due today.</div>';

  if (overdueTasks.length) {
    html += `
      <div class="overdue-block">
        <div class="overdue-title">Overdue Tasks</div>
        ${overdueTasks.map(task => createTaskRow(task, true)).join("")}
      </div>
    `;
  }

  taskList.innerHTML = html;

  taskList.querySelectorAll("[data-task-id]").forEach(button => {
    button.addEventListener("click", () => toggleTask(button.dataset.taskId));
  });
}

function toggleTask(taskId) {
  const task = dashboardData.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;

  task.status = task.status === "done" ? "todo" : "done";
  saveData();
  renderDashboard();

  FocusFlowShared.showToast(
    task.status === "done"
      ? `Task “${task.name}” completed`
      : `Task “${task.name}” moved back to To Do`,
    task.status === "done" ? "success" : "info"
  );
}

/* Shared application settings */
function applySettings() {
  FocusFlowShared.applyAppSettings(dashboardData.settings);
}

let dashboardHeader = null;

/* Main dashboard refresh */
function renderDashboard() {
  renderTasks();
  dashboardHeader?.renderNotifications?.();

  const completedTasks = dashboardData.tasks.filter(task => task.status === "done").length;
  const focusMinutes = Number(dashboardData.progress.focusMinutesToday || 0);
  const dailyGoal = Number(dashboardData.progress.dailyGoalMinutes || 60);
  const streak = Number(dashboardData.progress.streak || 0);

  document.getElementById("focusDuration").textContent = dashboardData.settings.focusDuration;
  document.getElementById("streakValue").textContent = `${streak} day${streak === 1 ? "" : "s"}`;
  document.getElementById("focusMinutesValue").textContent = `${focusMinutes} min`;
  document.getElementById("tasksDoneValue").textContent = `${completedTasks}/${dashboardData.tasks.length}`;
  document.getElementById("dailyGoalValue").textContent = `${Math.min(focusMinutes, dailyGoal)}/${dailyGoal} min`;

  document.querySelectorAll("[data-home-stats]").forEach(element => {
    element.hidden = !dashboardData.settings.showStatsOnHome;
  });
}

function wireEvents() {
  dashboardHeader = FocusFlowShared.connectPageChrome({
    getTasks: () => dashboardData.tasks,
    getSettings: () => dashboardData.settings,
    setSettings: nextSettings => {
      dashboardData.settings = { ...dashboardData.settings, ...nextSettings };
      saveData();
    },
    afterSettingChange: () => {
      applySettings();
      renderDashboard();
    },
    panelIds: ["notifyPanel", "quickSettings", "profilePanel", "sidebarProfilePanel"],
    panelControllerOptions: {
      expandedButtonId: "sidebarUser",
      expandedPanelId: "sidebarProfilePanel"
    },
    buttonPanelPairs: [
      ["notifyBtn", "notifyPanel"],
      ["quickSettingsBtn", "quickSettings"],
      ["profileBtn", "profilePanel"],
      ["sidebarUser", "sidebarProfilePanel"]
    ]
  });

  document.getElementById("quickAddTask")?.addEventListener("click", () => {
    window.location.href = "tasks.html";
  });
}

function initialiseDashboard() {
  document.getElementById("greetingText").textContent = getGreeting();
  document.getElementById("footerYear").textContent = new Date().getFullYear();

  fillProfile();
  applySettings();
  renderDashboard();
  wireEvents();
}

document.addEventListener("DOMContentLoaded", initialiseDashboard);