// Handles Add User modal variations for Farmers vs SRA Officers
// Splits logic out of dashboard.html

import { auth, db } from '../Common/firebase-config.js';
import { 
  addDoc, 
  collection, 
  serverTimestamp,
  setDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { 
  createUserWithEmailAndPassword as createUser,
  sendEmailVerification as sendVerification,
  updateProfile as updateUserProfile
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';

function generateTempPassword(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  let out = '';
  for (let i=0;i<10;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

// Custom alert function to replace browser alerts
function showCustomAlert(message, type = 'info') {
  // Remove existing alerts
  const existingAlert = document.getElementById('customAlert');
  if (existingAlert) {
    existingAlert.remove();
  }

  const alertDiv = document.createElement('div');
  alertDiv.id = 'customAlert';
  alertDiv.className = 'fixed top-4 right-4 z-50 max-w-md';
  
  const bgColor = type === 'error' ? 'bg-red-500' : 
                  type === 'warning' ? 'bg-yellow-500' : 
                  type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  
  alertDiv.innerHTML = `
    <div class="${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3">
      <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 
                     type === 'warning' ? 'fa-exclamation-triangle' : 
                     type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
      <span class="flex-1">${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  document.body.appendChild(alertDiv);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 5000);
}


export function openAddSRAModal(){
  // Since the addUserModal was removed, this function is no longer functional
  // You may want to create a new modal or redirect to a different page
  console.log('Add SRA modal functionality has been disabled');
  return;
}

function toggleSRAFields(show){
  ['tempPasswordRow','statusRow','forceChangeRow'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = show ? '' : 'none';
  });
}

// Hook generators
export function wireGenerators(){
  const genBtn = document.getElementById('genUserTempPassword');
  const pw = document.getElementById('userTempPassword');
  if (genBtn && pw){
    genBtn.addEventListener('click', () => { pw.value = generateTempPassword(); });
  }
}

// Optional: override submit to inject temp password storage
export function wireSubmitAugment(){
  const form = document.getElementById('addUserForm');
  if (!form) return;
  form.addEventListener('submit', async () => {
    try{
      const email = (document.getElementById('userEmail')||{}).value || '';
      const role = (document.getElementById('userRole')||{}).value || '';
      const temp = (document.getElementById('userTempPassword')||{}).value || '';
      if (role === 'sra' && email && temp){
        await addDoc(collection(db,'temp_passwords'), {
          email, tempPassword: temp, role, createdAt: serverTimestamp()
        });
      }
    }catch(_){}
  }, { once: true });
}

// Expose to window for inline usage
// eslint-disable-next-line no-undef
window.openAddSRAModal = openAddSRAModal;
// eslint-disable-next-line no-undef
window.wireAddUserModal = () => { wireGenerators(); wireSubmitAugment(); };

async function showSRASuccessPopup({ name, email, temp }){
  return new Promise((resolve) => {
    let modal = document.getElementById('sraAccountPopup');
    if (!modal){
      modal = document.createElement('div');
      modal.id = 'sraAccountPopup';
      modal.className = 'fixed inset-0 bg-black/40 hidden items-center justify-center z-50';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl w-[92%] max-w-xl p-6 shadow-2xl relative space-y-3';
    const close = document.createElement('button');
    close.className = 'absolute top-3 right-4 text-xl';
    close.textContent = '×';
    close.onclick = () => { modal.classList.add('hidden'); resolve(); };
    const title = document.createElement('h3');
    title.className = 'text-xl font-semibold text-green-600';
    title.textContent = 'SRA Officer Account Created Successfully';
    const body = document.createElement('div');
    body.className = 'text-sm text-gray-700 space-y-3';
    const link = window.location.origin + '/frontend/Common/farmers_login.html';
    body.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center mb-2">
          <i class="fas fa-check-circle text-green-500 mr-2"></i>
          <span class="font-semibold text-green-800">Account Created & Verification Email Sent</span>
        </div>
        <p class="text-green-700">The SRA Officer account has been created and a verification email has been sent to:</p>
        <p class="font-mono text-sm bg-white px-2 py-1 rounded border mt-1">${email}</p>
      </div>
      
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="font-semibold text-blue-800 mb-2">Next Steps:</h4>
        <ol class="list-decimal list-inside space-y-1 text-blue-700 text-sm">
          <li>The officer will receive a verification email</li>
          <li>They must click the verification link in the email</li>
          <li>After verification, they can login with:</li>
        </ol>
        <div class="mt-2 bg-white px-3 py-2 rounded border text-sm">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${temp}</p>
        </div>
        <p class="text-xs text-blue-600 mt-2">Login URL: <a href="${link}" class="underline" target="_blank">${link}</a></p>
      </div>
      
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p class="text-yellow-800 text-sm">
          <i class="fas fa-exclamation-triangle mr-1"></i>
          <strong>Important:</strong> The officer must verify their email before they can access the SRA dashboard.
        </p>
      </div>
    `;
    const footer = document.createElement('div');
    footer.className = 'pt-2 text-right';
    const ok = document.createElement('button');
    ok.className = 'px-5 py-2 rounded-lg bg-[var(--cane-600)] hover:bg-[var(--cane-700)] text-white';
    ok.textContent = 'Close';
    ok.onclick = () => { modal.classList.add('hidden'); resolve(); };
    card.appendChild(close); card.appendChild(title); card.appendChild(body); footer.appendChild(ok); card.appendChild(footer); modal.appendChild(card);
    modal.classList.remove('hidden'); modal.classList.add('flex');
  });
}


