"use strict";

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

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function loadData() {
  const defaults = createDefaultData();
  const savedData = readStorage(DASHBOARD_KEY, {});
  const savedSettings = readStorage(SETTINGS_KEY, {});

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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

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
  const profile = dashboardData.profile;
  const avatar = profile.avatar || profile.name.slice(0, 2).toUpperCase();

  document.querySelectorAll("[data-profile-name]").forEach(element => {
    element.textContent = profile.name;
  });

  document.querySelectorAll("[data-profile-username]").forEach(element => {
    element.textContent = `@${profile.username}`;
  });

  document.querySelectorAll("[data-profile-country]").forEach(element => {
    element.textContent = profile.country;
  });

  document.querySelectorAll("[data-profile-year]").forEach(element => {
    element.textContent = profile.year;
  });

  document.querySelectorAll("[data-profile-industry]").forEach(element => {
    element.textContent = profile.industry;
  });

  document.querySelectorAll("[data-profile-avatar]").forEach(element => {
    element.textContent = avatar;
  });
}

function createTaskRow(task, isOverdue = false) {
  const checked = task.status === "done";

  return `
    <div class="list-item ${isOverdue ? "overdue-item" : ""}">
      <div class="task-line">
        <button
          class="checkbox ${checked ? "checked" : ""}"
          type="button"
          data-task-id="${escapeHtml(task.id)}"
          aria-label="Toggle ${escapeHtml(task.name)}"
        >
          ${checked ? checkIcon : ""}
        </button>

        <div>
          <div class="task-title">${escapeHtml(task.name)}</div>
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

  showToast(
    task.status === "done"
      ? `Task “${task.name}” completed`
      : `Task “${task.name}” moved back to To Do`,
    task.status === "done" ? "success" : "info"
  );
}

function createNotifications() {
  const savedNotifications = readStorage(NOTIFICATIONS_KEY, []);
  const readIds = new Set(
    savedNotifications
      .filter(notification => notification.read)
      .map(notification => String(notification.id))
  );

  const today = localDate();
  const tomorrow = localDate(1);

  const notifications = [
    {
      id: "welcome",
      title: "Welcome",
      text: "Welcome back to FocusFlow. Have a great study session today.",
      read: readIds.has("welcome")
    }
  ];

  dashboardData.tasks.forEach(task => {
    if (task.status === "done" || !task.dueDate) return;

    if (task.dueDate < today) {
      const id = `overdue-${task.id}-${today}`;
      notifications.push({
        id,
        title: "Overdue task",
        text: `${task.name} was due ${formatDate(task.dueDate)}.`,
        read: readIds.has(id)
      });
    }

    if (task.dueDate === tomorrow) {
      const id = `upcoming-${task.id}-${today}`;
      notifications.push({
        id,
        title: "Task due tomorrow",
        text: `${task.name} is due tomorrow.`,
        read: readIds.has(id)
      });
    }
  });

  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  return notifications;
}

function renderNotifications() {
  const notificationList = document.getElementById("notificationList");
  const notificationDot = document.getElementById("notificationDot");
  const notificationSubtitle = document.getElementById("notificationSubtitle");
  const markAllButton = document.getElementById("clearNotifications");

  const notificationsEnabled = dashboardData.settings.notifications;
  const notifications = createNotifications();
  const unreadCount = notifications.filter(notification => !notification.read).length;

  notificationDot.hidden = !notificationsEnabled || unreadCount === 0;
  markAllButton.hidden = !notificationsEnabled || unreadCount === 0;

  if (!notificationsEnabled) {
    notificationSubtitle.textContent = "Notifications are turned off.";
    notificationList.innerHTML = `
      <div class="notify-empty">
        Notifications are turned off in Quick Settings.
      </div>
    `;
    return;
  }

  notificationSubtitle.textContent = unreadCount
    ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}.`
    : "You are all caught up.";

  notificationList.innerHTML = notifications.map(notification => `
    <button
      class="notification-item ${notification.read ? "read" : "unread"}"
      type="button"
      data-notification-id="${escapeHtml(notification.id)}"
    >
      <span class="notification-mark"></span>
      <span class="notification-copy">
        <span class="notification-title">${escapeHtml(notification.title)}</span>
        <span class="notification-text">${escapeHtml(notification.text)}</span>
        <span class="notification-meta">
          Just now${notification.read ? " • Read" : ""}
        </span>
      </span>
    </button>
  `).join("");

  notificationList.querySelectorAll("[data-notification-id]").forEach(button => {
    button.addEventListener("click", () => {
      markNotificationRead(button.dataset.notificationId);
    });
  });
}

