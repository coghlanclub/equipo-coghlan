// Registro de entrada/salida a partir del QR dinámico + lector de QR con la cámara.
import { DEMO, AHORA, listar, agregar, demoQrValido, demoTokenActual } from './datos.js';
import { hoy, mesDe, ms, horaDe, nombreCompleto } from './logica.js';
import { modal, cabModal, toast, idDispositivo } from './ui.js';

export function tokenDeTexto(txt) {
  try { const u = new URL(txt, location.href); return u.searchParams.get('t'); }
  catch { return /^[a-z0-9]{8,}$/i.test(txt) ? txt : null; }
}

export async function fichajesDeHoy(email) {
  const fs = await listar('fichajes', [['email', '==', email], ['fecha', '==', hoy()]]);
  return fs.sort((a, b) => ms(a.ts) - ms(b.ts));
}

// Devuelve { tipo, hora, repetido }
export async function registrarFichaje(persona, token, { metodo = 'qr' } = {}) {
  if (!token) throw Object.assign(new Error('Sin QR'), { code: 'qr' });
  const previos = await fichajesDeHoy(persona.email);
  const ultimo = previos.at(-1);
  if (ultimo && Date.now() - ms(ultimo.ts) < 90 * 1000) return { tipo: ultimo.tipo, hora: horaDe(ultimo.ts), repetido: true };
  const tipo = ultimo?.tipo === 'entrada' ? 'salida' : 'entrada';
  if (DEMO && !demoQrValido(token)) throw Object.assign(new Error('QR vencido'), { code: 'qr' });
  try {
    await agregar('fichajes', {
      email: persona.email, nombre: nombreCompleto(persona), fecha: hoy(), mes: mesDe(new Date()),
      tipo, ts: AHORA, token, metodo, dispositivoId: metodo === 'pin' ? 'tablet' : idDispositivo(), dispositivo: navigator.userAgent.slice(0, 140),
    });
  } catch (e) {
    if (e.code === 'permission-denied') throw Object.assign(new Error('QR vencido'), { code: 'qr' });
    throw e;
  }
  return { tipo, hora: horaDe(Date.now()), repetido: false };
}

export function mensajeError(e) {
  if (e.code === 'qr') return 'El QR venció, no es el de recepción o este celular no está habilitado. Escaneá de nuevo el de recepción.';
  return 'No se pudo registrar. Revisá tu conexión y probá de nuevo.';
}

// ---------- Lector de QR ----------
let jsqr = null;
function cargarJsQR() {
  if (jsqr) return jsqr;
  jsqr = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/jsQR.js';
    s.onload = () => res(window.jsQR); s.onerror = rej;
    document.head.appendChild(s);
  });
  return jsqr;
}

// Abre la cámara y resuelve con el texto del QR (o null si se cancela)
export function escanearQR() {
  return new Promise(resolve => {
    let stream = null, fin = false, raf = 0;
    const m = modal(`${cabModal('Escaneá el QR de recepción')}
      <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:3/4;max-width:100%">
        <video id="qr-video" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;inset:18%;border:3px solid var(--accent);border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div>
      </div>
      <p class="sub" id="qr-estado">Apuntá la cámara al QR de recepción.</p>
      <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button></div>`,
    { alCerrar: () => terminar(null) });
    const video = m.el.querySelector('#qr-video');
    const estado = m.el.querySelector('#qr-estado');
    function terminar(v) {
      if (fin) return; fin = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
      resolve(v);
    }
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream; await video.play();
      } catch {
        estado.textContent = 'No se pudo abrir la cámara. Dale permiso en la configuración del navegador o escaneá el QR con la cámara del celular.';
        return;
      }
      let detector = null;
      if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; } }
      const lib = detector ? null : await cargarJsQR().catch(() => null);
      if (!detector && !lib) { estado.textContent = 'Este celular no puede leer QR desde la app. Usá la cámara del celular.'; return; }
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const paso = async () => {
        if (fin) return;
        if (video.readyState >= 2) {
          try {
            let txt = null;
            if (detector) { const r = await detector.detect(video); txt = r[0]?.rawValue || null; }
            else {
              const w = 480, h = Math.round(480 * video.videoHeight / video.videoWidth) || 640;
              canvas.width = w; canvas.height = h; ctx.drawImage(video, 0, 0, w, h);
              txt = lib(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data || null;
            }
            if (txt) { terminar(txt); m.cerrar(); return; }
          } catch { /* sigue intentando */ }
        }
        raf = requestAnimationFrame(paso);
      };
      paso();
    })();
  });
}

function simularEscaneo() {
  return new Promise(res => {
    let v = null;
    const m = modal(`${cabModal('Escanear QR de recepción')}
      <div style="border-radius:12px;background:#000;aspect-ratio:4/3;display:grid;place-items:center;color:#fff;text-align:center;padding:20px">
        <div style="display:grid;gap:8px"><b>Acá se abre la cámara</b><span style="opacity:.75">En la app real el profe apunta al QR de recepción.</span></div></div>
      <p class="sub">Modo demo: tocá el botón para simular que se leyó el QR.</p>
      <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="sim-ok">Simular escaneo</button></div>`,
    { alCerrar: () => res(v) });
    m.el.querySelector('#sim-ok').onclick = () => { v = 'fichar.html?t=' + demoTokenActual(); m.cerrar(); };
  });
}

export async function flujoFichar(persona, alTerminar) {
  const txt = DEMO ? await simularEscaneo() : await escanearQR();
  if (!txt) return;
  const token = tokenDeTexto(txt);
  if (!token) return toast('Ese QR no es el de fichaje de Coghlan Club', true);
  try {
    const r = await registrarFichaje(persona, token);
    mostrarResultado(r);
    alTerminar?.(r);
  } catch (e) { console.error(e); toast(mensajeError(e), true); }
}

export function mostrarResultado(r) {
  const m = modal(`<div style="display:grid;gap:10px;text-align:center;padding:10px 0">
    <div style="font:800 3.4rem var(--f-mono);color:${r.tipo === 'entrada' ? 'var(--ok)' : 'var(--info)'}">${r.hora}</div>
    <h2>${r.repetido ? `Tu ${r.tipo} ya estaba registrada` : r.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada'}</h2>
    <p class="sub">${r.tipo === 'entrada' ? '¡Buen turno!' : '¡Hasta la próxima!'}</p>
    <button class="btn grande" data-cerrar>Listo</button></div>`);
  setTimeout(() => m.cerrar(), 6000);
}
