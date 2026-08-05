"use strict";

/* Break page functionality. */

const BREAK_DATA_KEY = "focusflowDashboardData";
const BREAK_SETTINGS_KEY = "focusflowDashboardSettings";
const BREAK_STATE_KEY = "focusflowActiveBreakSession";
const BREAK_STATS_KEY = "focusflowBreakStats";
const BREAK_SOUND_KEY = "focusflowBreakSound";
const BREAK_AUTO_START_KEY = "focusflowAutoStartBreakRequested";
const FOCUS_AUTO_START_KEY = "focusflowAutoStartFocusRequested";

const TIMER_RADIUS = 116;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

let breakData = loadBreakData();
let breakSettings = {
  ...FocusFlowShared.DEFAULT_SETTINGS,
  ...FocusFlowShared.readStorage(BREAK_SETTINGS_KEY, {})
};

let durationMinutes = Math.max(
  1,
  Number(breakSettings.shortBreakDuration || 5)
);
let totalSeconds = durationMinutes * 60;
let remainingSeconds = totalSeconds;
let timerRunning = false;
let timerEndAt = null;
let timerInterval = null;
let completionRecorded = false;
let alarmAudio = null;
let alarmRepeatTimer = null;
let alarmSnoozeTimer = null;
let alarmActive = false;
let ambientAudio = null;

function loadBreakData() {
  const saved = FocusFlowShared.readStorage(BREAK_DATA_KEY, {});

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

function saveBreakData() {
  breakData.settings = { ...breakData.settings, ...breakSettings };
  FocusFlowShared.writeStorage(BREAK_DATA_KEY, breakData);
}

function clampDuration(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(60, Math.max(1, parsed));
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateTimerDisplay() {
  const time = document.getElementById("breakTimerTime");
  const status = document.getElementById("breakTimerStatus");
  const ring = document.getElementById("breakProgressRing");
  const formattedTime = formatTimer(remainingSeconds);

  if (time) time.textContent = formattedTime;

  if (status) {
    status.textContent = timerRunning
      ? "Break in progress"
      : remainingSeconds === 0
        ? "Break complete"
        : remainingSeconds < totalSeconds
          ? "Break paused"
          : "Ready for a break";
  }

  if (ring) {
    const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
    ring.style.strokeDasharray = String(TIMER_CIRCUMFERENCE);
    ring.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - progress));
  }

  const startText = document.querySelector("#startBreakButton span");
  if (startText) {
    startText.textContent = remainingSeconds < totalSeconds && remainingSeconds > 0
      ? "Resume Break"
      : "Start Break";
  }

  const pauseButton = document.getElementById("pauseBreakButton");
  if (pauseButton) pauseButton.disabled = !timerRunning;
}

function saveBreakState() {
  FocusFlowShared.writeStorage(BREAK_STATE_KEY, {
    durationMinutes,
    totalSeconds,
    remainingSeconds,
    timerRunning,
    timerEndAt,
    completionRecorded
  });
}

function clearBreakState() {
  localStorage.removeItem(BREAK_STATE_KEY);
}

function restoreBreakState() {
  const saved = FocusFlowShared.readStorage(BREAK_STATE_KEY, null);
  if (!saved) return;

  durationMinutes = clampDuration(saved.durationMinutes || 5);
  totalSeconds = Math.max(60, Number(saved.totalSeconds) || durationMinutes * 60);
  remainingSeconds = Math.max(0, Number(saved.remainingSeconds) || 0);
  timerRunning = Boolean(saved.timerRunning);
  timerEndAt = Number(saved.timerEndAt) || null;
  completionRecorded = Boolean(saved.completionRecorded);

  if (timerRunning && timerEndAt) {
    remainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));

    if (remainingSeconds <= 0) {
      timerRunning = false;
      timerEndAt = null;
      completeBreak();
      return;
    }

    startTimerInterval();
  }

  syncDurationControls();
}

