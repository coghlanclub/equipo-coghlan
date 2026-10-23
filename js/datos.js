// Capa de datos: Firebase (Firestore + login con Google) o modo demo en el navegador.
import { FIREBASE_CONFIG, ADMIN_EMAILS } from './config.js';

export const DEMO = !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.startsWith('PEGAR');
export const AHORA = { __ahora: true }; // hora del servidor
export const DEMO_ADMIN = 'gerencia@coghlanclub.demo';
const V = '10.12.2';

// ============================================================ FIREBASE
let fb = null;
async function F() {
  if (fb) return fb;
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [app, auth, fs] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js'),
  ]);
  const a = app.initializeApp(FIREBASE_CONFIG);
  fb = { auth, fs, au: auth.getAuth(a), db: fs.getFirestore(a) };
  return fb;
}
function preparar(data, fs) {
  const o = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    o[k] = v === AHORA ? fs.serverTimestamp() : v;
  }
  return o;
}
const docAObj = d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) });

// ============================================================ DEMO
const KEY = 'coghlan-personal-demo-v5';
const KEY_USER = 'coghlan-personal-demo-usuario';
let mem = null; const subs = new Set(); const userSubs = new Set();
function leer() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY)) || null; } catch { mem = null; }
  return mem;
}
function grabar() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* sin almacenamiento: queda en memoria */ } avisar(); }
function avisar() { for (const s of subs) s.run(); }
try {
  addEventListener('storage', e => {
    if (e.key === KEY) { mem = null; leer(); avisar(); }
    if (e.key === KEY_USER) for (const cb of userSubs) cb(usuarioDemo());
  });
} catch { /* nada */ }
export function demoSembrado() { return !!leer(); }
export function demoSembrar(datos) { mem = datos; grabar(); }
export function demoReiniciar() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY_USER); } catch { /* nada */ } mem = null; }
function col(c) { const d = leer() || (mem = {}); return d[c] = d[c] || {}; }
function cumple(doc, [campo, op, val]) {
  const x = doc[campo];
  switch (op) {
    case '==': return x === val;
    case '!=': return x !== val;
    case '>=': return x >= val;
    case '<=': return x <= val;
    case '>': return x > val;
    case '<': return x < val;
    case 'in': return val.includes(x);
    case 'array-contains': return Array.isArray(x) && x.includes(val);
    default: return true;
  }
}
function filtrar(c, filtros) { return Object.entries(col(c)).map(([id, d]) => ({ id, ...d })).filter(d => filtros.every(f => cumple(d, f))); }
function demoDato(data) {
  const o = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    o[k] = v === AHORA ? Date.now() : v instanceof Date ? v.getTime() : v;
  }
  return o;
}
function usuarioDemo() {
  try { const e = localStorage.getItem(KEY_USER); return e ? { email: e, displayName: e } : null; } catch { return window.__demoUser || null; }
}
function fijarUsuarioDemo(email) {
  try { email ? localStorage.setItem(KEY_USER, email) : localStorage.removeItem(KEY_USER); } catch { window.__demoUser = email ? { email, displayName: email } : null; }
  for (const cb of userSubs) cb(usuarioDemo());
}

// Selector de usuario en demo (reemplaza al login de Google)
function elegirUsuarioDemo() {
  return new Promise(res => {
    const personas = Object.entries(col('personal')).map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const w = document.createElement('div');
    w.className = 'modal-fondo';
    w.innerHTML = `<div class="modal" role="dialog" aria-label="Elegir usuario de prueba">
      <div class="modal-cab"><h3>Modo demo: ¿quién entra?</h3><button class="x" data-x aria-label="Cerrar">×</button></div>
      <p class="sub">En la versión real cada uno entra con su cuenta de Google.</p>
      <div class="lista-demo">
        ${globalThis.__app !== 'profe' ? `<button class="btn" data-e="${DEMO_ADMIN}"><b>Gerencia</b><span>${DEMO_ADMIN}</span></button>` : ''}
        ${globalThis.__app !== 'profe' ? Object.keys(col('recepcion')).map(e => `<button class="btn ghost" data-e="${e}"><b>Recepción</b><span>${e}</span></button>`).join('') : ''}
        ${globalThis.__app === 'gerencia' ? '' : personas.map(p => `<button class="btn ghost" data-e="${p.email}"><b>${p.nombre || ''} ${p.apellido || ''}</b><span>${p.email}</span></button>`).join('')}
        ${globalThis.__app === 'gerencia' ? '' : `<button class="btn ghost" data-e="nuevo.profe@demo.com"><b>Profe nuevo (sin ficha)</b><span>nuevo.profe@demo.com</span></button>`}
      </div></div>`;
    w.addEventListener('click', e => {
      const b = e.target.closest('[data-e]');
      if (b) { w.remove(); fijarUsuarioDemo(b.dataset.e); res(usuarioDemo()); }
      else if (e.target === w || e.target.closest('[data-x]')) { w.remove(); res(null); }
    });
    document.body.appendChild(w);
  });
}

// ============================================================ API
export function alCambiarUsuario(cb) {
  if (DEMO) { userSubs.add(cb); queueMicrotask(() => cb(usuarioDemo())); return () => userSubs.delete(cb); }
  let un = () => {};
  F().then(({ auth, au }) => {
    auth.getRedirectResult(au).catch(() => {});
    un = auth.onAuthStateChanged(au, u => cb(u ? { email: (u.email || '').toLowerCase(), displayName: u.displayName, foto: u.photoURL } : null));
  });
  return () => un();
}

