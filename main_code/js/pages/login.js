const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("username");
const loginPassword = document.getElementById("password");
const showLoginPassword = document.getElementById("showLoginPassword");
const loginMessage = document.getElementById("loginMessage");

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const error = field.querySelector(".field-error");
  const input = field.querySelector("input");
  const hasError = Boolean(message);

  field.classList.toggle("invalid", hasError);
  input.setAttribute("aria-invalid", String(hasError));
  error.textContent = message;
}

function clearFieldError(fieldId) {
  setFieldError(fieldId, "");
}

function setSystemMessage(message, type) {
  loginMessage.textContent = message;
  loginMessage.className = `system-message ${type} show`;
}

function clearSystemMessage() {
  loginMessage.textContent = "";
  loginMessage.className = "system-message";
}

function validateLoginForm() {
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  let isValid = true;

  clearFieldError("usernameField");
  clearFieldError("passwordField");
  clearSystemMessage();

  if (!username) {
    setFieldError("usernameField", "Please enter your username.");
    isValid = false;
  }

  if (!password) {
    setFieldError("passwordField", "Please enter your password.");
    isValid = false;
  } else if (password.length < 6) {
    setFieldError(
      "passwordField",
      "Your password must be at least 6 characters."
    );
    isValid = false;
  }

  return isValid;
}

loginUsername.addEventListener("input", () => {
  clearFieldError("usernameField");
  clearSystemMessage();
});

loginPassword.addEventListener("input", () => {
  clearFieldError("passwordField");
  clearSystemMessage();
});

showLoginPassword.addEventListener("change", () => {
  loginPassword.type = showLoginPassword.checked ? "text" : "password";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginUsername.value = loginUsername.value.trim();

  if (!validateLoginForm()) {
    setSystemMessage("Please correct the highlighted fields.", "error");
    return;
  }

  try {
    const account = FocusFlowShared.getLocalAccount();

    if (!account) {
      setSystemMessage(
        "No local FocusFlow account exists yet. Create one on the Sign Up page first.",
        "error"
      );
      return;
    }

    const valid = await FocusFlowShared.verifyLocalPassword(
      loginUsername.value,
      loginPassword.value
    );

    if (!valid) {
      setSystemMessage("Incorrect username or password.", "error");
      return;
    }

    const displayUsername = account.displayUsername || loginUsername.value;

    sessionStorage.setItem(
      "focusflowCurrentUser",
      JSON.stringify({
        username: displayUsername,
        loggedInAt: new Date().toISOString()
      })
    );
    sessionStorage.setItem("focusflow_token", "local-auth");
    sessionStorage.setItem("focusflow_username", displayUsername);

    const remember = document.getElementById("rememberLogin")?.checked;
    if (remember) {
      localStorage.setItem("focusflowRememberedUsername", displayUsername);
    } else {
      localStorage.removeItem("focusflowRememberedUsername");
    }

    setSystemMessage("Login successful. Opening FocusFlow…", "success");

    window.setTimeout(() => {
      window.location.href = "index.html";
    }, 450);
  } catch (error) {
    setSystemMessage(
      error?.message || "Login could not be completed in this browser.",
      "error"
    );
  }
});