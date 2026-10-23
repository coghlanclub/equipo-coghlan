globalThis.__app = 'gerencia';
import { DEMO, AHORA, alCambiarUsuario, esAdmin, salir, escuchar, escucharDoc, guardar, actualizar, agregar, borrar, lote } from './datos.js';
import {
  esc, ROLES, ROL_CORTO, ROLES_TURNO, DIAS, DIAS_CORTOS, DIAS_LABORABLES, MESES, ESTADOS, SEDES, GRILLA_BASE, ACTIVIDADES_BASE,
  hoy, iso, deIso, mesDe, sumarDias, rangoTexto, diasEntre, fechaLarga, fechaCorta, min, seSolapan, nombreCompleto, iniciales,
  activo, agenda, necesidades, tipoReemplazo, cubierto, candidatos, huecos, conflictos, ausenteEn, jornadas, resumenAsistencia,
  horaDe, fmtMin, ms, mailto, mailRespuesta, waLink, textoReemplazo, queCubre, idClase, TOLERANCIA_TARDE, minutosDelDia, pad, sumarMin, DURACION_CLASE,
  faltasSinAviso, sinCorreo, rangoFechas, normTel,
} from './logica.js';
import { enviarCorreo, envioAutomatico } from './correo.js';
import { listar } from './datos.js';
import { $, $$, toast, modal, cabModal, confirmar, copiar, pantallaLogin, prepararDemo, registrarApp, htmlFicha, htmlContacto, chipsRoles, htmlAgenda } from './ui.js';
import { htmlFormFicha, activarFormFicha } from './ficha-form.js';
import { botonGuia, registrarGuia } from './guia.js';

const app = $('#app');
const TABS = [
  ['hoy', 'Hoy'], ['censo', 'Censo'], ['personal', 'Personal'], ['grilla', 'Grilla de clases'], ['vacaciones', 'Vacaciones y ausencias'],
  ['reemplazos', 'Reemplazos'], ['asistencia', 'Asistencia'], ['ajustes', 'Ajustes'],
];
const S = {
  user: null, recepcion: [], tab: (location.hash.slice(1) || 'hoy'), personal: [], clases: [], ausencias: [], reemplazos: [], fichajes: [], fichajesHoy: [],
  config: {}, admins: [], censo: [], mesAsis: mesDe(new Date()), mesCal: mesDe(new Date()), mesGrilla: mesDe(new Date()), sede: 'Anexo', vistaGrilla: 'semana',
  filtroRol: '', buscar: '', soloSinCubrir: true, personaAsis: '', listo: false, histAnio: '', histPersona: '',
};
if (!TABS.some(t => t[0] === S.tab)) S.tab = 'hoy';
let subs = [];
const limpiar = () => { subs.forEach(u => u()); subs = []; };

await prepararDemo();
registrarApp();

alCambiarUsuario(async u => {
  limpiar(); S.user = u; S.listo = false;
  if (!u) return pantallaLogin(app, { titulo: 'Gerencia', texto: 'Panel de personal: fichas, grilla, vacaciones, reemplazos y asistencia. Solo para cuentas de gerencia.' });
  if (!(await esAdmin(u.email))) {
    app.innerHTML = `<div class="login"><div class="caja"><h1>Sin acceso</h1><p class="sub">${esc(u.email)} no es una cuenta de gerencia. Si sos profe, entrá a tu ficha.</p>
      <a class="btn" href="profesor.html">Ir a mi ficha</a><button class="btn ghost" id="out">Salir</button></div></div>`;
    $('#out').onclick = () => salir(); return;
  }
  app.innerHTML = '<main><p class="sub">Cargando…</p></main>';
  const err = e => toast('Error de permisos o conexión: ' + (e?.code || ''), true);
  subs.push(
    escuchar('personal', [], d => { S.personal = d; pintar(); }, err),
    escuchar('clases', [], d => { S.clases = d; pintar(); }, err),
    escuchar('ausencias', [], d => { S.ausencias = d; pintar(); }, err),
    escuchar('reemplazos', [], d => { S.reemplazos = d; pintar(); }, err),
    escuchar('admins', [], d => { S.admins = d; pintar(); }, err),
    escuchar('recepcion', [], d => { S.recepcion = d; pintar(); }, err),
    escuchar('censo', [], d => { S.censo = d; pintar(); }, err),
    escucharDoc('config', 'general', c => { S.config = c || {}; pintar(); }),
    escuchar('fichajes', [['fecha', '==', hoy()]], d => { S.fichajesHoy = d; pintar(); }, err),
  );
  suscribirMes();
  setTimeout(() => { S.listo = true; pintar(); }, 50);
});
let unMes = () => {};
function suscribirMes() { unMes(); unMes = escuchar('fichajes', [['mes', '==', S.mesAsis]], d => { S.fichajes = d; pintar(); }); subs.push(() => unMes()); }