export async function entrar() {
  if (DEMO) return elegirUsuarioDemo();
  const { auth, au } = await F();
  const prov = new auth.GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  try { return (await auth.signInWithPopup(au, prov)).user; }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
      return auth.signInWithRedirect(au, prov);
    }
    throw e;
  }
}
export async function salir() {
  if (DEMO) return fijarUsuarioDemo(null);
  const { auth, au } = await F(); return auth.signOut(au);
}

export async function esAdmin(email) {
  if (!email) return false;
  if (DEMO) return email === DEMO_ADMIN || !!col('admins')[email];
  if (ADMIN_EMAILS.map(x => x.toLowerCase()).includes(email)) return true;
  try { return !!(await obtener('admins', email)); } catch { return false; }
}

// Cuenta de recepción: solo puede mostrar el QR y fichar con PIN (no ve el panel de gerencia).
export async function esRecepcion(email) {
  if (!email) return false;
  if (DEMO) return !!col('recepcion')[email];
  try { return !!(await obtener('recepcion', email)); } catch { return false; }
}

export async function obtener(c, id) {
  if (DEMO) { const d = col(c)[id]; return d ? { id, ...structuredClone(d) } : null; }
  const { fs, db } = await F();
  const s = await fs.getDoc(fs.doc(db, c, id));
  return s.exists() ? docAObj(s) : null;
}

export async function listar(c, filtros = []) {
  if (DEMO) return structuredClone(filtrar(c, filtros));
  const { fs, db } = await F();
  const q = fs.query(fs.collection(db, c), ...filtros.map(f => fs.where(...f)));
  return (await fs.getDocs(q)).docs.map(docAObj);
}

export function escuchar(c, filtros, cb, alError) {
  if (DEMO) {
    const s = { run: () => cb(structuredClone(filtrar(c, filtros))) };
    subs.add(s); queueMicrotask(s.run);
    return () => subs.delete(s);
  }
  let un = () => {}, cancel = false;
  F().then(({ fs, db }) => {
    if (cancel) return;
    const q = fs.query(fs.collection(db, c), ...filtros.map(f => fs.where(...f)));
    un = fs.onSnapshot(q, snap => cb(snap.docs.map(docAObj)), e => { console.error(c, e); alError?.(e); });
  });
  return () => { cancel = true; un(); };
}

export function escucharDoc(c, id, cb) {
  if (DEMO) {
    const s = { run: () => { const d = col(c)[id]; cb(d ? { id, ...structuredClone(d) } : null); } };
    subs.add(s); queueMicrotask(s.run);
    return () => subs.delete(s);
  }
  let un = () => {}, cancel = false;
  F().then(({ fs, db }) => {
    if (cancel) return;
    un = fs.onSnapshot(fs.doc(db, c, id), s => cb(s.exists() ? docAObj(s) : null), e => console.error(c, id, e));
  });
  return () => { cancel = true; un(); };
}

export async function guardar(c, id, data, { merge = false } = {}) {
  if (DEMO) { const k = col(c); k[id] = merge ? { ...(k[id] || {}), ...demoDato(data) } : demoDato(data); grabar(); return id; }
  const { fs, db } = await F();
  await fs.setDoc(fs.doc(db, c, id), preparar(data, fs), { merge });
  return id;
}

export async function agregar(c, data) {
  if (DEMO) { const id = Math.random().toString(36).slice(2, 12); col(c)[id] = demoDato(data); grabar(); return id; }
  const { fs, db } = await F();
  return (await fs.addDoc(fs.collection(db, c), preparar(data, fs))).id;
}

export async function actualizar(c, id, data) {
  if (DEMO) { const k = col(c); if (!k[id]) throw new Error('No existe'); k[id] = { ...k[id], ...demoDato(data) }; grabar(); return; }
  const { fs, db } = await F();
  await fs.updateDoc(fs.doc(db, c, id), preparar(data, fs));
}

export async function borrar(c, id) {
  if (DEMO) { delete col(c)[id]; grabar(); return; }
  const { fs, db } = await F();
  await fs.deleteDoc(fs.doc(db, c, id));
}

// Escritura de muchos documentos juntos (máx. 450 por tanda en Firebase)
export async function lote(ops) {
  if (DEMO) {
    for (const o of ops) {
      const k = col(o.c);
      if (o.borrar) delete k[o.id];
      else k[o.id] = o.merge ? { ...(k[o.id] || {}), ...demoDato(o.data) } : demoDato(o.data);
    }
    grabar(); return;
  }
  const { fs, db } = await F();
  for (let i = 0; i < ops.length; i += 450) {
    const b = fs.writeBatch(db);
    for (const o of ops.slice(i, i + 450)) {
      const ref = fs.doc(db, o.c, o.id);
      if (o.borrar) b.delete(ref); else b.set(ref, preparar(o.data, fs), { merge: !!o.merge });
    }
    await b.commit();
  }
}

// Validación del QR en demo (en Firebase la hacen las reglas de seguridad)
export function demoQrValido(token) {
  const q = col('qr').actual;
  return !!q && (q.token === token || q.prev === token) && Date.now() < q.exp;
}

// En demo: código vigente (si no hay tablet abierta, se genera uno)
export function demoTokenActual() {
  const k = col('qr'); const q = k.actual;
  if (q && Date.now() < q.exp) return q.token;
  const t = Math.random().toString(36).slice(2, 14);
  k.actual = { token: t, prev: t, exp: Date.now() + 70000 }; grabar();
  return t;
}