function applySavedBreakPreferences() {
  const latestSettings = {
    ...breakSettings,
    ...FocusFlowShared.readStorage(BREAK_SETTINGS_KEY, {})
  };

  breakSettings = latestSettings;

  const shortDuration = clampDuration(
    latestSettings.shortBreakDuration || 5
  );
  const longDuration = clampDuration(
    latestSettings.longBreakDuration || 15
  );

  /*
   * The normal Break page starts with the saved short-break duration.
   * The final preset represents the user's saved long-break duration.
   */
  const longButton = document.querySelector("[data-long-break-option]");
  if (longButton) {
    longButton.dataset.breakDuration = String(longDuration);

    const strong = longButton.querySelector("strong");
    if (strong) strong.textContent = `${longDuration} min`;
  }

  if (!FocusFlowShared.readStorage(BREAK_STATE_KEY, null)) {
    durationMinutes = shortDuration;
    totalSeconds = durationMinutes * 60;
    remainingSeconds = totalSeconds;
  }
}

function syncDurationControls() {
  const input = document.getElementById("customDuration");
  if (input) input.value = durationMinutes;

  document.querySelectorAll("[data-break-duration]").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.dataset.breakDuration) === durationMinutes
    );
  });
}

function setDuration(minutes) {
  if (timerRunning) {
    FocusFlowShared.showToast("Pause or reset the break before changing its duration.", "info");
    return;
  }

  durationMinutes = clampDuration(minutes);
  totalSeconds = durationMinutes * 60;
  remainingSeconds = totalSeconds;
  completionRecorded = false;
  syncDurationControls();
  updateTimerDisplay();
  saveBreakState();
}

function startTimerInterval() {
  window.clearInterval(timerInterval);
  timerInterval = window.setInterval(() => {
    if (!timerRunning || !timerEndAt) return;

    remainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
    updateTimerDisplay();
    saveBreakState();

    if (remainingSeconds <= 0) {
      completeBreak();
    }
  }, 250);
}

async function startBreak() {
  if (timerRunning || remainingSeconds <= 0) return;

  await primeAlarmAudio();
  timerRunning = true;
  timerEndAt = Date.now() + remainingSeconds * 1000;
  startTimerInterval();
  updateTimerDisplay();
  saveBreakState();
}

function pauseBreak() {
  if (!timerRunning) return;

  remainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
  timerRunning = false;
  timerEndAt = null;
  window.clearInterval(timerInterval);
  timerInterval = null;
  updateTimerDisplay();
  saveBreakState();
}

function resetBreak() {
  stopBreakAlarm();
  timerRunning = false;
  timerEndAt = null;
  window.clearInterval(timerInterval);
  timerInterval = null;
  remainingSeconds = totalSeconds;
  completionRecorded = false;
  updateTimerDisplay();
  saveBreakState();
}

function recordCompletedBreak() {
  if (completionRecorded) return;

  const stats = FocusFlowShared.readStorage(BREAK_STATS_KEY, {
    completedBreaks: 0
  });

  stats.completedBreaks = Number(stats.completedBreaks || 0) + 1;
  FocusFlowShared.writeStorage(BREAK_STATS_KEY, stats);
  completionRecorded = true;
  renderProgress();
}

function completeBreak() {
  if (remainingSeconds > 0) return;

  timerRunning = false;
  timerEndAt = null;
  window.clearInterval(timerInterval);
  timerInterval = null;
  remainingSeconds = 0;
  recordCompletedBreak();
  updateTimerDisplay();
  saveBreakState();
  startBreakAlarm();

  if (
    breakSettings.notifications &&
    breakSettings.breakNotifications !== false &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("Break complete", {
      body: "Your break is finished. Time to return to focus."
    });
  }
}

