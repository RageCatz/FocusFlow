"use strict";

/* Settings page functionality. */

const SETTINGS_DATA_KEY = "focusflowDashboardData";
const SETTINGS_KEY = "focusflowDashboardSettings";
const BREAK_SOUND_KEY = "focusflowBreakSound";
const FOCUS_SOUND_KEY = "focusflowDefaultAmbientSound";
const SOUND_VOLUME_KEY = "focusflowAmbientVolume";
const THEME_PREFERENCE_KEY = "focusflowThemePreference";

let settingsData = loadSettingsData();
let settings = {
  ...FocusFlowShared.DEFAULT_SETTINGS,
  focusSessionReminders: true,
  breakNotifications: true,
  taskDeadlineAlerts: true,
  distractionAlerts: true,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartFocusSessions: false,
  ...FocusFlowShared.readStorage(SETTINGS_KEY, {})
};

function loadSettingsData() {
  const saved = FocusFlowShared.readStorage(SETTINGS_DATA_KEY, {});

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

function saveSharedData() {
  settingsData.settings = {
    ...settingsData.settings,
    ...settings
  };

  FocusFlowShared.writeStorage(SETTINGS_DATA_KEY, settingsData);
  FocusFlowShared.writeStorage(SETTINGS_KEY, settings);
}

function getInputValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? "";
}

function buildAvatar(name) {
  return String(name || "Student")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("") || "ST";
}

function renderProfileForm() {
  const profile = settingsData.profile;

  setInputValue("fullName", profile.name);
  setInputValue("username", profile.username);
  setInputValue("country", profile.country);
  setInputValue("yearLevel", profile.year);
  setInputValue("industry", profile.industry);

  profile.avatar = profile.avatar || buildAvatar(profile.name);
  FocusFlowShared.fillProfile(profile);

  const avatar = document.getElementById("settingsProfileAvatar");
  if (avatar) avatar.textContent = profile.avatar;
}

function saveProfile() {
  const name = getInputValue("fullName");
  const username = getInputValue("username");
  const country = getInputValue("country");
  const year = document.getElementById("yearLevel")?.value || "";
  const industry = document.getElementById("industry")?.value || "";

  if (name.length < 2) {
    FocusFlowShared.showToast("Enter a valid full name.", "error");
    document.getElementById("fullName")?.focus();
    return;
  }

  if (!/^[A-Za-z0-9]{3,}$/.test(username)) {
    FocusFlowShared.showToast(
      "Username must be at least 3 letters or numbers.",
      "error"
    );
    document.getElementById("username")?.focus();
    return;
  }

  if (!country) {
    FocusFlowShared.showToast("Enter your country.", "error");
    document.getElementById("country")?.focus();
    return;
  }

  settingsData.profile = {
    ...settingsData.profile,
    name,
    username,
    country,
    year,
    industry,
    avatar: buildAvatar(name)
  };

  saveSharedData();

  FocusFlowShared.updateLocalAccountUsername(
    username,
    settingsData.profile
  );

  renderProfileForm();
  FocusFlowShared.showToast("Profile changes saved.", "success");
}

function getThemePreference() {
  return localStorage.getItem(THEME_PREFERENCE_KEY) || (
    settings.darkMode ? "dark" : "light"
  );
}

function resolveTheme(preference) {
  if (preference === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return preference === "dark" ? "dark" : "light";
}

function applyThemePreference(preference, { save = true } = {}) {
  const resolved = resolveTheme(preference);

  if (save) {
    localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  }

  settings.darkMode = resolved === "dark";
  localStorage.setItem("focusflowTheme", resolved);
  FocusFlowShared.applyAppSettings(settings);

  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.themeChoice === preference
    );
  });

  if (save) {
    saveSharedData();
    FocusFlowShared.showToast(
      `${preference === "system" ? "System" : preference === "dark" ? "Dark" : "Light"} theme selected.`,
      "success"
    );
  }
}

function renderSettingCheckboxes() {
  document.querySelectorAll("[data-setting-checkbox]").forEach(input => {
    input.checked = Boolean(settings[input.dataset.settingCheckbox]);
  });
}

function saveCheckboxSetting(input) {
  const key = input.dataset.settingCheckbox;
  if (!key) return;

  settings[key] = input.checked;

  /*
   * Focus session reminders are also the master in-app notification setting
   * used by the shared header.
   */
  if (key === "focusSessionReminders") {
    settings.notifications = input.checked;
  }

  saveSharedData();
  FocusFlowShared.applyAppSettings(settings);
  FocusFlowShared.showToast(
    `${input.closest(".preference-item")?.querySelector("strong")?.textContent.trim() || "Setting"} ${input.checked ? "enabled" : "disabled"}.`,
    "info"
  );
}

