"use strict";

/* Focus page styling. */

const FOCUS_DATA_KEY = "focusflowDashboardData";
const FOCUS_SETTINGS_KEY = "focusflowDashboardSettings";
const FOCUS_AUTO_BREAK_KEY = "focusflowAutoStartBreakRequested";
const FOCUS_AUTO_START_KEY = "focusflowAutoStartFocusRequested";
const FOCUS_TASK_KEY = "focusflowSelectedTaskId";
const FOCUS_SESSION_KEY = "focusflowActiveFocusSession";
const FOCUS_MONITORING_KEY = "focusflowStudyMonitoringEnabled";

const TIMER_RADIUS = 116;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

let focusData = loadFocusData();
let focusSettings = {
  ...FocusFlowShared.DEFAULT_SETTINGS,
  ...FocusFlowShared.readStorage(FOCUS_SETTINGS_KEY, {})
};

let selectedTaskId = FocusFlowShared.readStorage(FOCUS_TASK_KEY, null);
let durationMinutes = clampDuration(focusSettings.focusDuration || 25);
let totalSeconds = durationMinutes * 60;
let remainingSeconds = totalSeconds;
let timerInterval = null;
let timerEndAt = null;
let timerRunning = false;
let completionRecorded = false;
let allowStartWithoutCamera = false;
let cameraStream = null;
let ambientAudio = null;
let completionAudioElement = null;
let alarmRepeatTimer = null;
let alarmSnoozeTimer = null;
let alarmActive = false;

/* Study-presence monitoring state. The camera is analysed locally in the browser. */
const PRESENCE_CHECK_INTERVAL_MS = 650;
const AWAY_GRACE_MS = 10000;
const RETURN_CONFIRM_MS = 3000;
const CALIBRATION_MS = 4000;
const SCENE_HISTORY_SIZE = 5;
const SCENE_PRESENT_THRESHOLD = 0.145;
const SCENE_AWAY_THRESHOLD = 0.205;
const SCENE_MOTION_THRESHOLD = 0.012;
const SCENE_STRONG_MATCH_THRESHOLD = 0.07;

let presenceDetector = null;
let presenceDetectorType = "";
let presenceMonitorInterval = null;
let presenceState = "off";
let presenceStartedAt = 0;
let absenceStartedAt = 0;
let pendingStartForPresence = false;
let autoPausedByPresence = false;
let userPausedTimer = false;
let presenceAlertActive = false;

