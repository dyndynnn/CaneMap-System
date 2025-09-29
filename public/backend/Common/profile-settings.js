import { auth, db } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, updateEmail, updateProfile } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

const ui = {
  updateBtn: document.getElementById('updateBtn'),
  editBtn: document.getElementById('editBtn'),
  updatePanel: document.getElementById('updatePanel'),
  editPanel: document.getElementById('editPanel'),
  updateFields: document.getElementById('updateFields'),
  updateSaveBtn: document.getElementById('updateSaveBtn'),
  editSaveBtn: document.getElementById('editSaveBtn'),
  ro: {
    fullname: document.getElementById('ro_fullname'),
    email: document.getElementById('ro_email'),
    contact: document.getElementById('ro_contact'),
    location: document.getElementById('ro_location'),
  },
  input: {
    fullname: document.getElementById('in_fullname'),
    email: document.getElementById('in_email'),
    contact: document.getElementById('in_contact'),
    barangay: document.getElementById('in_barangay'),
    municipality: document.getElementById('in_municipality'),
    nickname: document.getElementById('in_nickname'),
    gender: document.getElementById('in_gender'),
    birthday: document.getElementById('in_birthday'),
    address: document.getElementById('in_address'),
    newpass: document.getElementById('in_newpass'),
    newpass2: document.getElementById('in_newpass2'),
  },
  photo: {
    img: document.getElementById('profilePhoto'),
    btn: document.getElementById('photoUploadBtn'),
    file: document.getElementById('photoFileInput'),
  },
  displayName: document.getElementById('displayName'),
  sensitiveInfoBanner: document.getElementById('sensitiveInfoBanner'),
  showSensitiveBtn: document.getElementById('showSensitiveBtn'),
  sensitivePanel: document.getElementById('sensitiveInfoPanel'),
  confirmModal: document.getElementById('confirmModal'),
  confirmYes: document.getElementById('confirmYes'),
  confirmNo: document.getElementById('confirmNo'),
  successModal: document.getElementById('successModal'),
  successOk: document.getElementById('successOk'),
  verifyModal: document.getElementById('verifyModal'),
  attemptsLabel: document.getElementById('attemptsLabel'),
  verifyPassword: document.getElementById('verifyPassword'),
  verifyError: document.getElementById('verifyError'),
  verifyConfirm: document.getElementById('verifyConfirm'),
  verifyCancel: document.getElementById('verifyCancel')
};

let userDocCache = null;
let role = 'worker';
let remainingAttempts = 3;

