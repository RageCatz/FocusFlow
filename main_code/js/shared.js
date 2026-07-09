const notificationButton = document.querySelector(
  "[data-notification-button]"
);
const themeButton = document.querySelector("[data-theme-button]");
const profileButton = document.querySelector("[data-profile-button]");

const notificationMenu = document.querySelector(
  "[data-notification-menu]"
);
const profileMenu = document.querySelector("[data-profile-menu]");

const notificationList = document.querySelector(
  "[data-notification-list]"
);
const notificationCount = document.querySelector(
  "[data-notification-count]"
);
const notificationStatus = document.querySelector(
  "[data-notification-status]"
);
const notificationDot = document.querySelector(
  "[data-notification-dot]"
);
const markAllReadButton = document.querySelector(
  "[data-mark-all-read]"
);

const logoutButton = document.querySelector("[data-logout-button]");
const themeIcon = document.querySelector("[data-theme-icon]");

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
  [notificationMenu, profileMenu].forEach((menu) => {
    if (menu && menu !== exceptMenu) {
      menu.classList.remove("show");
    }
  });

  if (
    notificationButton &&
    notificationMenu &&
    notificationMenu !== exceptMenu
  ) {
    notificationButton.setAttribute("aria-expanded", "false");
  }

  if (
    profileButton &&
    profileMenu &&
    profileMenu !== exceptMenu
  ) {
    profileButton.setAttribute("aria-expanded", "false");
  }
}

function toggleMenu(menu, button) {
  if (!menu) {
    return;
  }

  const shouldOpen = !menu.classList.contains("show");

  closeMenus(menu);
  menu.classList.toggle("show", shouldOpen);

  if (button) {
    button.setAttribute(
      "aria-expanded",
      String(shouldOpen)
    );
  }
}

function updateThemeIcon(theme) {
  if (!themeIcon) {
    return;
  }

  if (theme === "dark") {
    themeIcon.innerHTML = `
      <path
        d="M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.5A7 7 0 0 1 12 3Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
    `;

    return;
  }

  themeIcon.innerHTML = `
    <circle
      cx="12"
      cy="12"
      r="4"
      stroke="currentColor"
      stroke-width="2"
    />
    <path
      d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  `;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("focusflowTheme", theme);
  updateThemeIcon(theme);
}

function initialiseTheme() {
  const savedTheme = localStorage.getItem("focusflowTheme");

  if (savedTheme === "dark" || savedTheme === "light") {
    applyTheme(savedTheme);
    return;
  }

  applyTheme("light");
}

function saveNotifications(notifications) {
  localStorage.setItem(
    notificationStorageKey,
    JSON.stringify(notifications)
  );
}

function getNotifications() {
  try {
    const storedNotifications = JSON.parse(
      localStorage.getItem(notificationStorageKey)
    );

    if (Array.isArray(storedNotifications)) {
      return storedNotifications;
    }
  } catch {
    localStorage.removeItem(notificationStorageKey);
  }

  saveNotifications(defaultNotifications);

  return defaultNotifications;
}

function getNotificationIcon(type) {
  if (type === "focus") {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="12"
          cy="13"
          r="7"
          stroke="currentColor"
          stroke-width="2"
        />
        <path
          d="M12 2v4M12 13l4-3"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="5"
        y="4"
        width="14"
        height="16"
        rx="2"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="M9 9h6M9 13h6M9 17h4"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  `;
}

function renderNotifications() {
  if (!notificationList) {
    return;
  }

  const notifications = getNotifications();
  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  notificationList.innerHTML = notifications
    .map((notification) => {
      const stateClass = notification.read ? "read" : "unread";
      const stateText = notification.read ? "Read" : "New";

      return `
        <button
          class="notification-item ${stateClass}"
          type="button"
          data-notification-id="${notification.id}"
        >
          <span class="notification-icon">
            ${getNotificationIcon(notification.type)}
          </span>

          <span class="notification-copy">
            <strong>${notification.title}</strong>
            <span>${notification.message}</span>
            <small>${stateText}</small>
          </span>
        </button>
      `;
    })
    .join("");

  if (notificationCount) {
    notificationCount.textContent =
      unreadCount === 0
        ? ""
        : `${unreadCount} new`;
  }

  if (notificationStatus) {
    notificationStatus.textContent =
      unreadCount === 0
        ? "You are all caught up."
        : "You have unread notifications.";
  }

  if (notificationDot) {
    notificationDot.hidden = unreadCount === 0;
  }

  if (markAllReadButton) {
    markAllReadButton.hidden = unreadCount === 0;
  }
}

function markNotificationAsRead(notificationId) {
  const notifications = getNotifications();

  const updatedNotifications = notifications.map(
    (notification) => {
      if (notification.id !== notificationId) {
        return notification;
      }

      return {
        ...notification,
        read: true
      };
    }
  );

  saveNotifications(updatedNotifications);
  renderNotifications();
}

function markAllNotificationsAsRead() {
  const updatedNotifications = getNotifications().map(
    (notification) => ({
      ...notification,
      read: true
    })
  );

  saveNotifications(updatedNotifications);
  renderNotifications();
}

notificationButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  renderNotifications();
  toggleMenu(notificationMenu, notificationButton);
});

notificationList?.addEventListener("click", (event) => {
  const notificationItem = event.target.closest(
    "[data-notification-id]"
  );

  if (!notificationItem) {
    return;
  }

  markNotificationAsRead(
    notificationItem.dataset.notificationId
  );
});

markAllReadButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  markAllNotificationsAsRead();
});

profileButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu(profileMenu, profileButton);
});

themeButton?.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme;
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);
  closeMenus();
});

logoutButton?.addEventListener("click", () => {
  sessionStorage.removeItem("focusflowCurrentUser");
  window.location.href = "login.html";
});

document.addEventListener("click", (event) => {
  const clickedInsideMenu = event.target.closest(
    ".header-dropdown"
  );

  const clickedHeaderButton = event.target.closest(
    ".icon-button"
  );

  if (!clickedInsideMenu && !clickedHeaderButton) {
    closeMenus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenus();
  }
});

initialiseTheme();
renderNotifications();