// ---------- Derivados ----------
const P = email => S.personal.find(p => p.email === email);
const nom = email => { const p = P(email); return p ? nombreCompleto(p) : email; };
const activos = () => S.personal.filter(activo);
const pendientesFicha = () => S.personal.filter(p => p.estado === 'pendiente');
const pedidosCelular = () => S.personal.filter(p => p.pedidoDispositivo?.id && p.pedidoDispositivo.id !== p.dispositivo);
const pendientesAus = () => S.ausencias.filter(a => a.estado === 'pendiente');
function necesidadesFuturas(desde = hoy(), hasta = null) {
  const out = [];
  for (const a of S.ausencias.filter(x => x.estado === 'aprobada' && x.hasta >= desde)) {
    for (const n of necesidades(a, P(a.email), S.clases)) {
      if (n.fecha < desde || (hasta && n.fecha > hasta)) continue;
      out.push({ ...n, r: cubierto(n, S.reemplazos) });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desde.localeCompare(b.desde));
}
const sinCubrir14 = () => necesidadesFuturas(hoy(), iso(sumarDias(new Date(), 14))).filter(n => !n.r);
const clasesSinProfe = () => S.clases.filter(c => !c.profesor || !activo(P(c.profesor)));

// ---------- Render ----------
let raf = 0;
function pintar() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
function render() {
  if (!S.user || !S.listo) return;
  const y = scrollY;
  const cuentas = { censo: estadoCenso().filas.filter(f => f.estado === 'por-aprobar').length, personal: pendientesFicha().length + pedidosCelular().length, vacaciones: pendientesAus().length, reemplazos: sinCubrir14().length };
  app.innerHTML = `<header class="barra"><div class="barra-in">
      <a class="marca" href="gerencia.html">coghlan<b>club</b><small>Gerencia</small></a>
      <div class="der">${botonGuia()}<span class="sub" style="font-size:.8rem">${esc(S.user.email)}</span><button class="btn sm ghost" id="salir">Salir</button></div></div>
    <nav class="tabs" role="tablist">${TABS.map(([k, t]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}${cuentas[k] ? `<span class="cuenta">${cuentas[k]}</span>` : ''}</button>`).join('')}</nav>
  </header><main id="vista"></main>`;
  $('#salir').onclick = () => salir();
  $$('[data-tab]').forEach(b => b.onclick = () => irA(b.dataset.tab));
  ({ hoy: vHoy, censo: vCenso, personal: vPersonal, grilla: vGrilla, vacaciones: vVacaciones, reemplazos: vReemplazos, asistencia: vAsistencia, ajustes: vAjustes })[S.tab]($('#vista'));
  scrollTo(0, y);
}
function irA(tab) { S.tab = tab; history.replaceState(null, '', '#' + tab); render(); scrollTo(0, 0); }

// ============================================================ HOY
function vHoy(v) {
  const h = hoy(); const dia = new Date().getDay(); const ahora = minutosDelDia(Date.now());
  const fh = [...S.fichajesHoy].sort((a, b) => ms(a.ts) - ms(b.ts));
  const ultimo = e => fh.filter(f => f.email === e).at(-1);
  const dentro = activos().filter(p => ultimo(p.email)?.tipo === 'entrada');
  const remHoy = S.reemplazos.filter(r => r.fecha === h);
  const filas = [];
  for (const p of activos()) {
    const ag = agenda(p, S.clases).filter(s => s.dia === dia);
    const cubre = remHoy.filter(r => r.reemplazo === p.email);
    if (!ag.length && !cubre.length && !ultimo(p.email)) continue;
    const todos = [...ag, ...cubre.map(r => ({ ...r, cubriendo: true }))].sort((a, b) => a.desde.localeCompare(b.desde));
    const ini = todos.length ? min(todos[0].desde) : null;
    const prim = fh.find(f => f.email === p.email && f.tipo === 'entrada');
    const ult = ultimo(p.email);
    let est;
    if (ausenteEn(p.email, h, S.ausencias)) {
      const quien = [...new Set(remHoy.filter(r => r.titular === p.email).map(r => nom(r.reemplazo)))];
      const faltan = ag.length - remHoy.filter(r => r.titular === p.email).length;
      est = `<span class="pill neutro">Ausente</span> ${quien.length ? `<span class="sub">cubre ${esc(quien.join(', '))}</span>` : ''} ${faltan > 0 ? `<span class="pill sin">${faltan} sin cubrir</span>` : ''}`;
    } else if (prim) {
      const t = ini != null ? minutosDelDia(prim.ts) - ini : 0;
      est = `<span class="pill ${ult.tipo === 'entrada' ? 'activo' : 'info'}">${ult.tipo === 'entrada' ? 'En el club' : 'Se fue ' + horaDe(ult.ts)}</span> <span class="mono ${t > TOLERANCIA_TARDE ? 'tarde' : 'sub'}">llegó ${horaDe(prim.ts)}${t > TOLERANCIA_TARDE ? ` (+${t}′)` : ''}</span>`;
    } else if (ini != null && ahora > ini + TOLERANCIA_TARDE) est = '<span class="pill sin">No fichó</span>';
    else est = '<span class="pill neutro">Todavía no llegó</span>';
    filas.push({ p, todos, ini: ini ?? 9999, est });
  }
  filas.sort((a, b) => a.ini - b.ini);
  const sc = sinCubrir14(); const csp = clasesSinProfe();
  v.innerHTML = `
    <div class="cab"><div><span class="eyebrow">${fechaLarga(h)}</span><h1>Hoy en el club</h1></div>
      <div class="acciones"><a class="btn ghost" href="tablet.html" target="_blank" rel="noopener">Abrir QR de recepción</a></div></div>
    <div class="kpis">
      <button class="kpi" data-ir="asistencia"><b>${dentro.length}</b><span>en el club ahora</span></button>
      <button class="kpi ${pendientesFicha().length ? 'alerta' : ''}" data-ir="personal"><b>${pendientesFicha().length}</b><span>fichas nuevas por aprobar</span></button>
      <button class="kpi ${pendientesAus().length ? 'alerta' : ''}" data-ir="vacaciones"><b>${pendientesAus().length}</b><span>pedidos de vacaciones/ausencia</span></button>
      <button class="kpi ${sc.length ? 'alerta' : ''}" data-ir="reemplazos"><b>${sc.length}</b><span>turnos sin cubrir (14 días)</span></button>
      <button class="kpi ${csp.length ? 'alerta' : ''}" data-ir="grilla"><b>${csp.length}</b><span>clases sin profesor</span></button>
    </div>
    <div class="panel"><h3>Quién trabaja hoy</h3>
      ${filas.length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th>Horario de hoy</th><th>Estado</th></tr></thead><tbody>
        ${filas.map(f => `<tr><td><button class="btn sm ghost" data-ficha="${esc(f.p.email)}">${esc(nombreCompleto(f.p))}</button></td>
          <td><div class="slots">${f.todos.map(s => `<span class="slot-mini rol-${s.rol}"><span class="mono">${s.desde}–${s.hasta}</span> ${esc(s.actividad || ROL_CORTO[s.rol])}${s.cubriendo ? ' · reemplazo' : ''}</span>`).join('') || '<span class="sub">sin turno</span>'}</div></td>
          <td>${f.est}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vacio">Nadie tiene turno hoy.</p>'}
    </div>`;
  $$('[data-ir]', v).forEach(b => b.onclick = () => irA(b.dataset.ir));
  enlazarFichas(v);
}

// ============================================================ CENSO
const ESTADO_CENSO = {
  'sin-enviar': ['Sin enviar', 'neutro'], enviado: ['Link enviado · falta completar', 'pendiente'],
  'por-aprobar': ['Completó · por aprobar', 'info'], listo: ['Censado', 'aprobada'],
};
function estadoCenso() {
  const usadas = new Set();
  const filas = S.censo.map(r => {
    const p = S.personal.find(x => (r.email && x.email === r.email) || (r.telefono && normTel(x.telefono) === normTel(r.telefono)));
    if (p) usadas.add(p.email);
    const estado = p ? (p.estado === 'pendiente' ? 'por-aprobar' : 'listo') : r.enviado ? 'enviado' : 'sin-enviar';
    return { r, p, estado };
  }).sort((a, b) => Object.keys(ESTADO_CENSO).indexOf(a.estado) - Object.keys(ESTADO_CENSO).indexOf(b.estado) || (a.r.nombre || '').localeCompare(b.r.nombre || ''));
  const sueltos = S.personal.filter(p => !usadas.has(p.email) && p.estado !== 'inactivo');
  return { filas, sueltos };
}
const linkCenso = () => new URL('profesor.html', location.href).href;
const msjCenso = nombre => `Hola${nombre ? ' ' + nombre.split(' ')[0] : ''}! Estamos haciendo el censo del personal de Coghlan Club. Completá tu ficha acá, te lleva 5 minutos: ${linkCenso()}

1) Abrí el link en *Chrome* (Android) o *Safari* (iPhone), no dentro de WhatsApp: mantené apretado el link → Copiar → pegalo en el navegador.
2) Guardá la app en la pantalla de inicio:
   • iPhone (Safari): Compartir ⬆️ → *Agregar a inicio* → Agregar.
   • Android (Chrome): menú ⋮ → *Agregar a la pantalla principal* o *Instalar app*.
3) Abrí la app desde el ícono, entrá con tu cuenta de Google y cargá tus datos, tus clases u horarios y cuándo podés cubrir.

Desde esa app vas a fichar con el QR de recepción. ¡Gracias!`;

function vCenso(v) {
  const { filas, sueltos } = estadoCenso();
  const n = k => filas.filter(f => f.estado === k).length;
  const total = filas.length, listos = n('listo');
  const pct = total ? Math.round(listos / total * 100) : 0;
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Relevamiento de todo el personal</span><h1>Censo</h1>
      <p class="sub">Cada persona completa su ficha una sola vez: datos, contacto de emergencia, rol, clases u horarios y cuándo puede cubrir. Con el censo completo, la grilla y los reemplazos quedan armados.</p></div></div>
    <div class="panel">
      <div class="cab"><h3>Avance: ${listos} de ${total} censados</h3><span class="mono" style="font-size:1.4rem;font-weight:700">${pct}%</span></div>
      <div style="height:10px;background:var(--surface-2);border-radius:9px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--ok)"></div></div>
      <div class="kpis">
        <div class="kpi"><b>${n('sin-enviar')}</b><span>sin enviar el link</span></div>
        <div class="kpi ${n('enviado') ? 'alerta' : ''}"><b>${n('enviado')}</b><span>recibieron el link y no completaron</span></div>
        <div class="kpi ${n('por-aprobar') ? 'alerta' : ''}"><b>${n('por-aprobar')}</b><span>completaron, falta aprobar</span></div>
        <div class="kpi"><b>${listos}</b><span>censados</span></div>
        <div class="kpi ${clasesSinProfe().length ? 'alerta' : ''}"><b>${clasesSinProfe().length}</b><span>clases de la grilla sin profe</span></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel"><h3>Cómo se hace</h3><div class="lista">
        <div class="item"><div><b>1. Cargá la lista de todo el personal</b><span class="sub">Nombre y celular. Podés pegar la lista entera de una vez.</span></div></div>
        <div class="item"><div><b>2. Mandá el link</b><span class="sub">Uno por uno por WhatsApp con el botón de cada persona, o copiá el mensaje y pegalo en el grupo del personal.</span></div></div>
        <div class="item"><div><b>3. Cada uno completa su ficha</b><span class="sub">Desde su celular, en 5 pasos: sus datos (celular, emergencia, dirección), su rol, sus clases u horarios, firma el consentimiento de datos y envía. A los que no tienen celular se la completás vos con "Lo completo yo" y les imprimís el consentimiento para firmar en papel.</span></div></div>
        <div class="item"><div><b>4. Aprobá</b><span class="sub">Revisás cada ficha y la aprobás. Sus clases pasan solas a la grilla. Los que no completan quedan en amarillo: tocá Recordar.</span></div></div>
      </div>
      <button class="btn ghost" id="copiar-grupo" style="justify-self:start">Copiar mensaje para el grupo de WhatsApp</button></div>
      <div class="panel"><h3>Cargar la lista</h3>
        <label>Un renglón por persona: nombre y apellido, celular<textarea id="lista-pegar" rows="6" placeholder="Rosa Medina, 11 5555-1234&#10;Diego Paredes, 11 4444-9876"></textarea></label>
        <button class="btn" id="agregar-lista" style="justify-self:start">Agregar a la lista</button></div>
    </div>
    <div class="panel"><h3>Personal a censar (${total})</h3>
      ${total ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th>Celular</th><th>Estado</th><th>Consentimiento</th><th>Acciones</th></tr></thead><tbody>
      ${filas.map(({ r, p, estado }) => `<tr><td><b>${esc(r.nombre)}</b>${p && p.sinCelular ? ' <span class="pill neutro">sin celular · PIN</span>' : ''}</td><td class="mono">${esc(r.telefono || '—')}</td>
        <td><span class="pill ${ESTADO_CENSO[estado][1]}">${ESTADO_CENSO[estado][0]}</span>${r.enviado && estado === 'enviado' ? `<br><span class="sub">enviado el ${fechaCorta(iso(new Date(ms(r.enviado))))}</span>` : ''}</td>
        <td>${!p ? '<span class="sub">—</span>' : p.consentimiento?.aceptado ? `<span class="pill aprobada">${p.consentimiento.papel ? 'En papel' : 'Firmado'}</span>` : '<span class="pill sin">Falta</span>'}</td>
        <td><div class="acciones">
          ${estado === 'sin-enviar' || estado === 'enviado' ? `${r.telefono ? `<a class="btn sm" target="_blank" rel="noopener" href="${waLink(r.telefono, msjCenso(r.nombre))}" data-enviado="${r.id}">${estado === 'enviado' ? 'Recordar' : 'Mandar link'}</a>` : ''}
            <button class="btn sm ghost" data-completar="${r.id}">Lo completo yo</button>` : ''}
          ${estado === 'por-aprobar' ? `<button class="btn sm ok" data-aprobar-c="${esc(p.email)}">Aprobar</button>` : ''}
          ${p ? `<button class="btn sm ghost" data-ficha="${esc(p.email)}">Ver ficha</button>` : ''}
          <button class="btn sm ghost" data-quitar-c="${r.id}" aria-label="Quitar de la lista">×</button></div></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vacio">Todavía no cargaste la lista. Pegala arriba: un renglón por persona.</p>'}</div>
    ${sueltos.length ? `<div class="panel"><h3>Fichas que no están en la lista (${sueltos.length})</h3><p class="sub">Completaron la ficha o las cargaste antes de armar la lista.</p>
      <div class="lista">${sueltos.map(p => `<div class="item"><div><b>${esc(nombreCompleto(p))}</b><span class="sub mono">${esc(p.telefono || '')}</span></div>
        <div class="acciones">${p.estado === 'pendiente' ? `<button class="btn sm ok" data-aprobar-c="${esc(p.email)}">Aprobar</button>` : ''}<button class="btn sm ghost" data-sumar="${esc(p.email)}">Sumar a la lista</button></div></div>`).join('')}</div></div>` : ''}`;
  $('#copiar-grupo').onclick = () => copiar(msjCenso(''));
  $('#agregar-lista').onclick = async () => {
    const rs = $('#lista-pegar').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(.*?)[,;\t]\s*([\d\s()+-]{6,})\s*$/) || l.match(/^(.*?)\s+([\d\s()+-]{8,})$/);
      return m ? { nombre: m[1].trim(), telefono: m[2].trim() } : { nombre: l, telefono: '' };
    }).filter(r => r.nombre && !S.censo.some(c => c.telefono && r.telefono && normTel(c.telefono) === normTel(r.telefono)));
    if (!rs.length) return toast('No hay nombres nuevos para agregar', true);
    await lote(rs.map(r => ({ c: 'censo', id: Math.random().toString(36).slice(2, 12), data: { ...r, creado: AHORA } })));
    toast(`${rs.length} persona(s) agregadas`);
  };
  $$('[data-enviado]', v).forEach(a => a.addEventListener('click', () => { actualizar('censo', a.dataset.enviado, { enviado: Date.now() }).catch(() => {}); }));
  $$('[data-completar]', v).forEach(b => b.onclick = () => {
    const r = S.censo.find(x => x.id === b.dataset.completar);
    const [nombre, ...ap] = (r.nombre || '').split(' ');
    editarFicha({ estado: 'activo', nombre, apellido: ap.join(' '), telefono: r.telefono, sinCelular: true });
  });
  $$('[data-aprobar-c]', v).forEach(b => b.onclick = () => aprobarFicha(P(b.dataset.aprobarC)));
  $$('[data-quitar-c]', v).forEach(b => b.onclick = async () => { await borrar('censo', b.dataset.quitarC); toast('Quitado de la lista'); });
  $$('[data-sumar]', v).forEach(b => b.onclick = async () => { const p = P(b.dataset.sumar); await agregar('censo', { nombre: nombreCompleto(p), telefono: p.telefono || '', email: p.email, creado: AHORA }); toast('Sumado a la lista'); });
  enlazarFichas(v);
}

// ============================================================ PERSONAL / CENSO
function vPersonal(v) {
  const pend = pendientesFicha();
  const q = S.buscar.toLowerCase();
  const lista = S.personal.filter(p => p.estado !== 'pendiente')
    .filter(p => !S.filtroRol || (p.roles || []).includes(S.filtroRol))
    .filter(p => !q || `${nombreCompleto(p)} ${p.email} ${(p.actividades || []).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => (activo(b) - activo(a)) || nombreCompleto(a).localeCompare(nombreCompleto(b)));
  const linkCenso = new URL('profesor.html', location.href).href;
  v.innerHTML = `
    <div class="cab"><div><span class="eyebrow">Censo y fichas</span><h1>Personal</h1>
      <p class="sub">${activos().length} activos · cada profe completa su ficha desde el link del censo y vos la aprobás acá.</p></div>
      <div class="acciones"><button class="btn ghost" id="copiar-censo">Copiar link del censo</button><button class="btn" id="nueva">+ Cargar persona</button></div></div>
    <div class="aviso info"><div><b>Link para mandar a todo el personal</b><span class="mono" style="overflow-wrap:anywhere">${esc(linkCenso)}</span>
      <span>Entran con Google, completan su ficha y marcan las clases que dan. Después lo guardan en el celular como app.</span></div></div>
    ${pedidosCelular().length ? `<div class="panel"><h3>Pedidos de cambio de celular (${pedidosCelular().length})</h3><div class="lista">${pedidosCelular().map(p => `<div class="item"><div><b>${esc(nombreCompleto(p))}</b>
      <span class="sub">Quiere usar un ${esc(p.pedidoDispositivo.modelo || 'celular nuevo')} · hoy tiene vinculado ${esc(p.dispositivoModelo || 'otro celular')}</span></div>
      <div class="acciones"><button class="btn sm ok" data-hab-cel="${esc(p.email)}">Habilitar</button><button class="btn sm ghost" data-neg-cel="${esc(p.email)}">Rechazar</button></div></div>`).join('')}</div></div>` : ''}
    ${pend.length ? `<div class="panel"><h3>Fichas nuevas por aprobar (${pend.length})</h3><div class="grid-2">${pend.map(htmlPendiente).join('')}</div></div>` : ''}
    ${htmlCobertura()}
    <div class="acciones">
      <div class="seg" role="group" aria-label="Filtrar por rol"><button data-rol="" aria-pressed="${!S.filtroRol}">Todos</button>${Object.keys(ROLES).map(r => `<button data-rol="${r}" aria-pressed="${S.filtroRol === r}">${ROL_CORTO[r]}</button>`).join('')}</div>
      <input id="buscar" placeholder="Buscar por nombre o actividad" value="${esc(S.buscar)}" style="max-width:280px">
    </div>
    <div class="grid-3">${lista.map(p => `<button class="tarjeta" data-ficha="${esc(p.email)}" ${activo(p) ? '' : 'style="opacity:.55"'}>
        <div class="persona"><div class="avatar">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span class="sub mono">${esc(p.telefono || '')}</span></div></div>
        <div class="pie">${chipsRoles(p)} ${!activo(p) ? '<span class="pill neutro">Inactivo</span>' : ''} ${conflictos(p, S.clases).length ? '<span class="pill pendiente">Choque de horarios</span>' : ''}</div>
        <span class="sub">${agenda(p, S.clases).length} turnos/clases por semana${(p.actividades || []).length ? ' · ' + esc(p.actividades.slice(0, 3).join(', ')) + (p.actividades.length > 3 ? '…' : '') : ''}</span>
      </button>`).join('') || '<p class="vacio">No hay personas con ese filtro.</p>'}</div>`;
  $('#copiar-censo').onclick = () => copiar(linkCenso);
  $('#nueva').onclick = () => editarFicha({ estado: 'activo' });
  $$('[data-rol]', v).forEach(b => b.onclick = () => { S.filtroRol = b.dataset.rol; render(); });
  $('#buscar').oninput = e => { S.buscar = e.target.value; clearTimeout(vPersonal.t); vPersonal.t = setTimeout(() => { render(); const i = $('#buscar'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  enlazarFichas(v);
  $$('[data-aprobar]', v).forEach(b => b.onclick = () => aprobarFicha(P(b.dataset.aprobar)));
  $$('[data-hab-cel]', v).forEach(b => b.onclick = () => habilitarCelular(P(b.dataset.habCel)));
  $$('[data-neg-cel]', v).forEach(b => b.onclick = async () => { await actualizar('personal', b.dataset.negCel, { pedidoDispositivo: null }); toast('Pedido rechazado'); });
  $$('[data-editar]', v).forEach(b => b.onclick = () => editarFicha(P(b.dataset.editar)));
  $$('[data-rechazar]', v).forEach(b => b.onclick = async () => {
    const p = P(b.dataset.rechazar);
    if (await confirmar(`¿Descartar la ficha de ${esc(nombreCompleto(p))}? Va a tener que completarla de nuevo.`, { si: 'Descartar', peligro: true })) {
      await borrar('personal', p.email); toast('Ficha descartada');
    }
  });
}

function htmlPendiente(p) {
  const decl = S.clases.filter(c => (p.clasesDeclaradas || []).includes(c.id));
  const ocupadas = decl.filter(c => c.profesor && c.profesor !== p.email && activo(P(c.profesor)));
  return `<div class="panel" style="background:var(--bg)">
    <div class="persona"><div class="avatar">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span class="sub">${esc(p.email)} · ${esc(p.telefono || '')}</span></div></div>
    <div>${chipsRoles(p)}</div>
    ${(p.actividades || []).length ? `<span class="sub">Da: ${esc(p.actividades.join(', '))}</span>` : ''}
    ${htmlAgenda([...(p.horarios || []), ...decl.map(c => ({ ...c, rol: 'clases' }))])}
    ${ocupadas.length ? `<div class="aviso"><div><b>${ocupadas.length} clase(s) ya tienen profe asignado</b><span>${ocupadas.map(c => `${DIAS_CORTOS[c.dia]} ${c.desde} ${esc(c.actividad)} (hoy: ${esc(nom(c.profesor))})`).join(' · ')}</span><span>Al aprobar se cargan solo las libres. Las otras las resolvés en la grilla.</span></div></div>` : ''}
    <div class="acciones"><button class="btn ok" data-aprobar="${esc(p.email)}">Aprobar y cargar clases</button><button class="btn ghost" data-editar="${esc(p.email)}">Revisar</button><button class="btn ghost" data-rechazar="${esc(p.email)}">Descartar</button></div>
  </div>`;
}

async function aprobarFicha(p) {
  const decl = S.clases.filter(c => (p.clasesDeclaradas || []).includes(c.id));
  const libres = decl.filter(c => !c.profesor || c.profesor === p.email || !activo(P(c.profesor)));
  try {
    await lote([
      { c: 'personal', id: p.email, data: { estado: 'activo', aprobado: AHORA }, merge: true },
      ...libres.map(c => ({ c: 'clases', id: c.id, data: { profesor: p.email }, merge: true })),
    ]);
    toast(`Ficha aprobada · ${libres.length} clase(s) cargadas en la grilla`);
  } catch (e) { console.error(e); toast('No se pudo aprobar', true); }
}

function htmlCobertura() {
  const filas = [];
  for (const rol of ['musculacion', 'recepcion']) {
    const gente = activos().filter(p => (p.roles || []).includes(rol));
    if (!gente.length) continue;
    for (const d of DIAS_LABORABLES) {
      const slots = gente.flatMap(p => (p.horarios || []).filter(s => s.rol === rol && s.dia === d));
      const hs = huecos(d, slots);
      if (hs.length) filas.push(`<span class="pill sin">${ROL_CORTO[rol]} · ${DIAS_CORTOS[d]} ${hs.map(x => x.join('–')).join(', ')}</span>`);
    }
  }
  return filas.length ? `<div class="aviso"><div><b>Horarios del club sin nadie asignado</b><div class="checks">${filas.join('')}</div></div></div>` : '';
}

function enlazarFichas(v) { $$('[data-ficha]', v).forEach(b => b.onclick = () => verFicha(P(b.dataset.ficha))); }

function verFicha(p) {
  if (!p) return;
  const h = hoy();
  const aus = S.ausencias.filter(a => a.email === p.email && a.hasta >= h).sort((a, b) => a.desde.localeCompare(b.desde));
  const conf = conflictos(p, S.clases);
  const js = jornadas(S.fichajes.filter(f => f.email === p.email), { [p.email]: agenda(p, S.clases) });
  const mins = js.reduce((t, j) => t + (j.minutos || 0), 0);
  const histAus = S.ausencias.filter(a => a.email === p.email).sort((a, b) => b.desde.localeCompare(a.desde));
  const faltas = faltasMes().filter(f => f.email === p.email);
  const m = modal(`${cabModal('Ficha')}
    ${htmlFicha(p, S.clases, { extra: `
      ${conf.length ? `<div class="aviso"><div><b>Choque de horarios</b><span>${conf.map(([a, b]) => `${DIAS[a.dia]}: ${a.desde} ${esc(a.actividad || ROL_CORTO[a.rol])} con ${b.desde} ${esc(b.actividad || ROL_CORTO[b.rol])}`).join(' · ')}</span></div></div>` : ''}
      ${p.sinCelular ? `<div class="aviso info"><div><b>Ficha sin celular</b><span>Ficha en la PC de recepción tocando su nombre y poniendo el PIN <b class="mono">${esc(p.pin || '—')}</b>.</span></div></div>`
        : `<div class="item" style="border:1px solid var(--line);border-radius:8px;padding:10px"><div><b>Celular vinculado</b><span class="sub">${p.dispositivo ? `${esc(p.dispositivoModelo || 'Celular')}${p.dispositivoDesde ? ' · desde el ' + fechaCorta(iso(new Date(ms(p.dispositivoDesde)))) : ''}` : 'Todavía no entró desde ningún celular'}</span>
          ${p.pedidoDispositivo?.id && p.pedidoDispositivo.id !== p.dispositivo ? `<span class="sub" style="color:var(--warn)">Pidió habilitar un ${esc(p.pedidoDispositivo.modelo || 'celular nuevo')}</span>` : ''}</div>
          ${p.dispositivo ? `<button class="btn sm ghost" id="fi-cel">${p.pedidoDispositivo?.id ? 'Habilitar el celular nuevo' : 'Habilitar otro celular'}</button>` : ''}</div>`}
      <div style="display:grid;gap:6px"><h4>Vacaciones y ausencias (todas)</h4>${histAus.length ? `<div class="lista">${histAus.map(a => `<div class="item"><span>${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span> · ${diasEntre(a.desde, a.hasta)} día(s)</span><span class="pill ${a.estado}">${ESTADOS[a.estado]}</span></div>`).join('')}</div>` : '<p class="sub">Ninguna.</p>'}</div>
      <p class="sub">${MESES[+S.mesAsis.slice(5) - 1]}: <b class="mono">${js.length}</b> jornadas · <b class="mono">${fmtMin(mins)}</b> · <b class="mono ${faltas.length ? 'tarde' : ''}">${faltas.length}</b> falta(s) sin aviso${faltas.length ? ': ' + faltas.map(f => fechaCorta(f.fecha).slice(0, 5)).join(', ') : ''}</p>` })}
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cerrar</button><button class="btn ghost" id="fi-aus">Cargar ausencia</button><button class="btn" id="fi-editar">Editar ficha</button></div>`, { ancho: true });
  $('#fi-editar', m.el).onclick = () => { m.cerrar(); editarFicha(p); };
  $('#fi-cel', m.el)?.addEventListener('click', () => { m.cerrar(); habilitarCelular(p); });
  $('#fi-aus', m.el).onclick = () => { m.cerrar(); cargarAusencia(p.email); };
}

async function habilitarCelular(p) {
  const pedido = p.pedidoDispositivo?.id;
  const txt = pedido ? `¿Habilitar el ${esc(p.pedidoDispositivo.modelo || 'celular nuevo')} de ${esc(nombreCompleto(p))}? El celular anterior deja de funcionar.`
    : `¿Liberar la cuenta de ${esc(nombreCompleto(p))}? El próximo celular desde el que entre queda vinculado y el actual deja de funcionar.`;
  if (!(await confirmar(txt, { si: 'Habilitar' }))) return;
  await actualizar('personal', p.email, pedido
    ? { dispositivo: pedido, dispositivoModelo: p.pedidoDispositivo.modelo || '', dispositivoDesde: Date.now(), pedidoDispositivo: null }
    : { dispositivo: '', dispositivoModelo: '', pedidoDispositivo: null });
  toast('Celular habilitado');
}

// Faltas sin aviso del mes elegido en Asistencia (hasta ayer)
function faltasMes() {
  const [y, m] = S.mesAsis.split('-').map(Number);
  const ini = `${S.mesAsis}-01`; const fin = iso(new Date(y, m, 0));
  const ayer = iso(sumarDias(new Date(), -1));
  const hasta = fin < ayer ? fin : ayer;
  if (hasta < ini) return [];
  return faltasSinAviso(S.personal, S.clases, S.fichajes, S.ausencias, ini, hasta);
}

function editarFicha(p) {
  const nueva = !p.email;
  const m = modal(`${cabModal(nueva ? 'Cargar persona' : 'Editar ficha')}${htmlFormFicha(p, { modo: 'gerencia', clases: S.clases })}
    <div class="modal-pie">${!nueva ? '<button class="btn ghost" id="fe-borrar" style="margin-right:auto">Eliminar</button>' : ''}<button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="fe-ok">Guardar</button></div>`, { ancho: true });
  const f = activarFormFicha($('#form-ficha', m.el), p);
  $('#fe-ok', m.el).onclick = async () => {
    const d = f.leer(); if (!d) return;
    if (nueva && P(d.email)) return toast('Ya existe una ficha con ese correo', true);
    const { clases, ...resto } = d;
    const antes = S.clases.filter(c => c.profesor === d.email).map(c => c.id);
    const ops = [{ c: 'personal', id: d.email, data: { ...resto, clasesDeclaradas: clases, actualizado: AHORA, ...(nueva ? { creado: AHORA } : {}) }, merge: true }];
    for (const id of clases) if (!antes.includes(id)) ops.push({ c: 'clases', id, data: { profesor: d.email }, merge: true });
    for (const id of antes) if (!clases.includes(id)) ops.push({ c: 'clases', id, data: { profesor: '' }, merge: true });
    try { await lote(ops); m.cerrar(); toast('Ficha guardada'); } catch (e) { console.error(e); toast('No se pudo guardar', true); }
  };
  $('#fe-borrar', m.el)?.addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar la ficha de ${esc(nombreCompleto(p))}? Si dejó de trabajar, mejor marcala como Inactivo para conservar su historial.`, { si: 'Eliminar', peligro: true }))) return;
    const ops = [{ c: 'personal', id: p.email, borrar: true }, ...S.clases.filter(c => c.profesor === p.email).map(c => ({ c: 'clases', id: c.id, data: { profesor: '' }, merge: true }))];
    await lote(ops); m.cerrar(); toast('Ficha eliminada');
  });
}