function setExpanded(element, expanded) {
  if (!element) return;
  element.classList.remove('collapsed', 'expanded');
  element.classList.add(expanded ? 'expanded' : 'collapsed');
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function buildMissingField(name, label, type = 'text') {
  const id = `miss_${name}`;
  return `
    <div>
      <label class="text-xs text-[var(--cane-700)] font-semibold">${label}</label>
      ${type === 'select' ? `
        <select id="${id}" class="w-full mt-1 px-3 py-2 border border-[var(--cane-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--cane-500)]">
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      ` : type === 'date' ? `
        <input id="${id}" type="date" class="w-full mt-1 px-3 py-2 border border-[var(--cane-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--cane-500)]" />
      ` : `
        <input id="${id}" type="text" class="w-full mt-1 px-3 py-2 border border-[var(--cane-300)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--cane-500)]" />
      `}
    </div>
  `;
}

function populateReadOnly(data, user) {
  const fullname = data.fullname || user?.displayName || '-';
  const email = user?.email || '-';
  const contact = data.contact || '-';
  const barangay = data.barangay || '';
  const municipality = data.municipality || '';
  ui.ro.fullname.textContent = fullname;
  ui.ro.email.textContent = email;
  ui.ro.contact.textContent = contact;
  ui.ro.location.textContent = [barangay, municipality].filter(Boolean).join(', ') || '-';
  ui.displayName.textContent = fullname;
  const roNickname = document.getElementById('ro_nickname');
  const roGender = document.getElementById('ro_gender');
  const roBirthday = document.getElementById('ro_birthday');
  const roAddress = document.getElementById('ro_address');
  if (roNickname) roNickname.textContent = data.nickname || '-';
  if (roGender) roGender.textContent = data.gender || '-';
  if (roBirthday) roBirthday.textContent = data.birthday || '-';
  if (roAddress) roAddress.textContent = data.address || '-';
  const photoUrl = data.photoURL || user?.photoURL || '';
  ui.photo.img.src = photoUrl || `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' fill='%23ecfcca'/><g fill='%235ea500'><circle cx='64' cy='48' r='22'/><rect x='28' y='80' width='72' height='28' rx='14'/></g></svg>`)}`;
}

function populateEditInputs(data, user) {
  ui.input.fullname.value = data.fullname || user?.displayName || '';
  ui.input.email.value = user?.email || '';
  ui.input.contact.value = data.contact || '';
  ui.input.barangay.value = data.barangay || '';
  ui.input.municipality.value = data.municipality || '';
  ui.input.nickname.value = data.nickname || '';
  ui.input.gender.value = data.gender || '';
  ui.input.birthday.value = data.birthday || '';
  ui.input.address.value = data.address || '';
}

function buildMissingFieldsUI(data) {
  const completed = isAdditionalInfoComplete(data);
  if (data.profileCompleted || completed) {
    setUpdateButtonHidden(true);
    if (ui.updatePanel) ui.updatePanel.classList.add('hidden');
    return;
  }
  const missing = [];
  if (!data.nickname) missing.push(['nickname', 'Nickname']);
  if (!data.gender) missing.push(['gender', 'Gender', 'select']);
  if (!data.birthday) missing.push(['birthday', 'Birthday', 'date']);
  if (!data.address) missing.push(['address', 'Complete Address']);
  ui.updateFields.innerHTML = missing.map(([n,l,t]) => buildMissingField(n,l,t)).join('');
  // Show Update button only when at least one required additional field is missing; otherwise hide forever
  if (missing.length === 0) {
    setUpdateButtonHidden(true);
    if (ui.updatePanel) setExpanded(ui.updatePanel, false);
  } else {
    setUpdateButtonHidden(false);
  }
}

function isAdditionalInfoComplete(data) {
  return Boolean((data.nickname && data.nickname.trim()) &&
                 (data.gender && data.gender.trim()) &&
                 (data.birthday && data.birthday.trim()) &&
                 (data.address && data.address.trim()));
}

async function fetchUserDoc(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

async function ensureUserDoc(uid, base) {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, base, { merge: true });
}

function getRoleFromDoc(docData) {
  if (docData?.role) return docData.role;
  return 'worker';
}

function showSensitiveForRole(roleName) {
  ui.sensitiveInfoBanner.classList.toggle('hidden', !(roleName === 'driver' || roleName === 'field' || roleName === 'driver_field' || roleName === 'driver-field'));
}

async function uploadProfilePhoto(user) {
  const file = ui.photo.file.files?.[0];
  if (!file) return null;
  const storage = getStorage();
  const storageRef = ref(storage, `profilePhotos/${user.uid}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateProfile(user, { photoURL: url });
  await updateDoc(doc(db, 'users', user.uid), { photoURL: url, updatedAt: serverTimestamp() });
  return url;
}

function confirmBeforeSave() {
  return new Promise((resolve) => {
    openModal(ui.confirmModal);
    const yes = () => { cleanup(); resolve(true); };
    const no = () => { cleanup(); resolve(false); };
    function cleanup() {
      ui.confirmYes.removeEventListener('click', yes);
      ui.confirmNo.removeEventListener('click', no);
      closeModal(ui.confirmModal);
    }
    ui.confirmYes.addEventListener('click', yes);
    ui.confirmNo.addEventListener('click', no);
  });
}

