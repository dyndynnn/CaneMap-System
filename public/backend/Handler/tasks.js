// Tasks module for Handler dashboard
import { db } from '../../backend/Common/firebase-config.js';
import { collection, doc, setDoc, getDocs, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const STORAGE_KEY = 'cm_tasks';
const colTasks = () => collection(db, 'tasks');

function readJson(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)||'null') ?? fallback; }catch(_){ return fallback; } }
function writeJson(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } }

export async function fetchTasks(){
  try{
    const q = query(colTasks(), orderBy('createdAt','desc'));
    const sn = await getDocs(q);
    const tasks = sn.docs.map(d=>({ id:d.id, ...d.data() }));
    writeJson(STORAGE_KEY, tasks);
    return tasks;
  }catch(_){
    return readJson(STORAGE_KEY, []);
  }
}

export async function addTask(payload){
  try{
    const id = payload.id || Math.random().toString(36).slice(2,9);
    await setDoc(doc(colTasks(), id), { ...payload, id, createdAt: serverTimestamp() });
    return id;
  }catch(_){
    const list = readJson(STORAGE_KEY, []);
    list.unshift({ id: Math.random().toString(36).slice(2,9), ...payload, createdAt: new Date().toISOString() });
    writeJson(STORAGE_KEY, list);
    return null;
  }
}
