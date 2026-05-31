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

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginUsername.value = loginUsername.value.trim();

  if (!validateLoginForm()) {
    setSystemMessage("Please correct the highlighted fields.", "error");
    return;
  }

  setSystemMessage(
    "Your login details are valid. Authentication will be added next.",
    "success"
  );
});