function loadFocusData() {
  const saved = FocusFlowShared.readStorage(FOCUS_DATA_KEY, {});

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

function saveFocusData() {
  focusData.settings = { ...focusData.settings, ...focusSettings };
  FocusFlowShared.writeStorage(FOCUS_DATA_KEY, focusData);
}

function saveFocusSettings() {
  focusSettings.focusDuration = durationMinutes;
  FocusFlowShared.writeStorage(FOCUS_SETTINGS_KEY, focusSettings);
  saveFocusData();
}

function clampDuration(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(180, Math.max(1, parsed));
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function getIncompleteTasks() {
  return focusData.tasks.filter(task => task.status !== "done");
}

function getSelectedTask() {
  return focusData.tasks.find(task => String(task.id) === String(selectedTaskId)) || null;
}

function renderTaskOptions() {
  const select = document.getElementById("focusTask");
  if (!select) return;

  const tasks = getIncompleteTasks();

  if (selectedTaskId && !tasks.some(task => String(task.id) === String(selectedTaskId))) {
    selectedTaskId = null;
    FocusFlowShared.writeStorage(FOCUS_TASK_KEY, null);
  }

  if (!selectedTaskId && tasks.length) {
    selectedTaskId = tasks[0].id;
    FocusFlowShared.writeStorage(FOCUS_TASK_KEY, selectedTaskId);
  }

  select.innerHTML = tasks.length
    ? tasks.map(task => `
        <option value="${FocusFlowShared.escapeHtml(task.id)}" ${String(task.id) === String(selectedTaskId) ? "selected" : ""}>
          ${FocusFlowShared.escapeHtml(task.name)}
        </option>
      `).join("")
    : '<option value="">No incomplete tasks</option>';

  select.disabled = tasks.length === 0;
  renderSelectedTask();
}

function renderSelectedTask() {
  const task = getSelectedTask();
  const name = document.getElementById("selectedTaskName");
  const finishButton = document.getElementById("finishTaskButton");

  if (name) name.textContent = task?.name || "No task selected";
  if (finishButton) finishButton.disabled = !task;
}

function updatePresetButtons() {
  document.querySelectorAll("[data-duration]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.duration) === durationMinutes);
  });
}

function updateTimerDisplay() {
  const time = document.getElementById("timerTime");
  const ring = document.getElementById("timerProgressRing");

  if (time) time.textContent = formatTimer(remainingSeconds);

  if (ring) {
    const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
    const offset = TIMER_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
    ring.style.strokeDasharray = String(TIMER_CIRCUMFERENCE);
    ring.style.strokeDashoffset = String(offset);
  }

  document.title = timerRunning
    ? `${formatTimer(remainingSeconds)} | FocusFlow`
    : "Focus Session | FocusFlow";
}

function setTimerState(state, message) {
  const badge = document.getElementById("sessionStateBadge");
  const status = document.getElementById("timerStatus");

  if (badge) {
    badge.className = `session-state ${state === "ready" ? "" : state}`.trim();
    badge.textContent = {
      ready: "Ready",
      running: "Focusing",
      paused: "Paused",
      complete: "Complete"
    }[state] || "Ready";
  }

  if (status) status.textContent = message;
}

function syncTimerButtons() {
  const start = document.getElementById("startTimerButton");
  const pause = document.getElementById("pauseTimerButton");

  if (start) {
    start.disabled = timerRunning;
    start.querySelector("span").textContent = remainingSeconds < totalSeconds && remainingSeconds > 0
      ? "Resume"
      : "Start";
  }

  if (pause) pause.disabled = !timerRunning;
}

function renderSettingsSummary() {
  document.getElementById("settingsDuration").textContent = `${durationMinutes} min${durationMinutes === 1 ? "" : "s"}`;
  document.getElementById("settingsFocusMode").textContent = focusSettings.focusMode ? "On" : "Off";
  document.getElementById("settingsDarkMode").textContent = focusSettings.darkMode ? "On" : "Off";
  document.getElementById("settingsAutoBreaks").textContent = focusSettings.autoStartBreaks ? "On" : "Off";
}

function renderDailyProgress() {
  const focusMinutes = Math.max(0, Number(focusData.progress.focusMinutesToday) || 0);
  const goalMinutes = Math.max(1, Number(focusData.progress.dailyGoalMinutes) || 60);
  const sessionsGoal = Math.max(1, Math.ceil(goalMinutes / durationMinutes));
  const completedSessions = Math.floor(focusMinutes / durationMinutes);
  const currentSession = Math.min(sessionsGoal, completedSessions + 1);
  const percent = Math.min(100, (focusMinutes / goalMinutes) * 100);

  document.getElementById("sessionCountLabel").textContent = `Session ${currentSession} of ${sessionsGoal}`;
  document.getElementById("goalProgressText").textContent = `${focusMinutes} / ${goalMinutes} min`;
  document.getElementById("dailyProgressBar").style.width = `${percent}%`;
}

function validateFocusDuration(value) {
  const input = document.getElementById("focusDuration");
  const rawValue = String(value ?? "").trim();
  const parsed = Number(rawValue);

  if (!rawValue || !Number.isFinite(parsed)) {
    input?.setAttribute("aria-invalid", "true");
    FocusFlowShared.showToast(
      "Please enter a focus duration as a number between 1 and 180 minutes.",
      "error"
    );
    input?.focus();
    return null;
  }

  if (!Number.isInteger(parsed)) {
    input?.setAttribute("aria-invalid", "true");
    FocusFlowShared.showToast(
      "Please enter a whole number of minutes between 1 and 180.",
      "error"
    );
    input?.focus();
    return null;
  }

  if (parsed < 1 || parsed > 180) {
    input?.setAttribute("aria-invalid", "true");
    FocusFlowShared.showToast(
      "Focus duration must be between 1 and 180 minutes.",
      "error"
    );
    input?.focus();
    return null;
  }

  input?.removeAttribute("aria-invalid");
  return parsed;
}

function applyDuration(value, announce = true) {
  const validatedDuration = validateFocusDuration(value);
  if (validatedDuration === null) return false;

  durationMinutes = validatedDuration;
  totalSeconds = durationMinutes * 60;
  remainingSeconds = totalSeconds;
  completionRecorded = false;

  stopTimerInterval();
  document.getElementById("focusDuration").value = durationMinutes;

  const savedAmbientSound = FocusFlowShared.readStorage(
    "focusflowDefaultAmbientSound",
    "off"
  );
  const ambientSelect = document.getElementById("ambientSound");
  if (ambientSelect) ambientSelect.value = savedAmbientSound;

  updatePresetButtons();
  updateTimerDisplay();
  setTimerState("ready", cameraStream ? "Ready when presence is detected" : "Enable monitoring to begin");
  syncTimerButtons();
  saveFocusSettings();
  renderSettingsSummary();
  renderDailyProgress();

  if (announce) {
    FocusFlowShared.showToast(`Focus duration set to ${durationMinutes} minutes.`, "success");
  }

  return true;
}

function stopTimerInterval() {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
  timerEndAt = null;
  timerRunning = false;
}

function saveMonitoringPreference(enabled) {
  FocusFlowShared.writeStorage(FOCUS_MONITORING_KEY, Boolean(enabled));
}

function monitoringWasEnabled() {
  return Boolean(FocusFlowShared.readStorage(FOCUS_MONITORING_KEY, false));
}

function readSavedFocusSession() {
  return FocusFlowShared.readStorage(FOCUS_SESSION_KEY, null);
}

function restoreSavedFocusSession() {
  const saved = readSavedFocusSession();
  if (!saved || !saved.endAt || Number(saved.endAt) <= Date.now()) return false;

  durationMinutes = clampDuration(saved.durationMinutes || durationMinutes);
  totalSeconds = Math.max(1, Number(saved.totalSeconds) || durationMinutes * 60);
  remainingSeconds = Math.max(1, Math.ceil((Number(saved.endAt) - Date.now()) / 1000));
  timerEndAt = Number(saved.endAt);
  selectedTaskId = saved.selectedTaskId ?? selectedTaskId;

  /*
   * Restore the countdown as waiting-for-presence first. The browser cannot
   * persist a MediaStream, so the camera must reconnect before timing resumes.
   */
  timerRunning = false;
  pendingStartForPresence = true;
  autoPausedByPresence = true;
  userPausedTimer = false;
  completionRecorded = false;

  return true;
}

function saveActiveSessionState() {
  if (!timerRunning || !timerEndAt) {
    FocusFlowShared.writeStorage(FOCUS_SESSION_KEY, null);
    return;
  }

  FocusFlowShared.writeStorage(FOCUS_SESSION_KEY, {
    endAt: timerEndAt,
    totalSeconds,
    durationMinutes,
    selectedTaskId,
    savedAt: Date.now()
  });
}

function clearActiveSessionState() {
  FocusFlowShared.writeStorage(FOCUS_SESSION_KEY, null);
}

function syncTimerFromClock() {
  if (!timerRunning || !timerEndAt) return;
  remainingSeconds = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
  updateTimerDisplay();

  if (remainingSeconds <= 0) completeFocusSession();
}

function connectBackgroundSessionSupport() {
  /*
   * Browsers may throttle intervals in background tabs. The timer uses an
   * absolute end timestamp, so elapsed time stays correct even when callbacks
   * run less often while the learner works in another tab.
   */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncTimerFromClock();

      if (cameraStream && presenceDetector) {
        runPresenceCheck();
      }
    } else {
      saveActiveSessionState();
    }
  });

  window.addEventListener("pagehide", saveActiveSessionState);
}

