// Piezas de interfaz compartidas.
import { DEMO, entrar, demoReiniciar, demoSembrado, demoSembrar } from './datos.js';
import { esc, ROLES, ROL_CORTO, DIAS, DIAS_LABORABLES, nombreCompleto, iniciales, waLink, horasSemanales, agenda, sinCorreo, tokenAleatorio, FRANJAS, DIAS_CORTOS, fechaCorta } from './logica.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function toast(msg, mal = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (mal ? ' mal' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), mal ? 5000 : 2800);
}

export function modal(html, { ancho = false, alCerrar } = {}) {
  const w = document.createElement('div');
  w.className = 'modal-fondo';
  w.innerHTML = `<div class="modal${ancho ? ' ancho' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const cerrar = () => { w.remove(); document.removeEventListener('keydown', tecla); alCerrar?.(); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); };
  w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-cerrar]')) cerrar(); });
  document.addEventListener('keydown', tecla);
  document.body.appendChild(w);
  w.querySelector('input:not([type=checkbox]):not([readonly]),select,textarea')?.focus();
  return { el: w.firstElementChild, cerrar };
}
export const cabModal = t => `<div class="modal-cab"><h3>${t}</h3><button class="x" data-cerrar aria-label="Cerrar">×</button></div>`;

export function confirmar(texto, { si = 'Confirmar', peligro = false } = {}) {
  return new Promise(res => {
    let ok = false;
    const m = modal(`${cabModal('Confirmar')}<p>${texto}</p>
      <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn ${peligro ? '' : 'ok'}" data-si>${si}</button></div>`,
    { alCerrar: () => res(ok) });
    m.el.querySelector('[data-si]').onclick = () => { ok = true; m.cerrar(); };
  });
}

export async function copiar(texto, el) {
  try { await navigator.clipboard.writeText(texto); toast('Copiado'); }
  catch { if (el) { el.select?.(); } toast('Seleccioná y copiá a mano', true); }
}

const G_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

export function pantallaLogin(cont, { titulo, texto, extra = '' }) {
  cont.innerHTML = `<div class="login"><div class="caja">
    <img src="img/logo-40.png" alt="Coghlan Club · 40 aniversario" width="120" height="120" style="border-radius:50%;justify-self:start">
    <div class="marca">coghlan<b>club</b><small>Equipo</small></div>
    <div style="display:grid;gap:8px"><h1>${titulo}</h1><p class="sub">${texto}</p></div>
    ${navegadorInterno() ? `<div class="aviso"><div><b>Abrí este link en Chrome o Safari</b>
      <span>Estás en el navegador de WhatsApp, Instagram o Facebook, y Google no deja iniciar sesión desde acá. Tocá el menú <b>⋮</b> o <b>···</b> y elegí <b>"Abrir en Chrome"</b> o <b>"Abrir en Safari"</b>. O copiá el link y pegalo en el navegador.</span>
      <button class="btn sm ghost" id="copiar-link" style="justify-self:start">Copiar link</button></div></div>` : ''}
    <button class="btn grande btn-google" id="btn-entrar">${G_SVG} Entrar con Google</button>
    ${extra}
    ${DEMO ? '<p class="sub">Modo demo: vas a poder elegir con qué persona de ejemplo entrar.</p>' : ''}
  </div></div>`;
  $('#copiar-link', cont)?.addEventListener('click', () => copiar(location.href));
  $('#btn-entrar', cont).onclick = async () => {
    try { await entrar(); } catch (e) { console.error(e); toast(errorLogin(e), true); }
  };
}

// Navegadores de apps (WhatsApp, Instagram, Facebook…): Google no permite iniciar sesión dentro de ellos
const navegadorInterno = () => /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|TikTok|musical_ly|Snapchat|; wv\)/i.test(navigator.userAgent);

// Explica en palabras simples por qué falló el inicio de sesión
function errorLogin(e) {
  return ({
    'auth/operation-not-allowed': 'El inicio de sesión con Google no está activado en Firebase (Authentication → Método de acceso → Google).',
    'auth/unauthorized-domain': `Este sitio (${location.hostname}) no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados).`,
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar. Probá de nuevo.',
    'auth/network-request-failed': 'Sin conexión a internet. Revisá el wifi y probá de nuevo.',
    'auth/web-storage-unsupported': 'El navegador tiene bloqueadas las cookies. Abrí el link en Chrome o Safari normal (no en modo incógnito).',
    'auth/operation-not-supported-in-this-environment': 'Este navegador no deja iniciar sesión. Abrí el link en Chrome o Safari.',
  })[e?.code] || 'No se pudo iniciar sesión. Probá de nuevo.';
}

// Prepara datos de ejemplo y la cinta de "modo demo"
export async function prepararDemo() {
  if (!DEMO) return;
  if (!demoSembrado()) { const { datosDemo } = await import('./demo-datos.js'); demoSembrar(datosDemo()); }
  const c = document.createElement('div');
  c.className = 'demo-cinta';
  c.innerHTML = 'MODO DEMO · datos de ejemplo guardados solo en este navegador · <button id="demo-reset">Reiniciar demo</button>';
  document.body.prepend(c);
  c.querySelector('#demo-reset').onclick = () => { demoReiniciar(); location.reload(); };
}