function init() {
  let authResolved = false;
  const redirectTimerId = setTimeout(() => {
    if (!authResolved) {
              window.location.href = '../frontend/Handler/farmers_login.html';
    }
  }, 2000);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      return; // wait for timer to decide
    }
    authResolved = true;
    clearTimeout(redirectTimerId);
    const docData = await fetchUserDoc(user.uid);
    userDocCache = docData || {};
    role = getRoleFromDoc(userDocCache);
    populateReadOnly(userDocCache || {}, user);
    populateEditInputs(userDocCache || {}, user);
    buildMissingFieldsUI(userDocCache || {});
    showSensitiveForRole(role);
    // Ensure read-only state by default; enable only when Edit is toggled
    toggleEditMode(false);
  });
}

ui.editBtn?.addEventListener('click', () => {
  const nowExpanded = !ui.editPanel.classList.contains('expanded');
  setExpanded(ui.editPanel, nowExpanded);
  if (nowExpanded) setExpanded(ui.updatePanel, false);
  // Toggle edit mode styles and controls
  toggleEditMode(nowExpanded);
});

ui.updateBtn?.addEventListener('click', () => {
  const nowExpanded = !ui.updatePanel.classList.contains('expanded');
  setExpanded(ui.updatePanel, nowExpanded);
  if (nowExpanded) setExpanded(ui.editPanel, false);
});

ui.photo.btn?.addEventListener('click', () => ui.photo.file.click());
ui.photo.file?.addEventListener('change', () => {
  const f = ui.photo.file.files?.[0];
  if (f) {
    const reader = new FileReader();
    reader.onload = e => { ui.photo.img.src = e.target.result; };
    reader.readAsDataURL(f);
  }
});

ui.updateSaveBtn?.addEventListener('click', async () => {
  const proceed = await confirmBeforeSave();
  if (!proceed) return;
  const user = auth.currentUser;
  if (!user) return;
  const updatePayload = {};
  const missNickname = document.getElementById('miss_nickname')?.value?.trim();
  const missGender = document.getElementById('miss_gender')?.value?.trim();
  const missBirthday = document.getElementById('miss_birthday')?.value?.trim();
  const missAddress = document.getElementById('miss_address')?.value?.trim();
  if (missNickname) updatePayload.nickname = missNickname;
  if (missGender) updatePayload.gender = missGender;
  if (missBirthday) updatePayload.birthday = missBirthday;
  if (missAddress) updatePayload.address = missAddress;
  if (Object.keys(updatePayload).length === 0) return;
  await ensureUserDoc(user.uid, { ...updatePayload, profileCompleted: true, updatedAt: serverTimestamp() });
  const refreshed = await fetchUserDoc(user.uid);
  userDocCache = refreshed || userDocCache;
  populateReadOnly(userDocCache || {}, user);
  buildMissingFieldsUI(userDocCache || {});
  setExpanded(ui.updatePanel, false);
  if (updatePayload.nickname) localStorage.setItem('farmerNickname', updatePayload.nickname);
  // Permanently hide Update button after first completion
  setUpdateButtonHidden(true);
  if (ui.updatePanel) ui.updatePanel.classList.add('hidden');
  toggleEditMode(false);
});