function tickTimer() {
  syncTimerFromClock();
}

function beginTimerCountdown() {
  if (timerRunning) return;
  stopTimerAlarm();

  if (remainingSeconds <= 0) {
    remainingSeconds = totalSeconds;
    completionRecorded = false;
  }

  timerEndAt = Date.now() + remainingSeconds * 1000;
  timerRunning = true;
  pendingStartForPresence = false;
  autoPausedByPresence = false;
  userPausedTimer = false;
  setTimerState("running", "Stay with one task");
  syncTimerButtons();
  updateTimerDisplay();

  timerInterval = window.setInterval(tickTimer, 250);
  saveActiveSessionState();
}

function showCameraStartConfirmation() {
  const modal = document.getElementById("cameraConfirmModal");
  if (!modal) return;
  modal.hidden = false;
}

function hideCameraStartConfirmation() {
  const modal = document.getElementById("cameraConfirmModal");
  if (!modal) return;
  modal.hidden = true;
}

function startTimer() {
  if (timerRunning) return;

  if (!cameraStream && !allowStartWithoutCamera) {
    showCameraStartConfirmation();
    return;
  }

  if (!cameraStream && allowStartWithoutCamera) {
    allowStartWithoutCamera = false;
    beginTimerCountdown();
    FocusFlowShared.showToast(
      "Focus timer started without Study Monitoring.",
      "info"
    );
    return;
  }

  if (presenceState !== "present") {
    pendingStartForPresence = true;
    userPausedTimer = false;
    setTimerState("paused", "Waiting for presence");
    syncTimerButtons();
    FocusFlowShared.showToast("Timer will start when the camera can detect you in the study area.", "info");
    return;
  }

  beginTimerCountdown();
}

function pauseTimer() {
  pendingStartForPresence = false;
  autoPausedByPresence = false;
  userPausedTimer = true;

  if (!timerRunning) {
    setTimerState("paused", "Session paused");
    syncTimerButtons();
    return;
  }

  tickTimer();
  stopTimerInterval();
  clearActiveSessionState();
  setTimerState("paused", "Session paused");
  syncTimerButtons();
  updateTimerDisplay();
}

function pauseTimerForPresence() {
  if (!timerRunning) return;

  tickTimer();
  stopTimerInterval();
  clearActiveSessionState();
  autoPausedByPresence = true;
  pendingStartForPresence = true;
  userPausedTimer = false;
  setTimerState("paused", "Study presence lost — timer paused");
  syncTimerButtons();
  updateTimerDisplay();
  notifyReturnToStudy();
}

function resetTimer() {
  stopTimerAlarm();
  stopTimerInterval();
  clearActiveSessionState();
  allowStartWithoutCamera = false;
  remainingSeconds = totalSeconds;
  completionRecorded = false;
  pendingStartForPresence = false;
  autoPausedByPresence = false;
  userPausedTimer = false;
  setTimerState("ready", cameraStream ? "Ready when presence is detected" : "Enable monitoring to begin");
  syncTimerButtons();
  updateTimerDisplay();
  FocusFlowShared.showToast("Focus timer reset.", "info");
}

