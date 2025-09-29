// public/backend/Driver/Driver_Badge.js
import { supabase } from "../Common/supabase-config.js";

console.log("✅ Driver_Badge.js loaded (Supabase version)");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("driverBadgeForm");
  if (!form) return;

  // 📂 Convert file to base64 for storing as text
  async function uploadFile(file) {
    if (!file) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 🔹 Check if user already applied
  async function hasApplied(userId) {
    const { data, error } = await supabase
      .from("driver_badges")
      .select("id")
      .eq("user_id", userId);

    if (error) {
      console.error("Check error:", error.message);
      return true; // prevent duplicate if check fails
    }
    return data.length > 0;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      // Get current logged-in user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        alert("⚠️ You must be logged in to apply.");
        return;
      }
      const userId = userData.user.id;

      // Check if already applied
      if (await hasApplied(userId)) {
        alert("⚠️ You have already applied for a driver badge. Only one application is allowed.");
        return;
      }

      const formData = new FormData(form);

      // 🔹 Convert images to base64 text
      const licenseFront = await uploadFile(formData.get("license_front"));
      const licenseBack  = await uploadFile(formData.get("license_back"));
      const photo        = await uploadFile(formData.get("photo"));
      const orcr         = await uploadFile(formData.get("vehicle_orcr"));

      // 🔹 Collect form data
      const driverData = {
        user_id: userId,
        fullname: formData.get("fullname"),
        contact_number: formData.get("contact_number"),
        address: formData.get("address"),
        birth_date: formData.get("birth_date"),
        email: formData.get("email"),
        license_number: formData.get("license_number"),
        license_expiry: formData.get("license_expiry"),
        license_type: formData.get("license_type"),
        license_status: formData.get("license_status"),
        plate_number: formData.get("plate_number"),
        vehicle_model: formData.get("vehicle_model"),
        vehicle_year: formData.get("vehicle_year"),
        vehicle_color: formData.get("vehicle_color"),
        vehicle_types: formData.getAll("vehicle_types[]"),
        other_vehicle_type: formData.get("other_vehicle_type"),
        license_front_url: licenseFront,
        license_back_url: licenseBack,
        photo_url: photo,
        vehicle_orcr_url: orcr,
        created_at: new Date(),
      };

      console.log("🚀 Submitting driver data:", driverData);

      // 🔹 Insert into Supabase table
      const { data, error } = await supabase
        .from("driver_badges")
        .insert([driverData]);

      if (error) {
        console.error("❌ Insert error:", error.message);
        alert("Error submitting application. Please try again.");
        return;
      }

      // 🔹 Update user's role to "driver" in users table using email
      const { error: roleError } = await supabase
        .from("users")
        .update({ role: "driver" })
        .eq("email", formData.get("email")); // match by email

      if (roleError) {
        console.warn("⚠️ Role update failed:", roleError.message);
      } else {
        console.log("✅ Role updated to driver");
        localStorage.setItem("userRole", "driver"); // update localStorage
      }

      alert("✅ Driver badge application submitted successfully!");
      window.location.href = "../Common/lobby.html"; // redirect after submit

    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Something went wrong. Please try again.");
    }
  });
});
