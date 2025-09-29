import { supabase } from "./supabase-config.js";

const emailInput = document.getElementById("email");
const resetBtn = document.getElementById("resetBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalMessage = document.getElementById("modalMessage");
const modalOkBtn = document.getElementById("modalOkBtn");

let isSuccess = false;

function showModal(message, success = false) {
  modalMessage.textContent = message;
  modalOverlay.style.display = "flex";
  isSuccess = success;
  modalOkBtn.disabled = false;
}

function hideModal() {
  modalOverlay.style.display = "none";
}

resetBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  // Basic validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showModal("Invalid email. Please try again.", false);
    return;
  }

  try {
    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://127.0.0.1:5500/public/frontend/Common/farmers_resetpass.html"
    });

    if (error) {
      console.error("Supabase error:", error.message);
      showModal("Invalid email. Please try again.", false);
      return;
    }

    // Success message
    showModal("Reset link has been sent! Check your email.", true);
  } catch (err) {
    console.error(err);
    showModal("Invalid email. Please try again.", false);
  }
});

// Modal OK button
modalOkBtn.addEventListener("click", () => {
  hideModal();
  if (isSuccess) {
    window.location.href = "../../frontend/Common/farmers_login.html";
  }
  // Otherwise stay on page
});