function buildCompletionToneDataUri() {
  const sampleRate = 22050;
  const notes = [
    { frequency: 660, start: 0.00, duration: 0.22 },
    { frequency: 820, start: 0.32, duration: 0.22 },
    { frequency: 990, start: 0.64, duration: 0.46 }
  ];
  const totalDuration = 1.18;
  const sampleCount = Math.floor(sampleRate * totalDuration);
  const samples = new Int16Array(sampleCount);

  notes.forEach(note => {
    const noteStart = Math.floor(note.start * sampleRate);
    const noteLength = Math.floor(note.duration * sampleRate);

    for (let index = 0; index < noteLength && noteStart + index < sampleCount; index += 1) {
      const time = index / sampleRate;
      const attack = Math.min(1, index / (sampleRate * 0.018));
      const release = Math.min(1, (noteLength - index) / (sampleRate * 0.07));
      const envelope = Math.min(attack, release);
      const value = Math.sin(2 * Math.PI * note.frequency * time) * 0.48 * envelope;
      samples[noteStart + index] += Math.round(value * 32767);
    }
  });

  const byteLength = 44 + samples.length * 2;
  const buffer = new ArrayBuffer(byteLength);
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

function getCompletionAudioElement() {
  if (!completionAudioElement) {
    completionAudioElement = new Audio(buildCompletionToneDataUri());
    completionAudioElement.preload = "auto";
  }

  return completionAudioElement;
}

async function primeCompletionAudio() {
  /*
   * Chrome allows later timer-completion playback more reliably when the same
   * media element has first been activated by a direct user gesture.
   */
  try {
    const audio = getCompletionAudioElement();
    const previousVolume = audio.volume;

    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.001;

    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = previousVolume || 1;

    return true;
  } catch {
    return false;
  }
}

async function playAlarmCycle() {
  const latestSettings = {
    ...focusSettings,
    ...FocusFlowShared.readStorage(FOCUS_SETTINGS_KEY, {})
  };

  if (!latestSettings.soundAlerts || !alarmActive) return false;

  try {
    const audio = getCompletionAudioElement();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function showTimerAlarmModal() {
  const modal = document.getElementById("timerAlarmModal");
  if (modal) modal.hidden = false;
}

function hideTimerAlarmModal() {
  const modal = document.getElementById("timerAlarmModal");
  if (modal) modal.hidden = true;
}

function clearAlarmTimers() {
  if (alarmRepeatTimer) window.clearInterval(alarmRepeatTimer);
  if (alarmSnoozeTimer) window.clearTimeout(alarmSnoozeTimer);
  alarmRepeatTimer = null;
  alarmSnoozeTimer = null;
}

async function startRepeatingTimerAlarm() {
  clearAlarmTimers();
  alarmActive = true;
  showTimerAlarmModal();

  /*
   * Ring immediately, then repeat every 2.2 seconds. The same media element is
   * reused because it was unlocked when the user started/interacted with the
   * timer, which is more reliable in Chrome than creating new audio objects.
   */
  await playAlarmCycle();
  alarmRepeatTimer = window.setInterval(playAlarmCycle, 2200);
}

function stopTimerAlarm({ closeModal = true } = {}) {
  alarmActive = false;
  clearAlarmTimers();

  if (completionAudioElement) {
    completionAudioElement.pause();
    completionAudioElement.currentTime = 0;
  }

  if (closeModal) hideTimerAlarmModal();
}

function snoozeTimerAlarm() {
  stopTimerAlarm({ closeModal: false });

  const message = document.getElementById("timerAlarmMessage");
  if (message) {
    message.textContent = "Alarm snoozed for 1 minute. It will ring again automatically.";
  }

  const modal = document.getElementById("timerAlarmModal");
  if (modal) modal.hidden = false;

  alarmSnoozeTimer = window.setTimeout(() => {
    const currentMessage = document.getElementById("timerAlarmMessage");
    if (currentMessage) {
      currentMessage.textContent = "Your focus session finished. Stop the alarm or snooze it again.";
    }
    startRepeatingTimerAlarm();
  }, 60 * 1000);
}

async function completeFocusSession() {
  stopTimerInterval();
  clearActiveSessionState();
  remainingSeconds = 0;
  updateTimerDisplay();
  setTimerState("complete", "Focus session complete");
  syncTimerButtons();

  if (!completionRecorded) {
    completionRecorded = true;
    focusData.progress.focusMinutesToday =
      Math.max(0, Number(focusData.progress.focusMinutesToday) || 0) + durationMinutes;
    saveFocusData();
    renderDailyProgress();

    const latestSettings = {
      ...focusSettings,
      ...FocusFlowShared.readStorage(FOCUS_SETTINGS_KEY, {})
    };

    if (latestSettings.soundAlerts) {
      await startRepeatingTimerAlarm();
    } else {
      showTimerAlarmModal();
    }

    if (
      latestSettings.notifications &&
      latestSettings.breakNotifications !== false &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("FocusFlow: focus session complete", {
          body: `${durationMinutes} focus minutes completed. Time for a break.`
        });
      } catch {
        // The in-app completion message remains available.
      }
    }

    FocusFlowShared.showToast(
      `Great work — ${durationMinutes} focus minutes recorded.`,
      "success"
    );
  }

  /*
   * Do not navigate away automatically while the completion alarm is active.
   * The user must stop/snooze the alarm first, just like a phone timer.
   */
  if (focusSettings.autoStartBreaks) {
    FocusFlowShared.showToast(
      "Focus complete. Stop the alarm to begin your break automatically.",
      "info"
    );
  }
}

function completeSelectedTask() {
  const task = getSelectedTask();
  if (!task) {
    FocusFlowShared.showToast("Choose a task first.", "error");
    return;
  }

  task.status = "done";
  saveFocusData();
  FocusFlowShared.showToast(`Task “${task.name}” marked complete.`, "success");

  const remainingTasks = getIncompleteTasks();
  selectedTaskId = remainingTasks[0]?.id || null;
  FocusFlowShared.writeStorage(FOCUS_TASK_KEY, selectedTaskId);
  renderTaskOptions();
}

/* =====================================================
   Camera study-presence monitoring
   The app only checks whether the learner is visible in the camera.
   It does not record video or claim to infer attention or understanding.
===================================================== */

function updatePresenceUi(state, message = "") {
  presenceState = state;

  const badge = document.getElementById("cameraBadge");
  const status = document.getElementById("cameraMonitorMessage");
  const overlay = document.getElementById("cameraPresenceOverlay");

  const labels = {
    off: "Not started",
    loading: "Starting…",
    checking: "Checking…",
    present: "Study area active",
    away: "No presence detected",
    error: "Monitoring unavailable"
  };

  if (badge) {
    badge.textContent = labels[state] || labels.off;
    badge.className = "camera-badge";
    if (state === "present") badge.classList.add("active");
    if (state === "away") badge.classList.add("away");
    if (state === "loading" || state === "checking") badge.classList.add("checking");
    if (state === "error") badge.classList.add("error");
  }

  if (status) {
    status.textContent = message || {
      off: "Enable the camera before starting a monitored focus session.",
      loading: "Starting the camera and preparing local study-area monitoring…",
      checking: "Stay in your normal study position for a few seconds while FocusFlow calibrates the camera view.",
      present: "Your calibrated study area is active. The timer can run.",
      away: "Return to the study area. The timer will stay paused until you are detected again.",
      error: "Study Monitoring could not start in this browser."
    }[state] || "";
  }

  if (overlay) {
    overlay.hidden = !cameraStream;
    overlay.textContent = state === "present" ? "Presence detected" : state === "away" ? "Return to study" : "Checking presence";
    overlay.className = `camera-presence-overlay ${state}`;
  }
}

function createScenePresenceDetector(video) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 72;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas analysis is not supported in this browser.");
  }

  presenceDetectorType = "scene";
  presenceDetector = {
    canvas,
    context,
    baseline: null,
    baselineSamples: [],
    calibrationStartedAt: Date.now(),
    differenceHistory: [],
    previousSignature: null,
    lastDifference: 0,
    lastMotion: 0
  };

  return video;
}

function captureSceneSignature(video) {
  if (!presenceDetector || presenceDetectorType !== "scene") return null;

  const { canvas, context } = presenceDetector;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  /*
   * Analyse the centre of the frame where the learner normally sits.
   * A block-based luminance signature keeps processing lightweight and local.
   */
  const signature = [];
  const block = 4;
  const marginX = Math.floor(canvas.width * 0.12);
  const marginY = Math.floor(canvas.height * 0.08);

  for (let y = marginY; y < canvas.height - marginY; y += block) {
    for (let x = marginX; x < canvas.width - marginX; x += block) {
      let total = 0;
      let count = 0;

      for (let by = 0; by < block && y + by < canvas.height - marginY; by += 1) {
        for (let bx = 0; bx < block && x + bx < canvas.width - marginX; bx += 1) {
          const index = ((y + by) * canvas.width + (x + bx)) * 4;
          total += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
          count += 1;
        }
      }

      signature.push(total / Math.max(1, count));
    }
  }

  return signature;
}

