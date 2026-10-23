globalThis.__app = 'profe';
// Página a la que llega el profe si escanea el QR con la cámara del celular (fuera de la app).
import { alCambiarUsuario, obtener } from './datos.js';
import { esc, hoy, fechaLarga, horaDe, nombreCompleto } from './logica.js';
import { $, pantallaLogin, prepararDemo, registrarApp } from './ui.js';
import { registrarFichaje, mensajeError, fichajesDeHoy } from './fichaje.js';

const app = $('#app');
const token = new URLSearchParams(location.search).get('t');
await prepararDemo();
registrarApp();

const caja = html => `<div class="login"><div class="caja">
  <div class="marca">coghlan<b>club</b><small>Fichaje</small></div>${html}</div></div>`;

if (!token) {
  app.innerHTML = caja('<h1>Escaneá el QR</h1><p class="sub">Para fichar, escaneá el QR de la PC de recepción con la cámara del celular o desde el botón Fichar de la app.</p><a class="btn grande" href="profesor.html">Ir a mi ficha</a>');
} else {
  let hecho = false;
  alCambiarUsuario(async u => {
    if (!u) return pantallaLogin(app, { titulo: 'Fichar', texto: 'Entrá con tu cuenta de Google para registrar tu entrada o salida. Solo la primera vez.' });
    if (hecho) return;
    hecho = true;
    app.innerHTML = caja('<p class="sub">Registrando…</p>');
    const p = await obtener('personal', u.email).catch(() => null);
    if (!p || p.estado !== 'activo') {
      app.innerHTML = caja(`<h1>Sin ficha activa</h1><p class="sub">${esc(u.email)} no tiene una ficha aprobada. ${p ? 'Gerencia todavía la tiene que aprobar.' : 'Completá tu ficha primero.'}</p><a class="btn grande" href="profesor.html">Ir a mi ficha</a>`);
      return;
    }
    try {
      const r = await registrarFichaje(p, token);
      const lista = await fichajesDeHoy(p.email).catch(() => []);
      app.innerHTML = caja(`
        <div style="display:grid;gap:6px"><span class="eyebrow">${fechaLarga(hoy())}</span>
        <div style="font:800 4rem var(--f-mono);color:${r.tipo === 'entrada' ? 'var(--ok)' : 'var(--info)'}">${r.hora}</div>
        <h1>${r.repetido ? `Tu ${r.tipo} ya estaba registrada` : r.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada'}</h1>
        <p class="sub">${esc(nombreCompleto(p))}</p></div>
        ${lista.length ? `<div class="panel"><h4>Hoy</h4><div class="lista">${lista.map(f => `<div class="item"><span>${f.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span><span class="mono">${horaDe(f.ts)}</span></div>`).join('')}</div></div>` : ''}
        <a class="btn grande ghost" href="profesor.html">Ver mi ficha</a>`);
      history.replaceState(null, '', 'fichar.html');
    } catch (e) {
      console.error(e);
      app.innerHTML = caja(`<h1>No se registró</h1><div class="aviso mal"><div>${mensajeError(e)}</div></div><a class="btn grande" href="profesor.html">Abrir mi ficha y escanear</a>`);
    }
  });
}
