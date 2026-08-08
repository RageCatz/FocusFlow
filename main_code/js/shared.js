"use strict";

/* =====================================================
   Core shared utilities
===================================================== */
window.FocusFlowShared = {
  readStorage(key, fallbackValue) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallbackValue;
    } catch {
      return fallbackValue;
    }
  },

  writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  },

  fillProfile(profile) {
    if (!profile) return;

    const name = profile.name || "Student";
    const username = profile.username || "student";
    const avatar = profile.avatar || name.slice(0, 2).toUpperCase();

    document.querySelectorAll("[data-profile-name]").forEach(element => {
      element.textContent = name;
    });

    document.querySelectorAll("[data-profile-username]").forEach(element => {
      element.textContent = `@${username}`;
    });

    document.querySelectorAll("[data-profile-country]").forEach(element => {
      element.textContent = profile.country || "";
    });

    document.querySelectorAll("[data-profile-year]").forEach(element => {
      element.textContent = profile.year || "";
    });

    document.querySelectorAll("[data-profile-industry]").forEach(element => {
      element.textContent = profile.industry || "";
    });

    document.querySelectorAll("[data-profile-avatar]").forEach(element => {
      element.textContent = avatar;
    });
  },

  applyBodyTheme(isDarkMode) {
    document.body.classList.toggle("dark-mode", Boolean(isDarkMode));
  },

  syncToggleButtons(settings) {
    document.querySelectorAll("[data-toggle]").forEach(button => {
      const settingName = button.dataset.toggle;
      const enabled = Boolean(settings?.[settingName]);

      button.classList.toggle("on", enabled);
      button.setAttribute("aria-pressed", String(enabled));
    });
  },

  createPanelController(panelIds, options = {}) {
    const { expandedButtonId = "", expandedPanelId = "" } = options;

    function close(exceptId = "") {
      panelIds.forEach(panelId => {
        if (panelId === exceptId) return;
        document.getElementById(panelId)?.classList.remove("open");
      });

      if (expandedButtonId && exceptId !== expandedPanelId) {
        document
          .getElementById(expandedButtonId)
          ?.setAttribute("aria-expanded", "false");
      }
    }

    function toggle(panelId) {
      const panel = document.getElementById(panelId);
      if (!panel) return;

      const shouldOpen = !panel.classList.contains("open");
      close(panelId);
      panel.classList.toggle("open", shouldOpen);

      if (expandedButtonId && panelId === expandedPanelId) {
        document
          .getElementById(expandedButtonId)
          ?.setAttribute("aria-expanded", String(shouldOpen));
      }
    }

    function connectButton(buttonId, panelId) {
      const button = document.getElementById(buttonId);
      const panel = document.getElementById(panelId);

      if (!button || !panel) return;

      button.addEventListener("click", event => {
        event.stopPropagation();
        toggle(panelId);
      });

      panel.addEventListener("click", event => {
        event.stopPropagation();
      });
    }

    return { close, toggle, connectButton };
  },

  showToast(message, type = "info") {
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
  },

  logout() {
    sessionStorage.removeItem("focusflowCurrentUser");
    sessionStorage.removeItem("focusflow_token");
    sessionStorage.removeItem("focusflow_username");
    window.location.href = "login.html";
  }
};



/* =====================================================
   Shared Dashboard and Tasks application controls
   Handles settings, notifications, and header popups.
===================================================== */
FocusFlowShared.SETTINGS_KEY = "focusflowDashboardSettings";
FocusFlowShared.NOTIFICATIONS_KEY = "focusflowNotifications";
FocusFlowShared.DEFAULT_SETTINGS = {
  focusMode: false,
  notifications: true,
  soundAlerts: true,
  darkMode: false,
  autoStartBreaks: true,
  showStatsOnHome: true,
  focusDuration: 25
};

FocusFlowShared.formatStudyDate = function (dateString) {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
};