function averageSignatures(samples) {
  if (!samples.length) return null;
  const size = samples[0].length;
  const output = new Array(size).fill(0);

  samples.forEach(sample => {
    for (let index = 0; index < size; index += 1) output[index] += sample[index];
  });

  return output.map(value => value / samples.length);
}

function sceneDifference(first, second) {
  if (!first || !second || first.length !== second.length) return 1;

  /*
   * Remove each frame's average brightness before comparison. This makes the
   * monitor far less sensitive to sunlight, monitor glow, and camera exposure.
   */
  const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondMean = second.reduce((sum, value) => sum + value, 0) / second.length;

  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference += Math.abs(
      (first[index] - firstMean) - (second[index] - secondMean)
    );
  }

  return difference / (first.length * 255);
}

function median(values) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function blendBaseline(baseline, current, amount = 0.015) {
  if (!baseline || !current || baseline.length !== current.length) return baseline;
  return baseline.map((value, index) => value * (1 - amount) + current[index] * amount);
}

async function createPresenceDetector(video) {
  /* Use the browser's native face detector when it is available. It runs locally
     and needs no model download. */
  if ("FaceDetector" in window) {
    presenceDetectorType = "native";
    presenceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    return;
  }

  /* Most desktop browsers do not expose FaceDetector. In that case use a local
     scene-baseline check instead of downloading an external AI model. */
  createScenePresenceDetector(video);
}

async function detectStudyPresence(video) {
  if (!presenceDetector || !video || video.readyState < 2) {
    return { state: "uncertain", confidence: 0 };
  }

  if (presenceDetectorType === "native") {
    const faces = await presenceDetector.detect(video);
    return {
      state: Array.isArray(faces) && faces.length > 0 ? "present" : "away",
      confidence: Array.isArray(faces) && faces.length > 0 ? 1 : 0
    };
  }

  if (presenceDetectorType === "scene") {
    const current = captureSceneSignature(video);
    if (!current) return { state: "uncertain", confidence: 0 };

    if (!presenceDetector.baseline) {
      presenceDetector.baselineSamples.push(current);
      presenceDetector.previousSignature = current;

      if (
        Date.now() - presenceDetector.calibrationStartedAt >= CALIBRATION_MS &&
        presenceDetector.baselineSamples.length >= 6
      ) {
        presenceDetector.baseline = averageSignatures(presenceDetector.baselineSamples);
        presenceDetector.differenceHistory = [];
      }

      return {
        state: presenceDetector.baseline ? "present" : "calibrating",
        confidence: presenceDetector.baseline ? 0.8 : 0
      };
    }

    const difference = sceneDifference(presenceDetector.baseline, current);
    const motion = presenceDetector.previousSignature
      ? sceneDifference(presenceDetector.previousSignature, current)
      : 0;

    presenceDetector.previousSignature = current;
    presenceDetector.lastDifference = difference;
    presenceDetector.lastMotion = motion;
    presenceDetector.differenceHistory.push(difference);

    if (presenceDetector.differenceHistory.length > SCENE_HISTORY_SIZE) {
      presenceDetector.differenceHistory.shift();
    }

    const smoothedDifference = median(presenceDetector.differenceHistory);

    /*
     * A close match to the calibrated study view is strong evidence that the
     * learner is still present. Small gradual changes are folded into the
     * baseline so normal posture and lighting changes do not cause false pauses.
     */
    if (smoothedDifference < SCENE_STRONG_MATCH_THRESHOLD) {
      presenceDetector.baseline = blendBaseline(presenceDetector.baseline, current, 0.025);
    }

    if (smoothedDifference < SCENE_PRESENT_THRESHOLD) {
      return {
        state: "present",
        confidence: Math.max(0, 1 - smoothedDifference / SCENE_PRESENT_THRESHOLD)
      };
    }

    /*
     * Movement in the centre of the camera is treated as evidence of presence.
     * This is especially useful when the learner changes posture after
     * calibration and no longer closely matches the original reference frame.
     */
    if (motion >= SCENE_MOTION_THRESHOLD) {
      return { state: "present", confidence: 0.65 };
    }

    /*
     * Only a very large, stable change is considered "away". Everything between
     * the present and away thresholds is deliberately "uncertain"; uncertain
     * readings never pause the timer.
     */
    if (smoothedDifference >= SCENE_AWAY_THRESHOLD && motion < SCENE_MOTION_THRESHOLD) {
      return {
        state: "away",
        confidence: Math.min(1, smoothedDifference / SCENE_AWAY_THRESHOLD - 0.1)
      };
    }

    return { state: "uncertain", confidence: 0.4 };
  }

  return { state: "uncertain", confidence: 0 };
}

