// Review Applications module for SRA Officer
// Renders list of field applications from Firestore and allows status updates

import { db } from '../Common/firebase-config.js';
import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

function h(tag, className = '', children = []) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (!Array.isArray(children)) children = [children];
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else el.appendChild(child);
  }
  return el;
}

async function fetchApplications(status = 'all') {
  const baseRef = collection(db, 'field_applications');
  let q = query(baseRef, orderBy('createdAt', 'desc'));
  if (status !== 'all') {
    q = query(baseRef, where('status', '==', status), orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function formatDate(ts) {
  try {
    if (!ts) return '';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

function buildItem(app) {
  const statusBadge = h('span', `text-xs px-2 py-1 rounded ${app.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`, app.status === 'reviewed' ? 'Reviewed' : 'Pending Review');

  const left = h('div', 'flex items-start space-x-3', [
    h('div', 'w-9 h-9 bg-gradient-to-br from-[var(--cane-500)] to-[var(--cane-600)] rounded-full flex items-center justify-center text-white', [h('i', 'fas fa-user')]),
    h('div', '', [
      h('p', 'text-[var(--cane-900)] font-semibold leading-tight', app.applicantName || 'Unknown Applicant'),
      h('p', 'text-sm text-[var(--cane-700)]', `Field Registration - ${app.barangay || 'N/A'}`),
      h('p', 'text-xs text-[var(--cane-600)]', `${formatDate(app.createdAt)}  ·  ${app.barangay || ''}`)
    ])
  ]);

  const row = h('div', 'flex items-start justify-between px-4 py-3');
  row.appendChild(left);

  const actions = h('div', 'flex items-center space-x-2');
  const viewBtn = h('button', 'px-3 py-1 rounded bg-white border border-[var(--cane-200)] text-[var(--cane-800)] text-xs hover:bg-[var(--cane-50)]', 'View');
  const pendBtn = h('button', 'px-3 py-1 rounded bg-gray-100 text-gray-700 text-xs hover:bg-gray-200', 'Pending');
  const revBtn = h('button', 'px-3 py-1 rounded bg-green-100 text-green-700 text-xs hover:bg-green-200', 'Reviewed');
  actions.append(statusBadge, viewBtn, pendBtn, revBtn);
  row.appendChild(actions);

  viewBtn.addEventListener('click', () => openModal(app));
  pendBtn.addEventListener('click', () => updateStatus(app.id, 'pending'));
  revBtn.addEventListener('click', () => updateStatus(app.id, 'reviewed'));

  return row;
}

async function updateStatus(id, status) {
  try {
    await updateDoc(doc(db, 'field_applications', id), { status, statusUpdatedAt: serverTimestamp() });
    await render();
  } catch (e) {
    alert('Failed to update status.');
    // eslint-disable-next-line no-console
    console.error(e);
  }
}

function openModal(app) {
  let modal = document.getElementById('sraReviewModal');
  if (!modal) {
    modal = document.body.appendChild(h('div', 'fixed inset-0 bg-black/40 hidden items-center justify-center z-50', []));
    modal.id = 'sraReviewModal';
  }
  modal.innerHTML = '';
  const card = h('div', 'bg-white rounded-xl w-[92%] max-w-2xl p-6 shadow-2xl relative space-y-4');
  const close = h('button', 'absolute top-3 right-4 text-xl', '×');
  close.addEventListener('click', () => { modal.classList.add('hidden'); });
  card.appendChild(close);
  card.appendChild(h('h3', 'text-xl font-semibold', 'Field Application'));
  const grid = h('div', 'grid grid-cols-1 md:grid-cols-2 gap-3');
  const info = [
    ['Applicant', app.applicantName || '—'],
    ['Barangay', app.barangay || '—'],
    ['Terrain', app.terrain || '—'],
    ['Size (ha)', String(app.size || '—')],
    ['Latitude', String(app.lat || '—')],
    ['Longitude', String(app.lng || '—')],
    ['Status', app.status || 'pending'],
    ['Submitted', formatDate(app.createdAt)]
  ];
  for (const [k, v] of info) {
    grid.appendChild(h('div', 'text-sm', [h('div', 'text-gray-500', k), h('div', 'font-medium', v)]));
  }
  card.appendChild(grid);
  const actions = h('div', 'pt-2 flex justify-end space-x-2');
  const toPending = h('button', 'px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm', 'Mark Pending');
  const toReviewed = h('button', 'px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm', 'Mark Reviewed');
  toPending.addEventListener('click', async () => { await updateStatus(app.id, 'pending'); modal.classList.add('hidden'); });
  toReviewed.addEventListener('click', async () => { await updateStatus(app.id, 'reviewed'); modal.classList.add('hidden'); });
  actions.append(toPending, toReviewed);
  card.appendChild(actions);
  modal.appendChild(card);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

async function render(status = 'all') {
  const container = document.getElementById('fieldDocsDynamic');
  if (!container) return;
  container.innerHTML = '';
  const list = h('div', 'divide-y divide-[var(--cane-200)]');
  const apps = await fetchApplications(status);
  if (apps.length === 0) {
    container.appendChild(h('div', 'px-4 py-6 text-[var(--cane-700)] text-sm', 'No applications yet.'));
    return;
  }
  for (const app of apps) list.appendChild(buildItem(app));
  container.appendChild(list);
}

export const SRAReview = {
  async init() {
    const statusSelect = document.getElementById('fieldDocsStatus');
    if (statusSelect) {
      statusSelect.addEventListener('change', () => render(statusSelect.value));
    }
    await render('all');
  }
};

// expose for non-module invocation if needed
// eslint-disable-next-line no-undef
window.SRAReview = SRAReview;


