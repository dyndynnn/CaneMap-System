// CaneMap Workers handler hooked to Firestore (falls back to localStorage)
import { db } from '../../backend/Common/firebase-config.js';
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

(function(){
  const STORAGE_KEYS = {
    farmers: 'cm_farmers',
    drivers: 'cm_drivers',
    requests: 'cm_worker_requests'
  };

  const colFarmers = () => collection(db, 'farmers');
  const colDrivers = () => collection(db, 'drivers');
  const colRequests = () => collection(db, 'worker_requests');

  function readJson(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }catch(_){ return fallback; }
  }
  function writeJson(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } }
  function uid(){ return 'id_' + Math.random().toString(36).slice(2,9); }

  let refs = {};
  function grabRefs(){
    refs.farmersTbody = document.getElementById('farmersTbody');
    refs.driversTbody = document.getElementById('driversTbody');
    refs.requestsList = document.getElementById('requestsList');
    refs.requestsCount = document.getElementById('requestsCount');
    refs.searchFarmers = document.getElementById('searchFarmers');
    refs.searchDrivers = document.getElementById('searchDrivers');
    refs.addFarmerBtn = document.getElementById('addFarmer');
    refs.addDriverBtn = document.getElementById('addDriver');
  }
  function fmtDate(iso){ try{ const d=new Date(iso); return d.toLocaleDateString(); }catch(_){ return ''; } }

  async function fetchAllFirestore(){
    try{
      const [fSn, dSn, rSn] = await Promise.all([
        getDocs(colFarmers()),
        getDocs(colDrivers()),
        getDocs(colRequests())
      ]);
      const farmers = fSn.docs.map(d=>({ id:d.id, ...d.data() }));
      const drivers = dSn.docs.map(d=>({ id:d.id, ...d.data() }));
      const requests = rSn.docs.map(d=>({ id:d.id, ...d.data() }));
      writeJson(STORAGE_KEYS.farmers, farmers);
      writeJson(STORAGE_KEYS.drivers, drivers);
      writeJson(STORAGE_KEYS.requests, requests);
      return { farmers, drivers, requests };
    }catch(err){
      return {
        farmers: readJson(STORAGE_KEYS.farmers, []),
        drivers: readJson(STORAGE_KEYS.drivers, []),
        requests: readJson(STORAGE_KEYS.requests, [])
      };
    }
  }

  async function addFarmerFirestore(payload){
    try{ const id = payload.id || uid(); await setDoc(doc(colFarmers(), id), { ...payload, id, since: payload.since || new Date().toISOString(), createdAt: serverTimestamp() }); return id; }catch(_){ return null; }
  }
  async function addDriverFirestore(payload){
    try{ const id = payload.id || uid(); await setDoc(doc(colDrivers(), id), { ...payload, id, since: payload.since || new Date().toISOString(), createdAt: serverTimestamp() }); return id; }catch(_){ return null; }
  }
  async function approveRequestFirestore(req){
    try{
      const rRef = doc(colRequests(), req.id);
      // delete request
      await deleteDoc(rRef);
      if ((req.role||'').toLowerCase()==='driver'){
        await addDriverFirestore({ name:req.name, phone:req.phone||'', plate:req.plate||'' });
      }else{
        await addFarmerFirestore({ name:req.name, phone:req.phone||'', barangay:req.barangay||'' });
      }
      return true;
    }catch(_){ return false; }
  }
  async function rejectRequestFirestore(req){
    try{ await deleteDoc(doc(colRequests(), req.id)); return true; }catch(_){ return false; }
  }

  function renderFarmers(filter=''){
    const list = readJson(STORAGE_KEYS.farmers, []);
    const q = filter.trim().toLowerCase();
    const rows = list.filter(x => !q || (x.name+(x.barangay||'')+(x.phone||'')).toLowerCase().includes(q)).map(x => `
      <tr class="border-t border-[var(--cane-100)]">
        <td class="py-2 pr-2 font-semibold text-[var(--cane-950)]">${x.name}</td>
        <td class="py-2 pr-2">${x.barangay||''}</td>
        <td class="py-2 pr-2">${x.phone||''}</td>
        <td class="py-2 pr-2">${fmtDate(x.since)}</td>
        <td class="py-2 pr-2"></td>
      </tr>
    `).join('');
    if (refs.farmersTbody) refs.farmersTbody.innerHTML = rows || '<tr><td colspan="5" class="py-3 text-sm text-[var(--cane-700)]">No farmers yet.</td></tr>';
  }
  function renderDrivers(filter=''){
    const list = readJson(STORAGE_KEYS.drivers, []);
    const q = filter.trim().toLowerCase();
    const rows = list.filter(x => !q || (x.name+(x.plate||'')+(x.phone||'')).toLowerCase().includes(q)).map(x => `
      <tr class="border-t border-[var(--cane-100)]">
        <td class="py-2 pr-2 font-semibold text-[var(--cane-950)]">${x.name}</td>
        <td class="py-2 pr-2">${x.plate||''}</td>
        <td class="py-2 pr-2">${x.phone||''}</td>
        <td class="py-2 pr-2">${fmtDate(x.since)}</td>
        <td class="py-2 pr-2"></td>
      </tr>
    `).join('');
    if (refs.driversTbody) refs.driversTbody.innerHTML = rows || '<tr><td colspan="5" class="py-3 text-sm text-[var(--cane-700)]">No drivers yet.</td></tr>';
  }
  function renderRequests(){
    const list = readJson(STORAGE_KEYS.requests, []);
    if (refs.requestsCount) refs.requestsCount.textContent = `${list.length} pending`;
    if (!refs.requestsList) return;
    if (list.length === 0) { refs.requestsList.innerHTML = '<div class="text-sm text-[var(--cane-700)]">No pending requests.</div>'; return; }
    const tpl = document.getElementById('requestItemTpl');
    refs.requestsList.innerHTML = '';
    list.forEach(req => {
      const node = tpl.content.cloneNode(true);
      node.querySelector('[data-field="name"]').textContent = req.name;
      node.querySelector('[data-field="role"]').textContent = req.role;
      node.querySelector('[data-field="barangay"]').textContent = req.barangay||'';
      node.querySelector('[data-field="phone"]').textContent = req.phone||'';
      node.querySelector('[data-action="approve"]').addEventListener('click', async () => { await onApprove(req.id); });
      node.querySelector('[data-action="reject"]').addEventListener('click', async () => { await onReject(req.id); });
      refs.requestsList.appendChild(node);
    });
  }

  async function onApprove(id){
    const requests = readJson(STORAGE_KEYS.requests, []);
    const idx = requests.findIndex(r=>r.id===id);
    if (idx === -1) return;
    const req = requests[idx];
    // optimistic update
    requests.splice(idx,1); writeJson(STORAGE_KEYS.requests, requests);
    renderRequests();
    const ok = await approveRequestFirestore(req);
    if (!ok) {
      // fallback to local only
      if ((req.role||'').toLowerCase()==='driver'){
        const drivers = readJson(STORAGE_KEYS.drivers, []);
        drivers.push({ id: uid(), name: req.name, phone: req.phone, plate: req.plate||'', since: new Date().toISOString() });
        writeJson(STORAGE_KEYS.drivers, drivers);
      } else {
        const farmers = readJson(STORAGE_KEYS.farmers, []);
        farmers.push({ id: uid(), name: req.name, phone: req.phone, barangay: req.barangay||'', since: new Date().toISOString() });
        writeJson(STORAGE_KEYS.farmers, farmers);
      }
    }
    await refresh();
  }
  async function onReject(id){
    const requests = readJson(STORAGE_KEYS.requests, []);
    const idx = requests.findIndex(r=>r.id===id);
    if (idx === -1) return;
    const req = requests[idx];
    requests.splice(idx,1); writeJson(STORAGE_KEYS.requests, requests);
    renderRequests();
    await rejectRequestFirestore(req);
    await refresh();
  }

  function attachEvents(){
    if (refs.searchFarmers) refs.searchFarmers.addEventListener('input', ()=>renderFarmers(refs.searchFarmers.value||''));
    if (refs.searchDrivers) refs.searchDrivers.addEventListener('input', ()=>renderDrivers(refs.searchDrivers.value||''));
    if (refs.addFarmerBtn) refs.addFarmerBtn.addEventListener('click', async ()=>{
      const name = prompt('Farmer name:'); if (!name) return;
      const barangay = prompt('Barangay:')||''; const phone = prompt('Phone:')||'';
      const id = await addFarmerFirestore({ name, barangay, phone });
      if (!id){ const list = readJson(STORAGE_KEYS.farmers, []); list.push({ id: uid(), name, barangay, phone, since: new Date().toISOString() }); writeJson(STORAGE_KEYS.farmers, list); }
      await refresh();
    });
    if (refs.addDriverBtn) refs.addDriverBtn.addEventListener('click', async ()=>{
      const name = prompt('Driver name:'); if (!name) return; const plate = prompt('Plate No.:')||''; const phone = prompt('Phone:')||'';
      const id = await addDriverFirestore({ name, plate, phone });
      if (!id){ const list = readJson(STORAGE_KEYS.drivers, []); list.push({ id: uid(), name, plate, phone, since: new Date().toISOString() }); writeJson(STORAGE_KEYS.drivers, list); }
      await refresh();
    });
  }

  async function refresh(){
    await fetchAllFirestore();
    renderFarmers(refs.searchFarmers?.value||'');
    renderDrivers(refs.searchDrivers?.value||'');
    renderRequests();
  }

  async function init(){
    grabRefs();
    attachEvents();
    await refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
