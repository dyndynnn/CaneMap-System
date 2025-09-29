import { supabase } from "../../backend/Common/supabase-config.js";

const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm-password");
const resetBtn = document.getElementById("resetBtn");
const alertBox = document.getElementById("alertBox");

const modalOverlay = document.getElementById("modalOverlay");
const modalMessage = document.getElementById("modalMessage");
const modalOkBtn = document.getElementById("modalOkBtn");

function showAlert(message, type) {
  hideModal();
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.style.display = "block";
}

function clearAlert() {
  alertBox.textContent = "";
  alertBox.className = "alert";
  alertBox.style.display = "none";
}

function showModal(message) {
  clearAlert();
  modalMessage.textContent = message;
  modalOverlay.style.display = "flex";
}

function hideModal() {
  modalOverlay.style.display = "none";
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password);
}

resetBtn.addEventListener("click", async () => {
  clearAlert();
  hideModal();

  const password = passwordInput.value.trim();
  const confirmPassword = confirmInput.value.trim();

  if (!password || !confirmPassword) {
    showAlert("Please fill all fields.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showAlert("Passwords do not match.", "error");
    return;
  }

  if (!isStrongPassword(password)) {
    showAlert(
      "Password must be at least 8 characters, include uppercase, lowercase, number, and special character.",
      "error"
    );
    return;
  }

  try {
    // ✅ Update password (Supabase automatically reads token from URL)
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      showAlert(error.message, "error");
      return;
    }

    showModal("Password reset successful!");
  } catch (err) {
    console.error(err);
    showAlert("Something went wrong. Please try again.", "error");
  }
});

modalOkBtn.addEventListener("click", () => {
  hideModal();
  window.location.href = "farmers_login.html";
});
