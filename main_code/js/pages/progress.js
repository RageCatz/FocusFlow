"use strict";

/* Progress page functionality. */

const PROGRESS_DATA_KEY = "focusflowDashboardData";
const PROGRESS_SETTINGS_KEY = "focusflowDashboardSettings";
const BREAK_STATS_KEY = "focusflowBreakStats";
const PROGRESS_HISTORY_KEY = "focusflowProgressHistory";

let progressData = loadProgressData();
let progressSettings = {
  ...FocusFlowShared.DEFAULT_SETTINGS,
  ...FocusFlowShared.readStorage(PROGRESS_SETTINGS_KEY, {})
};


function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadProgressData() {
  const saved = FocusFlowShared.readStorage(PROGRESS_DATA_KEY, {});

  return {
    profile: {
      name: "Huan Qi",
      username: "huanqi",
      country: "New Zealand",
      year: "Year 12",
      industry: "High School Student",
      avatar: "HQ",
      ...(saved.profile || {})
    },
    tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
    progress: {
      focusMinutesToday: 0,
      dailyGoalMinutes: 60,
      streak: 0,
      ...(saved.progress || {})
    },
    settings: {
      ...(saved.settings || {})
    }
  };
}

function saveProgressData() {
  progressData.settings = {
    ...progressData.settings,
    ...progressSettings
  };

  FocusFlowShared.writeStorage(PROGRESS_DATA_KEY, progressData);
  FocusFlowShared.writeStorage(PROGRESS_SETTINGS_KEY, progressSettings);
}

function getBreakStats() {
  return FocusFlowShared.readStorage(BREAK_STATS_KEY, {
    completedBreaks: 0
  });
}

function getHistory() {
  const history = FocusFlowShared.readStorage(PROGRESS_HISTORY_KEY, {});
  const today = localDate();
  const focusMinutes = Number(progressData.progress.focusMinutesToday || 0);

  history[today] = focusMinutes;

  FocusFlowShared.writeStorage(PROGRESS_HISTORY_KEY, history);
  return history;
}

function saveTodayToHistory() {
  const history = FocusFlowShared.readStorage(PROGRESS_HISTORY_KEY, {});
  history[localDate()] = Number(progressData.progress.focusMinutesToday || 0);
  FocusFlowShared.writeStorage(PROGRESS_HISTORY_KEY, history);
}

function getMetrics() {
  const totalTasks = progressData.tasks.length;
  const completedTasks = progressData.tasks.filter(task => task.status === "done").length;
  const incompleteTasks = totalTasks - completedTasks;
  const focusMinutes = Number(progressData.progress.focusMinutesToday || 0);
  const dailyGoal = Math.max(1, Number(progressData.progress.dailyGoalMinutes || 60));
  const streak = Number(progressData.progress.streak || 0);
  const completedBreaks = Number(getBreakStats().completedBreaks || 0);
  const taskCompletion = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;
  const goalPercentage = Math.min(100, Math.round((focusMinutes / dailyGoal) * 100));
  const xp = focusMinutes + completedTasks * 25 + completedBreaks * 10;

  return {
    totalTasks,
    completedTasks,
    incompleteTasks,
    focusMinutes,
    dailyGoal,
    streak,
    completedBreaks,
    taskCompletion,
    goalPercentage,
    xp
  };
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderSummary() {
  const metrics = getMetrics();

  setText("xpValue", `${metrics.xp} XP`);
  setText("focusMinutesStat", `${metrics.focusMinutes} min`);
  setText("focusGoalStat", `${metrics.goalPercentage}% of goal`);
  setText("tasksCompletedStat", metrics.completedTasks);
  setText("taskCompletionStat", `${metrics.taskCompletion}% completion`);
  setText("breaksCompletedStat", metrics.completedBreaks);
  setText("streakStat", `${metrics.streak} day${metrics.streak === 1 ? "" : "s"}`);

  setText("goalProgressText", `${metrics.focusMinutes} / ${metrics.dailyGoal} min`);
  setText("goalPercentageText", `${metrics.goalPercentage}%`);
  setText("summaryFocusMinutes", `${metrics.focusMinutes} min`);
  setText("summaryTasks", metrics.completedTasks);
  setText("summaryIncompleteTasks", metrics.incompleteTasks);
  setText("summaryBreaks", metrics.completedBreaks);

  const goalInput = document.getElementById("dailyGoal");
  if (goalInput) goalInput.value = metrics.dailyGoal;

  const goalBar = document.getElementById("goalProgressBar");
  if (goalBar) goalBar.style.width = `${metrics.goalPercentage}%`;
}

function getLastSevenDays() {
  const history = getHistory();
  const todayKey = localDate();
  const currentTodayMinutes = Number(
    progressData.progress.focusMinutesToday || 0
  );
  const days = [];

  /*
   * Today's weekly bar must always match the live Focus minutes shown in the
   * Daily Focus Goal and Today at a Glance cards. Older days continue to use
   * saved history.
   */
  history[todayKey] = currentTodayMinutes;
  FocusFlowShared.writeStorage(PROGRESS_HISTORY_KEY, history);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    const key = localDate(date);
    days.push({
      key,
      label: new Intl.DateTimeFormat("en-NZ", {
        weekday: "short"
      }).format(date),
      minutes: key === todayKey
        ? currentTodayMinutes
        : Number(history[key] || 0)
    });
  }

  return days;
}