function readNumber(id, minimum, maximum, label) {
  const input = document.getElementById(id);
  const value = Math.round(Number(input?.value));

  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    FocusFlowShared.showToast(
      `${label} must be between ${minimum} and ${maximum} minutes.`,
      "error"
    );
    input?.focus();
    return null;
  }

  return value;
}

function renderFocusPreferences() {
  setInputValue("focusLength", settings.focusDuration || 25);
  setInputValue("shortBreak", settings.shortBreakDuration || 5);
  setInputValue("longBreak", settings.longBreakDuration || 15);
  setInputValue(
    "dailyGoal",
    settingsData.progress.dailyGoalMinutes || 60
  );
  renderSettingCheckboxes();
}

function saveFocusPreferences() {
  const focusDuration = readNumber(
    "focusLength",
    1,
    180,
    "Focus duration"
  );
  const shortBreakDuration = readNumber(
    "shortBreak",
    1,
    60,
    "Short break"
  );
  const longBreakDuration = readNumber(
    "longBreak",
    1,
    120,
    "Long break"
  );
  const dailyGoalMinutes = readNumber(
    "dailyGoal",
    1,
    480,
    "Daily goal"
  );

  if (
    focusDuration === null ||
    shortBreakDuration === null ||
    longBreakDuration === null ||
    dailyGoalMinutes === null
  ) {
    return;
  }

  settings.focusDuration = focusDuration;
  settings.shortBreakDuration = shortBreakDuration;
  settings.longBreakDuration = longBreakDuration;
  settingsData.progress.dailyGoalMinutes = dailyGoalMinutes;

  saveSharedData();
  renderFocusPreferences();

  FocusFlowShared.showToast(
    "Focus preferences saved.",
    "success"
  );
}

function getSelectedSound() {
  return FocusFlowShared.readStorage(FOCUS_SOUND_KEY, "off");
}

function renderSoundSettings() {
  const selected = getSelectedSound();
  const volume = Math.min(
    100,
    Math.max(
      0,
      Number(FocusFlowShared.readStorage(SOUND_VOLUME_KEY, 45))
    )
  );

  document.querySelectorAll("[data-sound-choice]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.soundChoice === selected
    );
  });

  const slider = document.getElementById("volume");
  if (slider) slider.value = volume;

  const label = document.getElementById("volumeValue");
  if (label) label.textContent = `${volume}%`;
}

function selectSound(button) {
  const sound = button.dataset.soundChoice || "off";

  FocusFlowShared.writeStorage(FOCUS_SOUND_KEY, sound);

  /*
   * Keep the Break page's saved sound aligned where names overlap.
   * White noise is Focus-only in the current Break implementation.
   */
  if (["off", "rain", "forest", "ocean"].includes(sound)) {
    FocusFlowShared.writeStorage(BREAK_SOUND_KEY, sound);
  }

  renderSoundSettings();
  FocusFlowShared.showToast(
    `${button.querySelector("strong")?.textContent.trim() || "Sound"} selected.`,
    "success"
  );
}

function updateVolume() {
  const slider = document.getElementById("volume");
  const volume = Number(slider?.value || 0);

  FocusFlowShared.writeStorage(SOUND_VOLUME_KEY, volume);

  const label = document.getElementById("volumeValue");
  if (label) label.textContent = `${volume}%`;
}

function togglePasswordVisibility() {
  const show = Boolean(
    document.getElementById("showSettingsPasswords")?.checked
  );

  ["currentPassword", "newPassword", "confirmPassword"].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.type = show ? "text" : "password";
  });
}

function validatePassword(password) {
  return (
    password.length >= 6 &&
    /\d/.test(password) &&
    /^[A-Za-z0-9]+$/.test(password)
  );
}

async function changePassword() {
  const currentInput = document.getElementById("currentPassword");
  const newInput = document.getElementById("newPassword");
  const confirmInput = document.getElementById("confirmPassword");
  const button = document.getElementById("changePasswordButton");

  const currentPassword = currentInput?.value || "";
  const newPassword = newInput?.value || "";
  const confirmation = confirmInput?.value || "";

  if (!currentPassword) {
    FocusFlowShared.showToast("Enter your current password.", "error");
    currentInput?.focus();
    return;
  }

  if (!validatePassword(newPassword)) {
    FocusFlowShared.showToast(
      "New password needs at least 6 characters, 1 number, and letters or numbers only.",
      "error"
    );
    newInput?.focus();
    return;
  }

  if (newPassword !== confirmation) {
    FocusFlowShared.showToast("New passwords do not match.", "error");
    confirmInput?.focus();
    return;
  }

  if (currentPassword === newPassword) {
    FocusFlowShared.showToast(
      "Choose a new password that is different from your current password.",
      "error"
    );
    newInput?.focus();
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Changing Password…";
    }

    const result = await FocusFlowShared.changeLocalPassword(
      currentPassword,
      newPassword
    );

    if (!result.ok) {
      if (result.reason === "no-account") {
        FocusFlowShared.showToast(
          "No local login account exists yet. Create your account through Sign Up first.",
          "error"
        );
      } else {
        FocusFlowShared.showToast(
          "Your current password is incorrect.",
          "error"
        );
        currentInput?.focus();
      }

      return;
    }

    [currentInput, newInput, confirmInput].forEach(input => {
      if (input) {
        input.value = "";
        input.type = "password";
      }
    });

    const showPasswords = document.getElementById("showSettingsPasswords");
    if (showPasswords) showPasswords.checked = false;

    FocusFlowShared.showToast(
      "Password changed successfully. Use the new password next time you log in.",
      "success"
    );
  } catch (error) {
    FocusFlowShared.showToast(
      error?.message || "Password could not be changed in this browser.",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Change Password";
    }
  }
}

