// public/backend/Common/signup.js
import { supabase } from "./supabase-config.js";

const form = document.getElementById("signup-form");
const messageDiv = document.getElementById("message");

const errors = {
  fullname: document.getElementById("error-fullname"),
  email: document.getElementById("error-email"),
  contact: document.getElementById("error-contact"),
  password: document.getElementById("error-password"),
  confirmPassword: document.getElementById("error-confirm-password"),
  terms: document.getElementById("error-terms"),
};

const successModal = document.getElementById("successModal");
const modalOkBtn = document.getElementById("modalOkBtn");
const modalMessageEl = document.getElementById("modalMessage");

function clearErrors() {
  for (const k in errors) errors[k].textContent = "";
  messageDiv.textContent = "";
  messageDiv.style.color = "#16a34a";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const fullName = form.fullname.value.trim();
  const email = form.email.value.trim();
  const contact = form.contact.value.trim();
  const password = form.password.value;
  const confirm = form["confirm-password"].value;
  const terms = form.terms.checked;

  // ---------- validations ----------
  let valid = true;
  if (!fullName) {
    errors.fullname.textContent = "Please enter your full name.";
    valid = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.email.textContent = "Please enter a valid email.";
    valid = false;
  }

  const contactRegex = /^\+?\d{10,15}$/;
  if (!contact || !contactRegex.test(contact)) {
    errors.contact.textContent = "Please enter a valid contact number.";
    valid = false;
  }

  const strongPass = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
  if (!password || password.length < 8 || !strongPass.test(password)) {
    errors.password.textContent =
      "Password must have uppercase, lowercase, number and special character.";
    valid = false;
  }

  if (confirm && confirm !== password) {
    errors.confirmPassword.textContent = "Passwords do not match.";
    valid = false;
  }

  if (!terms) {
    errors.terms.textContent =
      "You must agree to the Terms of Service and Privacy Policy.";
    valid = false;
  }

  if (!valid) return;

  // ---------- Check if email already exists ----------
  const { data: existingUser, error: checkError } = await supabase
    .from("users")
    .select("email, status")
    .eq("email", email)
    .maybeSingle();

  if (checkError) console.error("Check error:", checkError);

  if (existingUser) {
    messageDiv.style.color = "#dc2626";
    if (existingUser.status === "unverified") {
      messageDiv.textContent =
        "This email is already registered but not yet verified. Please check your email inbox (and spam folder) for the verification link.";
      return;
    }
    if (existingUser.status === "verified") {
      messageDiv.textContent =
        "This email is already verified and in use. Please log in instead.";
      return;
    }
  }

  // ---------- Supabase sign-up ----------
  const redirectURL = `${window.location.origin}/public/frontend/Common/farmers_login.html`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectURL,
      data: { full_name: fullName, contact, role: "farmer" },
    },
  });

  if (error) {
    messageDiv.style.color = "#dc2626";
    messageDiv.textContent = error.message;
    return;
  }

  // ---------- Insert into users table with Auth UID ----------
  if (data && data.user) {
    const authUID = data.user.id;

    const { error: insertError } = await supabase.from("users").insert([
      {
        uid: authUID, // store Supabase Auth UID
        full_name: fullName,
        email,
        contact,
        role: "farmer",
        status: "unverified",
      },
    ]);

    if (insertError) {
      console.error("Insert error:", insertError);
      messageDiv.style.color = "#dc2626";

      if (
        insertError.code === "23505" ||
        (insertError.message || "").toLowerCase().includes("duplicate")
      ) {
        messageDiv.textContent =
          "This email is already registered. Please log in or verify your email.";
      } else {
        messageDiv.textContent = insertError.message;
      }
      return;
    }
  }

  // ---------- Local storage ----------
  localStorage.setItem("farmerName", fullName);
  localStorage.setItem("farmerContact", contact);

  // ---------- Show success modal ----------
  const verifyMsg = `Sign-up successful! We've sent a verification link to ${email}. Please verify your email before logging in.`;
  if (modalMessageEl) modalMessageEl.textContent = verifyMsg;
  successModal.style.display = "flex";
  modalOkBtn.onclick = () => {
    successModal.style.display = "none";
    window.location.href = "/public/frontend/Common/farmers_login.html";
  };

  form.reset();
});