function showPresenceModal() {
  const modal = document.getElementById("presenceModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("presence-modal-open");
}

function hidePresenceModal() {
  const modal = document.getElementById("presenceModal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("presence-modal-open");
}

function notifyReturnToStudy() {
  if (presenceAlertActive) return;
  presenceAlertActive = true;
  showPresenceModal();

  FocusFlowShared.showToast("Focus timer paused — return to your study area to continue.", "error");

  if (
    focusSettings.notifications &&
    focusSettings.distractionAlerts !== false &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification("FocusFlow: return to study", {
        body: "Your focus timer is paused. It will resume after the camera detects you again."
      });
    } catch {
      // The in-app notification remains available if system notifications are blocked.
    }
  }
}

function clearPresenceAlert() {
  presenceAlertActive = false;
  hidePresenceModal();
}

async function runPresenceCheck() {
  const video = document.getElementById("cameraVideo");
  if (!cameraStream || !presenceDetector || !video) return;

  try {
    const result = await detectStudyPresence(video);
    const state = result?.state || "uncertain";
    const now = Date.now();

    if (state === "calibrating") {
      presenceStartedAt = 0;
      absenceStartedAt = 0;
      updatePresenceUi(
        "checking",
        "Calibrating your study position. Stay naturally in view for a few seconds."
      );
      return;
    }

    if (state === "present") {
      absenceStartedAt = 0;
      if (!presenceStartedAt) presenceStartedAt = now;

      if (now - presenceStartedAt >= RETURN_CONFIRM_MS) {
        const wasAway = presenceState === "away";
        updatePresenceUi("present");
        clearPresenceAlert();

        if ((pendingStartForPresence || autoPausedByPresence) && !userPausedTimer) {
          beginTimerCountdown();
          FocusFlowShared.showToast(
            wasAway
              ? "Study presence restored — timer resumed."
              : "Study presence confirmed — timer started.",
            "success"
          );
        }
      } else {
        updatePresenceUi("checking", "Study presence detected. Confirming…");
      }
      return;
    }

    if (state === "uncertain") {
      /*
       * An uncertain camera reading is not proof that the learner left. Keep the
       * current timer state and wait for a clearer reading instead of pausing.
       */
      presenceStartedAt = 0;
      absenceStartedAt = 0;

      if (presenceState !== "away") {
        updatePresenceUi(
          "checking",
          "Study Monitoring is checking the camera. Keep studying normally."
        );
      }
      return;
    }

    /* Only a sustained, high-confidence "away" result starts the pause timer. */
    presenceStartedAt = 0;
    if (!absenceStartedAt) absenceStartedAt = now;

    if (now - absenceStartedAt >= AWAY_GRACE_MS) {
      updatePresenceUi("away");
      showPresenceModal();
      if (timerRunning) {
        pauseTimerForPresence();
      } else {
        notifyReturnToStudy();
      }
    } else {
      const secondsLeft = Math.max(
        1,
        Math.ceil((AWAY_GRACE_MS - (now - absenceStartedAt)) / 1000)
      );
      updatePresenceUi(
        "checking",
        `Study area may be empty. Checking for ${secondsLeft}s before pausing.`
      );
    }
  } catch {
    /*
     * Detector errors are treated as uncertain rather than absent. A technical
     * problem with the camera must never incorrectly stop a valid focus session.
     */
    absenceStartedAt = 0;
    updatePresenceUi("checking", "Study Monitoring is checking the camera…");
  }
}

function startPresenceMonitor() {
  if (presenceMonitorInterval) window.clearInterval(presenceMonitorInterval);
  presenceMonitorInterval = window.setInterval(runPresenceCheck, PRESENCE_CHECK_INTERVAL_MS);
  runPresenceCheck();
}

function stopPresenceMonitor() {
  if (presenceMonitorInterval) window.clearInterval(presenceMonitorInterval);
  presenceMonitorInterval = null;
  presenceStartedAt = 0;
  absenceStartedAt = 0;
  clearPresenceAlert();
}

async function requestSystemNotificationPermission() {
  if (!focusSettings.notifications || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;

  try {
    await Notification.requestPermission();
  } catch {
    // In-app reminders still work if browser notifications cannot be requested.
  }
}

async function enableStudyMonitoring({ restoring = false } = {}) {
  const button = document.getElementById("cameraButton");
  const video = document.getElementById("cameraVideo");
  const placeholder = document.getElementById("cameraPlaceholder");

  if (cameraStream) return true;

  if (!navigator.mediaDevices?.getUserMedia) {
    const reason = "Camera access is not supported in this browser.";
    updatePresenceUi("error", reason);
    if (!restoring) FocusFlowShared.showToast(reason, "error");
    return false;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = restoring ? "Reconnecting Monitoring…" : "Starting Monitoring…";
    }

    updatePresenceUi(
      "loading",
      restoring ? "Reconnecting your camera and restoring Study Monitoring…" : undefined
    );

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });

    video.srcObject = cameraStream;
    video.hidden = false;
    placeholder.hidden = true;
    document.getElementById("cameraPreview")?.classList.add("camera-active");
    await video.play();

    const videoTrack = cameraStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener("ended", () => {
        if (!cameraStream) return;
        stopPresenceMonitor();
        cameraStream = null;
        saveMonitoringPreference(false);
        video.srcObject = null;
        video.hidden = true;
        placeholder.hidden = false;
        document.getElementById("cameraPreview")?.classList.remove("camera-active");
        updatePresenceUi("error", "Camera access stopped. Enable Study Monitoring again to continue.");
        if (timerRunning) pauseTimerForPresence();
      });
    }

    await createPresenceDetector(video);
    startPresenceMonitor();
    await requestSystemNotificationPermission();

    saveMonitoringPreference(true);
    if (button) button.textContent = "Disable Study Monitoring";

    updatePresenceUi(
      "checking",
      restoring
        ? "Camera reconnected. Stay in your normal study position while FocusFlow confirms presence."
        : undefined
    );

    if (!restoring) {
      setTimerState("ready", "Waiting for presence");
      FocusFlowShared.showToast(
        "Study Monitoring enabled. Stay in view to start your timer.",
        "success"
      );
    }

    return true;
  } catch (error) {
    stopPresenceMonitor();

    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;

    video.srcObject = null;
    video.hidden = true;
    placeholder.hidden = false;
    document.getElementById("cameraPreview")?.classList.remove("camera-active");

    presenceDetector = null;
    presenceDetectorType = "";

    const reason = error?.name === "NotAllowedError"
      ? "Camera permission was blocked. Allow camera access for this site and try again."
      : error?.name === "NotFoundError"
        ? "No camera was found on this device."
        : "Study Monitoring could not reconnect. Check camera permission and try again.";

    updatePresenceUi("error", reason);
    if (!restoring) FocusFlowShared.showToast(reason, "error");
    return false;
  } finally {
    if (button) button.disabled = false;
  }
}