// ============================================================ GRILLA
function opcionesProfe(c) {
  const profes = activos().filter(p => (p.roles || []).includes('clases'));
  const saben = profes.filter(p => (p.actividades || []).includes(c.actividad));
  const otros = profes.filter(p => !(p.actividades || []).includes(c.actividad));
  const op = p => `<option value="${esc(p.email)}" ${c.profesor === p.email ? 'selected' : ''}>${esc(nombreCompleto(p))}</option>`;
  const huerf = c.profesor && !profes.some(p => p.email === c.profesor) ? `<option value="${esc(c.profesor)}" selected>${esc(nom(c.profesor))} (inactivo)</option>` : '';
  return `<option value="">— Sin profesor —</option>${huerf}${saben.length ? `<optgroup label="Dan ${esc(c.actividad)}">${saben.map(op).join('')}</optgroup>` : ''}${otros.length ? `<optgroup label="Otros profes de clases">${otros.map(op).join('')}</optgroup>` : ''}`;
}

function vGrilla(v) {
  const vacia = !S.clases.length;
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Agenda de clases presenciales</span><h1>Grilla de clases</h1>
      <p class="sub">${S.clases.length} clases por semana · ${clasesSinProfe().length} sin profesor</p></div>
      <div class="acciones">
        <div class="seg" role="group" aria-label="Vista"><button data-vista="semana" aria-pressed="${S.vistaGrilla === 'semana'}">Semana tipo</button><button data-vista="mes" aria-pressed="${S.vistaGrilla === 'mes'}">Calendario del mes</button></div>
        <button class="btn ghost" id="cargar-oficial">${vacia ? 'Cargar grilla oficial' : 'Sumar clases faltantes de la grilla oficial'}</button>
        <button class="btn" id="nueva-clase">+ Clase</button></div></div>
    ${vacia ? '<div class="aviso"><div><b>La grilla está vacía.</b><span>Tocá "Cargar grilla oficial" para traer Sede, Anexo y Clases aranceladas.</span></div></div>' : ''}
    <div id="contenido-grilla"></div>`;
  $$('[data-vista]', v).forEach(b => b.onclick = () => { S.vistaGrilla = b.dataset.vista; render(); });
  $('#nueva-clase').onclick = () => editarClase({ sede: S.sede, dia: 1, desde: '08:00', hasta: '09:00', actividad: '' });
  $('#cargar-oficial').onclick = async () => {
    const faltan = GRILLA_BASE.filter(c => !S.clases.some(x => x.id === c.id));
    if (!faltan.length) return toast('La grilla ya tiene todas las clases oficiales');
    await lote(faltan.map(c => ({ c: 'clases', id: c.id, data: c })));
    toast(`${faltan.length} clases cargadas`);
  };
  const c = $('#contenido-grilla');
  S.vistaGrilla === 'semana' ? grillaSemana(c) : grillaMes(c);
}

function grillaSemana(v) {
  const cs = S.clases.filter(c => c.sede === S.sede);
  const horas = [...new Set(cs.map(c => c.desde))].sort();
  const confl = new Set();
  for (const p of activos()) for (const [a, b] of conflictos(p, S.clases)) { if (a.claseId) confl.add(a.claseId); if (b.claseId) confl.add(b.claseId); }
  const sedes = [...new Set([...SEDES, ...S.clases.map(c => c.sede)])];
  v.innerHTML = `<div class="acciones" style="margin-bottom:12px"><div class="seg" role="group" aria-label="Sede">${sedes.map(s => `<button data-sede="${esc(s)}" aria-pressed="${S.sede === s}">${esc(s)}</button>`).join('')}</div>
      <span class="leyenda"><span><span class="pill sin">borde rojo</span> sin profesor</span><span><span class="pill pendiente">borde amarillo</span> choque de horario</span></span></div>
    <div class="tabla-wrap"><table class="grilla"><thead><tr><th>Hora</th>${DIAS_LABORABLES.map(d => `<th>${DIAS_CORTOS[d]}</th>`).join('')}</tr></thead><tbody>
    ${horas.map(h => `<tr><td class="hora">${h}</td>${DIAS_LABORABLES.map(d => `<td>${cs.filter(c => c.desde === h && c.dia === d).map(c => `
      <div class="celda ${!c.profesor ? 'sin-profe' : ''} ${confl.has(c.id) ? 'conflicto' : ''}">
        <div class="act"><span>${esc(c.actividad)}</span><button data-editar-clase="${c.id}" aria-label="Editar clase">✎</button></div>
        <select data-asignar="${c.id}" aria-label="Profesor de ${esc(c.actividad)}">${opcionesProfe(c)}</select>
        ${confl.has(c.id) ? '<span class="nota">Choca con otro horario</span>' : ''}
        ${c.profesor && !(P(c.profesor)?.actividades || []).includes(c.actividad) ? '<span class="nota">No figura que dé esta actividad</span>' : ''}
      </div>`).join('')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="7"><p class="vacio">No hay clases en ${esc(S.sede)}.</p></td></tr>`}
    </tbody></table></div>`;
  $$('[data-sede]', v).forEach(b => b.onclick = () => { S.sede = b.dataset.sede; render(); });
  $$('[data-asignar]', v).forEach(s => s.onchange = async () => {
    try { await actualizar('clases', s.dataset.asignar, { profesor: s.value }); toast(s.value ? `Asignada a ${nom(s.value)}` : 'Clase sin profesor'); }
    catch { toast('No se pudo guardar', true); }
  });
  $$('[data-editar-clase]', v).forEach(b => b.onclick = () => editarClase(S.clases.find(c => c.id === b.dataset.editarClase)));
}

function editarClase(c) {
  const nueva = !c.id;
  const acts = [...new Set([...ACTIVIDADES_BASE, ...S.clases.map(x => x.actividad)])].sort();
  const m = modal(`${cabModal(nueva ? 'Nueva clase' : 'Editar clase')}<div class="form">
    <div class="fila"><label>Sede<select id="c-sede">${[...new Set([...SEDES, c.sede])].map(s => `<option ${s === c.sede ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label>Día<select id="c-dia">${DIAS_LABORABLES.map(d => `<option value="${d}" ${d === c.dia ? 'selected' : ''}>${DIAS[d]}</option>`).join('')}</select></label></div>
    <label>Actividad<input id="c-act" list="lista-acts" value="${esc(c.actividad)}"><datalist id="lista-acts">${acts.map(a => `<option value="${esc(a)}">`).join('')}</datalist></label>
    <div class="fila"><label>Desde<input id="c-desde" type="time" step="900" value="${c.desde}"></label><label>Hasta<input id="c-hasta" type="time" step="900" value="${c.hasta}"></label></div>
    <label>Profesor<select id="c-profe">${opcionesProfe(c)}</select></label></div>
    <div class="modal-pie">${!nueva ? '<button class="btn ghost" id="c-borrar" style="margin-right:auto">Eliminar clase</button>' : ''}<button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="c-ok">Guardar</button></div>`);
  $('#c-desde', m.el).onchange = e => { if (nueva) $('#c-hasta', m.el).value = sumarMin(e.target.value, DURACION_CLASE); };
  $('#c-ok', m.el).onclick = async () => {
    const d = { sede: $('#c-sede', m.el).value, dia: +$('#c-dia', m.el).value, actividad: $('#c-act', m.el).value.trim(), desde: $('#c-desde', m.el).value, hasta: $('#c-hasta', m.el).value, profesor: $('#c-profe', m.el).value };
    if (!d.actividad || !d.desde || !d.hasta) return toast('Completá actividad y horario', true);
    if (min(d.hasta) <= min(d.desde)) return toast('La clase tiene que terminar después de empezar', true);
    try { await guardar('clases', c.id || idClase(d), d); m.cerrar(); toast('Clase guardada'); } catch { toast('No se pudo guardar', true); }
  };
  $('#c-borrar', m.el)?.addEventListener('click', async () => {
    if (await confirmar(`¿Eliminar ${esc(c.actividad)} del ${DIAS[c.dia]} ${c.desde}?`, { si: 'Eliminar', peligro: true })) { await borrar('clases', c.id); m.cerrar(); toast('Clase eliminada'); }
  });
}

// Calendario de clases del mes: quién da cada clase cada día
function estadoDelDia(fecha) {
  const dia = deIso(fecha).getDay();
  const cs = S.clases.filter(c => c.dia === dia).sort((a, b) => a.desde.localeCompare(b.desde) || a.sede.localeCompare(b.sede));
  return cs.map(c => {
    const tit = c.profesor;
    const aus = tit && ausenteEn(tit, fecha, S.ausencias);
    const r = aus ? S.reemplazos.find(r => r.titular === tit && r.fecha === fecha && r.desde === c.desde && (r.actividad || '') === c.actividad) : null;
    return { c, tit, aus, r, ok: !!tit && (!aus || !!r) };
  });
}
function navMes(clave, etiqueta) {
  const [y, mm] = S[clave].split('-').map(Number);
  return `<div class="acciones"><button class="btn sm ghost" data-mes="-1" aria-label="Mes anterior">‹</button><h2 style="min-width:190px;text-align:center;text-transform:capitalize">${MESES[mm - 1]} ${y}</h2><button class="btn sm ghost" data-mes="1" aria-label="Mes siguiente">›</button>${etiqueta || ''}</div>`;
}
function enlazarNavMes(v, clave, alCambiar) {
  $$('[data-mes]', v).forEach(b => b.onclick = () => {
    const [y, m] = S[clave].split('-').map(Number);
    S[clave] = mesDe(new Date(y, m - 1 + +b.dataset.mes, 1));
    alCambiar?.(); render();
  });
}
function diasCalendario(mesClave) {
  const [y, m] = mesClave.split('-').map(Number);
  const primero = new Date(y, m - 1, 1);
  const ini = sumarDias(primero, -((primero.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => sumarDias(ini, i)).filter((d, i, arr) => i < 35 || arr[35].getMonth() === m - 1);
}
function grillaMes(v) {
  const [, m] = S.mesGrilla.split('-').map(Number);
  const h = hoy();
  v.innerHTML = `${navMes('mesGrilla')}
    <div class="leyenda" style="margin:10px 0"><span><span class="ev neutro">12 clases</span> todo cubierto</span><span><span class="ev vacaciones aprobada">reemplazo</span> clase con reemplazo</span><span><span class="ev sin">sin cubrir</span> falta profesor</span></div>
    <div class="cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="dn">${d}</div>`).join('')}
    ${diasCalendario(S.mesGrilla).map(d => {
      const f = iso(d); const est = estadoDelDia(f);
      const sin = est.filter(x => !x.ok).length, rem = est.filter(x => x.r).length;
      return `<button class="d ${d.getMonth() !== m - 1 ? 'fuera' : ''} ${d.getDay() === 0 ? 'dom' : ''} ${f === h ? 'hoy' : ''}" data-dia="${f}">
        <span class="n">${d.getDate()}</span>
        ${est.length ? `<span class="ev neutro">${est.length} clases</span>` : ''}
        ${rem ? `<span class="ev vacaciones aprobada">${rem} reemplazo${rem > 1 ? 's' : ''}</span>` : ''}
        ${sin ? `<span class="ev sin">${sin} sin cubrir</span>` : ''}</button>`;
    }).join('')}</div>`;
  enlazarNavMes(v, 'mesGrilla');
  $$('[data-dia]', v).forEach(b => b.onclick = () => verDia(b.dataset.dia));
}
function verDia(f) {
  const est = estadoDelDia(f);
  const dia = deIso(f).getDay();
  const turnos = activos().flatMap(p => (p.horarios || []).filter(s => s.dia === dia).map(s => ({ ...s, p })));
  modal(`${cabModal(fechaLarga(f))}
    ${est.length ? `<div class="tabla-wrap"><table><thead><tr><th>Hora</th><th>Clase</th><th>Da la clase</th></tr></thead><tbody>
      ${est.map(x => `<tr><td class="mono">${x.c.desde}</td><td>${esc(x.c.actividad)} <span class="sub">· ${esc(x.c.sede)}</span></td>
        <td>${!x.tit ? '<span class="pill sin">Sin profesor</span>' : x.aus ? (x.r ? `${esc(nom(x.r.reemplazo))} <span class="pill info">reemplaza a ${esc(nom(x.tit))}</span>` : `<span class="pill sin">${esc(nom(x.tit))} ausente · sin cubrir</span>`) : esc(nom(x.tit))}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="vacio">No hay clases este día.</p>'}
    ${turnos.length ? `<h4>Turnos fijos</h4><div class="lista">${turnos.sort((a, b) => a.desde.localeCompare(b.desde)).map(t => {
      const aus = ausenteEn(t.p.email, f, S.ausencias);
      const r = aus && S.reemplazos.find(r => r.titular === t.p.email && r.fecha === f && r.desde === t.desde);
      return `<div class="item"><span><span class="rol rol-${t.rol}">${ROL_CORTO[t.rol]}</span> <span class="mono">${t.desde}–${t.hasta}</span> ${esc(nombreCompleto(t.p))}</span>
        ${aus ? (r ? `<span class="pill info">cubre ${esc(nom(r.reemplazo))}</span>` : '<span class="pill sin">ausente · sin cubrir</span>') : ''}</div>`;
    }).join('')}</div>` : ''}
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cerrar</button></div>`, { ancho: true });
}

// ============================================================ VACACIONES Y AUSENCIAS
function vVacaciones(v) {
  const [, m] = S.mesCal.split('-').map(Number);
  const h = hoy();
  const pend = pendientesAus().sort((a, b) => a.desde.localeCompare(b.desde));
  const visibles = S.ausencias.filter(a => a.estado !== 'rechazada');
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Calendario de gerencia</span><h1>Vacaciones y ausencias</h1></div>
      <div class="acciones"><button class="btn" id="cargar-aus">+ Cargar ausencia</button></div></div>
    ${pend.length ? `<div class="panel"><h3>Pedidos por responder (${pend.length})</h3><div class="lista">${pend.map(a => {
      const necs = necesidades(a, P(a.email), S.clases);
      const choques = S.ausencias.filter(x => x.id !== a.id && x.estado === 'aprobada' && x.desde <= a.hasta && x.hasta >= a.desde);
      return `<div class="item"><div><b>${esc(a.nombre || nom(a.email))} · ${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'}</b>
        <span class="sub"><span class="mono">${rangoTexto(a.desde, a.hasta)}</span> · ${diasEntre(a.desde, a.hasta)} día(s) · ${necs.length} turnos/clases a cubrir${a.motivo ? ' · ' + esc(a.motivo) : ''}</span>
        ${choques.length ? `<span class="sub" style="color:var(--warn)">Esos días también falta: ${esc(choques.map(x => x.nombre || nom(x.email)).join(', '))}</span>` : ''}</div>
        <div class="acciones"><button class="btn sm ghost" data-ver-aus="${a.id}">Ver detalle</button><button class="btn sm ok" data-aprobar-aus="${a.id}">Aprobar</button><button class="btn sm ghost" data-rechazar-aus="${a.id}">Rechazar</button></div></div>`;
    }).join('')}</div></div>` : ''}
    <div class="panel">
      ${navMes('mesCal', '<span class="leyenda" style="margin-left:auto"><span class="ev vacaciones aprobada">Vacaciones</span><span class="ev aprobada">Ausencia</span><span class="ev pendiente">Pendiente</span></span>')}
      <div class="cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="dn">${d}</div>`).join('')}
      ${diasCalendario(S.mesCal).map(d => {
        const f = iso(d); const del = visibles.filter(a => a.desde <= f && a.hasta >= f);
        return `<div class="d ${d.getMonth() !== m - 1 ? 'fuera' : ''} ${d.getDay() === 0 ? 'dom' : ''} ${f === h ? 'hoy' : ''}" style="cursor:default">
          <span class="n">${d.getDate()}</span>
          ${del.slice(0, 3).map(a => `<button class="ev ${a.tipo} ${a.estado}" data-ver-aus="${a.id}" title="${esc((a.nombre || nom(a.email)) + ' · ' + (a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia') + ' · ' + ESTADOS[a.estado])}" style="border:0;cursor:pointer;text-align:left;font-family:inherit">${esc((a.nombre || nom(a.email)).split(' ')[0])}${(() => { const q = quienCubre(a, f); return q.length ? ' → ' + esc(q.map(x => x.nombre.split(' ')[0]).join(', ')) : ''; })()}</button>`).join('')}
          ${del.length > 3 ? `<button class="ev mas" data-dia-aus="${f}" style="border:0;cursor:pointer;font-family:inherit">+${del.length - 3} más</button>` : ''}</div>`;
      }).join('')}</div>
    </div>
    <div class="panel"><h3>Próximas ausencias aprobadas</h3>${(() => {
      const prox = S.ausencias.filter(a => a.estado === 'aprobada' && a.hasta >= h).sort((a, b) => a.desde.localeCompare(b.desde));
      return prox.length ? `<div class="lista">${prox.map(a => {
        const necs = necesidades(a, P(a.email), S.clases).filter(n => n.fecha >= h);
        const sin = necs.filter(n => !cubierto(n, S.reemplazos)).length;
        return `<div class="item"><div><b>${esc(a.nombre || nom(a.email))}</b><span class="sub">${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span></span>${htmlCubren(a)}</div>
          <div class="acciones">${necs.length ? `<span class="pill ${sin ? 'sin' : 'cubierto'}">${sin ? `${sin} de ${necs.length} sin cubrir` : 'Todo cubierto'}</span>` : '<span class="pill neutro">Sin turnos</span>'}<button class="btn sm ghost" data-ver-aus="${a.id}">Detalle</button></div></div>`;
      }).join('')}</div>` : '<p class="vacio">No hay ausencias aprobadas por delante.</p>';
    })()}</div>
    ${htmlHistorial()}`;
  enlazarNavMes(v, 'mesCal');
  $('#cargar-aus').onclick = () => cargarAusencia();
  $('#h-anio').onchange = e => { S.histAnio = e.target.value; render(); };
  $('#h-persona').onchange = e => { S.histPersona = e.target.value; render(); };
  $$('[data-ver-aus]', v).forEach(b => b.onclick = () => verAusencia(S.ausencias.find(a => a.id === b.dataset.verAus)));
  $$('[data-aprobar-aus]', v).forEach(b => b.onclick = () => responder(S.ausencias.find(a => a.id === b.dataset.aprobarAus), true));
  $$('[data-rechazar-aus]', v).forEach(b => b.onclick = () => responder(S.ausencias.find(a => a.id === b.dataset.rechazarAus), false));
  $$('[data-dia-aus]', v).forEach(b => b.onclick = () => {
    const f = b.dataset.diaAus; const del = visibles.filter(a => a.desde <= f && a.hasta >= f);
    const mm = modal(`${cabModal(fechaLarga(f))}<div class="lista">${del.map(a => `<div class="item"><span>${esc(a.nombre || nom(a.email))} · ${a.tipo}</span><button class="btn sm ghost" data-ver-aus="${a.id}">Detalle</button></div>`).join('')}</div>`);
    $$('[data-ver-aus]', mm.el).forEach(x => x.onclick = () => { mm.cerrar(); verAusencia(S.ausencias.find(a => a.id === x.dataset.verAus)); });
  });
}

// Quién cubre una ausencia (opcionalmente solo un día): "Pablo Romero (Indoor Cycle ×3)"
function quienCubre(a, fecha = null) {
  const rs = S.reemplazos.filter(r => r.ausenciaId === a.id && (!fecha || r.fecha === fecha));
  const por = {};
  for (const r of rs) {
    const k = r.reemplazo; por[k] = por[k] || {};
    const q = r.rol === 'clases' ? r.actividad : ROL_CORTO[r.rol];
    por[k][q] = (por[k][q] || 0) + 1;
  }
  return Object.entries(por).map(([e, qs]) => ({ email: e, nombre: nom(e), detalle: Object.entries(qs).map(([q, n]) => `${q} ×${n}`).join(', ') }));
}
function htmlCubren(a) {
  const qc = quienCubre(a);
  return qc.length ? `<span class="sub">Cubre: ${qc.map(x => `<b style="color:var(--fg)">${esc(x.nombre)}</b> (${esc(x.detalle)})`).join(' · ')}</span>` : '';
}

function htmlHistorial() {
  const anios = [...new Set([String(new Date().getFullYear()), ...S.ausencias.map(a => a.desde.slice(0, 4))])].sort().reverse();
  const anio = S.histAnio || anios[0];
  const lista = S.ausencias.filter(a => a.desde.slice(0, 4) === anio && (!S.histPersona || a.email === S.histPersona))
    .sort((a, b) => b.desde.localeCompare(a.desde));
  const tot = {};
  for (const a of lista.filter(x => x.estado === 'aprobada')) {
    const t = tot[a.email] = tot[a.email] || { nombre: a.nombre || nom(a.email), vac: 0, aus: 0 };
    t[a.tipo === 'vacaciones' ? 'vac' : 'aus'] += diasEntre(a.desde, a.hasta);
  }
  const personas = [...new Set(S.ausencias.map(a => a.email))].map(e => [e, nom(e)]).sort((a, b) => a[1].localeCompare(b[1]));
  return `<div class="panel"><div class="cab"><h3>Historial</h3><div class="acciones">
      <select id="h-anio" style="width:auto">${anios.map(y => `<option ${y === anio ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select id="h-persona" style="width:auto"><option value="">Todo el personal</option>${personas.map(([e, n]) => `<option value="${esc(e)}" ${e === S.histPersona ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
    ${Object.keys(tot).length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th class="num">Días de vacaciones ${anio}</th><th class="num">Días de ausencia ${anio}</th></tr></thead><tbody>
      ${Object.values(tot).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(t => `<tr><td>${esc(t.nombre)}</td><td class="num mono">${t.vac}</td><td class="num mono">${t.aus}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${lista.length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th>Tipo</th><th>Fechas</th><th class="num">Días</th><th>Estado</th><th>Quién cubrió</th><th></th></tr></thead><tbody>
      ${lista.map(a => `<tr><td>${esc(a.nombre || nom(a.email))}</td><td>${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'}${a.cargadaPorGerencia ? ' <span class="pill neutro">cargada por gerencia</span>' : ''}</td>
        <td class="mono">${rangoTexto(a.desde, a.hasta)}</td><td class="num mono">${diasEntre(a.desde, a.hasta)}</td><td><span class="pill ${a.estado}">${ESTADOS[a.estado]}</span></td>
        <td class="sub">${esc(quienCubre(a).map(x => x.nombre).join(', ') || '—')}</td><td><button class="btn sm ghost" data-ver-aus="${a.id}">Ver</button></td></tr>`).join('')}</tbody></table></div>`
      : `<p class="vacio">Sin vacaciones ni ausencias en ${anio}.</p>`}
    <p class="sub">Todo queda guardado: elegí otro año para ver las anteriores. En el calendario de arriba podés ir a meses pasados con ‹.</p></div>`;
}

function htmlTipoReemplazo(necs) {
  const t = tipoReemplazo(necs);
  const ks = Object.keys(t);
  if (!ks.length) return '<p class="sub">No tiene turnos ni clases en esas fechas: no hace falta reemplazo.</p>';
  return `<div class="resumen-tipo">${ks.map(k => `<div class="bloque-tipo"><b>${k}</b><span>${Object.entries(t[k]).map(([s, n]) => s === 'turnos' ? `${n} turno${n > 1 ? 's' : ''}` : `${esc(s)} ×${n}`).join(' · ')}</span></div>`).join('')}</div>`;
}

function verAusencia(a) {
  if (!a) return;
  const p = P(a.email);
  const necs = necesidades(a, p, S.clases);
  const sin = necs.filter(n => !cubierto(n, S.reemplazos)).length;
  const m = modal(`${cabModal(a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia')}
    <div class="persona"><div class="avatar">${esc(iniciales(p || { nombre: a.nombre }))}</div><div><b>${esc(a.nombre || nom(a.email))}</b><div>${p ? chipsRoles(p) : ''}</div></div>
      <span class="pill ${a.estado}" style="margin-left:auto">${ESTADOS[a.estado]}</span></div>
    <p><b class="mono">${rangoTexto(a.desde, a.hasta)}</b> · ${diasEntre(a.desde, a.hasta)} día(s)${a.motivo ? `<br><span class="sub">Motivo: ${esc(a.motivo)}</span>` : ''}${a.nota ? `<br><span class="sub">Nota de gerencia: ${esc(a.nota)}</span>` : ''}</p>
    ${p ? htmlContacto(p) : ''}
    ${a.estado === 'aprobada' && necs.length ? `<div style="display:grid;gap:8px"><h4>Quién cubre</h4><div class="tabla-wrap"><table><thead><tr><th>Día</th><th>Horario</th><th>Qué</th><th>Cubre</th></tr></thead><tbody>
      ${necs.map(n => { const r = cubierto(n, S.reemplazos); return `<tr><td>${fechaCorta(n.fecha).slice(0, 5)} ${DIAS_CORTOS[n.dia]}</td><td class="mono">${n.desde}–${n.hasta}</td><td>${esc(n.rol === 'clases' ? queCubre(n) : ROL_CORTO[n.rol])}</td>
        <td>${r ? `<b>${esc(nom(r.reemplazo))}</b>` : '<span class="pill sin">Sin cubrir</span>'}</td></tr>`; }).join('')}
    </tbody></table></div></div>` : ''}
    <div style="display:grid;gap:8px"><h4>Reemplazo que necesita</h4>${htmlTipoReemplazo(necs)}
      ${a.estado === 'aprobada' && necs.length ? `<span class="sub">${sin ? `${sin} de ${necs.length} todavía sin cubrir.` : 'Todo cubierto.'}</span>` : ''}</div>
    <div class="modal-pie"><button class="btn ghost" id="a-borrar" style="margin-right:auto">Eliminar</button>
      ${a.estado !== 'rechazada' ? '<button class="btn ghost" id="a-rech">Rechazar</button>' : ''}
      ${a.estado !== 'aprobada' ? '<button class="btn ok" id="a-apr">Aprobar</button>' : ''}
      ${a.estado === 'aprobada' && necs.length ? '<button class="btn" id="a-rem">Asignar reemplazos</button>' : ''}</div>`, { ancho: true });
  $('#a-apr', m.el)?.addEventListener('click', () => { m.cerrar(); responder(a, true); });
  $('#a-rech', m.el)?.addEventListener('click', () => { m.cerrar(); responder(a, false); });
  $('#a-rem', m.el)?.addEventListener('click', () => { m.cerrar(); S.soloSinCubrir = true; irA('reemplazos'); });
  $('#a-borrar', m.el).onclick = async () => {
    const rs = S.reemplazos.filter(r => r.ausenciaId === a.id);
    if (!(await confirmar(`¿Eliminar este registro${rs.length ? ` y sus ${rs.length} reemplazo(s) asignados` : ''}?`, { si: 'Eliminar', peligro: true }))) return;
    await lote([{ c: 'ausencias', id: a.id, borrar: true }, ...rs.map(r => ({ c: 'reemplazos', id: r.id, borrar: true }))]);
    m.cerrar(); toast('Eliminado');
  };
}

function responder(a, aprobar) {
  const p = P(a.email) || { nombre: (a.nombre || '').split(' ')[0], email: a.email };
  const necs = necesidades(a, P(a.email), S.clases);
  const m = modal(`${cabModal(aprobar ? 'Aprobar pedido' : 'Rechazar pedido')}
    <p><b>${esc(a.nombre || nom(a.email))}</b> · ${a.tipo === 'vacaciones' ? 'vacaciones' : 'ausencia'} del <span class="mono">${rangoTexto(a.desde, a.hasta)}</span></p>
    ${aprobar ? `<div style="display:grid;gap:6px"><h4>Al aprobar, el sistema detecta este reemplazo</h4>${htmlTipoReemplazo(necs)}</div>` : ''}
    <label>${aprobar ? 'Nota para el correo (opcional)' : 'Motivo del rechazo'}<textarea id="r-nota" rows="3"></textarea></label>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn ${aprobar ? 'ok' : ''}" id="r-ok">${aprobar ? 'Aprobar' : 'Rechazar'}</button></div>`);
  $('#r-ok', m.el).onclick = async () => {
    const nota = $('#r-nota', m.el).value.trim();
    if (!aprobar && !nota) return toast('Escribí el motivo del rechazo', true);
    try { await actualizar('ausencias', a.id, { estado: aprobar ? 'aprobada' : 'rechazada', nota, respondida: AHORA, respondidaPor: S.user.email }); }
    catch { return toast('No se pudo guardar', true); }
    m.cerrar();
    const t = mailRespuesta(a, p, aprobar, nota);
    const m2 = modal(`${cabModal(aprobar ? 'Pedido aprobado' : 'Pedido rechazado')}
      <p>Avisale a ${esc(p.nombre || a.email)} la respuesta formal por correo:</p>
      <div class="correo"><div class="campo"><span>Para</span><input readonly value="${esc(a.email)}"></div><div class="campo"><span>Asunto</span><input readonly value="${esc(t.asunto)}"></div><textarea readonly rows="7">${esc(t.cuerpo)}</textarea></div>
      <div class="modal-pie"><button class="btn ghost" data-cerrar>Cerrar</button>
        ${P(a.email)?.telefono ? `<a class="btn ghost" target="_blank" rel="noopener" href="${waLink(P(a.email).telefono, t.cuerpo)}">WhatsApp</a>` : ''}
        ${sinCorreo(P(a.email)) ? '' : `<button class="btn" id="r-mail">${envioAutomatico(S.config) ? 'Enviar correo' : 'Abrir correo'}</button>`}
        ${aprobar && necs.length ? '<button class="btn ok" id="ir-rem">Asignar reemplazos</button>' : ''}</div>`);
    $('#ir-rem', m2.el)?.addEventListener('click', () => { m2.cerrar(); irA('reemplazos'); });
    $('#r-mail', m2.el)?.addEventListener('click', async e => {
      const como = await enviarCorreo(S.config, { para: a.email, cc: S.config.correoCC || '', asunto: t.asunto, cuerpo: t.cuerpo, responderA: S.config.correoGerencia || '' });
      if (como === 'auto') { e.target.textContent = 'Correo enviado ✓'; e.target.disabled = true; toast(`Correo enviado a ${a.email}`); }
    });
  };
}

function cargarAusencia(email = '') {
  const m = modal(`${cabModal('Cargar ausencia')}<p class="sub">Para cuando avisan por teléfono o en persona. Queda aprobada directamente.</p>
    <div class="form"><label>Persona<select id="ca-p">${activos().sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))).map(p => `<option value="${esc(p.email)}" ${p.email === email ? 'selected' : ''}>${esc(nombreCompleto(p))}</option>`).join('')}</select></label>
      <div class="fila"><label>Tipo<select id="ca-t"><option value="ausencia">Ausencia</option><option value="vacaciones">Vacaciones</option></select></label>
        <label>Desde<input type="date" id="ca-d" value="${hoy()}"></label><label>Hasta<input type="date" id="ca-h" value="${hoy()}"></label></div>
      <label>Motivo<input id="ca-m"></label></div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="ca-ok">Guardar</button></div>`);
  $('#ca-d', m.el).onchange = e => { if ($('#ca-h', m.el).value < e.target.value) $('#ca-h', m.el).value = e.target.value; };
  $('#ca-ok', m.el).onclick = async () => {
    const e = $('#ca-p', m.el).value, desde = $('#ca-d', m.el).value, hasta = $('#ca-h', m.el).value;
    if (!e || !desde || !hasta || hasta < desde) return toast('Revisá persona y fechas', true);
    await agregar('ausencias', { email: e, nombre: nom(e), tipo: $('#ca-t', m.el).value, desde, hasta, motivo: $('#ca-m', m.el).value.trim(), estado: 'aprobada', creado: AHORA, respondida: AHORA, respondidaPor: S.user.email, cargadaPorGerencia: true });
    m.cerrar(); toast('Ausencia cargada');
  };
}

// ============================================================ REEMPLAZOS
function vReemplazos(v) {
  const h = hoy();
  const aus = S.ausencias.filter(a => a.estado === 'aprobada' && a.hasta >= h).sort((a, b) => a.desde.localeCompare(b.desde));
  const bloques = aus.map(a => {
    const necs = necesidades(a, P(a.email), S.clases).filter(n => n.fecha >= h).map(n => ({ ...n, r: cubierto(n, S.reemplazos) }));
    return { a, necs, mostrar: S.soloSinCubrir ? necs.filter(n => !n.r) : necs };
  }).filter(b => b.necs.length);
  const total = bloques.reduce((t, b) => t + b.necs.filter(n => !n.r).length, 0);
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Detección automática</span><h1>Reemplazos</h1>
      <p class="sub">${total ? `${total} turnos o clases sin cubrir.` : 'Todo cubierto.'} El sistema propone a quien tiene el mismo rol, da esa actividad, no está de vacaciones y está libre en ese horario.</p></div>
      <div class="seg" role="group" aria-label="Filtro"><button data-f="1" aria-pressed="${S.soloSinCubrir}">Sin cubrir</button><button data-f="0" aria-pressed="${!S.soloSinCubrir}">Todos</button></div></div>
    ${bloques.length ? bloques.map(({ a, necs, mostrar }) => {
      const p = P(a.email);
      return `<div class="panel">
        <div class="cab"><div class="persona"><div class="avatar">${esc(iniciales(p || { nombre: a.nombre }))}</div><div><b>${esc(a.nombre || nom(a.email))}</b>
          <span class="sub">${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span></span></div></div>
          <span class="pill ${necs.some(n => !n.r) ? 'sin' : 'cubierto'}">${necs.filter(n => n.r).length}/${necs.length} cubiertos</span></div>
        <div style="display:grid;gap:6px"><span class="eyebrow">Necesita</span>${htmlTipoReemplazo(necs.filter(n => !n.r).length ? necs.filter(n => !n.r) : necs)}</div>
        <div>${mostrar.length ? mostrar.map(n => htmlNecesidad(n)).join('') : '<p class="vacio">Todo cubierto.</p>'}</div></div>`;
    }).join('') : '<p class="vacio">No hay ausencias aprobadas con turnos por delante.</p>'}`;
  $$('[data-f]', v).forEach(b => b.onclick = () => { S.soloSinCubrir = b.dataset.f === '1'; render(); });
  $$('[data-asignar-r]', v).forEach(b => b.onclick = () => asignar(JSON.parse(b.dataset.n), b.dataset.asignarR));
  $$('[data-quitar-r]', v).forEach(b => b.onclick = async () => { await borrar('reemplazos', b.dataset.quitarR); toast('Reemplazo quitado'); });
  $$('[data-mas]', v).forEach(b => b.onclick = () => { b.closest('.nec').querySelectorAll('.cand[hidden]').forEach(c => { c.hidden = false; }); b.remove(); });
  $$('[data-manual]', v).forEach(b => b.onclick = () => asignarManual(JSON.parse(b.dataset.manual)));
  enlazarFichas(v);
}

function htmlNecesidad(n) {
  const nd = esc(JSON.stringify({ fecha: n.fecha, dia: n.dia, desde: n.desde, hasta: n.hasta, rol: n.rol, actividad: n.actividad, sede: n.sede, claseId: n.claseId, titular: n.titular, ausenciaId: n.ausenciaId }));
  const cab = `<div class="nec-cab"><b>${fechaLarga(n.fecha)}</b><span class="mono">${n.desde}–${n.hasta}</span><span class="rol rol-${n.rol}">${ROL_CORTO[n.rol]}</span><span>${esc(n.rol === 'clases' ? queCubre(n) : ROLES[n.rol])}</span></div>`;
  if (n.r) {
    const q = P(n.r.reemplazo);
    return `<div class="nec">${cab}<div class="acciones"><span class="pill cubierto">Cubre ${esc(nom(n.r.reemplazo))}</span>
      ${q?.telefono ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(q.telefono, textoReemplazo(n, q))}">WhatsApp</a>` : ''}
      <button class="btn sm ghost" data-ficha="${esc(n.r.reemplazo)}">Ficha</button><button class="btn sm ghost" data-quitar-r="${n.r.id}">Quitar</button></div></div>`;
  }
  const cs = candidatos(n, S.personal, S.ausencias, S.reemplazos, S.clases);
  return `<div class="nec">${cab}
    ${cs.length ? `<div class="cands">${cs.map(({ p, carga, disponible }, i) => `<div class="cand" ${i >= 3 ? 'hidden' : ''}>
        <div class="persona"><div class="avatar">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span class="sub mono">${esc(p.telefono || 'sin teléfono')}</span><span class="sub">${esc(p.email)}</span></div></div>
        <span class="sub">${disponible ? '<span class="pill aprobada">Dijo que puede cubrir en ese horario</span> ' : ''}${carga ? `Ya cubre ${carga} este mes` : 'Sin reemplazos este mes'}</span>
        <div class="acciones">
          ${p.telefono ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(p.telefono, textoReemplazo(n, p))}">WhatsApp</a>` : ''}
          <a class="btn sm ghost" href="${mailto(p.email, '', `Reemplazo ${fechaCorta(n.fecha)} ${n.desde}`, textoReemplazo(n, p))}">Correo</a>
          <button class="btn sm ghost" data-ficha="${esc(p.email)}">Ficha</button>
          <button class="btn sm" data-asignar-r="${esc(p.email)}" data-n="${nd}">Asignar</button></div></div>`).join('')}</div>
      ${cs.length > 3 ? `<button class="btn sm ghost" data-mas style="justify-self:start">Ver ${cs.length - 3} más</button>` : ''}`
    : `<div class="aviso mal"><div><b>Nadie disponible con ese perfil.</b><span>No hay ${n.rol === 'clases' ? `profes que den ${esc(n.actividad)}` : esc(ROLES[n.rol].toLowerCase())} libres en ese horario.</span></div></div>`}
    <button class="btn sm ghost" data-manual="${nd}" style="justify-self:start">Elegir otra persona</button></div>`;
}

async function asignar(n, email) {
  const q = P(email);
  const doc = { ...n, titularNombre: nom(n.titular), reemplazo: email, reemplazoNombre: nombreCompleto(q), creado: AHORA, asignadoPor: S.user.email };
  try { await agregar('reemplazos', doc); } catch { return toast('No se pudo asignar', true); }
  toast(`${nombreCompleto(q)} cubre ${queCubre(n)} el ${fechaCorta(n.fecha)}`);
  // ¿Puede cubrir también las demás iguales de esta ausencia?
  const a = S.ausencias.find(x => x.id === n.ausenciaId);
  if (!a) return;
  const otras = necesidades(a, P(a.email), S.clases)
    .filter(x => x.fecha >= hoy() && !(x.fecha === n.fecha && x.desde === n.desde) && x.rol === n.rol && (x.actividad || '') === (n.actividad || '') && !cubierto(x, S.reemplazos))
    .filter(x => candidatos(x, S.personal, S.ausencias, [...S.reemplazos, { ...doc }], S.clases).some(c => c.p.email === email));
  if (otras.length && await confirmar(`${esc(q.nombre)} también está libre para las otras <b>${otras.length}</b> ${n.rol === 'clases' ? esc(n.actividad) : 'turnos'} de esta ausencia. ¿Asignarlas también?`, { si: `Asignar ${otras.length} más` })) {
    await lote(otras.map(x => ({ c: 'reemplazos', id: Math.random().toString(36).slice(2, 14), data: { ...x, titularNombre: nom(x.titular), reemplazo: email, reemplazoNombre: nombreCompleto(q), creado: AHORA, asignadoPor: S.user.email } })));
    toast(`${otras.length + 1} reemplazos asignados a ${q.nombre}`);
  }
}

function asignarManual(n) {
  const todos = activos().filter(p => p.email !== n.titular && !ausenteEn(p.email, n.fecha, S.ausencias)).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
  const m = modal(`${cabModal('Elegir otra persona')}<p class="sub">${fechaLarga(n.fecha)} · <span class="mono">${n.desde}–${n.hasta}</span> · ${esc(queCubre(n))}. Se muestran todos los activos que no están de vacaciones ese día.</p>
    <label>Persona<select id="m-p">${todos.map(p => {
      const ocupado = agenda(p, S.clases).some(s => s.dia === n.dia && seSolapan(s.desde, s.hasta, n.desde, n.hasta));
      return `<option value="${esc(p.email)}">${esc(nombreCompleto(p))} · ${(p.roles || []).map(r => ROL_CORTO[r]).join('/')}${ocupado ? ' · ocupado en ese horario' : ''}</option>`;
    }).join('')}</select></label>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="m-ok">Asignar</button></div>`);
  $('#m-ok', m.el).onclick = () => { const e = $('#m-p', m.el).value; m.cerrar(); if (e) asignar(n, e); };
}

// ============================================================ ASISTENCIA
function vAsistencia(v) {
  const ags = Object.fromEntries(S.personal.map(p => [p.email, agenda(p, S.clases)]));
  const noms = Object.fromEntries(S.personal.map(p => [p.email, nombreCompleto(p)]));
  const js = jornadas(S.fichajes, ags, noms);
  const res = resumenAsistencia(js);
  const det = S.personaAsis ? js.filter(j => j.email === S.personaAsis) : js;
  const faltas = faltasMes();
  const fpp = {}; faltas.forEach(f => { fpp[f.email] = (fpp[f.email] || 0) + 1; });
  for (const e of Object.keys(fpp)) if (!res.some(r => r.email === e)) res.push({ email: e, nombre: nom(e), dias: 0, minutos: 0, tardes: 0, sinSalida: 0 });
  res.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const faltasVer = S.personaAsis ? faltas.filter(f => f.email === S.personaAsis) : faltas;
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Registro del QR · cualquier mes, pasado o actual</span><h1>Asistencia</h1></div>
      <div class="acciones"><label style="flex-direction:row">Mes<input type="month" id="mes" value="${S.mesAsis}" style="width:auto"></label>
        <button class="btn ghost" id="csv">Descargar CSV</button><button class="btn" id="manual">+ Fichaje manual</button></div></div>
    <div class="panel"><h3>Resumen de ${MESES[+S.mesAsis.slice(5) - 1]}</h3>
      ${res.length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th class="num">Días</th><th class="num">Horas</th><th class="num">Llegadas tarde</th><th class="num">Faltas sin aviso</th><th class="num">Sin salida</th></tr></thead><tbody>
      ${res.map(r => `<tr><td><button class="btn sm ghost" data-filtrar="${esc(r.email)}">${esc(r.nombre)}</button></td><td class="num mono">${r.dias}</td><td class="num mono">${fmtMin(r.minutos)}</td>
        <td class="num mono ${r.tardes ? 'tarde' : ''}">${r.tardes}</td><td class="num mono ${fpp[r.email] ? 'tarde' : ''}">${fpp[r.email] || 0}</td><td class="num mono">${r.sinSalida || ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vacio">No hay fichajes este mes.</p>'}
      <p class="sub">Tarde = más de ${TOLERANCIA_TARDE} minutos después del primer turno o clase del día. Falta sin aviso = tenía turno o clase, no fichó y no tenía ausencia aprobada.</p></div>
    ${faltasVer.length ? `<div class="panel"><h3>Faltas sin aviso${S.personaAsis ? ' · ' + esc(nom(S.personaAsis)) : ''} (${faltasVer.length})</h3><div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Tenía</th><th></th></tr></thead><tbody>
      ${faltasVer.slice().reverse().map(f => `<tr><td class="mono">${fechaCorta(f.fecha)}</td><td>${esc(f.nombre)}</td><td><div class="slots">${f.turnos.map(t => `<span class="slot-mini rol-${t.rol}"><span class="mono">${t.desde}</span> ${esc(t.actividad || ROL_CORTO[t.rol])}</span>`).join('')}</div></td>
        <td><button class="btn sm ghost" data-justificar="${esc(f.email)}|${f.fecha}">Justificar</button></td></tr>`).join('')}</tbody></table></div>
      <p class="sub">Si fue un olvido de fichar, cargá el fichaje manual. Si avisó, tocá Justificar y queda como ausencia aprobada.</p></div>` : ''}
    <div class="panel"><div class="cab"><h3>Detalle${S.personaAsis ? ' · ' + esc(nom(S.personaAsis)) : ''}</h3>${S.personaAsis ? '<button class="btn sm ghost" id="todos">Ver todos</button>' : ''}</div>
      ${det.length ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Previsto</th><th>Entrada</th><th>Salida</th><th class="num">Horas</th></tr></thead><tbody>
      ${det.map(j => `<tr><td class="mono">${fechaCorta(j.fecha)}</td><td>${esc(j.nombre)}</td><td class="mono sub">${j.previsto != null ? pad(Math.floor(j.previsto / 60)) + ':' + pad(j.previsto % 60) : ''}</td>
        <td class="mono ${j.tardanza > TOLERANCIA_TARDE ? 'tarde' : ''}">${j.entrada ? horaDe(j.entrada.ts) : '—'}${j.tardanza > TOLERANCIA_TARDE ? ` (+${j.tardanza}′)` : ''}${j.entrada?.manual ? ' <span class="pill neutro">manual</span>' : j.entrada?.metodo === 'pin' ? ' <span class="pill info">PIN</span>' : ''}</td>
        <td class="mono">${j.salida ? horaDe(j.salida.ts) : '<span class="pill pendiente">sin salida</span>'}${j.salida?.manual ? ' <span class="pill neutro">manual</span>' : ''}</td>
        <td class="num mono">${j.minutos != null ? fmtMin(j.minutos) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vacio">Sin registros.</p>'}</div>`;
  $('#mes').onchange = e => { if (!e.target.value) return; S.mesAsis = e.target.value; suscribirMes(); render(); };
  $$('[data-filtrar]', v).forEach(b => b.onclick = () => { S.personaAsis = b.dataset.filtrar; render(); });
  $('#todos')?.addEventListener('click', () => { S.personaAsis = ''; render(); });
  $('#manual').onclick = fichajeManual;
  $$('[data-justificar]', v).forEach(b => b.onclick = async () => {
    const [e, f] = b.dataset.justificar.split('|');
    await agregar('ausencias', { email: e, nombre: nom(e), tipo: 'ausencia', desde: f, hasta: f, motivo: 'Justificada por gerencia', estado: 'aprobada', creado: AHORA, respondida: AHORA, respondidaPor: S.user.email, cargadaPorGerencia: true });
    toast('Falta justificada');
  });
  $('#csv').onclick = () => {
    const filas = [['Fecha', 'Persona', 'Correo', 'Entrada', 'Salida', 'Minutos', 'Tardanza (min)', 'Método']];
    for (const j of [...js].reverse()) filas.push([j.fecha, j.nombre, j.email, j.entrada ? horaDe(j.entrada.ts) : '', j.salida ? horaDe(j.salida.ts) : '', j.minutos ?? '', j.tardanza ?? '', j.entrada?.metodo === 'pin' ? 'PIN recepción' : j.entrada?.manual ? 'Manual' : 'QR']);
    for (const f of faltas) filas.push([f.fecha, f.nombre, f.email, 'FALTA SIN AVISO', '', '', '', '']);
    const csv = '﻿' + filas.map(f => f.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `asistencia-${S.mesAsis}.csv`; a.click();
  };
}

function fichajeManual() {
  const m = modal(`${cabModal('Fichaje manual')}<p class="sub">Para cuando alguien se olvidó de fichar. Queda marcado como manual.</p>
    <div class="form"><label>Persona<select id="fm-p">${activos().sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))).map(p => `<option value="${esc(p.email)}">${esc(nombreCompleto(p))}</option>`).join('')}</select></label>
    <div class="fila"><label>Fecha<input type="date" id="fm-f" value="${hoy()}"></label><label>Hora<input type="time" id="fm-h" value="${pad(new Date().getHours())}:${pad(new Date().getMinutes())}"></label>
      <label>Tipo<select id="fm-t"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label></div></div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="fm-ok">Guardar</button></div>`);
  $('#fm-ok', m.el).onclick = async () => {
    const e = $('#fm-p', m.el).value, f = $('#fm-f', m.el).value, h = $('#fm-h', m.el).value;
    if (!e || !f || !h) return toast('Completá todos los datos', true);
    const [y, mo, d] = f.split('-').map(Number); const [hh, mm] = h.split(':').map(Number);
    const ts = new Date(y, mo - 1, d, hh, mm);
    await agregar('fichajes', { email: e, nombre: nom(e), fecha: f, mes: f.slice(0, 7), tipo: $('#fm-t', m.el).value, ts, token: 'manual', manual: true, cargadoPor: S.user.email, dispositivo: 'gerencia' });
    m.cerrar(); toast('Fichaje cargado');
  };
}

// ============================================================ AJUSTES
function vAjustes(v) {
  const url = f => new URL(f, location.href).href;
  const c = S.config;
  v.innerHTML = `<div class="cab"><div><h1>Ajustes</h1></div></div>
    <div class="grid-2">
      <div class="panel"><h3>A dónde llegan los pedidos</h3>
        <p class="sub">Los pedidos de vacaciones y ausencias van a este correo. Las ausencias de último momento también se pueden avisar por WhatsApp.</p>
        <div class="form"><label>Correo de gerencia<input id="aj-g" type="email" value="${esc(c.correoGerencia || '')}" placeholder="gerencia@…"></label>
          <label>Con copia a (opcional, separados por coma)<input id="aj-cc" value="${esc(c.correoCC || '')}"></label>
          <label>WhatsApp de gerencia<input id="aj-wa" inputmode="tel" value="${esc(c.whatsappGerencia || '')}" placeholder="11 5555-5555"></label>
          <button class="btn" id="aj-ok" style="justify-self:start">Guardar</button></div></div>

      <div class="panel"><div class="cab"><h3>Envío automático de correos</h3><span class="pill ${envioAutomatico(c) ? 'aprobada' : 'neutro'}">${envioAutomatico(c) ? 'Activado' : 'Desactivado'}</span></div>
        <p class="sub">Desactivado: al pedir vacaciones se abre la app de correo del profe con el mensaje listo y él toca Enviar (sale desde su correo).<br>
        Activado: el pedido le llega solo a gerencia, sale desde el Gmail de gerencia con "responder a" el profe. Las respuestas de gerencia también salen solas.</p>
        <p class="sub">Se activa con el archivo <b>correo-automatico.gs</b> (instrucciones adentro, 5 minutos).</p>
        <div class="form"><label>URL del script (termina en /exec)<input id="aj-url" value="${esc(c.correoScriptUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
          <label>Clave<input id="aj-clave" value="${esc(c.correoClave || '')}"></label>
          <div class="acciones"><button class="btn" id="aj-auto">Guardar</button>${envioAutomatico(c) ? '<button class="btn ghost" id="aj-probar">Enviarme un correo de prueba</button>' : ''}</div></div></div>

      <div class="panel"><h3>Links de cada app</h3><div class="lista">
        ${[['App del profe (censo, fichar, pedidos)', 'profesor.html'], ['Panel de gerencia', 'gerencia.html'], ['QR de recepción (PC)', 'tablet.html']].map(([t, f]) => `<div class="item"><div><b>${t}</b><span class="sub mono" style="overflow-wrap:anywhere">${esc(url(f))}</span></div><button class="btn sm ghost" data-copiar="${esc(url(f))}">Copiar</button></div>`).join('')}
      </div></div>

      <div class="panel"><h3>Otras cuentas de gerencia</h3><p class="sub">Pueden ver todo y aprobar. Tienen que entrar con ese correo de Google.</p>
        <div class="lista">${S.admins.map(a => `<div class="item"><span>${esc(a.id)}</span><button class="btn sm ghost" data-quitar-admin="${esc(a.id)}">Quitar</button></div>`).join('') || '<p class="sub">Solo las cuentas fijas de la configuración.</p>'}</div>
        <div class="acciones"><input id="aj-admin" type="email" placeholder="correo@gmail.com" style="flex:1;min-width:0"><button class="btn ghost" id="aj-add">Agregar</button></div></div>

      <div class="panel"><h3>Cuenta de recepción</h3><p class="sub">Para la PC de recepción. <b>Solo puede mostrar el QR</b> y fichar con PIN a quien no tiene celular. No ve el panel de gerencia ni los datos del personal.</p>
        <p class="sub">Creá un Gmail solo para esto (por ejemplo, recepcion.coghlan@gmail.com), agregalo acá y entrá con él en la PC de recepción.</p>
        <div class="lista">${S.recepcion.map(a => `<div class="item"><span>${esc(a.id)}</span><button class="btn sm ghost" data-quitar-rec="${esc(a.id)}">Quitar</button></div>`).join('') || '<p class="sub">Todavía no hay cuenta de recepción.</p>'}</div>
        <div class="acciones"><input id="aj-rec" type="email" placeholder="recepcion@gmail.com" style="flex:1;min-width:0"><button class="btn ghost" id="aj-rec-add">Agregar</button></div></div>

      <div class="panel"><h3>Datos y respaldo</h3>
        <p class="sub">Todo se guarda en la base de datos del club en Google (Firebase), no en los celulares. No se borra nada solo: fichas, grilla, vacaciones, reemplazos y fichajes de todos los meses quedan para siempre.</p>
        <p class="sub">Para tener una copia propia, descargá el respaldo una vez por mes.</p>
        <button class="btn ghost" id="aj-backup" style="justify-self:start">Descargar respaldo completo</button></div>
    </div>`;
  $('#aj-ok').onclick = async () => {
    await guardar('config', 'general', { correoGerencia: $('#aj-g').value.trim(), correoCC: $('#aj-cc').value.trim(), whatsappGerencia: $('#aj-wa').value.trim() }, { merge: true });
    toast('Guardado');
  };
  $('#aj-auto').onclick = async () => {
    const u = $('#aj-url').value.trim();
    if (u && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) return toast('La URL tiene que ser la de script.google.com y terminar en /exec', true);
    await guardar('config', 'general', { correoScriptUrl: u, correoClave: $('#aj-clave').value.trim() }, { merge: true });
    toast(u ? 'Envío automático activado' : 'Envío automático desactivado');
  };
  $('#aj-probar')?.addEventListener('click', async () => {
    await enviarCorreo(S.config, { para: S.config.correoGerencia || S.user.email, asunto: 'Prueba · Coghlan Club', cuerpo: 'Si te llegó este correo, el envío automático funciona.' });
    toast('Correo de prueba enviado. Revisá la bandeja (y spam).');
  });
  $$('[data-copiar]', v).forEach(b => b.onclick = () => copiar(b.dataset.copiar));
  $('#aj-add').onclick = async () => {
    const e = $('#aj-admin').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast('Correo inválido', true);
    await guardar('admins', e, { agregadoPor: S.user.email, creado: AHORA }); toast('Cuenta agregada');
  };
  $$('[data-quitar-admin]', v).forEach(b => b.onclick = async () => { await borrar('admins', b.dataset.quitarAdmin); toast('Cuenta quitada'); });
  $('#aj-rec-add').onclick = async () => {
    const e = $('#aj-rec').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast('Correo inválido', true);
    if (S.admins.some(a => a.id === e)) return toast('Ese correo ya es de gerencia. Usá un Gmail aparte para recepción.', true);
    await guardar('recepcion', e, { agregadoPor: S.user.email, creado: AHORA }); toast('Cuenta de recepción agregada');
  };
  $$('[data-quitar-rec]', v).forEach(b => b.onclick = async () => { await borrar('recepcion', b.dataset.quitarRec); toast('Cuenta quitada'); });
  $('#aj-backup').onclick = async () => {
    try {
      const datos = {};
      for (const c of ['personal', 'clases', 'ausencias', 'reemplazos', 'fichajes', 'config', 'admins', 'recepcion']) datos[c] = await listar(c);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ fecha: new Date().toISOString(), datos }, null, 1)], { type: 'application/json' }));
      a.download = `respaldo-coghlan-personal-${hoy()}.json`; a.click();
      toast('Respaldo descargado');
    } catch (e) { console.error(e); toast('No se pudo descargar el respaldo', true); }
  };
}

if (DEMO) window.__S = S;
export { ROLES_TURNO, iso };

// ============================================================ GUÍA DE USO
let tabAntesDeGuia = 'hoy';
const enTab = tab => () => { if (S.tab !== tab) irA(tab); };
registrarGuia({
  clave: 'gerencia', listo: '.kpis',
  alTerminar: () => irA(tabAntesDeGuia),
  pasos: () => { tabAntesDeGuia = S.tab; return [
    { titulo: 'Bienvenido al panel de gerencia', texto: `<p>Desde acá manejás todo el personal del club: quién trabaja, sus horarios, vacaciones, reemplazos y asistencia.</p>
      <p>Te mostramos cada pestaña y para qué sirve.</p>`,
      tip: 'Avanzá con las flechas del teclado. Con Esc salís cuando quieras.' },
    { sel: '.tabs', antes: enTab('hoy'), titulo: 'Las pestañas', texto: `<p>Cada pestaña es una parte del trabajo.</p>
      <p>El <b>número rojo</b> al lado del nombre te dice cuántas cosas esperan tu respuesta.</p>` },
    { sel: '.kpis', antes: enTab('hoy'), titulo: 'El resumen del día', texto: `<p>Lo más importante de hoy en números: quién está en el club, qué falta aprobar y qué quedó sin cubrir.</p>`,
      tip: 'Las tarjetas se tocan: cada una te lleva directo a la pestaña donde lo resolvés.' },
    { sel: '#vista table', antes: enTab('hoy'), opcional: true, titulo: 'Quién trabaja hoy', texto: `<p>Todo el personal de hoy, con su horario y su estado:</p>
      <ul><li><b>En el club</b>: ya fichó la entrada.</li><li><b>No fichó</b>: pasó su hora y no marcó.</li><li><b>Todavía no llegó</b>: todavía no es su hora.</li><li><b>Ausente</b>: tiene una ausencia aprobada, y dice quién lo cubre.</li></ul>`,
      tip: 'Tocá el nombre de una persona para ver su ficha completa y llamarla o escribirle por WhatsApp.' },
    { sel: '#vista a[href="tablet.html"]', antes: enTab('hoy'), titulo: 'Abrir el QR de recepción', texto: `<p>Abre la pantalla con el <b>QR de fichaje</b>. Abrila en la <b>PC de recepción</b> y dejala en pantalla completa.</p>`,
      tip: 'En la PC de recepción entrá con la <b>cuenta de recepción</b> (se agrega en Ajustes), no con la tuya: así nadie en recepción ve este panel.' },
    { sel: '[data-tab="censo"]', antes: enTab('censo'), titulo: 'Censo', texto: `<p>Para que todo el personal cargue sus datos.</p>
      <ul><li>Armás la lista con nombre y celular.</li><li>Les mandás el link por <b>WhatsApp</b>.</li><li>Ves quién lo recibió, quién lo completó y quién firmó el consentimiento.</li></ul>`,
      tip: 'Para quien no tiene celular, tocá "Lo completo yo" y cargás su ficha vos.' },
    { sel: '[data-tab="personal"]', antes: enTab('personal'), titulo: 'Personal', texto: `<p>Las fichas de todos.</p>
      <ul><li><b>Aprobar y cargar clases</b>: acepta una ficha nueva y pasa sus clases a la grilla.</li><li><b>Habilitar celular</b>: cuando alguien cambió de teléfono.</li><li>Tocá una persona para ver su ficha, sus ausencias y sus faltas.</li></ul>` },
    { sel: '#nueva', antes: enTab('personal'), opcional: true, titulo: 'Cargar a alguien a mano', texto: '<p>Si preferís cargar una persona vos mismo, sin esperar a que complete el censo.</p>' },
    { sel: '[data-tab="grilla"]', antes: enTab('grilla'), titulo: 'Grilla de clases', texto: `<p>La semana de clases por sede, con el profe de cada una. También hay un calendario del mes.</p>
      <ul><li><b>Rojo</b>: clase sin profesor.</li><li><b>Amarillo</b>: un profe con dos clases a la misma hora.</li></ul>`,
      tip: 'Tocá una clase para cambiarle el profe, el horario o borrarla. Con "+ Clase" sumás una nueva.' },
    { sel: '[data-tab="vacaciones"]', antes: enTab('vacaciones'), titulo: 'Vacaciones y ausencias', texto: `<p>Los pedidos que hace el personal desde su app.</p>
      <ul><li><b>Aprobar</b> o <b>Rechazar</b>: le llega la respuesta al profe.</li><li>Al aprobar, el sistema te muestra qué clases y turnos quedan sin cubrir.</li><li>El calendario muestra quién falta cada día y quién lo cubre.</li></ul>` },
    { sel: '[data-tab="reemplazos"]', antes: enTab('reemplazos'), titulo: 'Reemplazos', texto: `<p>Cada clase o turno descubierto, con <b>candidatos sugeridos</b>: mismo rol, dan esa actividad, están libres y no están de vacaciones.</p>
      <p>Primero aparecen los que dijeron que pueden cubrir.</p>`,
      tip: 'Tocá "Asignar" y el reemplazo le aparece a los dos profes en su app. Desde la ficha le podés escribir por WhatsApp.' },
    { sel: '[data-tab="asistencia"]', antes: enTab('asistencia'), titulo: 'Asistencia', texto: `<p>Las horas de cada persona en cualquier mes, sus <b>llegadas tarde</b> (más de 10 minutos) y sus <b>faltas sin aviso</b>.</p>
      <ul><li><b>Justificar</b>: si una falta tenía motivo.</li><li><b>+ Fichaje manual</b>: si alguien se olvidó de fichar.</li><li><b>Descargar CSV</b>: para abrirlo en Excel o mandárselo al contador.</li></ul>` },
    { sel: '[data-tab="ajustes"]', antes: enTab('ajustes'), titulo: 'Ajustes', texto: `<ul><li>El correo y el WhatsApp de gerencia, adonde llegan los pedidos.</li><li>Los links de las tres apps, para copiarlos.</li>
      <li>Sumar otras cuentas de gerencia y la <b>cuenta de recepción</b> (solo QR).</li><li><b>Descargar respaldo completo</b>: una copia de todos los datos.</li></ul>`,
      tip: 'Bajá un respaldo una vez por mes y guardalo en tu Drive.' },
    { sel: '[data-guia]', antes: enTab(tabAntesDeGuia), titulo: 'Listo', texto: '<p>Tocá <b>"? Guía"</b> cuando quieras para ver esta explicación de nuevo.</p>' },
  ]; },
});