// App instalable (pantalla de inicio)
export function registrarApp() {
  if (DEMO) return;
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch { /* sin service worker */ }
}
// Identificador de este celular (queda guardado en el navegador o en la app instalada)
export function idDispositivo() {
  const K = 'coghlan-dispositivo';
  try { let v = localStorage.getItem(K); if (!v) { v = tokenAleatorio(); localStorage.setItem(K, v); } return v; }
  catch { return (window.__disp = window.__disp || tokenAleatorio()); }
}

// ---------- Ficha ----------
export function chipsRoles(p) { return (p.roles || []).map(r => `<span class="rol rol-${r}">${ROL_CORTO[r]}</span>`).join(' '); }

export function htmlAgenda(slots) {
  const filas = DIAS_LABORABLES.map(d => {
    const ss = slots.filter(s => s.dia === d);
    if (!ss.length) return '';
    return `<div class="fila-dia"><b>${DIAS[d]}</b><div class="slots">${ss.map(s =>
      `<span class="slot-mini rol-${s.rol}"><span class="mono">${s.desde}–${s.hasta}</span> ${esc(s.actividad || ROL_CORTO[s.rol])}${s.sede ? ' · ' + esc(s.sede) : ''}</span>`).join('')}</div></div>`;
  }).join('');
  return filas ? `<div class="semana">${filas}</div>` : '<p class="vacio">Sin horarios cargados.</p>';
}

export function htmlContacto(p, { mensaje = '' } = {}) {
  return `<div class="contacto">
    <div class="linea"><span>Teléfono</span><span class="valor mono">${esc(p.telefono || '—')}</span>
      ${p.telefono ? `<a class="btn sm ghost" href="tel:${esc(p.telefono.replace(/\s/g, ''))}">Llamar</a>
      <a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(p.telefono, mensaje || `Hola ${p.nombre}`)}">WhatsApp</a>` : ''}</div>
    ${sinCorreo(p) ? '<div class="linea"><span>Correo</span><span class="valor sub">Sin correo · ficha con PIN en recepción</span></div>' : `<div class="linea"><span>Correo</span><span class="valor">${esc(p.email)}</span>
      <a class="btn sm ghost" href="mailto:${esc(p.email)}">Escribir</a></div>`}
  </div>`;
}

export function htmlFicha(p, clases, { extra = '' } = {}) {
  const hs = horasSemanales(p, clases);
  return `<div class="persona"><div class="avatar xl">${esc(iniciales(p))}</div>
      <div><h2>${esc(nombreCompleto(p))}</h2><div>${chipsRoles(p)} ${p.estado === 'pendiente' ? '<span class="pill pendiente">Ficha por aprobar</span>' : p.estado === 'inactivo' ? '<span class="pill neutro">Inactivo</span>' : ''}</div></div></div>
    ${htmlContacto(p)}
    ${p.direccion || p.dni || p.emergenciaTel ? `<div class="contacto">
      ${p.direccion ? `<div class="linea"><span>Dirección</span><span class="valor">${esc(p.direccion)}</span></div>` : ''}
      ${p.dni ? `<div class="linea"><span>DNI</span><span class="valor mono">${esc(p.dni)}</span></div>` : ''}
      ${p.emergenciaTel ? `<div class="linea"><span>Emergencia</span><span class="valor">${esc(p.emergenciaNombre || '')} <span class="mono">${esc(p.emergenciaTel)}</span></span><a class="btn sm ghost" href="tel:${esc(p.emergenciaTel.replace(/\s/g, ''))}">Llamar</a></div>` : ''}
      <div class="linea"><span>Datos</span><span class="valor">${p.consentimiento?.aceptado ? `<span class="pill aprobada">Consentimiento firmado ${p.consentimiento.papel ? 'en papel' : 'en la app'}</span>` : '<span class="pill sin">Falta firmar el consentimiento</span>'}</span></div>
    </div>` : ''}
    ${(p.disponible || []).length ? `<div style="display:grid;gap:6px"><h4>Puede cubrir reemplazos</h4><div class="checks">${p.disponible.slice().sort().map(k => { const [d, f] = k.split('-'); return `<span class="pill info">${DIAS_CORTOS[+d]} ${FRANJAS[f].toLowerCase()}</span>`; }).join('')}</div></div>` : ''}
    ${(p.actividades || []).length ? `<div style="display:grid;gap:6px"><h4>Actividades que da</h4><div class="checks">${p.actividades.map(a => `<span class="pill neutro">${esc(a)}</span>`).join('')}</div></div>` : ''}
    <div style="display:grid;gap:6px"><div class="cab"><h4>Horario semanal</h4><span class="sub mono">${hs.toFixed(1).replace('.', ',')} h/semana</span></div>${htmlAgenda(agenda(p, clases))}</div>
    ${extra}`;
}
export { ROLES };