function renderWeeklyBars() {
  const container = document.getElementById("weeklyBars");
  if (!container) return;

  const days = getLastSevenDays();
  const maxMinutes = Math.max(
    1,
    Number(progressData.progress.dailyGoalMinutes || 60),
    ...days.map(day => day.minutes)
  );

  container.innerHTML = days.map(day => {
    const height = Math.max(
      day.minutes > 0 ? 8 : 3,
      Math.min(100, (day.minutes / maxMinutes) * 100)
    );

    return `
      <div class="weekly-day">
        <strong>${FocusFlowShared.escapeHtml(day.label)}</strong>
        <div class="weekly-track" title="${day.minutes} focus minutes">
          <span style="height:${height}%"></span>
        </div>
        <small>${day.minutes}m</small>
      </div>
    `;
  }).join("");
}

function renderAchievements() {
  const container = document.getElementById("achievementGrid");
  if (!container) return;

  const metrics = getMetrics();
  const achievements = [
    {
      icon: "🎯",
      title: "Goal Getter",
      description: "Reach your daily focus goal.",
      unlocked: metrics.focusMinutes >= metrics.dailyGoal
    },
    {
      icon: "✅",
      title: "Task Finisher",
      description: "Complete at least 3 tasks.",
      unlocked: metrics.completedTasks >= 3
    },
    {
      icon: "☕",
      title: "Healthy Breaks",
      description: "Complete at least 3 breaks.",
      unlocked: metrics.completedBreaks >= 3
    },
    {
      icon: "🔥",
      title: "Study Streak",
      description: "Build a 3-day study streak.",
      unlocked: metrics.streak >= 3
    }
  ];

  container.innerHTML = achievements.map(item => `
    <article class="achievement ${item.unlocked ? "unlocked" : ""}">
      <div class="achievement-icon" aria-hidden="true">${item.icon}</div>
      <strong>${FocusFlowShared.escapeHtml(item.title)}</strong>
      <span>
        ${FocusFlowShared.escapeHtml(item.description)}
        ${item.unlocked ? " Unlocked." : ""}
      </span>
    </article>
  `).join("");
}

function renderCalendar() {
  const container = document.getElementById("studyCalendar");
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const history = getHistory();

  setText(
    "calendarMonthLabel",
    new Intl.DateTimeFormat("en-NZ", {
      month: "long",
      year: "numeric"
    }).format(now)
  );

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((leadingDays + lastDay.getDate()) / 7) * 7;
  const todayKey = localDate();

  const cells = [];

  for (let cell = 0; cell < totalCells; cell += 1) {
    const dayNumber = cell - leadingDays + 1;

    if (dayNumber < 1 || dayNumber > lastDay.getDate()) {
      cells.push('<div class="calendar-day muted-day" aria-hidden="true"></div>');
      continue;
    }

    const date = new Date(year, month, dayNumber, 12);
    const key = localDate(date);
    const studied = Number(history[key] || 0) > 0;
    const today = key === todayKey;

    cells.push(`
      <div
        class="calendar-day ${studied ? "studied" : ""} ${today ? "today" : ""}"
        title="${studied ? `${history[key]} focus minutes` : "No focus minutes recorded"}"
      >
        ${dayNumber}
      </div>
    `);
  }

  container.innerHTML = cells.join("");
}

function renderAllProgress() {
  progressData = loadProgressData();
  renderSummary();
  renderWeeklyBars();
  renderAchievements();
  renderCalendar();
}

