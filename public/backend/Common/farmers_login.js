// public/backend/Common/farmers_login.js
import { supabase } from "./supabase-config.js";

let alertBox = document.getElementById("alertBox");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.querySelector("button[type='submit']");

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 30 * 1000; // 30s lockout

function showAlert(message, type) {
  if (!alertBox) {
    alertBox = document.createElement("div");
    alertBox.id = "alertBox";
    alertBox.className = "alert";
    document.querySelector(".container").appendChild(alertBox);
  }
  alertBox.innerHTML = message;
  alertBox.className = `alert ${type}`;
  alertBox.style.display = "block";
}

function disableForm(seconds) {
  emailInput.disabled = true;
  passwordInput.disabled = true;
  loginButton.disabled = true;

  let remaining = seconds;
  loginButton.textContent = `Try again in ${remaining}s`;

  const countdown = setInterval(() => {
    remaining--;
    loginButton.textContent = `Try again in ${remaining}s`;

    if (remaining <= 0) {
      clearInterval(countdown);
      emailInput.disabled = false;
      passwordInput.disabled = false;
      loginButton.disabled = false;
      loginButton.textContent = "Login";
      alertBox.style.display = "none";
    }
  }, 1000);
}

function isLocked() {
  const lockUntil = localStorage.getItem("lockUntil");
  if (lockUntil && Date.now() < parseInt(lockUntil)) {
    const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000);
    showAlert(`Too many failed attempts. Try again in ${remaining} seconds.`, "error");
    disableForm(remaining);
    return true;
  }
  return false;
}

function recordFailedAttempt() {
  let attempts = parseInt(localStorage.getItem("loginAttempts") || "0") + 1;
  localStorage.setItem("loginAttempts", attempts);

  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem("lockUntil", Date.now() + LOCK_TIME);
    localStorage.setItem("loginAttempts", 0);
    showAlert(`Too many failed attempts. Please try again in ${LOCK_TIME / 1000} seconds.`, "error");
    disableForm(LOCK_TIME / 1000);
  }
}

function resetAttempts() {
  localStorage.setItem("loginAttempts", 0);
  localStorage.removeItem("lockUntil");
}

async function login() {
  if (isLocked()) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  try {
    // ✅ Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const code = (error.message || "").toLowerCase();
      if (code.includes("invalid login")) {
        showAlert("Incorrect email or password. Please try again.", "error");
      } else {
        showAlert(error.message, "error");
      }
      recordFailedAttempt();
      passwordInput.value = "";
      return;
    }

  const user = data.user;

  if (!user) {
    showAlert("Login failed. Please try again.", "error");
    return;
  }

  // ✅ Check if email is verified
  if (!user.email_confirmed_at) {
    showAlert(
      "Your email is registered but not yet verified. Please check your inbox.",
      "warning"
    );
    passwordInput.value = "";
    recordFailedAttempt();
    return;
  }

  // ✅ Fetch extra details from `users` table
  const { data: userDetails, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  let profile;
  if (userDetails) {
    profile = userDetails;
  } else {
    console.warn("No row found in users table, using auth metadata as fallback");
    profile = {
      full_name: user.user_metadata?.full_name || user.email,
      contact: user.user_metadata?.contact || "",
      role: user.user_metadata?.role || "farmer",
      status: "verified",
    };

    // Optional: auto-insert missing row
    const { error: insertFallback } = await supabase.from("users").insert([
      {
        full_name: profile.full_name,
        email: user.email,
        contact: profile.contact,
        role: profile.role,
        status: "verified",
      },
    ]);
    if (insertFallback) console.error("Insert fallback failed:", insertFallback);
  }

  // ✅ Always use profile
  localStorage.setItem("farmerName", profile.full_name || "User");
  localStorage.setItem("farmerContact", profile.contact || "");
  localStorage.setItem("userRole", profile.role || "farmer");
  localStorage.setItem("userId", user.id);

  resetAttempts();
  showAlert("Login successful!", "success");

  // Redirect
  setTimeout(() => {
    if (profile.role === "sra_officer") {
      window.location.href = "../../frontend/SRA/SRA_Dashboard.html";
    } else {
      window.location.href = "../../frontend/Common/lobby.html";
    }
  }, 1500);


  } catch (err) {
    console.error("Unexpected error:", err);
    showAlert("Login failed. Please try again.", "error");
    recordFailedAttempt();
  }
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  login();
});

document.querySelectorAll("#email, #password").forEach((input) => {
  input.addEventListener("focus", () => {
    if (alertBox) alertBox.style.display = "none";
  });
});

isLocked();