function buildAlarmToneDataUri() {
  const sampleRate = 22050;
  const duration = 1.1;
  const sampleCount = Math.floor(sampleRate * duration);
  const samples = new Int16Array(sampleCount);
  const notes = [
    { frequency: 740, start: 0, length: 0.24 },
    { frequency: 920, start: 0.34, length: 0.24 },
    { frequency: 1100, start: 0.68, length: 0.34 }
  ];

  notes.forEach(note => {
    const start = Math.floor(note.start * sampleRate);
    const length = Math.floor(note.length * sampleRate);

    for (let index = 0; index < length && start + index < sampleCount; index += 1) {
      const time = index / sampleRate;
      const attack = Math.min(1, index / (sampleRate * 0.018));
      const release = Math.min(1, (length - index) / (sampleRate * 0.07));
      const envelope = Math.min(attack, release);
      const sample = Math.sin(2 * Math.PI * note.frequency * time) * 0.45 * envelope;
      samples[start + index] += Math.round(sample * 32767);
    }
  });

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + index * 2, samples[index], true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

function getAlarmAudio() {
  if (!alarmAudio) {
    alarmAudio = new Audio(buildAlarmToneDataUri());
    alarmAudio.preload = "auto";
  }

  return alarmAudio;
}

async function primeAlarmAudio() {
  try {
    const audio = getAlarmAudio();
    const oldVolume = audio.volume;
    audio.volume = 0.001;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = oldVolume || 1;
  } catch {
    /* Browser audio permission can still require another user interaction. */
  }
}

async function playAlarmCycle() {
  if (!alarmActive || !breakSettings.soundAlerts) return;

  try {
    const audio = getAlarmAudio();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    await audio.play();
  } catch {
    /* The completion popup remains available if the browser blocks audio. */
  }
}

function startBreakAlarm() {
  stopBreakAlarm({ closeModal: false });
  alarmActive = true;

  const modal = document.getElementById("breakAlarmModal");
  if (modal) modal.hidden = false;

  playAlarmCycle();
  alarmRepeatTimer = window.setInterval(playAlarmCycle, 2200);
}

function stopBreakAlarm({ closeModal = true } = {}) {
  alarmActive = false;

  window.clearInterval(alarmRepeatTimer);
  window.clearTimeout(alarmSnoozeTimer);
  alarmRepeatTimer = null;
  alarmSnoozeTimer = null;

  if (alarmAudio) {
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
  }

  if (closeModal) {
    const modal = document.getElementById("breakAlarmModal");
    if (modal) modal.hidden = true;
  }
}

function snoozeBreakAlarm() {
  stopBreakAlarm({ closeModal: false });

  alarmSnoozeTimer = window.setTimeout(() => {
    startBreakAlarm();
  }, 60 * 1000);

  FocusFlowShared.showToast("Break alarm snoozed for 1 minute.", "info");
}

function createAmbientSound(type) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const context = new AudioContextClass();
  const master = context.createGain();
  const savedVolume = Math.min(
    100,
    Math.max(
      0,
      Number(FocusFlowShared.readStorage("focusflowAmbientVolume", 45))
    )
  );
  master.gain.value = 0.1 * (savedVolume / 100);
  master.connect(context.destination);

  const nodes = [];

  if (type === "rain") {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1700;
    source.buffer = buffer;
    source.loop = true;
    source.connect(filter);
    filter.connect(master);
    source.start();
    nodes.push(source);
  } else {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type === "ocean" ? "sine" : "triangle";
    oscillator.frequency.value = type === "ocean" ? 95 : 180;
    gain.gain.value = type === "ocean" ? 0.35 : 0.18;
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    nodes.push(oscillator);
  }

  return { context, nodes };
}

function stopAmbientSound() {
  if (!ambientAudio) return;

  ambientAudio.nodes.forEach(node => {
    try {
      node.stop();
    } catch {
      /* The node may already be stopped. */
    }
  });

  ambientAudio.context.close();
  ambientAudio = null;
}

function updateBreakSound() {
  const select = document.getElementById("breakSoundSelect");
  const type = select?.value || "off";

  stopAmbientSound();
  FocusFlowShared.writeStorage(BREAK_SOUND_KEY, type);

  if (type !== "off") {
    ambientAudio = createAmbientSound(type);
    FocusFlowShared.showToast("Break sound started.", "success");
  }
}

