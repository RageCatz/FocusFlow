const signupForm = document.getElementById("signupForm");
const nameInput = document.getElementById("name");
const usernameInput = document.getElementById("username");
const countryInput = document.getElementById("country");
const yearLevelInput = document.getElementById("yearLevel");
const industryInput = document.getElementById("industry");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const showPasswordsInput = document.getElementById("showSignupPasswords");
const signupMessage = document.getElementById("signupMessage");
const passwordHint = document.getElementById("passwordHint");
const passwordMatch = document.getElementById("passwordMatch");

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const input = field.querySelector("input, select");
  const error = field.querySelector(".field-error");
  const hasError = Boolean(message);

  field.classList.toggle("invalid", hasError);
  input.setAttribute("aria-invalid", String(hasError));
  error.textContent = message;
}

function clearFieldError(fieldId) {
  setFieldError(fieldId, "");
}

function setSystemMessage(message, type) {
  signupMessage.textContent = message;
  signupMessage.className = `system-message ${type} show`;
}

function clearSystemMessage() {
  signupMessage.textContent = "";
  signupMessage.className = "system-message";
}

function isStrongPassword(password) {
  const hasMinimumLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const usesAllowedCharacters = /^[A-Za-z0-9]+$/.test(password);

  return hasMinimumLength && hasNumber && usesAllowedCharacters;
}

function updatePasswordHint() {
  const password = passwordInput.value;

  passwordHint.textContent = "";
  passwordHint.className = "inline-status";

  if (!password) {
    return;
  }

  if (isStrongPassword(password)) {
    passwordHint.textContent = "Password looks good.";
    passwordHint.classList.add("valid");
  } else {
    passwordHint.textContent =
      "Use at least 6 characters, at least 1 number, and no special characters.";
    passwordHint.classList.add("invalid");
  }
}

function updatePasswordMatch() {
  const password = passwordInput.value;
  const confirmation = confirmPasswordInput.value;

  passwordMatch.textContent = "";
  passwordMatch.className = "inline-status";

  if (!confirmation) {
    return;
  }

  if (password === confirmation) {
    passwordMatch.textContent = "Passwords match.";
    passwordMatch.classList.add("valid");
  } else {
    passwordMatch.textContent = "Passwords do not match yet.";
    passwordMatch.classList.add("invalid");
  }
}

function validateSignupForm() {
  const name = nameInput.value.trim();
  const username = usernameInput.value.trim();
  const country = countryInput.value.trim();
  const yearLevel = yearLevelInput.value;
  const industry = industryInput.value;
  const password = passwordInput.value;
  const confirmation = confirmPasswordInput.value;
  let isValid = true;

  [
    "nameField",
    "usernameField",
    "countryField",
    "yearLevelField",
    "industryField",
    "passwordField",
    "confirmPasswordField"
  ].forEach(clearFieldError);

  clearSystemMessage();

  if (!name) {
    setFieldError("nameField", "Please enter your full name.");
    isValid = false;
  } else if (name.length < 2) {
    setFieldError(
      "nameField",
      "Your full name must contain at least 2 characters."
    );
    isValid = false;
  }

  if (!username) {
    setFieldError("usernameField", "Please choose a username.");
    isValid = false;
  } else if (username.length < 3) {
    setFieldError(
      "usernameField",
      "Your username must contain at least 3 characters."
    );
    isValid = false;
  } else if (!/^[A-Za-z0-9]+$/.test(username)) {
    setFieldError(
      "usernameField",
      "Your username can only contain letters and numbers."
    );
    isValid = false;
  }

  if (!country) {
    setFieldError("countryField", "Please enter your country.");
    isValid = false;
  }

  if (!yearLevel) {
    setFieldError("yearLevelField", "Please select your year level.");
    isValid = false;
  }

  if (!industry) {
    setFieldError("industryField", "Please select your industry.");
    isValid = false;
  }

  if (!password) {
    setFieldError("passwordField", "Please create a password.");
    isValid = false;
  } else if (!isStrongPassword(password)) {
    setFieldError(
      "passwordField",
      "Use at least 6 characters, at least 1 number, and no special characters."
    );
    isValid = false;
  }

  if (!confirmation) {
    setFieldError(
      "confirmPasswordField",
      "Please confirm your password."
    );
    isValid = false;
  } else if (password !== confirmation) {
    isValid = false;
  }

  return isValid;
}

function clearInputError(input, fieldId) {
  input.addEventListener("input", () => {
    clearFieldError(fieldId);
    clearSystemMessage();
  });
}

clearInputError(nameInput, "nameField");
clearInputError(usernameInput, "usernameField");
clearInputError(countryInput, "countryField");

yearLevelInput.addEventListener("change", () => {
  clearFieldError("yearLevelField");
  clearSystemMessage();
});

industryInput.addEventListener("change", () => {
  clearFieldError("industryField");
  clearSystemMessage();
});

passwordInput.addEventListener("input", () => {
  clearFieldError("passwordField");
  clearFieldError("confirmPasswordField");
  clearSystemMessage();
  updatePasswordHint();
  updatePasswordMatch();
});

confirmPasswordInput.addEventListener("input", () => {
  clearFieldError("confirmPasswordField");
  clearSystemMessage();
  updatePasswordMatch();
});

showPasswordsInput.addEventListener("change", () => {
  const type = showPasswordsInput.checked ? "text" : "password";

  passwordInput.type = type;
  confirmPasswordInput.type = type;
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  nameInput.value = nameInput.value.trim();
  usernameInput.value = usernameInput.value.trim();
  countryInput.value = countryInput.value.trim();

  updatePasswordHint();
  updatePasswordMatch();

  if (!validateSignupForm()) {
    setSystemMessage("Please correct the highlighted fields.", "error");
    return;
  }

  try {
    const profile = {
      name: nameInput.value,
      username: usernameInput.value,
      country: countryInput.value,
      year: yearLevelInput.value,
      industry: industryInput.value,
      avatar: nameInput.value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "ST"
    };

    if (FocusFlowShared.isCloudMode()) {
      await FocusFlowShared.apiRequest("auth/signup", {
        method: "POST",
        body: {
          username: usernameInput.value,
          password: passwordInput.value,
          profile,
          state: {}
        }
      });
    } else {
      const existingAccount = FocusFlowShared.getLocalAccount();

      if (existingAccount) {
        setSystemMessage(
          "A local FocusFlow account already exists in this browser. Log in with it, or delete its local data from Settings before creating a different account.",
          "error"
        );
        return;
      }

      await FocusFlowShared.createLocalAccount({
        username: usernameInput.value,
        password: passwordInput.value,
        profile
      });
    }

    const savedData = FocusFlowShared.readStorage(
      "focusflowDashboardData",
      {}
    );

    FocusFlowShared.writeStorage("focusflowDashboardData", {
      ...savedData,
      profile,
      tasks: Array.isArray(savedData.tasks) ? savedData.tasks : [],
      progress: {
        focusMinutesToday: 0,
        dailyGoalMinutes: 60,
        streak: 0,
        ...(savedData.progress || {})
      },
      settings: {
        ...(savedData.settings || {})
      }
    });

    setSystemMessage(
      FocusFlowShared.isCloudMode()
        ? "Account created. Your login is now saved securely in the FocusFlow database."
        : "Account created securely. You can now log in with this username and password.",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "login.html";
    }, 700);
  } catch (error) {
    setSystemMessage(
      error?.message || "Your account could not be created in this browser.",
      "error"
    );
  }
});