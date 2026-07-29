"use strict";

/* Tasks data and settings */
const TASK_DATA_KEY = "focusflowDashboardData";
const FOCUS_TASK_KEY = "focusflowSelectedTaskId";
const TASK_SETTINGS_KEY = "focusflowDashboardSettings";
const LEGACY_TASK_SETTINGS_KEY = "focusflowTaskSettings";

let activeFilter = "all";
let activeSort = "due-asc";
let editingTaskId = null;
let taskPendingDeletion = null;

const defaultTaskSettings = {
  focusMode: false,
  notifications: true,
  soundAlerts: true,
  darkMode: false,
  autoStartBreaks: true,
  showStatsOnHome: true
};

const legacyTaskSettings = FocusFlowShared.readStorage(LEGACY_TASK_SETTINGS_KEY, {});
let taskSettings = {
  ...defaultTaskSettings,
  ...legacyTaskSettings,
  ...FocusFlowShared.readStorage(TASK_SETTINGS_KEY, {})
};

const checkIcon = `
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 6 9 17l-5-5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></path>
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
      {
        id: 1,
        name: "Math Homework",
        dueDate: localDate(),
        priority: "high",
        status: "todo"
      },
      {
        id: 2,
        name: "Science Revision",
        dueDate: localDate(1),
        priority: "medium",
        status: "todo"
      },
      {
        id: 3,
        name: "English Essay",
        dueDate: localDate(2),
        priority: "low",
        status: "todo"
      },
      {
        id: 4,
        name: "History Notes",
        dueDate: localDate(-1),
        priority: "medium",
        status: "todo"
      }
    ],
    progress: {
      focusMinutesToday: 0,
      dailyGoalMinutes: 60,
      streak: 0
    },
    settings: {}
  };
}

function loadData() {
  const defaults = createDefaultData();
  const saved = FocusFlowShared.readStorage(TASK_DATA_KEY, {});

  return {
    ...defaults,
    ...saved,
    profile: {
      ...defaults.profile,
      ...(saved.profile || {})
    },
    progress: {
      ...defaults.progress,
      ...(saved.progress || {})
    },
    settings: {
      ...defaults.settings,
      ...(saved.settings || {})
    },
    tasks: Array.isArray(saved.tasks)
      ? saved.tasks.map(task => ({
          id: task.id,
          name: task.name || "Untitled task",
          dueDate: task.dueDate || "",
          priority: task.priority || "medium",
          status: task.status === "done" ? "done" : "todo"
        }))
      : defaults.tasks
  };
}

let taskData = loadData();

function saveData() {
  FocusFlowShared.writeStorage(TASK_DATA_KEY, taskData);
}

/* Task filtering and sorting helpers */
function parseDate(dateString) {
  if (!dateString) return null;

  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(dateString) {
  if (!dateString) return "No date";

  if (dateString === localDate()) return "Today";
  if (dateString === localDate(1)) return "Tomorrow";

  const date = parseDate(dateString);
  if (!date) return "No date";

  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function isOverdue(task) {
  return (
    task.status !== "done" &&
    Boolean(task.dueDate) &&
    task.dueDate < localDate()
  );
}

function getNextId() {
  return taskData.tasks.reduce((largestId, task) => {
    return Math.max(largestId, Number(task.id) || 0);
  }, 0) + 1;
}

function priorityValue(priority) {
  return {
    high: 3,
    medium: 2,
    low: 1
  }[priority] || 0;
}

function filterTasks(tasks) {
  const today = localDate();

  return tasks.filter(task => {
    if (activeFilter === "overdue") return isOverdue(task);
    if (activeFilter === "today") return task.dueDate === today;
    if (activeFilter === "upcoming") {
      return task.status !== "done" && task.dueDate > today;
    }
    if (activeFilter === "completed") return task.status === "done";

    return true;
  });
}

function sortTasks(tasks) {
  return [...tasks].sort((taskA, taskB) => {
    if (activeSort === "due-desc") {
      return String(taskB.dueDate).localeCompare(String(taskA.dueDate));
    }

    if (activeSort === "name-asc") {
      return taskA.name.localeCompare(taskB.name);
    }

    if (activeSort === "name-desc") {
      return taskB.name.localeCompare(taskA.name);
    }

    if (activeSort === "priority-desc") {
      return priorityValue(taskB.priority) - priorityValue(taskA.priority);
    }

    if (activeSort === "priority-asc") {
      return priorityValue(taskA.priority) - priorityValue(taskB.priority);
    }

    if (activeSort === "status") {
      return taskA.status.localeCompare(taskB.status);
    }

    return String(taskA.dueDate).localeCompare(String(taskB.dueDate));
  });
}

function createActionButtons(task) {
  if (String(editingTaskId) === String(task.id)) {
    return `
      <button class="secondary-action" type="button" data-save-edit="${task.id}">
        <span>Save</span>
      </button>

      <button class="danger-action" type="button" data-cancel-edit="${task.id}">
        <span>Cancel</span>
      </button>
    `;
  }

  return `
    <button class="secondary-action" type="button" data-edit-task="${task.id}">
      <span>Edit</span>
    </button>

    <button class="danger-action" type="button" data-delete-task="${task.id}">
      <span>Delete</span>
    </button>

    <button class="secondary-action" type="button" data-focus-task="${task.id}">
      <span>Focus</span>
    </button>
  `;
}

function createTaskRow(task) {
  const completed = task.status === "done";
  const overdue = isOverdue(task);
  const editing = String(editingTaskId) === String(task.id);

  const nameCell = editing
    ? `
      <input
        class="inline-task-input"
        id="editTaskName-${task.id}"
        type="text"
        maxlength="100"
        value="${FocusFlowShared.escapeHtml(task.name)}"
      >
    `
    : `
      <button
        class="task-check ${completed ? "checked" : ""}"
        type="button"
        data-toggle-task="${task.id}"
        aria-label="Mark ${FocusFlowShared.escapeHtml(task.name)} as ${completed ? "not completed" : "completed"}"
      >
        ${completed ? checkIcon : ""}
      </button>

      <strong>${FocusFlowShared.escapeHtml(task.name)}</strong>

      ${completed ? '<span class="completed-badge">Completed</span>' : ""}
      ${overdue ? '<span class="overdue-badge">Overdue</span>' : ""}
    `;

  const dateCell = editing
    ? `
      <input
        class="inline-task-input"
        id="editTaskDate-${task.id}"
        type="date"
        value="${FocusFlowShared.escapeHtml(task.dueDate)}"
      >
    `
    : formatDate(task.dueDate);

  const priorityCell = editing
    ? `
      <select class="inline-task-select" id="editTaskPriority-${task.id}">
        <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
        <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
        <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
      </select>
    `
    : `
      <span class="priority ${task.priority}">
        ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
      </span>
    `;

  return `
    <tr class="${completed ? "completed-row" : ""} ${overdue ? "overdue-row" : ""}">
      <td>
        <div class="task-cell">
          ${nameCell}
        </div>
      </td>

      <td class="${overdue ? "overdue-date" : ""}">
        ${dateCell}
      </td>

      <td>
        ${priorityCell}
      </td>

      <td>
        <button
          class="status-pill ${completed ? "done" : "todo"}"
          type="button"
          data-toggle-task="${task.id}"
        >
          ${completed ? "Done" : "To Do"}
        </button>
      </td>

      <td>
        <div class="action-group">
          ${createActionButtons(task)}
        </div>
      </td>
    </tr>
  `;
}

/* Tasks page rendering */
function renderTasks() {
  const tableBody = document.getElementById("taskTableBody");
  const filteredTasks = sortTasks(filterTasks(taskData.tasks));

  tableBody.innerHTML = filteredTasks.length
    ? filteredTasks.map(createTaskRow).join("")
    : `
      <tr>
        <td class="empty-task-row" colspan="5">
          No tasks in this section.
        </td>
      </tr>
    `;

  const completedCount = taskData.tasks.filter(task => task.status === "done").length;
  const completionBanner = document.getElementById("completionBanner");

  completionBanner.textContent = `${completedCount} task${completedCount === 1 ? "" : "s"} completed. Keep going.`;

  connectTaskActions();
}

function connectTaskActions() {
  document.querySelectorAll("[data-toggle-task]").forEach(button => {
    button.addEventListener("click", () => {
      toggleTask(button.dataset.toggleTask);
    });
  });

  document.querySelectorAll("[data-edit-task]").forEach(button => {
    button.addEventListener("click", () => {
      editingTaskId = button.dataset.editTask;
      renderTasks();
      document.getElementById(`editTaskName-${editingTaskId}`)?.focus();
    });
  });

  document.querySelectorAll("[data-cancel-edit]").forEach(button => {
    button.addEventListener("click", () => {
      editingTaskId = null;
      renderTasks();
    });
  });

  document.querySelectorAll("[data-save-edit]").forEach(button => {
    button.addEventListener("click", () => {
      saveEditedTask(button.dataset.saveEdit);
    });
  });

  document.querySelectorAll("[data-delete-task]").forEach(button => {
    button.addEventListener("click", () => {
      openDeleteModal(button.dataset.deleteTask);
    });
  });

  document.querySelectorAll("[data-focus-task]").forEach(button => {
    button.addEventListener("click", () => {
      selectTaskForFocus(button.dataset.focusTask);
    });
  });
}

function addTask() {
  const nameInput = document.getElementById("taskName");
  const dateInput = document.getElementById("taskDate");
  const priorityInput = document.getElementById("taskPriority");

  const name = nameInput.value.trim();
  const dueDate = dateInput.value;
  const priority = priorityInput.value;

  if (name.length < 2) {
    FocusFlowShared.showToast(
      "Enter a task name with at least 2 characters.",
      "error"
    );
    nameInput.focus();
    return;
  }

  if (!parseDate(dueDate)) {
    FocusFlowShared.showToast("Choose a valid due date.", "error");
    dateInput.focus();
    return;
  }

  taskData.tasks.push({
    id: getNextId(),
    name,
    dueDate,
    priority,
    status: "todo"
  });

  saveData();
  editingTaskId = null;
  activeFilter = "all";

  nameInput.value = "";
  dateInput.value = localDate();
  priorityInput.value = "medium";

  updateActiveFilter();
  renderTasks();

  FocusFlowShared.showToast(`Task “${name}” added.`, "success");
}

function toggleTask(taskId) {
  const task = taskData.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;

  task.status = task.status === "done" ? "todo" : "done";
  saveData();
  renderTasks();

  FocusFlowShared.showToast(
    task.status === "done"
      ? `Task “${task.name}” completed.`
      : `Task “${task.name}” moved back to To Do.`,
    task.status === "done" ? "success" : "info"
  );
}

function saveEditedTask(taskId) {
  const task = taskData.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;

  const nameInput = document.getElementById(`editTaskName-${task.id}`);
  const dateInput = document.getElementById(`editTaskDate-${task.id}`);
  const priorityInput = document.getElementById(`editTaskPriority-${task.id}`);

  const name = nameInput.value.trim();
  const dueDate = dateInput.value;

  if (name.length < 2) {
    FocusFlowShared.showToast(
      "Enter a task name with at least 2 characters.",
      "error"
    );
    nameInput.focus();
    return;
  }

  if (!parseDate(dueDate)) {
    FocusFlowShared.showToast("Choose a valid due date.", "error");
    dateInput.focus();
    return;
  }

  task.name = name;
  task.dueDate = dueDate;
  task.priority = priorityInput.value;

  editingTaskId = null;
  saveData();
  renderTasks();

  FocusFlowShared.showToast(`Task “${name}” updated.`, "success");
}

function openDeleteModal(taskId) {
  const task = taskData.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;

  taskPendingDeletion = task;

  document.getElementById("deleteModalMessage").textContent =
    `“${task.name}” will be permanently removed.`;

  document.getElementById("deleteModal").hidden = false;
  document.getElementById("confirmDeleteButton")?.focus();
}

function closeDeleteModal() {
  document.getElementById("deleteModal").hidden = true;
  taskPendingDeletion = null;
}

function confirmDeleteTask() {
  if (!taskPendingDeletion) return;

  const task = taskPendingDeletion;

  taskData.tasks = taskData.tasks.filter(
    item => String(item.id) !== String(task.id)
  );

  saveData();
  closeDeleteModal();
  renderTasks();

  FocusFlowShared.showToast(`Task “${task.name}” deleted.`, "success");
}

function selectTaskForFocus(taskId) {
  const task = taskData.tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;

  FocusFlowShared.writeStorage(FOCUS_TASK_KEY, task.id);
  window.location.href = "focus.html";
}

function createStudyPlan() {
  const subjectInput = document.getElementById("plannerSubject");
  const deadlineInput = document.getElementById("plannerDeadline");

  const subject = subjectInput.value.trim();
  const deadline = deadlineInput.value;

  if (subject.length < 2) {
    FocusFlowShared.showToast("Enter a subject or assignment.", "error");
    subjectInput.focus();
    return;
  }

  const deadlineDate = parseDate(deadline);
  const todayDate = parseDate(localDate());

  if (!deadlineDate || deadlineDate < todayDate) {
    FocusFlowShared.showToast(
      "Choose today or a future deadline.",
      "error"
    );
    deadlineInput.focus();
    return;
  }

  const totalDays = Math.max(
    1,
    Math.round((deadlineDate - todayDate) / 86400000)
  );

  const stepNames = [
    "Review key ideas",
    "Complete practice questions",
    "Check weak areas",
    "Final revision"
  ];

  const stepCount = Math.min(4, totalDays + 1);

  for (let step = 0; step < stepCount; step += 1) {
    const daysFromToday = Math.round(
      ((step + 1) * totalDays) / stepCount
    );

    taskData.tasks.push({
      id: getNextId(),
      name: `${subject}: ${stepNames[step]}`,
      dueDate: localDate(daysFromToday),
      priority: step === stepCount - 1 ? "high" : "medium",
      status: "todo"
    });
  }

  saveData();
  subjectInput.value = "";
  deadlineInput.value = localDate(7);
  activeFilter = "all";

  updateActiveFilter();
  renderTasks();

  FocusFlowShared.showToast(
    `${stepCount} study steps created for ${subject}.`,
    "success"
  );
}

function updateActiveFilter() {
  document.querySelectorAll("[data-filter]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === activeFilter
    );
  });
}

function connectPageControls() {
  document.getElementById("saveTaskButton")?.addEventListener("click", addTask);
  document.getElementById("createPlanButton")?.addEventListener("click", createStudyPlan);

  document.getElementById("taskSort")?.addEventListener("change", event => {
    activeSort = event.target.value;
    renderTasks();
  });

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      editingTaskId = null;
      updateActiveFilter();
      renderTasks();
    });
  });

  document.getElementById("taskName")?.addEventListener("keydown", event => {
    if (event.key === "Enter") addTask();
  });

  document.getElementById("cancelDeleteButton")?.addEventListener(
    "click",
    closeDeleteModal
  );

  document.getElementById("confirmDeleteButton")?.addEventListener(
    "click",
    confirmDeleteTask
  );

  document.getElementById("deleteModal")?.addEventListener("click", event => {
    if (event.target.id === "deleteModal") {
      closeDeleteModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("deleteModal").hidden) {
      closeDeleteModal();
    }
  });
}

function applyTaskSettings() {
  FocusFlowShared.applyAppSettings(taskSettings);
  document.getElementById("notifyBtn")?.classList.toggle(
    "disabled-notify",
    !taskSettings.notifications
  );
}

function initialiseTasksPage() {
  FocusFlowShared.fillProfile(taskData.profile);
  applyTaskSettings();
  FocusFlowShared.connectPageChrome({
      getTasks: () => taskData.tasks,
      getSettings: () => taskSettings,
      setSettings: nextSettings => {
        taskSettings = { ...taskSettings, ...nextSettings };
        taskData.settings = { ...taskData.settings, ...taskSettings };
        FocusFlowShared.writeStorage(TASK_SETTINGS_KEY, taskSettings);
        saveData();
      },
      afterSettingChange: applyTaskSettings
    });

  const taskDate = document.getElementById("taskDate");
  const plannerDeadline = document.getElementById("plannerDeadline");

  taskDate.value = taskDate.value || localDate();
  plannerDeadline.value = plannerDeadline.value || localDate(7);

  connectPageControls();
  updateActiveFilter();
  renderTasks();
}

/* Page interaction wiring */
document.addEventListener("DOMContentLoaded", initialiseTasksPage);
