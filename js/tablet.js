globalThis.__app = 'qr';
// Tablet de recepción: muestra el QR dinámico y los fichajes del día.
import { DEMO, alCambiarUsuario, esAdmin, esRecepcion, salir, guardar, escuchar, listar } from './datos.js';
import { registrarFichaje } from './fichaje.js';
import { modal, cabModal } from './ui.js';
import { QR_SEGUNDOS } from './config.js';
import { esc, hoy, fechaLarga, horaDe, ms, tokenAleatorio, pad, nombreCompleto } from './logica.js';
import { $, pantallaLogin, prepararDemo, toast } from './ui.js';
import { botonGuia, registrarGuia } from './guia.js';

const app = $('#app');
await prepararDemo();

function cargarQR() {
  return new Promise((res, rej) => {
    if (window.QRCode) return res(window.QRCode);
    const s = document.createElement('script');
    s.src = 'js/vendor/qrcode.min.js';
    s.onload = () => res(window.QRCode); s.onerror = rej;
    document.head.appendChild(s);
  });
}

let timers = [], unsub = () => {}, wake = null;
// Se abre con la cuenta de recepción (solo QR) o con una de gerencia.
alCambiarUsuario(async u => {
  timers.forEach(clearInterval); timers = []; unsub();
  if (!u) return pantallaLogin(app, { titulo: 'QR de recepción', texto: 'Entrá con la cuenta de recepción. La pantalla queda mostrando el QR de fichaje que cambia solo.' });
  if (!(await esRecepcion(u.email)) && !(await esAdmin(u.email))) {
    app.innerHTML = `<div class="login"><div class="caja"><h1>Sin permiso</h1><p class="sub">${esc(u.email)} no es la cuenta de recepción ni de gerencia. Gerencia la habilita en Ajustes → Cuenta de recepción.</p><button class="btn" id="out">Salir</button></div></div>`;
    $('#out').onclick = () => salir(); return;
  }
  iniciar();
});