FocusFlowShared.applyAppSettings = function (settings) {
  const current = { ...this.DEFAULT_SETTINGS, ...(settings || {}) };

  this.applyBodyTheme(current.darkMode);
  document.body.classList.toggle("focus-mode", Boolean(current.focusMode));
  document.body.classList.toggle("notifications-disabled", current.notifications === false);
  document.body.classList.toggle("hide-home-stats", current.showStatsOnHome === false);
  document.documentElement.dataset.theme = current.darkMode ? "dark" : "light";
  this.syncToggleButtons(current);
};

FocusFlowShared.buildTaskNotifications = function (tasks = []) {
  const saved = this.readStorage(this.NOTIFICATIONS_KEY, []);
  const readIds = new Set(
    saved.filter(item => item.read).map(item => String(item.id))
  );

  const localDate = offsetDays => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + (offsetDays || 0));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const today = localDate(0);
  const tomorrow = localDate(1);
  const notifications = [{
    id: "welcome",
    title: "Welcome",
    text: "Welcome back to FocusFlow. Have a great study session today.",
    read: readIds.has("welcome")
  }];

  tasks.forEach(task => {
    if (task.status === "done" || !task.dueDate) return;

    if (task.dueDate < today) {
      const id = `overdue-${task.id}-${today}`;
      notifications.push({
        id,
        title: "Overdue task",
        text: `${task.name} was due ${this.formatStudyDate(task.dueDate)}.`,
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

  this.writeStorage(this.NOTIFICATIONS_KEY, notifications);
  return notifications;
};

FocusFlowShared.renderHeaderNotifications = function (tasks, settings) {
  const list = document.getElementById("notificationList");
  const dot = document.getElementById("notificationDot");
  const subtitle = document.getElementById("notificationSubtitle");
  const markAll = document.getElementById("clearNotifications");
  if (!list || !dot || !subtitle || !markAll) return;

  const enabled = settings?.notifications !== false;
  const notifications = this.buildTaskNotifications(tasks);
  const unread = notifications.filter(item => !item.read).length;

  dot.hidden = !enabled || unread === 0;
  markAll.hidden = !enabled || unread === 0;

  if (!enabled) {
    subtitle.textContent = "Notifications are turned off.";
    list.innerHTML = '<div class="notify-empty">Notifications are turned off in Quick Settings.</div>';
    return;
  }

  subtitle.textContent = unread
    ? `${unread} unread update${unread === 1 ? "" : "s"}.`
    : "You are all caught up.";

  list.innerHTML = notifications.map(item => `
    <button class="notification-item ${item.read ? "read" : "unread"}"
      type="button" data-shared-notification-id="${this.escapeHtml(item.id)}">
      <span class="notification-mark"></span>
      <span class="notification-copy">
        <span class="notification-title">${this.escapeHtml(item.title)}</span>
        <span class="notification-text">${this.escapeHtml(item.text)}</span>
        <span class="notification-meta">Just now${item.read ? " • Read" : ""}</span>
      </span>
    </button>
  `).join("");
};

FocusFlowShared.markHeaderNotificationRead = function (notificationId) {
  const notifications = this.readStorage(this.NOTIFICATIONS_KEY, []);
  notifications.forEach(item => {
    if (String(item.id) === String(notificationId)) item.read = true;
  });
  this.writeStorage(this.NOTIFICATIONS_KEY, notifications);
};

FocusFlowShared.markAllHeaderNotificationsRead = function () {
  const notifications = this.readStorage(this.NOTIFICATIONS_KEY, []);
  notifications.forEach(item => { item.read = true; });
  this.writeStorage(this.NOTIFICATIONS_KEY, notifications);
};

FocusFlowShared.connectDashboardHeader = function (options = {}) {
  const getTasks = options.getTasks || (() => []);
  const getSettings = options.getSettings || (() => ({ ...this.DEFAULT_SETTINGS }));
  const setSettings = options.setSettings || (() => {});
  const afterSettingChange = options.afterSettingChange || (() => {});
  const panelIds = options.panelIds || ["notifyPanel", "quickSettings", "profilePanel"];
  const labels = {
    focusMode: "Focus mode",
    notifications: "Notifications",
    soundAlerts: "Sound alerts",
    darkMode: "Dark mode",
    autoStartBreaks: "Auto start breaks",
    showStatsOnHome: "Dashboard stats"
  };

  const controller = this.createPanelController(panelIds, options.panelControllerOptions || {});
  const renderNotifications = () => this.renderHeaderNotifications(getTasks(), getSettings());

  const buttonPanelPairs = options.buttonPanelPairs || [
    ["notifyBtn", "notifyPanel"],
    ["quickSettingsBtn", "quickSettings"],
    ["profileBtn", "profilePanel"]
  ];
  buttonPanelPairs.forEach(([buttonId, panelId]) => controller.connectButton(buttonId, panelId));

  document.getElementById("notifyBtn")?.addEventListener("click", renderNotifications);
  document.getElementById("notificationList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-shared-notification-id]");
    if (!button) return;
    event.stopPropagation();
    this.markHeaderNotificationRead(button.dataset.sharedNotificationId);
    renderNotifications();
  });
  document.getElementById("clearNotifications")?.addEventListener("click", event => {
    event.stopPropagation();
    this.markAllHeaderNotificationsRead();
    renderNotifications();
    this.showToast("All notifications marked as read", "success");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", this.logout);
  document.getElementById("sidebarLogoutBtn")?.addEventListener("click", this.logout);

  document.querySelectorAll("[data-toggle]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const name = button.dataset.toggle;
      const next = { ...getSettings(), [name]: !Boolean(getSettings()?.[name]) };
      setSettings(next);
      this.writeStorage(this.SETTINGS_KEY, next);
      this.applyAppSettings(next);
      renderNotifications();
      afterSettingChange(name, next);
      this.showToast(`${labels[name] || name} ${next[name] ? "enabled" : "disabled"}`, "info");
    });
  });

  document.addEventListener("click", () => {
    controller.close();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") controller.close();
  });

  this.applyAppSettings(getSettings());
  renderNotifications();
  return { controller, renderNotifications };
};


/* =====================================================
   Legacy header helper (currently inactive)
   Kept for the unfinished Focus, Break, Progress, and Settings pages.
===================================================== */
function initialiseSharedHeader() {
  const notificationButton = document.querySelector("[data-notification-button]");
  const themeButton = document.querySelector("[data-theme-button]");
  const profileButton = document.querySelector("[data-profile-button]");

  const notificationMenu = document.querySelector("[data-notification-menu]");
  const profileMenu = document.querySelector("[data-profile-menu]");

  const notificationList = document.querySelector("[data-notification-list]");
  const notificationCount = document.querySelector("[data-notification-count]");
  const notificationStatus = document.querySelector("[data-notification-status]");
  const notificationDot = document.querySelector("[data-notification-dot]");
  const markAllReadButton = document.querySelector("[data-mark-all-read]");

  const logoutButton = document.querySelector("[data-logout-button]");
  const themeIcon = document.querySelector("[data-theme-icon]");

  const usesSharedHeader = Boolean(
    notificationButton || themeButton || profileButton
  );

  if (!usesSharedHeader) return;

  const notificationStorageKey = "focusflowNotifications";
  const defaultNotifications = [
    {
      id: "test-unread-notification",
      title: "Test notification",
      message: "This is an unread message to test the notification system.",
      type: "task",
      read: false
    },
    {
      id: "focus-reminder",
      title: "Ready to focus?",
      message: "Start a 25-minute focus session when you are ready.",
      type: "focus",
      read: true
    }
  ];

  function closeMenus(exceptMenu = null) {
    [notificationMenu, profileMenu].forEach(menu => {
      if (menu && menu !== exceptMenu) menu.classList.remove("show");
    });

    if (notificationMenu !== exceptMenu) {
      notificationButton?.setAttribute("aria-expanded", "false");
    }

    if (profileMenu !== exceptMenu) {
      profileButton?.setAttribute("aria-expanded", "false");
    }
  }

  function toggleMenu(menu, button) {
    if (!menu) return;

    const shouldOpen = !menu.classList.contains("show");
    closeMenus(menu);
    menu.classList.toggle("show", shouldOpen);
    button?.setAttribute("aria-expanded", String(shouldOpen));
  }

  function updateThemeIcon(theme) {
    if (!themeIcon) return;

    themeIcon.innerHTML = theme === "dark"
      ? '<path d="M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.5A7 7 0 0 1 12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />'
      : '<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("focusflowTheme", theme);
    updateThemeIcon(theme);
  }

  function getNotifications() {
    const notifications = FocusFlowShared.readStorage(
      notificationStorageKey,
      null
    );

    if (Array.isArray(notifications)) return notifications;

    FocusFlowShared.writeStorage(notificationStorageKey, defaultNotifications);
    return defaultNotifications;
  }

  function getNotificationIcon(type) {
    if (type === "focus") {
      return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="2"/><path d="M12 2v4M12 13l4-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    }

    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function renderNotifications() {
    if (!notificationList) return;

    const notifications = getNotifications();
    const unreadCount = notifications.filter(notification => !notification.read).length;

    notificationList.innerHTML = notifications.map(notification => {
      const stateClass = notification.read ? "read" : "unread";
      const stateText = notification.read ? "Read" : "New";

      return `
        <button
          class="notification-item ${stateClass}"
          type="button"
          data-notification-id="${FocusFlowShared.escapeHtml(notification.id)}"
        >
          <span class="notification-icon">
            ${getNotificationIcon(notification.type)}
          </span>
          <span class="notification-copy">
            <strong>${FocusFlowShared.escapeHtml(notification.title)}</strong>
            <span>${FocusFlowShared.escapeHtml(notification.message)}</span>
            <small>${stateText}</small>
          </span>
        </button>
      `;
    }).join("");

    if (notificationCount) {
      notificationCount.textContent = unreadCount ? `${unreadCount} new` : "";
    }

    if (notificationStatus) {
      notificationStatus.textContent = unreadCount
        ? "You have unread notifications."
        : "You are all caught up.";
    }

    if (notificationDot) notificationDot.hidden = unreadCount === 0;
    if (markAllReadButton) markAllReadButton.hidden = unreadCount === 0;
  }

  function saveNotifications(notifications) {
    FocusFlowShared.writeStorage(notificationStorageKey, notifications);
  }

  function markNotificationAsRead(notificationId) {
    const notifications = getNotifications().map(notification => (
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    ));

    saveNotifications(notifications);
    renderNotifications();
  }

  function markAllNotificationsAsRead() {
    saveNotifications(
      getNotifications().map(notification => ({ ...notification, read: true }))
    );
    renderNotifications();
  }

  notificationButton?.addEventListener("click", event => {
    event.stopPropagation();
    renderNotifications();
    toggleMenu(notificationMenu, notificationButton);
  });

  notificationList?.addEventListener("click", event => {
    const notificationItem = event.target.closest("[data-notification-id]");
    if (!notificationItem) return;
    markNotificationAsRead(notificationItem.dataset.notificationId);
  });

  markAllReadButton?.addEventListener("click", event => {
    event.stopPropagation();
    markAllNotificationsAsRead();
  });

  profileButton?.addEventListener("click", event => {
    event.stopPropagation();
    toggleMenu(profileMenu, profileButton);
  });

  themeButton?.addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.theme;
    applyTheme(currentTheme === "dark" ? "light" : "dark");
    closeMenus();
  });

  logoutButton?.addEventListener("click", FocusFlowShared.logout);

  document.addEventListener("click", event => {
    const clickedInsideMenu = event.target.closest(".header-dropdown");
    const clickedHeaderButton = event.target.closest(".icon-button");

    if (!clickedInsideMenu && !clickedHeaderButton) closeMenus();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenus();
  });

  const savedTheme = localStorage.getItem("focusflowTheme");
  applyTheme(savedTheme === "dark" ? "dark" : "light");
  renderNotifications();
}