ui.editSaveBtn?.addEventListener('click', async () => {
  const proceed = await confirmBeforeSave();
  if (!proceed) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    const payload = {
      fullname: ui.input.fullname.value.trim(),
      contact: ui.input.contact.value.trim(),
      barangay: ui.input.barangay.value.trim(),
      municipality: ui.input.municipality.value.trim(),
      nickname: ui.input.nickname.value.trim(),
      gender: ui.input.gender.value.trim(),
      birthday: ui.input.birthday.value.trim(),
      address: ui.input.address.value.trim(),
      updatedAt: serverTimestamp()
    };
    const newEmail = ui.input.email.value.trim();
    const promises = [];
    if (ui.photo.file.files?.length) {
      promises.push(uploadProfilePhoto(user));
    }
    if (newEmail && newEmail !== user.email) {
      try { await updateEmail(user, newEmail); } catch (e) { /* ignore for now */ }
    }
    if (payload.fullname && payload.fullname !== (user.displayName || '')) {
      try { await updateProfile(user, { displayName: payload.fullname }); } catch (e) { /* ignore */ }
    }
    await Promise.allSettled(promises);
    await ensureUserDoc(user.uid, payload);
    const refreshed = await fetchUserDoc(user.uid);
    userDocCache = refreshed || userDocCache;
    populateReadOnly(userDocCache || {}, user);
    // Stay in edit mode as requested
    setExpanded(ui.editPanel, true);
    if (payload.fullname) localStorage.setItem('farmerName', payload.fullname);
    if (payload.contact) localStorage.setItem('farmerContact', payload.contact);
    if (payload.nickname) localStorage.setItem('farmerNickname', payload.nickname);
    toggleEditMode(true);
    // Show success modal
    if (ui.successModal) {
      openModal(ui.successModal);
      const close = () => {
        if (ui.successOk) ui.successOk.removeEventListener('click', close);
        closeModal(ui.successModal);
      };
      if (ui.successOk) ui.successOk.addEventListener('click', close);
    }
    // If after editing, all additional info is complete, mark profileCompleted and hide Update
    if (isAdditionalInfoComplete(userDocCache)) {
      await ensureUserDoc(user.uid, { profileCompleted: true, updatedAt: serverTimestamp() });
      setUpdateButtonHidden(true);
      if (ui.updatePanel) ui.updatePanel.classList.add('hidden');
    } else {
      setUpdateButtonHidden(false);
    }
  } catch (err) {
    console.error('Save failed:', err);
    alert('Saving failed: ' + (err?.message || err));
  }
});

// Sensitive info verification (for driver/field roles)
ui.showSensitiveBtn?.addEventListener('click', () => {
  remainingAttempts = 3;
  ui.attemptsLabel.textContent = `Attempts: ${remainingAttempts}`;
  ui.verifyPassword.value = '';
  ui.verifyError.textContent = '';
  openModal(ui.verifyModal);
});

ui.verifyCancel?.addEventListener('click', () => closeModal(ui.verifyModal));

ui.verifyConfirm?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  const pass = ui.verifyPassword.value;
  try {
    const cred = EmailAuthProvider.credential(user.email, pass);
    await reauthenticateWithCredential(user, cred);
    closeModal(ui.verifyModal);
    setExpanded(ui.sensitivePanel, true);
  } catch (e) {
    remainingAttempts = Math.max(0, remainingAttempts - 1);
    ui.attemptsLabel.textContent = `Attempts: ${remainingAttempts}`;
    ui.verifyError.textContent = remainingAttempts === 0 ? 'No attempts left.' : 'Incorrect password. Try again.';
    if (remainingAttempts === 0) {
      ui.verifyConfirm.disabled = true;
      setTimeout(() => {
        ui.verifyConfirm.disabled = false;
        closeModal(ui.verifyModal);
      }, 1500);
    }
  }
});

document.addEventListener('DOMContentLoaded', init);

function toggleEditMode(isEditing) {
  // Profile photo camera icon visibility
  if (ui.photo && ui.photo.btn) {
    if (isEditing) ui.photo.btn.classList.remove('hidden');
    else ui.photo.btn.classList.add('hidden');
  }
  // Input highlighting
  const inputs = [
    ui.input.fullname,
    ui.input.email,
    ui.input.contact,
    ui.input.barangay,
    ui.input.municipality,
    ui.input.nickname,
    ui.input.gender,
    ui.input.birthday,
    ui.input.address
  ].filter(Boolean);

  inputs.forEach(el => {
    if (isEditing) {
      el.classList.add('bg-[var(--cane-50)]', 'border-[var(--cane-500)]');
    } else {
      el.classList.remove('bg-[var(--cane-50)]', 'border-[var(--cane-500)]');
    }
    el.disabled = !isEditing;
  });
  // Disable file input when not editing
  if (ui.photo && ui.photo.file) ui.photo.file.disabled = !isEditing;
}

function setUpdateButtonHidden(hidden) {
  if (!ui.updateBtn) return;
  if (hidden) {
    ui.updateBtn.classList.add('hidden');
    ui.updateBtn.classList.remove('inline-flex');
    ui.updateBtn.classList.remove('sm:inline-flex');
  } else {
    ui.updateBtn.classList.remove('hidden');
    ui.updateBtn.classList.add('inline-flex');
  }
}