// ---------- Fichaje sin celular: nombre + PIN ----------
let fallos = 0, bloqueoHasta = 0;
async function fichaConPin() {
  if (Date.now() < bloqueoHasta) return toast('Demasiados intentos. Esperá un minuto.', true);
  // La cuenta de recepción solo puede leer las fichas de quienes fichan sin celular
  const ps = (await listar('personal', [['sinCelular', '==', true]])).filter(p => p.estado === 'activo' && p.pin)
    .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
  if (!ps.length) return toast('No hay personal cargado para fichar con PIN. Se activa desde Gerencia → ficha → "Ficha sin celular".', true);
  const m = modal(`${cabModal('¿Quién sos?')}<div class="lista-demo">${ps.map(p => `<button class="btn ghost grande" data-p="${esc(p.email)}"><b>${esc(nombreCompleto(p))}</b></button>`).join('')}</div>`);
  m.el.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    m.cerrar(); pedirPin(ps.find(p => p.email === b.dataset.p));
  });
}
function pedirPin(p) {
  let pin = '';
  const m = modal(`${cabModal(esc(nombreCompleto(p)))}
    <p class="sub" style="text-align:center">Poné tu PIN de 4 números</p>
    <div id="puntos" style="display:flex;gap:14px;justify-content:center;font:800 2rem var(--f-mono)"></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:320px;margin:0 auto;width:100%">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button class="btn ghost" data-k="${k}" style="min-height:64px;font-size:1.6rem">${k}</button>`).join('')}
    </div>`);
  const pintarPuntos = () => { m.el.querySelector('#puntos').textContent = '●'.repeat(pin.length) + '○'.repeat(4 - pin.length); };
  pintarPuntos();
  m.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
    pintarPuntos();
    if (pin.length < 4) return;
    if (pin !== String(p.pin)) {
      fallos++; pin = ''; pintarPuntos();
      if (fallos >= 5) { bloqueoHasta = Date.now() + 60000; fallos = 0; m.cerrar(); return toast('PIN incorrecto 5 veces. Esperá un minuto.', true); }
      return toast('PIN incorrecto', true);
    }
    fallos = 0; m.cerrar();
    try {
      const r = await registrarFichaje(p, actualToken(), { metodo: 'pin' });
      const ok = modal(`<div style="display:grid;gap:10px;text-align:center;padding:10px 0">
        <div style="font:800 3.6rem var(--f-mono);color:${r.tipo === 'entrada' ? 'var(--ok)' : 'var(--info)'}">${r.hora}</div>
        <h2>${r.repetido ? `Tu ${r.tipo} ya estaba registrada` : r.tipo === 'entrada' ? `¡Hola ${esc(p.nombre)}! Entrada registrada` : `¡Chau ${esc(p.nombre)}! Salida registrada`}</h2>
        <button class="btn grande" data-cerrar>Listo</button></div>`);
      setTimeout(() => ok.cerrar(), 5000);
    } catch (e) { console.error(e); toast('No se pudo registrar. Probá de nuevo.', true); }
  });
}
let actualToken = () => '';

async function iniciar() {
  app.innerHTML = `<div style="min-height:100dvh;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:24px;padding:24px 16px;align-items:center;max-width:1180px;margin:0 auto">
    <section style="display:grid;gap:16px;justify-items:center;text-align:center">
      <div class="marca" style="font-size:1.6rem">coghlan<b>club</b></div>
      <h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">Escaneá para fichar</h1>
      <div id="qr" style="background:#fff;padding:18px;border-radius:18px;width:min(78vw,56vh,560px);aspect-ratio:1;display:grid;place-items:center"></div>
      <div style="width:min(78vw,56vh,560px);height:6px;background:var(--surface-2);border-radius:9px;overflow:hidden"><div id="barra-t" style="height:100%;background:var(--accent);width:100%"></div></div>
      <p class="sub">Abrí la app <b>Mi ficha</b> → <b>Fichar</b>, o usá la cámara del celular. El código cambia cada ${QR_SEGUNDOS} segundos.</p>
      <button class="btn grande" id="sin-cel" style="width:min(78vw,56vh,560px)">Fichar sin celular (con PIN)</button>
      ${DEMO ? '<button class="btn ghost" id="demo-sim">Demo: simular que un profe escanea</button><a id="demo-link" hidden></a>' : ''}
    </section>
    <section class="panel" style="align-self:stretch;align-content:start">
      <div class="cab"><div><span class="eyebrow" id="fecha"></span><div id="reloj" style="font:700 3rem var(--f-mono)"></div></div>
        <div class="acciones">${botonGuia()}<button class="btn sm ghost" id="pantalla">Pantalla completa</button><button class="btn sm ghost" id="out">Salir</button></div></div>
      <h3>Fichajes de hoy</h3>
      <div class="lista" id="ultimos"><p class="vacio">Todavía nadie fichó hoy.</p></div>
    </section>
  </div>`;
  $('#out').onclick = () => salir();
  $('#pantalla').onclick = () => document.documentElement.requestFullscreen?.().catch(() => {});
  try { wake = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') { try { wake = await navigator.wakeLock?.request('screen'); } catch { /* nada */ } rotar(); } });

  $('#sin-cel').onclick = fichaConPin;
  $('#demo-sim')?.addEventListener('click', async () => {
    const ps = (await listar('personal')).filter(p => p.estado === 'activo').sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
    const m = modal(`${cabModal('¿Quién escanea?')}<div class="lista-demo">${ps.map(p => `<button class="btn ghost" data-p="${esc(p.email)}"><b>${esc(nombreCompleto(p))}</b></button>`).join('')}</div>`);
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      m.cerrar();
      try { const r = await registrarFichaje(ps.find(p => p.email === b.dataset.p), actual); toast(`${b.textContent.trim()}: ${r.repetido ? 'ya había fichado' : r.tipo + ' ' + r.hora}`); }
      catch { toast('El código venció, probá de nuevo', true); }
    });
  });
  let QR;
  try { QR = await cargarQR(); } catch { toast('No se pudo cargar el generador de QR. Revisá la conexión.', true); return; }
  const qr = new QR($('#qr'), { width: 560, height: 560, correctLevel: QR.CorrectLevel.M, colorDark: '#111111', colorLight: '#ffffff' });
  $('#qr').querySelector('img')?.style.setProperty('width', '100%');
  $('#qr').querySelector('canvas')?.style.setProperty('width', '100%');

  const base = location.href.replace(/[^/]*([?#].*)?$/, '');
  let actual = null, desde = Date.now();
  actualToken = () => actual;
  async function rotar() {
    if (document.visibilityState !== 'visible') return;
    const nuevo = tokenAleatorio();
    try {
      await guardar('qr', 'actual', { token: nuevo, prev: actual || nuevo, exp: new Date(Date.now() + (QR_SEGUNDOS * 2 + 10) * 1000) });
      actual = nuevo; desde = Date.now();
      const url = `${base}fichar.html?t=${nuevo}`;
      qr.makeCode(url);
      $('#qr').querySelector('img')?.style.setProperty('width', '100%');
      const dl = $('#demo-link'); if (dl) dl.href = url;
    } catch (e) { console.error(e); toast('No se pudo actualizar el QR. Revisá la conexión.', true); }
  }
  rotar();
  timers.push(setInterval(rotar, QR_SEGUNDOS * 1000));
  timers.push(setInterval(() => {
    const d = new Date();
    $('#reloj').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    $('#fecha').textContent = fechaLarga(hoy());
    const resto = Math.max(0, 1 - (Date.now() - desde) / (QR_SEGUNDOS * 1000));
    $('#barra-t').style.width = (resto * 100).toFixed(1) + '%';
  }, 250));

  let fechaEscucha = '';
  const escucharHoy = () => {
    if (fechaEscucha === hoy()) return;
    fechaEscucha = hoy(); unsub();
    unsub = escuchar('fichajes', [['fecha', '==', fechaEscucha]], fs => {
      const l = fs.sort((a, b) => ms(b.ts) - ms(a.ts)).slice(0, 14);
      $('#ultimos').innerHTML = l.length ? l.map(f => `<div class="item"><div><b>${esc(f.nombre)}</b></div>
        <div class="acciones"><span class="pill ${f.tipo === 'entrada' ? 'activo' : 'info'}">${f.tipo}</span><span class="mono">${horaDe(f.ts)}</span></div></div>`).join('')
        : '<p class="vacio">Todavía nadie fichó hoy.</p>';
    });
  };
  escucharHoy();
  timers.push(setInterval(escucharHoy, 60000));
}

// ---------- Guía de uso ----------
registrarGuia({
  clave: 'qr', listo: '#qr',
  pasos: () => [
    { titulo: 'La pantalla de fichaje', texto: `<p>Esta pantalla va en la <b>PC de recepción</b>. El personal la usa para marcar su entrada y su salida.</p>`,
      tip: 'Entrá con la cuenta de recepción, no con la de gerencia: así nadie en recepción puede ver el panel de gerencia.' },
    { sel: '#qr', titulo: 'El QR', texto: `<p>Cada persona abre su app <b>Mi ficha</b>, toca <b>Fichar</b> y apunta la cámara a este código.</p>
      <p>Cambia cada ${QR_SEGUNDOS} segundos: una foto vieja no sirve para fichar desde casa.</p>` },
    { sel: '#barra-t', titulo: 'Tiempo que le queda', texto: '<p>La barra se achica hasta que el código cambia. Si alguien escaneó justo cuando cambiaba, que escanee de nuevo.</p>' },
    { sel: '#sin-cel', titulo: 'Fichar sin celular', texto: `<p>Para quien no tiene celular: toca su nombre y pone su <b>PIN de 4 números</b>.</p>
      <p>El PIN se activa desde <b>Gerencia → Personal → la ficha de la persona → "Ficha sin celular"</b>.</p>`,
      tip: 'Si alguien se equivoca de PIN muchas veces, el botón se bloquea un minuto.' },
    { sel: '#ultimos', titulo: 'Quién fichó hoy', texto: '<p>Cada entrada y salida aparece acá al instante, con su hora. Así ves que el fichaje funcionó.</p>' },
    { sel: '#pantalla', titulo: 'Pantalla completa', texto: '<p>Oculta las barras del navegador para que el QR se vea grande. Para salir, apretá <b>Esc</b>.</p>' },
    { sel: '[data-guia]', titulo: 'Listo', texto: '<p>Tocá <b>"? Guía"</b> cuando quieras para ver esta explicación de nuevo.</p>' },
  ],
});
