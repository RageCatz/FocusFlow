const notificationButton = document.querySelector("[data-notification-button]");
const themeButton = document.querySelector("[data-theme-button]");
const profileButton = document.querySelector("[data-profile-button]");
const notificationMenu = document.querySelector("[data-notification-menu]");
const profileMenu = document.querySelector("[data-profile-menu]");
const logoutButton = document.querySelector("[data-logout-button]");
const themeIcon = document.querySelector("[data-theme-icon]");

function closeMenus(exceptMenu = null) {
  [notificationMenu, profileMenu].forEach((menu) => {
    if (menu && menu !== exceptMenu) {
      menu.classList.remove("show");
    }
  });
}

function toggleMenu(menu) {
  if (!menu) {
    return;
  }

  const shouldOpen = !menu.classList.contains("show");

  closeMenus(menu);
  menu.classList.toggle("show", shouldOpen);
}

function updateThemeIcon(theme) {
  if (!themeIcon) {
    return;
  }

  themeIcon.innerHTML =
    theme === "dark"
      ? `
        <path
          d="M12 3a9 9 0 1 0 9 9c0-.5 0-1-.1-1.5A7 7 0 0 1 12 3Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      `
      : `
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

notificationButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu(notificationMenu);
});

profileButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu(profileMenu);
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
  const clickedInsideMenu = event.target.closest(".header-dropdown");
  const clickedHeaderButton = event.target.closest(".icon-button");

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