function markNotificationRead(notificationId) {
  const notifications = readStorage(NOTIFICATIONS_KEY, []);

  notifications.forEach(notification => {
    if (String(notification.id) === String(notificationId)) {
      notification.read = true;
    }
  });

  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  renderNotifications();
}

function markAllNotificationsRead() {
  const notifications = readStorage(NOTIFICATIONS_KEY, []);

  notifications.forEach(notification => {
    notification.read = true;
  });

  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  renderNotifications();
  showToast("All notifications marked as read", "success");
}

function applySettings() {
  document.body.classList.toggle("dark-mode", dashboardData.settings.darkMode);
  document.body.classList.toggle("focus-mode", dashboardData.settings.focusMode);

  document.querySelectorAll("[data-toggle]").forEach(button => {
    const settingName = button.dataset.toggle;
    const enabled = Boolean(dashboardData.settings[settingName]);

    button.classList.toggle("on", enabled);
    button.setAttribute("aria-pressed", String(enabled));
  });
}

function toggleSetting(settingName) {
  dashboardData.settings[settingName] = !dashboardData.settings[settingName];

  saveData();
  applySettings();
  renderDashboard();

  const labels = {
    focusMode: "Focus mode",
    notifications: "Notifications",
    soundAlerts: "Sound alerts",
    darkMode: "Dark mode",
    autoStartBreaks: "Auto start breaks",
    showStatsOnHome: "Dashboard stats"
  };

  showToast(
    `${labels[settingName]} ${dashboardData.settings[settingName] ? "enabled" : "disabled"}`,
    "info"
  );
}

function renderDashboard() {
  renderTasks();
  renderNotifications();

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

const panelIds = [
  "notifyPanel",
  "quickSettings",
  "profilePanel",
  "sidebarProfilePanel"
];

function closePanels(exceptId = "") {
  panelIds.forEach(panelId => {
    if (panelId === exceptId) return;

    document.getElementById(panelId)?.classList.remove("open");
  });

  if (exceptId !== "sidebarProfilePanel") {
    document.getElementById("sidebarUser")?.setAttribute("aria-expanded", "false");
  }
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const shouldOpen = !panel.classList.contains("open");
  closePanels(panelId);
  panel.classList.toggle("open", shouldOpen);

  if (panelId === "sidebarProfilePanel") {
    document.getElementById("sidebarUser")?.setAttribute(
      "aria-expanded",
      String(shouldOpen)
    );
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 250);
  }, 2600);
}

function logout() {
  sessionStorage.removeItem("focusflowCurrentUser");
  sessionStorage.removeItem("focusflow_token");
  sessionStorage.removeItem("focusflow_username");
  window.location.href = "login.html";
}

function wirePanelButton(buttonId, panelId) {
  const button = document.getElementById(buttonId);
  const panel = document.getElementById(panelId);

  if (!button || !panel) return;

  button.addEventListener("click", event => {
    event.stopPropagation();
    togglePanel(panelId);
  });

  panel.addEventListener("click", event => {
    event.stopPropagation();
  });
}

function wireEvents() {
  wirePanelButton("notifyBtn", "notifyPanel");
  wirePanelButton("quickSettingsBtn", "quickSettings");
  wirePanelButton("profileBtn", "profilePanel");
  wirePanelButton("sidebarUser", "sidebarProfilePanel");

  document.getElementById("clearNotifications")?.addEventListener(
    "click",
    markAllNotificationsRead
  );

  document.getElementById("quickAddTask")?.addEventListener("click", () => {
    window.location.href = "tasks.html";
  });

  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("sidebarLogoutBtn")?.addEventListener("click", logout);

  document.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      toggleSetting(button.dataset.toggle);
    });
  });

  document.addEventListener("click", () => closePanels());

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePanels();
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