async function toggleCamera() {
  const button = document.getElementById("cameraButton");
  const video = document.getElementById("cameraVideo");
  const placeholder = document.getElementById("cameraPlaceholder");

  if (cameraStream) {
    if (timerRunning) pauseTimerForPresence();
    stopPresenceMonitor();
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;

    video.srcObject = null;
    video.hidden = true;
    placeholder.hidden = false;
    document.getElementById("cameraPreview")?.classList.remove("camera-active");

    if (button) button.textContent = "Enable Study Monitoring";

    saveMonitoringPreference(false);
    pendingStartForPresence = false;
    autoPausedByPresence = false;
    updatePresenceUi("off");
    return;
  }

  await enableStudyMonitoring();
}

function stopAmbientSound() {
  if (!ambientAudio) return;

  ambientAudio.nodes.forEach(node => {
    try { node.stop?.(); } catch { /* Node may already be stopped. */ }
    try { node.disconnect?.(); } catch { /* Safe cleanup. */ }
  });

  ambientAudio.context.close().catch(() => {});
  ambientAudio = null;
  document.getElementById("ambientSound").value = "off";
}

function createNoiseSource(context, seconds = 2) {
  const frameCount = context.sampleRate * seconds;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

async function startAmbientSound(type) {
  stopAmbientSound();
  if (type === "off") return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    FocusFlowShared.showToast("Ambient audio is not supported in this browser.", "error");
    return;
  }

  try {
    const context = new AudioContextClass();
    await context.resume();
    const master = context.createGain();
    const savedVolume = Math.min(
      100,
      Math.max(
        0,
        Number(FocusFlowShared.readStorage("focusflowAmbientVolume", 45))
      )
    );
    master.gain.value = 0.12 * (savedVolume / 100);
    master.connect(context.destination);
    const nodes = [master];

    if (type === "white-noise" || type === "rain") {
      const noise = createNoiseSource(context);
      const filter = context.createBiquadFilter();
      filter.type = type === "rain" ? "lowpass" : "highpass";
      filter.frequency.value = type === "rain" ? 2800 : 180;
      noise.connect(filter);
      filter.connect(master);
      noise.start();
      nodes.push(noise, filter);
    }

    if (type === "forest") {
      const noise = createNoiseSource(context);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      const forestGain = context.createGain();
      forestGain.gain.value = 0.55;
      noise.connect(filter);
      filter.connect(forestGain);
      forestGain.connect(master);
      noise.start();

      const tone = context.createOscillator();
      const toneGain = context.createGain();
      tone.type = "sine";
      tone.frequency.value = 220;
      toneGain.gain.value = 0.08;
      tone.connect(toneGain);
      toneGain.connect(master);
      tone.start();
      nodes.push(noise, filter, forestGain, tone, toneGain);
    }

    ambientAudio = { context, nodes };
    document.getElementById("ambientSound").value = type;
    FocusFlowShared.showToast(`${type === "white-noise" ? "White noise" : type.charAt(0).toUpperCase() + type.slice(1)} started.`, "info");
  } catch {
    document.getElementById("ambientSound").value = "off";
    FocusFlowShared.showToast("Ambient sound could not be started.", "error");
  }
}

/* =====================================================
   Shared header and page controls
===================================================== */

function applyFocusSettings() {
  FocusFlowShared.applyAppSettings(focusSettings);
  document.getElementById("notifyBtn")?.classList.toggle(
    "disabled-notify",
    !focusSettings.notifications
  );
  renderSettingsSummary();
}

function connectFocusControls() {
  document.getElementById("focusTask")?.addEventListener("change", event => {
    selectedTaskId = event.target.value || null;
    FocusFlowShared.writeStorage(FOCUS_TASK_KEY, selectedTaskId);
    renderSelectedTask();
  });

  document.getElementById("applyDurationButton")?.addEventListener("click", () => {
    applyDuration(document.getElementById("focusDuration").value);
  });

  document.getElementById("focusDuration")?.addEventListener("keydown", event => {
    if (event.key === "Enter") applyDuration(event.currentTarget.value);
  });

  document.querySelectorAll("[data-duration]").forEach(button => {
    button.addEventListener("click", () => applyDuration(button.dataset.duration));
  });

  document.getElementById("startTimerButton")?.addEventListener("click", async () => {
    await primeCompletionAudio();
    startTimer();
  });
  document.getElementById("pauseTimerButton")?.addEventListener("click", pauseTimer);
  document.getElementById("resetTimerButton")?.addEventListener("click", resetTimer);
  document.getElementById("finishTaskButton")?.addEventListener("click", completeSelectedTask);
  document.getElementById("cameraButton")?.addEventListener("click", async () => {
    await primeCompletionAudio();
    toggleCamera();
  });

  document.getElementById("confirmEnableCameraButton")?.addEventListener("click", async () => {
    hideCameraStartConfirmation();
    await primeCompletionAudio();
    await enableStudyMonitoring();
  });

  document.getElementById("confirmStartWithoutCameraButton")?.addEventListener("click", async () => {
    hideCameraStartConfirmation();
    allowStartWithoutCamera = true;
    await primeCompletionAudio();
    startTimer();
  });

  document.getElementById("confirmCancelButton")?.addEventListener("click", () => {
    hideCameraStartConfirmation();
  });

  document.getElementById("stopAlarmButton")?.addEventListener("click", () => {
    stopTimerAlarm();

    const latestSettings = {
      ...focusSettings,
      ...FocusFlowShared.readStorage(FOCUS_SETTINGS_KEY, {})
    };

    FocusFlowShared.writeStorage(
      FOCUS_AUTO_BREAK_KEY,
      Boolean(latestSettings.autoStartBreaks)
    );

    FocusFlowShared.showToast(
      latestSettings.autoStartBreaks
        ? "Timer alarm stopped. Opening and starting your break…"
        : "Timer alarm stopped. Opening your break…",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "break.html";
    }, 500);
  });

  document.getElementById("snoozeAlarmButton")?.addEventListener("click", () => {
    snoozeTimerAlarm();
    FocusFlowShared.showToast("Alarm snoozed for 1 minute.", "info");
  });

  document.getElementById("cameraConfirmModal")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) {
      hideCameraStartConfirmation();
    }
  });

  document.getElementById("ambientSound")?.addEventListener("change", event => {
    startAmbientSound(event.target.value);
  });

  document.getElementById("stopSoundButton")?.addEventListener("click", () => {
    stopAmbientSound();
    FocusFlowShared.showToast("Ambient sound stopped.", "info");
  });

  document.addEventListener("pointerdown", primeCompletionAudio, { passive: true });
  document.addEventListener("keydown", event => {
    primeCompletionAudio();
    if (event.key === "Escape") hideCameraStartConfirmation();
  });

  window.addEventListener("beforeunload", () => {
    stopPresenceMonitor();
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    if (ambientAudio) stopAmbientSound();
    try { presenceDetector?.close?.(); } catch { /* Detector cleanup is best-effort. */ }
  });
}

