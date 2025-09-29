import { sendPasswordResetEmail, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

const emailInput = document.getElementById("email");
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
  modalOkBtn.disabled = false;
}

function hideModal() {
  modalOverlay.style.display = "none";
}

resetBtn.addEventListener("click", async () => {
  clearAlert();
  hideModal();

  const emailRaw = emailInput.value.trim();
  const email = emailRaw; // keep original casing for best provider match

  if (!email) {
    showAlert("Please enter your email address.", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert("Please enter a valid email address.", "error");
    return;
  }

  try {
    // Run existence check and send in parallel; decide messaging after results
    const methodsPromise = (async () => {
      try {
        return await fetchSignInMethodsForEmail(auth, emailRaw);
      } catch (_) {
        try { return await fetchSignInMethodsForEmail(auth, emailRaw.toLowerCase()); } catch (_) { return null; }
      }
    })();

    let sendError = null;
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      sendError = err;
    }

    let methods = null;
    try { methods = await methodsPromise; } catch (_) { methods = null; }

    if (!sendError) {
      // If sending succeeded, show success regardless of methods check
      showModal("Reset link has been sent successfully. Please check your Inbox or Spam folder.");
      return;
    }

    // Sending failed; classify the error leveraging both the code and methods
    if (sendError.code === "auth/user-not-found" || (Array.isArray(methods) && methods.length === 0)) {
      showModal("This email is not registered or verified in our system. Please check and try again.");
      return;
    }
    if (sendError.code === "auth/invalid-email") {
      showModal("Invalid email address.");
      return;
    }
    if (sendError.code === "auth/network-request-failed") {
      showModal("Network error. Please check your connection and try again.");
      return;
    }
    showModal("Something went wrong. Please try again.");
  } catch (error) {
    // Fallback catch in case the outer try block throws unexpectedly before classification
    console.error("UNCAUGHT RESET ERROR:", error);
    showModal("Something went wrong. Please try again.");
  }
});

modalOkBtn.addEventListener("click", () => {
  hideModal();
  window.location.href = "../../frontend/Common/farmers_login.html";
});

emailInput.addEventListener("focus", () => clearAlert());