function saveDailyGoal() {
  const input = document.getElementById("dailyGoal");
  const saveButton = document.getElementById("saveGoalButton");
  const value = Math.round(Number(input?.value));

  if (!Number.isFinite(value) || value < 1 || value > 480) {
    FocusFlowShared.showToast(
      "Choose a daily goal between 1 and 480 minutes.",
      "error"
    );

    input?.focus();
    return;
  }

  /*
   * Read the latest shared data before saving so a Progress-page save never
   * overwrites newer task/focus changes made by another FocusFlow page.
   */
  const latestData = FocusFlowShared.readStorage(PROGRESS_DATA_KEY, {});
  const latestProgress = {
    focusMinutesToday: 0,
    dailyGoalMinutes: 60,
    streak: 0,
    ...(latestData.progress || {}),
    dailyGoalMinutes: value
  };

  const updatedData = {
    ...latestData,
    profile: {
      ...progressData.profile,
      ...(latestData.profile || {})
    },
    tasks: Array.isArray(latestData.tasks)
      ? latestData.tasks
      : progressData.tasks,
    progress: latestProgress,
    settings: {
      ...(latestData.settings || {}),
      ...progressSettings
    }
  };

  FocusFlowShared.writeStorage(PROGRESS_DATA_KEY, updatedData);

  progressData = {
    ...progressData,
    ...updatedData,
    progress: latestProgress
  };

  if (input) input.value = value;

  renderSummary();
  renderWeeklyBars();
  renderAchievements();
  renderCalendar();

  if (saveButton) {
    const originalText = saveButton.textContent;
    saveButton.textContent = "Saved ✓";
    saveButton.disabled = true;

    window.setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }, 900);
  }

  FocusFlowShared.showToast(
    `Daily focus goal saved as ${value} minutes.`,
    "success"
  );
}

function showResetProgressModal() {
  const modal = document.getElementById("resetProgressModal");
  if (modal) modal.hidden = false;
}

function hideResetProgressModal() {
  const modal = document.getElementById("resetProgressModal");
  if (modal) modal.hidden = true;
}

function confirmResetTodayProgress() {
  progressData.progress.focusMinutesToday = 0;
  saveProgressData();

  FocusFlowShared.writeStorage(BREAK_STATS_KEY, {
    completedBreaks: 0
  });

  saveTodayToHistory();
  renderAllProgress();
  hideResetProgressModal();

  FocusFlowShared.showToast("Today's progress was reset.", "success");
}

function printProgress() {
  window.print();
}


function applyProgressSettings() {
  FocusFlowShared.applyAppSettings(progressSettings);
}

function connectControls() {
  document.getElementById("saveGoalButton")?.addEventListener("click", saveDailyGoal);

  document.getElementById("dailyGoal")?.addEventListener("keydown", event => {
    if (event.key === "Enter") saveDailyGoal();
  });

  document.getElementById("resetProgressButton")?.addEventListener(
    "click",
    showResetProgressModal
  );

  document.getElementById("confirmResetProgressButton")?.addEventListener(
    "click",
    confirmResetTodayProgress
  );

  document.getElementById("cancelResetProgressButton")?.addEventListener(
    "click",
    hideResetProgressModal
  );

  document.getElementById("resetProgressModal")?.addEventListener(
    "click",
    event => {
      if (event.target === event.currentTarget) {
        hideResetProgressModal();
      }
    }
  );

  document.getElementById("printProgressButton")?.addEventListener(
    "click",
    printProgress
  );

  document.getElementById("printReportButton")?.addEventListener(
    "click",
    printProgress
  );

  window.addEventListener("storage", event => {
    if (
      event.key === PROGRESS_DATA_KEY ||
      event.key === BREAK_STATS_KEY ||
      event.key === PROGRESS_HISTORY_KEY
    ) {
      renderAllProgress();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      hideResetProgressModal();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      renderAllProgress();
    }
  });
}

function initializeProgressPage() {
  FocusFlowShared.fillProfile(progressData.profile);
  applyProgressSettings();

  FocusFlowShared.connectPageChrome({
    getTasks: () => progressData.tasks,
    getSettings: () => progressSettings,
    setSettings: nextSettings => {
      progressSettings = {
        ...progressSettings,
        ...nextSettings
      };

      FocusFlowShared.writeStorage(
        PROGRESS_SETTINGS_KEY,
        progressSettings
      );

      saveProgressData();
    },
    afterSettingChange: applyProgressSettings
  });

  connectControls();
  renderAllProgress();
}


document.addEventListener("DOMContentLoaded", initializeProgressPage);