function createPersistentAppShell() {
  let shell = document.getElementById("persistentPageShell");
  if (shell) return shell;

  shell = document.createElement("div");
  shell.id = "persistentPageShell";
  shell.className = "persistent-page-shell";
  shell.hidden = true;
  shell.innerHTML = `
    <iframe
      id="persistentPageFrame"
      class="persistent-page-frame"
      title="FocusFlow page"
    ></iframe>
  `;

  document.body.appendChild(shell);
  return shell;
}

function closePersistentPage() {
  const shell = document.getElementById("persistentPageShell");
  const frame = document.getElementById("persistentPageFrame");
  if (!shell || !frame) return;

  shell.hidden = true;
  frame.removeAttribute("src");
  document.body.classList.remove("persistent-page-open");

  syncTimerFromClock();
  if (cameraStream && presenceDetector) runPresenceCheck();
}

function wirePersistentFrameNavigation(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;

    doc.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute("href");
      if (!href) return;

      if (href === "focus.html" || href.endsWith("/focus.html")) {
        link.addEventListener("click", event => {
          event.preventDefault();
          closePersistentPage();
          FocusFlowShared.showToast(
            "Returned to your live Focus session.",
            "success"
          );
        });
      }
    });
  } catch {
    // Same-origin pages are expected. Ignore if the browser blocks frame access.
  }
}

function openPageInsidePersistentShell(href) {
  const shell = createPersistentAppShell();
  const frame = document.getElementById("persistentPageFrame");
  if (!frame) return;

  frame.onload = () => wirePersistentFrameNavigation(frame);
  frame.src = href;
  shell.hidden = false;
  document.body.classList.add("persistent-page-open");

  FocusFlowShared.showToast(
    "Focus session is still running in the background.",
    "info"
  );
}

function connectPersistentFocusNavigation() {
  document.querySelectorAll('a[href$=".html"]').forEach(link => {
    link.addEventListener("click", event => {
      const href = link.getAttribute("href");
      if (!href || href === "focus.html") return;

      const sessionActive =
        Boolean(cameraStream) &&
        (timerRunning || pendingStartForPresence || autoPausedByPresence);

      if (!sessionActive) return;

      event.preventDefault();
      openPageInsidePersistentShell(href);
    });
  });
}

function connectPersistentShellMessages() {
  window.addEventListener("message", event => {
    if (event?.data?.type !== "focusflow:return-to-live-focus") return;
    closePersistentPage();

    FocusFlowShared.showToast(
      "Returned to your live Focus session.",
      "success"
    );
  });
}

async function restoreMonitoringOnFocusLoad() {
  const restoredSession = restoreSavedFocusSession();
  const shouldReconnectCamera = monitoringWasEnabled() || restoredSession;

  if (restoredSession) {
    const durationInput = document.getElementById("focusDuration");
    if (durationInput) durationInput.value = durationMinutes;

    updatePresetButtons();
    updateTimerDisplay();
    renderTaskOptions();
    renderSelectedTask();
    setTimerState("paused", "Reconnecting Study Monitoring…");
    syncTimerButtons();
  }

  if (!shouldReconnectCamera) return;

  const cameraRestored = await enableStudyMonitoring({ restoring: true });

  if (!cameraRestored) {
    if (restoredSession) {
      setTimerState("paused", "Reconnect Study Monitoring to continue");
      FocusFlowShared.showToast(
        "Your timer was restored, but the camera needs to be enabled again before it can continue.",
        "error"
      );
    }
    return;
  }

  if (restoredSession) {
    /*
     * runPresenceCheck() will resume the restored timer automatically once
     * presence is confirmed for the normal return-confirmation period.
     */
    setTimerState("paused", "Waiting for presence");
    FocusFlowShared.showToast(
      "Camera restored. Your focus timer will resume after presence is confirmed.",
      "success"
    );
  }
}

function initialiseFocusPage() {
  FocusFlowShared.fillProfile(focusData.profile);
  applyFocusSettings();
  FocusFlowShared.connectPageChrome({
      getTasks: () => focusData.tasks,
      getSettings: () => focusSettings,
      setSettings: nextSettings => {
        focusSettings = { ...focusSettings, ...nextSettings };
        saveFocusSettings();
      },
      afterSettingChange: applyFocusSettings
    });
  connectFocusControls();
  connectBackgroundSessionSupport();
  connectPersistentFocusNavigation();
  connectPersistentShellMessages();
  renderTaskOptions();

  document.getElementById("focusDuration").value = durationMinutes;
  updatePresetButtons();
  updateTimerDisplay();
  setTimerState("ready", "Enable monitoring to begin");
  syncTimerButtons();
  updatePresenceUi("off");
  renderSettingsSummary();
  renderDailyProgress();

  restoreMonitoringOnFocusLoad();

  const shouldAutoStartFocus = Boolean(
    FocusFlowShared.readStorage(FOCUS_AUTO_START_KEY, false)
  );
  localStorage.removeItem(FOCUS_AUTO_START_KEY);

  if (shouldAutoStartFocus) {
    window.setTimeout(() => {
      const startButton = document.getElementById("startTimerButton");

      if (startButton && !timerRunning) {
        startButton.click();
        FocusFlowShared.showToast(
          "Auto-starting your next focus session.",
          "info"
        );
      }
    }, 700);
  }
}

document.addEventListener("DOMContentLoaded", initialiseFocusPage);