function renderProgress() {
  const stats = FocusFlowShared.readStorage(BREAK_STATS_KEY, {
    completedBreaks: 0
  });
  const completedBreaks = Number(stats.completedBreaks || 0);
  const focusMinutes = Number(breakData.progress?.focusMinutesToday || 0);
  const focusDuration = Number(breakSettings.focusDuration || 25);
  const focusSessions = focusDuration > 0
    ? Math.floor(focusMinutes / focusDuration)
    : 0;

  const breakCount = document.getElementById("completedBreakCount");
  const sessionCount = document.getElementById("focusSessionCount");
  const progressBar = document.getElementById("breakProgressBar");

  if (breakCount) breakCount.textContent = completedBreaks;
  if (sessionCount) sessionCount.textContent = focusSessions;

  if (progressBar) {
    const target = Math.max(1, focusSessions);
    progressBar.style.width = `${Math.min(100, (completedBreaks / target) * 100)}%`;
  }
}

function applyBreakSettings() {
  FocusFlowShared.applyAppSettings(breakSettings);
}

function connectControls() {
  document.querySelectorAll("[data-break-duration]").forEach(button => {
    button.addEventListener("click", () => {
      setDuration(button.dataset.breakDuration);
    });
  });

  document.getElementById("applyDurationButton")?.addEventListener("click", () => {
    setDuration(document.getElementById("customDuration")?.value);
  });

  document.getElementById("customDuration")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      setDuration(event.currentTarget.value);
    }
  });

  document.getElementById("startBreakButton")?.addEventListener("click", startBreak);
  document.getElementById("pauseBreakButton")?.addEventListener("click", pauseBreak);
  document.getElementById("resetBreakButton")?.addEventListener("click", resetBreak);

  document.getElementById("returnToFocusButton")?.addEventListener("click", () => {
    stopBreakAlarm();
    clearBreakState();
    window.location.href = "focus.html";
  });

  document.querySelectorAll("[data-break-activity]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-break-activity]").forEach(option => {
        option.classList.toggle("active", option === button);
      });

      FocusFlowShared.showToast(
        `${button.dataset.breakActivity} selected for this break.`,
        "success"
      );
    });
  });

  document.getElementById("breakSoundSelect")?.addEventListener("change", updateBreakSound);

  document.getElementById("stopBreakSoundButton")?.addEventListener("click", () => {
    stopAmbientSound();
    const select = document.getElementById("breakSoundSelect");
    if (select) select.value = "off";
    FocusFlowShared.writeStorage(BREAK_SOUND_KEY, "off");
  });

  document.getElementById("stopBreakAlarmButton")?.addEventListener("click", () => {
    stopBreakAlarm();
    clearBreakState();

    const latestSettings = {
      ...breakSettings,
      ...FocusFlowShared.readStorage(BREAK_SETTINGS_KEY, {})
    };

    FocusFlowShared.writeStorage(
      FOCUS_AUTO_START_KEY,
      Boolean(latestSettings.autoStartFocusSessions)
    );

    window.location.href = "focus.html";
  });

  document.getElementById("snoozeBreakAlarmButton")?.addEventListener("click", snoozeBreakAlarm);

  document.addEventListener("pointerdown", primeAlarmAudio, { once: true });
}

function initializeBreakPage() {
  applySavedBreakPreferences();
  restoreBreakState();

  const shouldAutoStartBreak = Boolean(
    FocusFlowShared.readStorage(BREAK_AUTO_START_KEY, false)
  );
  localStorage.removeItem(BREAK_AUTO_START_KEY);

  const savedSound = FocusFlowShared.readStorage(BREAK_SOUND_KEY, "off");
  const soundSelect = document.getElementById("breakSoundSelect");
  if (soundSelect) soundSelect.value = savedSound;

  FocusFlowShared.fillProfile(breakData.profile);
  applyBreakSettings();
  syncDurationControls();
  updateTimerDisplay();
  renderProgress();

  FocusFlowShared.connectPageChrome({
    getTasks: () => breakData.tasks,
    getSettings: () => breakSettings,
    setSettings: nextSettings => {
      breakSettings = { ...breakSettings, ...nextSettings };
      FocusFlowShared.writeStorage(BREAK_SETTINGS_KEY, breakSettings);
      saveBreakData();
    },
    afterSettingChange: applyBreakSettings
  });

  connectControls();

  if (
    shouldAutoStartBreak &&
    !timerRunning &&
    remainingSeconds > 0
  ) {
    startBreak();
  }
}

document.addEventListener("DOMContentLoaded", initializeBreakPage);