function exportData() {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    data: FocusFlowShared.readStorage(SETTINGS_DATA_KEY, {}),
    settings: FocusFlowShared.readStorage(SETTINGS_KEY, {}),
    notifications: FocusFlowShared.readStorage(
      FocusFlowShared.NOTIFICATIONS_KEY,
      []
    ),
    breakStats: FocusFlowShared.readStorage("focusflowBreakStats", {}),
    progressHistory: FocusFlowShared.readStorage(
      "focusflowProgressHistory",
      {}
    )
  };

  const blob = new Blob(
    [JSON.stringify(exportPayload, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `focusflow-data-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  FocusFlowShared.showToast("FocusFlow data exported.", "success");
}

function showDeleteModal() {
  const modal = document.getElementById("deleteAccountModal");
  if (modal) modal.hidden = false;
}

function hideDeleteModal() {
  const modal = document.getElementById("deleteAccountModal");
  if (modal) modal.hidden = true;
}

function deleteLocalAccountData() {
  const keysToRemove = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("focusflow")) keysToRemove.push(key);
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));

  sessionStorage.removeItem("focusflowCurrentUser");
  sessionStorage.removeItem("focusflow_token");
  sessionStorage.removeItem("focusflow_username");

  hideDeleteModal();
  window.location.href = "login.html";
}

function connectSettingsMenu() {
  document.querySelectorAll("[data-settings-target]").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.settingsTarget);
      if (!target) return;

      document.querySelectorAll("[data-settings-target]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}

function connectControls() {
  document.getElementById("saveProfileButton")?.addEventListener(
    "click",
    saveProfile
  );

  document.querySelectorAll("[data-theme-choice]").forEach(button => {
    button.addEventListener("click", () => {
      applyThemePreference(button.dataset.themeChoice);
    });
  });

  document.querySelectorAll("[data-setting-checkbox]").forEach(input => {
    input.addEventListener("change", () => saveCheckboxSetting(input));
  });

  document.getElementById("saveFocusPreferencesButton")?.addEventListener(
    "click",
    saveFocusPreferences
  );

  document.querySelectorAll("[data-sound-choice]").forEach(button => {
    button.addEventListener("click", () => selectSound(button));
  });

  document.getElementById("volume")?.addEventListener(
    "input",
    updateVolume
  );

  document.getElementById("showSettingsPasswords")?.addEventListener(
    "change",
    togglePasswordVisibility
  );

  document.getElementById("changePasswordButton")?.addEventListener(
    "click",
    changePassword
  );

  document.getElementById("exportDataButton")?.addEventListener(
    "click",
    exportData
  );

  document.getElementById("settingsAccountLogoutButton")?.addEventListener(
    "click",
    FocusFlowShared.logout
  );

  document.getElementById("deleteAccountButton")?.addEventListener(
    "click",
    showDeleteModal
  );

  document.getElementById("cancelDeleteAccountButton")?.addEventListener(
    "click",
    hideDeleteModal
  );

  document.getElementById("confirmDeleteAccountButton")?.addEventListener(
    "click",
    deleteLocalAccountData
  );

  document.getElementById("deleteAccountModal")?.addEventListener(
    "click",
    event => {
      if (event.target === event.currentTarget) hideDeleteModal();
    }
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") hideDeleteModal();
  });

  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.(
    "change",
    () => {
      if (getThemePreference() === "system") {
        applyThemePreference("system", { save: false });
      }
    }
  );

  connectSettingsMenu();
}

function initializeSettingsPage() {
  settingsData = loadSettingsData();
  settings = {
    ...FocusFlowShared.DEFAULT_SETTINGS,
    focusSessionReminders: true,
    breakNotifications: true,
    taskDeadlineAlerts: true,
    distractionAlerts: true,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    autoStartFocusSessions: false,
    ...FocusFlowShared.readStorage(SETTINGS_KEY, {})
  };

  renderProfileForm();
  renderFocusPreferences();
  renderSettingCheckboxes();
  renderSoundSettings();
  applyThemePreference(getThemePreference(), { save: false });
  connectControls();
}

document.addEventListener("DOMContentLoaded", initializeSettingsPage);