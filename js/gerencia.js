globalThis.__app = 'gerencia';
import { DEMO, AHORA, alCambiarUsuario, esAdmin, salir, escuchar, escucharDoc, guardar, actualizar, agregar, borrar, lote } from './datos.js';
import {
  esc, ROLES, ROL_CORTO, ROLES_TURNO, DIAS, DIAS_CORTOS, DIAS_LABORABLES, MESES, ESTADOS, SEDES, GRILLA_BASE, ACTIVIDADES_BASE,
  hoy, iso, deIso, mesDe, sumarDias, rangoTexto, diasDeTrabajo, textoDias, fechaLarga, fechaCorta, min, seSolapan, nombreCompleto, iniciales,
  activo, agenda, bloquesAgenda, resumenSemana, necesidades, tipoReemplazo, cubierto, reemplazosDe, faltaCubrir, candidatos, huecos, conflictos, ausenteEn, jornadas, resumenAsistencia,
  horaDe, fmtMin, ms, mailto, mailRespuesta, waLink, textoReemplazo, queCubre, idClase, TOLERANCIA_TARDE, minutosDelDia, pad, sumarMin, DURACION_CLASE,
  faltasSinAviso, sinCorreo, rangoFechas, normTel, HORARIO_CLUB, hhmm, FRANJAS, enClasesDeUnaHora,
} from './logica.js';
import { enviarCorreo, envioAutomatico, destinos } from './correo.js';
import { CORREO_GERENCIA } from './config.js';
import { listar } from './datos.js';
import { $, $$, toast, modal, cabModal, confirmar, copiar, pantallaLogin, prepararDemo, registrarApp, htmlFicha, htmlContacto, chipsRoles, htmlAgenda } from './ui.js';
import { htmlFormFicha, activarFormFicha } from './ficha-form.js';
import { botonGuia, registrarGuia } from './guia.js';

const app = $('#app');
const TABS = [
  ['hoy', 'Hoy'], ['grilla', 'Grilla'], ['reemplazos', 'Reemplazos'], ['personal', 'Staff'], ['externos', 'Externos'],
  ['vacaciones', 'Vacaciones'], ['asistencia', 'Asistencia'], ['censo', 'Censo'], ['ajustes', 'Ajustes'],
];
const S = {
  user: null, recepcion: [], tab: (location.hash.slice(1) || 'hoy'), personal: [], clases: [], ausencias: [], reemplazos: [], fichajes: [], fichajesHoy: [],
  config: {}, admins: [], censo: [], mesAsis: mesDe(new Date()), mesCal: mesDe(new Date()), mesGrilla: mesDe(new Date()), sede: 'Anexo', vistaGrilla: 'semana',
  filtroRol: '', buscar: '', soloSinCubrir: true, personaAsis: '', listo: false, histAnio: '', histPersona: '',
  externos: [], extListo: false, remVista: 'cubrir', histMes: mesDe(new Date()), histTipo: 'todos', semanaClases: undefined,
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
    escucharDoc('config', 'externos', c => { S.externos = c?.lista || []; S.extListo = true; pintar(); }),
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
// Quien cubre puede no estar en el sistema (reemplazo "externo": solo nombre y teléfono)
const nomR = r => r.externo ? r.reemplazoNombre : nom(r.reemplazo);
// "Franco Díaz" o, si lo cubren por partes, "Franco Díaz 12:00–13:00 · Cris 13:00–17:00"
const nomsTurno = n => { const rs = reemplazosDe(n, S.reemplazos); return rs.map(r => nomR(r) + (rs.length > 1 || r.desde !== n.desde || r.hasta !== n.hasta ? ` ${r.desde}–${r.hasta}` : '')).join(' · '); };
const activos = () => S.personal.filter(activo);
const pendientesFicha = () => S.personal.filter(p => p.estado === 'pendiente');
const pedidosCelular = () => S.personal.filter(p => p.pedidoDispositivo?.id && p.pedidoDispositivo.id !== p.dispositivo);
const pendientesAus = () => S.ausencias.filter(a => a.estado === 'pendiente');
function necesidadesFuturas(desde = hoy(), hasta = null) {
  const out = [];
  // Se busca reemplazo desde que llega el pedido (pendiente o aprobado)
  for (const a of S.ausencias.filter(x => (x.estado === 'aprobada' || x.estado === 'pendiente') && x.hasta >= desde)) {
    for (const n of necesidades(a, P(a.email), S.clases)) {
      if (n.fecha < desde || (hasta && n.fecha > hasta)) continue;
      out.push({ ...n, r: cubierto(n, S.reemplazos) });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desde.localeCompare(b.desde));
}
const sinCubrir14 = () => necesidadesFuturas(hoy(), iso(sumarDias(new Date(), 14))).filter(n => !n.r);
// Las clases que cargó un profe con la ficha por aprobar ya cuentan como con profe
const clasesSinProfe = () => S.clases.filter(c => !c.profesor || P(c.profesor)?.estado === 'inactivo');

// ---------- Externos: contratados que NO son staff, solo cubren reemplazos ----------
const ACT_ROL = { musculacion: 'Musculación', recepcion: 'Recepción', limpieza: 'Limpieza' };
const queAct = n => n.rol === 'clases' ? n.actividad : ACT_ROL[n.rol];
// "Queda libre (sin profe)": el hueco se deja sin cubrir a propósito
const esLibre = r => /^queda libre/i.test(r?.reemplazoNombre || '');
const slugExt = nombre => 'externo:' + sinTildes(nombre).trim().replace(/[^a-z0-9ñ]+/g, '-').replace(/^-|-$/g, '');
// La carpeta: los guardados + los que ya cubrieron alguna vez (se suman solos)
function externos() {
  const lista = (S.externos || []).map(x => ({ ...x }));
  for (const r of S.reemplazos.filter(r => r.externo && !esLibre(r))) {
    if (lista.some(x => x.id === r.reemplazo)) continue;
    lista.push({ id: r.reemplazo, nombre: r.reemplazoNombre || 'Sin nombre', tel: r.reemplazoTel || '', acts: [queAct(r)].filter(Boolean), disp: '', auto: true });
  }
  return lista.filter(x => !x.oculto).sort((a, b) => a.nombre.localeCompare(b.nombre));
}
const EXT = id => externos().find(x => x.id === id) || (S.externos || []).find(x => x.id === id);
async function guardarExternos(lista) { await guardar('config', 'externos', { lista: lista.map(({ auto, ...x }) => x) }); }
// Todos (incluso los quitados de la carpeta) para no perder datos al guardar
const todosExt = () => { const vis = externos(); return [...vis, ...(S.externos || []).filter(x => x.oculto && !vis.some(v => v.id === x.id))]; };
const libreExt = (x, fecha, desde, hasta) => !S.reemplazos.some(r => r.reemplazo === x.id && r.fecha === fecha && seSolapan(r.desde, r.hasta, desde, hasta));
const minR = r => min(r.hasta) - min(r.desde);
const horasTxt = m => m % 60 ? fmtMin(m) : `${m / 60} h`;

// Estado de cada pedazo de turno, con un color fijo en toda la app:
// titular (verde), cubre alguien del staff (azul), cubre un externo (violeta), falta cubrir (rojo), queda libre (gris)
const ESTADOS_TURNO = { tit: 'Titular', stf: 'Cubre staff', ext: 'Cubre externo', falta: 'Falta cubrir', libre: 'Queda libre' };
const estadoR = r => esLibre(r) ? 'libre' : r.externo ? 'ext' : 'stf';
const leyendaEstados = () => `<span class="leyenda est-ley">${Object.entries(ESTADOS_TURNO).map(([k, t]) => `<span><i class="sw est-${k}"></i>${t}</span>`).join('')}</span>`;
// Botones que abren "Resolver" desde cualquier pantalla (línea del día, grilla, para resolver)
const RES = new Map(); let resN = 0;
const regResolver = n => { RES.set(++resN, n); return resN; };
document.addEventListener('click', e => { const b = e.target.closest('[data-resolver]'); if (b && RES.has(+b.dataset.resolver)) { e.preventDefault(); b.closest('.modal-fondo')?.remove(); resolver(RES.get(+b.dataset.resolver)); } });
// Panel para cubrir un turno sin moverse de la pantalla: staff libre primero, después externos
function resolver(n) {
  const actual = necesidadesFuturas(n.fecha, n.fecha).find(x => x.titular === n.titular && x.desde === n.desde && (x.actividad || '') === (n.actividad || '')) || n;
  const m = modal(`${cabModal('Cubrir turno')}<div class="persona"><div class="avatar">${esc(iniciales(P(actual.titular) || {}))}</div><div><b>Falta ${esc(nom(actual.titular))}</b><span class="sub">${esc(queCubre(actual))} · ${fechaLarga(actual.fecha)}</span></div></div>
    <div id="res-cuerpo">${htmlNecesidad(actual)}</div><div class="modal-pie"><button class="btn ghost" data-cerrar>Listo</button></div>`, { ancho: true });
  enlazarNecesidades(m.el, () => m.cerrar());
}

// ---------- Corrección automática de la grilla ----------
// Las clases duran 1 hora: si quedó cargada una clase de varias horas (de antes, o a mano) se parte sola
// en clases de 1 hora, y si una persona tiene la misma clase repetida a la misma hora se deja una sola.
let corrigiendo = false, limpiandoCenso = false, guardandoExt = false;
async function corregirGrilla() {
  if (corrigiendo || !S.listo) return; // Gerencia solo abre para cuentas de gerencia
  const largas = S.clases.filter(c => c.desde && c.hasta && min(c.hasta) - min(c.desde) > DURACION_CLASE);
  const vistas = new Map(), repetidas = [];
  for (const c of [...S.clases].filter(c => !largas.includes(c)).sort((a, b) => (a.profesor ? 0 : 1) - (b.profesor ? 0 : 1) || a.id.localeCompare(b.id))) {
    const k = [c.sede, c.dia, c.desde, sinTildes(c.actividad)].join('|');
    if (vistas.has(k) && (!c.profesor || c.profesor === vistas.get(k).profesor)) repetidas.push(c); else if (!vistas.has(k)) vistas.set(k, c);
  }
  if (S.extListo && !guardandoExt && externos().some(x => x.auto)) {
    guardandoExt = true;
    guardarExternos(todosExt()).catch(e => console.error(e)).finally(() => { guardandoExt = false; });
  }
  const dupCenso = censoUnico().repetidos;
  if (dupCenso.length && !limpiandoCenso) {
    limpiandoCenso = true;
    lote(dupCenso.map(r => ({ c: 'censo', id: r.id, borrar: true })))
      .then(() => toast(`Saqué ${dupCenso.length} fila(s) repetida(s) de la lista del censo.`)).catch(e => console.error(e))
      .finally(() => { limpiandoCenso = false; });
  }
  if (!largas.length && !repetidas.length) return;
  corrigiendo = true;
  const ops = [], reemplazo = {};
  for (const c of largas) {
    const { id, ...datos } = c;
    reemplazo[id] = [];
    for (const [desde, hasta] of enClasesDeUnaHora(c.desde, c.hasta)) {
      const nid = idClase({ ...datos, desde });
      reemplazo[id].push(nid);
      if (!S.clases.some(x => x.id === nid)) ops.push({ c: 'clases', id: nid, data: { ...datos, desde, hasta } });
    }
    ops.push({ c: 'clases', id, borrar: true });
  }
  for (const c of repetidas) { reemplazo[c.id] = [vistas.get([c.sede, c.dia, c.desde, sinTildes(c.actividad)].join('|')).id]; ops.push({ c: 'clases', id: c.id, borrar: true }); }
  // Las fichas que tenían esas clases quedan con las nuevas
  for (const p of S.personal) {
    const dec = p.clasesDeclaradas || [];
    if (!dec.some(id => reemplazo[id])) continue;
    ops.push({ c: 'personal', id: p.email, data: { clasesDeclaradas: [...new Set(dec.flatMap(id => reemplazo[id] || [id]))] }, merge: true });
  }
  try {
    await lote(ops);
    toast(`Ordené la grilla: ${largas.length ? `${largas.length} clase(s) largas pasaron a clases de 1 hora` : ''}${largas.length && repetidas.length ? ' y ' : ''}${repetidas.length ? `${repetidas.length} repetida(s) borrada(s)` : ''}.`);
  } catch (e) { console.error('No se pudo ordenar la grilla', e); }
  corrigiendo = false;
}

// ---------- Render ----------
let raf = 0;
function pintar() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
function render() {
  if (!S.user || !S.listo) return;
  const y = scrollY;
  const cuentas = { censo: estadoCenso().filas.filter(f => f.estado === 'por-aprobar').length, personal: pendientesFicha().length + pedidosCelular().length, vacaciones: pendientesAus().length, reemplazos: sinCubrir14().length };
  const ext = externos().length;
  app.innerHTML = `<header class="barra"><div class="barra-in">
      <a class="marca" href="gerencia.html">coghlan<b>club</b><small>Gerencia</small></a>
      <div class="der">${botonGuia()}<span class="sub" style="font-size:.8rem">${esc(S.user.email)}</span><button class="btn sm ghost" id="salir">Salir</button></div></div>
    <nav class="tabs" role="tablist">${TABS.map(([k, t]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}${cuentas[k] ? `<span class="cuenta">${cuentas[k]}</span>` : k === 'externos' && ext ? `<span class="cuenta ext">${ext}</span>` : ''}</button>`).join('')}</nav>
  </header><main id="vista"></main>`;
  $('#salir').onclick = () => salir();
  $$('[data-tab]').forEach(b => b.onclick = () => irA(b.dataset.tab));
  montarAsistente();
  corregirGrilla();
  ({ hoy: vHoy, censo: vCenso, personal: vPersonal, externos: vExternos, grilla: vGrilla, vacaciones: vVacaciones, reemplazos: vReemplazos, asistencia: vAsistencia, ajustes: vAjustes })[S.tab]($('#vista'));
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
      const quien = [...new Set(remHoy.filter(r => r.titular === p.email).map(nomR))];
      const faltan = ag.filter(x => !cubierto({ ...x, titular: p.email, fecha: h, actividad: x.actividad || '' }, remHoy)).length;
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
  // Para resolver: lo que falta cubrir en los próximos 7 días y los pedidos sin responder
  const faltan = necesidadesFuturas(h, iso(sumarDias(new Date(), 7))).filter(n => faltaCubrir(n, S.reemplazos).length);
  const hoyFaltan = faltan.filter(n => n.fecha === h);
  const minFaltaHoy = hoyFaltan.reduce((t, n) => t + faltaCubrir(n, S.reemplazos).reduce((u, [a, b]) => u + min(b) - min(a), 0), 0);
  const items = [
    // Una fila por persona y día; cada turno o clase que falta es un botón para resolverlo
    ...Object.values(faltan.reduce((g, n) => { (g[n.fecha + n.titular] = g[n.fecha + n.titular] || []).push(n); return g; }, {})).slice(0, 6).map(ns => { const n = ns[0];
      return `<div class="item fila-est falta"><div><b>${n.fecha === h ? 'Hoy' : DIAS_CORTOS[n.dia] + ' ' + fechaCorta(n.fecha).slice(0, 5)} falta ${esc(nom(n.titular).split(' ')[0])}</b>
      <span class="sub">${ns.length} ${ns.length === 1 ? 'turno' : 'turnos'} sin cubrir · tocá uno para resolverlo</span></div>
      <div class="acciones">${ns.map(x => `<button class="btn sm" data-resolver="${regResolver(x)}">${x.generico ? 'A confirmar' : `<span class="mono">${faltaCubrir(x, S.reemplazos)[0]?.[0] || x.desde}</span>&nbsp;${esc(x.rol === 'clases' ? x.actividad : ROL_CORTO[x.rol])}`}</button>`).join('')}</div></div>`; }),
    ...pendientesAus().slice(0, 4).map(a => `<div class="item fila-est pend"><div><b>${esc((a.nombre || nom(a.email)).split(' ')[0])} pide ${a.tipo === 'vacaciones' ? 'vacaciones' : 'ausencia'}</b><span class="sub"><span class="mono">${rangoTexto(a.desde, a.hasta)}</span> · ${textoDias(a.desde, a.hasta, P(a.email), S.clases)}</span></div>
      <div class="acciones"><button class="btn sm ok" data-apr-hoy="${a.id}">Aprobar</button><button class="btn sm ghost" data-ver-hoy="${a.id}">Ver</button></div></div>`),
  ];
  v.innerHTML = `
    <div class="cab"><div><span class="eyebrow">${fechaLarga(h)}</span><h1>Hoy en el club</h1></div>
      <div class="acciones"><a class="btn ghost" href="tablet.html" target="_blank" rel="noopener">Abrir QR de recepción</a></div></div>
    <div class="kpis">
      <button class="kpi ok" data-ir="asistencia"><b>${dentro.length}</b><span>en el club ahora</span></button>
      <button class="kpi ${minFaltaHoy ? 'alerta' : 'ok'}" data-ir="reemplazos"><b>${minFaltaHoy ? horasTxt(minFaltaHoy) : '✓'}</b><span>${minFaltaHoy ? 'sin cubrir hoy' : 'hoy está todo cubierto'}</span></button>
      <button class="kpi ${pendientesFicha().length ? 'alerta' : ''}" data-ir="personal"><b>${pendientesFicha().length}</b><span>fichas nuevas por aprobar</span></button>
      <button class="kpi ${pendientesAus().length ? 'alerta' : ''}" data-ir="vacaciones"><b>${pendientesAus().length}</b><span>pedidos de vacaciones/ausencia</span></button>
      <button class="kpi ${sc.length ? 'alerta' : ''}" data-ir="reemplazos"><b>${sc.length}</b><span>turnos sin cubrir (14 días)</span></button>
      <button class="kpi ${csp.length ? 'alerta' : ''}" data-ir="grilla"><b>${csp.length}</b><span>clases sin profesor</span></button>
    </div>
    ${items.length ? `<div class="panel"><h3>Para resolver</h3><div class="lista">${items.join('')}</div></div>` : '<div class="todo-ok">✓ Nada para resolver</div>'}
    <div class="panel"><div class="cab"><h3>Quién está hoy, hora por hora</h3>${leyendaEstados()}</div>${lineaDelDia(h) || '<p class="vacio">Hoy no hay turnos.</p>'}<span class="sub">Tocá lo rojo para cubrirlo, o un nombre para ver su ficha.</span></div>
    <div class="panel"><h3>Llegadas de hoy</h3>
      ${filas.length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th>Horario de hoy</th><th>Estado</th></tr></thead><tbody>
        ${filas.map(f => `<tr><td><button class="btn sm ghost" data-ficha="${esc(f.p.email)}">${esc(nombreCompleto(f.p))}</button></td>
          <td><div class="slots">${f.todos.map(s => `<span class="slot-mini rol-${s.rol}"><span class="mono">${s.desde}–${s.hasta}</span> ${esc(s.actividad || ROL_CORTO[s.rol])}${s.cubriendo ? ' · reemplazo' : ''}</span>`).join('') || '<span class="sub">sin turno</span>'}</div></td>
          <td>${f.est}</td></tr>`).join('')}</tbody></table></div>` : '<p class="vacio">Nadie tiene turno hoy.</p>'}
    </div>`;
  $$('[data-ir]', v).forEach(b => b.onclick = () => irA(b.dataset.ir));
  $$('[data-apr-hoy]', v).forEach(b => b.onclick = () => responder(S.ausencias.find(a => a.id === b.dataset.aprHoy), true));
  $$('[data-ver-hoy]', v).forEach(b => b.onclick = () => verAusencia(S.ausencias.find(a => a.id === b.dataset.verHoy)));
  $$('[data-ext]', v).forEach(b => b.onclick = () => verExterno(EXT(b.dataset.ext)));
  enlazarFichas(v);
}

// ============================================================ CENSO
const ESTADO_CENSO = {
  'sin-enviar': ['Sin enviar', 'neutro'], enviado: ['Link enviado · falta completar', 'pendiente'],
  'por-aprobar': ['Completó · por aprobar', 'info'], listo: ['Censado', 'aprobada'],
};
// Ficha de una fila del censo: primero por correo (exacto) y solo si no, por celular
const fichaDeCenso = r => (r.email && S.personal.find(x => x.email === r.email))
  || (r.telefono && normTel(r.telefono) && S.personal.find(x => x.estado !== 'inactivo' && normTel(x.telefono) === normTel(r.telefono))) || null;
const claveCenso = r => {
  const p = fichaDeCenso(r);
  return p ? 'p:' + p.email : r.telefono && normTel(r.telefono) ? 't:' + normTel(r.telefono) : 'n:' + sinTildes(r.nombre || '').replace(/\s+/g, ' ').trim();
};
// Otra ficha activa con el mismo celular (la misma persona cargada dos veces)
const fichaRepetida = p => normTel(p.telefono) && S.personal.some(x => x !== p && x.estado !== 'inactivo' && normTel(x.telefono) === normTel(p.telefono));
// Una sola fila por persona aunque haya quedado repetida en la lista
function censoUnico() {
  const vistos = new Map();
  for (const r of [...S.censo].sort((a, b) => (b.enviado ? 1 : 0) - (a.enviado ? 1 : 0) || (b.email ? 1 : 0) - (a.email ? 1 : 0) || a.id.localeCompare(b.id))) {
    const k = claveCenso(r);
    if (!vistos.has(k)) vistos.set(k, r);
  }
  return { unicos: [...vistos.values()], repetidos: S.censo.filter(r => vistos.get(claveCenso(r)) !== r) };
}
function estadoCenso() {
  const usadas = new Set();
  const deLista = censoUnico().unicos.map(r => {
    const p = fichaDeCenso(r);
    if (p) usadas.add(p.email);
    return { r, p };
  });
  // Las fichas cargadas a mano (o que llegaron sin estar en la lista) son staff igual: entran solas al censo
  const aMano = S.personal.filter(p => !usadas.has(p.email) && p.estado !== 'inactivo')
    .map(p => ({ r: { id: '', nombre: nombreCompleto(p), telefono: p.telefono || '', aMano: true }, p }));
  const filas = [...deLista, ...aMano].map(({ r, p }) => ({ r, p, estado: p ? (p.estado === 'pendiente' ? 'por-aprobar' : 'listo') : r.enviado ? 'enviado' : 'sin-enviar' })).sort((a, b) => Object.keys(ESTADO_CENSO).indexOf(a.estado) - Object.keys(ESTADO_CENSO).indexOf(b.estado) || (a.r.nombre || '').localeCompare(b.r.nombre || ''));
  return { filas, sueltos: [] };
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
      ${filas.map(({ r, p, estado }) => `<tr><td><b>${esc(r.nombre)}</b>${p && p.sinCelular ? ' <span class="pill neutro">sin celular · PIN</span>' : ''}${r.aMano ? ' <span class="pill neutro">cargada a mano</span>' : ''}${p && fichaRepetida(p) ? ' <span class="pill pendiente" title="Hay otra ficha activa con el mismo celular. Si es la misma persona, dejá una sola.">2 fichas con este celular</span>' : ''}</td><td class="mono">${esc(r.telefono || '—')}</td>
        <td><span class="pill ${ESTADO_CENSO[estado][1]}">${ESTADO_CENSO[estado][0]}</span>${r.enviado && estado === 'enviado' ? `<br><span class="sub">enviado el ${fechaCorta(iso(new Date(ms(r.enviado))))}</span>` : ''}</td>
        <td>${!p ? '<span class="sub">—</span>' : p.consentimiento?.aceptado ? `<span class="pill aprobada">${p.consentimiento.papel ? 'En papel' : 'Firmado'}</span>` : '<span class="pill sin">Falta</span>'}</td>
        <td><div class="acciones">
          ${estado === 'sin-enviar' || estado === 'enviado' ? `${r.telefono ? `<a class="btn sm" target="_blank" rel="noopener" href="${waLink(r.telefono, msjCenso(r.nombre))}" data-enviado="${r.id}">${estado === 'enviado' ? 'Recordar' : 'Mandar link'}</a>` : ''}
            <button class="btn sm ghost" data-completar="${r.id}">Lo completo yo</button>` : ''}
          ${estado === 'por-aprobar' ? `<button class="btn sm ok" data-aprobar-c="${esc(p.email)}">Aprobar</button>` : ''}
          ${p ? `<button class="btn sm ghost" data-ficha="${esc(p.email)}">Ver ficha</button>` : ''}
          ${r.id ? `<button class="btn sm ghost" data-quitar-c="${r.id}" aria-label="Quitar de la lista">×</button>` : ''}</div></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vacio">Todavía no cargaste la lista. Pegala arriba: un renglón por persona.</p>'}</div>
    ${sueltos.length ? `<div class="panel"><h3>Fichas que no están en la lista (${sueltos.length})</h3><p class="sub">Completaron la ficha o las cargaste antes de armar la lista.</p>
      <div class="lista">${sueltos.map(p => `<div class="item"><div><b>${esc(nombreCompleto(p))}</b>${fichaRepetida(p) ? ' <span class="pill pendiente">ficha repetida</span>' : ''}<span class="sub mono">${esc(p.telefono || '')}</span></div>
        <div class="acciones">${p.estado === 'pendiente' ? `<button class="btn sm ok" data-aprobar-c="${esc(p.email)}">Aprobar</button>` : ''}<button class="btn sm ghost" data-sumar="${esc(p.email)}">Sumar a la lista</button></div></div>`).join('')}</div></div>` : ''}`;
  $('#copiar-grupo').onclick = () => copiar(msjCenso(''));
  $('#agregar-lista').onclick = async () => {
    const rs = $('#lista-pegar').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(.*?)[,;\t]\s*([\d\s()+-]{6,})\s*$/) || l.match(/^(.*?)\s+([\d\s()+-]{8,})$/);
      return m ? { nombre: m[1].trim(), telefono: m[2].trim() } : { nombre: l, telefono: '' };
    }).filter(r => r.nombre);
    const ya = new Set(S.censo.map(claveCenso));
    for (const r of rs.splice(0)) { const k = claveCenso(r); if (!ya.has(k)) { ya.add(k); rs.push(r); } }
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
  $$('[data-sumar]', v).forEach(b => b.onclick = async () => {
    const p = P(b.dataset.sumar);
    if (b.disabled || S.censo.some(r => claveCenso(r) === 'p:' + p.email)) return;
    b.disabled = true; await agregar('censo', { nombre: nombreCompleto(p), telefono: p.telefono || '', email: p.email, creado: AHORA }); toast('Sumado a la lista'); });
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
    <div class="cab"><div><span class="eyebrow">Titulares de una clase o turno cada semana</span><h1>Staff</h1>
      <p class="sub">${activos().length} personas en el staff. Los contratados que solo cubren reemplazos van en <b>Externos</b>.</p></div>
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
        <div class="persona"><div class="avatar" style="${estiloAvatar(p.email)}">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span class="sub mono">${esc(p.telefono || '')}</span></div></div>
        ${semanaMini(p)}${activo(p) ? estadoHoy(p) : ''}
        <div class="pie">${chipsRoles(p)} ${!activo(p) ? '<span class="pill neutro">Inactivo</span>' : ''} ${conflictos(p, S.clases).length ? '<span class="pill pendiente">Choque de horarios</span>' : ''}</div>
        <span class="sub">${resumenSemana(agenda(p, S.clases))}${(p.actividades || []).length ? ' · ' + esc(p.actividades.slice(0, 3).join(', ')) + (p.actividades.length > 3 ? '…' : '') : ''}</span>
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

// La semana de una persona en barritas (alto = horas de ese día)
function semanaMini(p) {
  const ag = agenda(p, S.clases), h = colorDe(p.email);
  const hs = DIAS_LABORABLES.map(d => ag.filter(s => s.dia === d).reduce((t, s) => t + min(s.hasta) - min(s.desde), 0) / 60);
  if (!hs.some(Boolean)) return '<span class="sub">Sin horarios cargados</span>';
  return `<div class="sem-mini" title="Horas por día">${DIAS_LABORABLES.map((d, i) => `<div>${hs[i] ? `<i style="height:${Math.max(5, Math.min(hs[i], 10) / 10 * 30)}px;background:hsl(${h} 65% 55% / .4);border:1px solid hsl(${h} 70% 62%)"></i>` : '<i class="vacio"></i>'}<small>${DIAS_CORTOS[d][0]}</small></div>`).join('')}</div>`;
}
const estiloAvatar = clave => { const h = colorDe(clave); return `background:hsl(${h} 55% 40% / .35);color:hsl(${h} 75% 72%)`; };
// Cómo está hoy: falta, trabaja (de qué hora a qué hora), vacaciones que vienen o no trabaja
function estadoHoy(p) {
  const h = hoy(), a = ausenteEn(p.email, h, S.ausencias);
  if (a) return `<span class="est est-falta">${a.tipo === 'vacaciones' ? 'De vacaciones' : 'Falta hoy'}</span>`;
  const prox = S.ausencias.filter(x => x.email === p.email && x.desde > h && x.estado !== 'rechazada').sort((x, y) => x.desde.localeCompare(y.desde))[0];
  const bs = bloquesAgenda(agenda(p, S.clases).filter(s => s.dia === new Date().getDay()));
  const px = prox ? ` · ${prox.tipo === 'vacaciones' ? 'vacaciones' : 'ausencia'} ${fechaCorta(prox.desde).slice(0, 5)}${prox.estado === 'pendiente' ? ' (pedido)' : ''}` : '';
  if (bs.length) return `<span class="est est-tit">Hoy ${bs.map(b => `${b.desde}–${b.hasta}`).join(', ')}${px}</span>`;
  return prox ? `<span class="est est-pend">${px.slice(3).replace(/^./, c => c.toUpperCase())}</span>` : '<span class="est est-libre">Hoy no trabaja</span>';
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
      ...libres.map(c => ({ c: 'clases', id: c.id, data: { profesor: p.email, profesorNombre: nombreCompleto(p) }, merge: true })),
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
      <div style="display:grid;gap:6px"><h4>Vacaciones y ausencias (todas)</h4>${histAus.length ? `<div class="lista">${histAus.map(a => `<div class="item"><span>${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span> · ${textoDias(a.desde, a.hasta, p, S.clases)}</span><span class="pill ${a.estado}">${ESTADOS[a.estado]}</span></div>`).join('')}</div>` : '<p class="sub">Ninguna.</p>'}</div>
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
    // Si ya estaba cargada (por el censo o antes), se ofrece abrir su ficha en vez de no hacer nada
    if (nueva && P(d.email)) {
      const ya = P(d.email);
      if (await confirmar(`<b>${esc(nombreCompleto(ya))}</b> ya tiene ficha con ese correo${ya.estado === 'pendiente' ? ' (por aprobar)' : ''}. ¿Abrir su ficha para completarla?`, { si: 'Abrir su ficha' })) { m.cerrar(); editarFicha(ya); }
      return;
    }
    const { clases, clasesNuevas = [], ...resto } = d;
    const antes = S.clases.filter(c => c.profesor === d.email).map(c => c.id);
    // Las clases nuevas se crean en la grilla a su nombre (o se le asignan si ya existían)
    const creadas = [];
    for (const c of clasesNuevas) {
      const id = idClase(c);
      if (!clases.includes(id)) clases.push(id);
      if (!S.clases.some(x => x.id === id)) creadas.push({ c: 'clases', id, data: { ...c, profesor: d.email, profesorNombre: nombreCompleto(d), origen: 'gerencia', creado: AHORA } });
    }
    const ops = [{ c: 'personal', id: d.email, data: { ...resto, clasesDeclaradas: clases, actualizado: AHORA, ...(nueva ? { creado: AHORA } : {}) }, merge: true }, ...creadas];
    for (const id of clases) if (!antes.includes(id) && !creadas.some(o => o.id === id)) ops.push({ c: 'clases', id, data: { profesor: d.email, profesorNombre: nombreCompleto(d) }, merge: true });
    for (const id of antes) if (!clases.includes(id)) ops.push({ c: 'clases', id, data: { profesor: '', profesorNombre: '' }, merge: true });
    try { await lote(ops); m.cerrar(); toast('Ficha guardada'); } catch (e) { console.error(e); toast('No se pudo guardar', true); }
  };
  $('#fe-borrar', m.el)?.addEventListener('click', async () => {
    if (!(await confirmar(`¿Eliminar la ficha de ${esc(nombreCompleto(p))}? Si dejó de trabajar, mejor marcala como Inactivo para conservar su historial.`, { si: 'Eliminar', peligro: true }))) return;
    const ops = [{ c: 'personal', id: p.email, borrar: true }, ...S.clases.filter(c => c.profesor === p.email).map(c => ({ c: 'clases', id: c.id, data: { profesor: '', profesorNombre: '' }, merge: true }))];
    await lote(ops); m.cerrar(); toast('Ficha eliminada');
  });
}

// ============================================================ GRILLA
function opcionesProfe(c) {
  const profes = activos().filter(p => (p.roles || []).includes('clases'));
  const saben = profes.filter(p => (p.actividades || []).includes(c.actividad));
  const otros = profes.filter(p => !(p.actividades || []).includes(c.actividad));
  const op = p => `<option value="${esc(p.email)}" ${c.profesor === p.email ? 'selected' : ''}>${esc(nombreCompleto(p))}</option>`;
  const pp = c.profesor && P(c.profesor);
  const estadoProfe = !pp ? 'sin ficha todavía' : pp.estado === 'pendiente' ? 'ficha por aprobar' : 'inactivo';
  const huerf = c.profesor && !profes.some(p => p.email === c.profesor) ? `<option value="${esc(c.profesor)}" selected>${esc(pp ? nombreCompleto(pp) : c.profesorNombre || c.profesor)} (${estadoProfe})</option>` : '';
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
  $('#nueva-clase').onclick = () => editarClase({ sede: S.sede === SALA ? SEDES[0] : S.sede, dia: 1, desde: '08:00', hasta: '09:00', actividad: '' });
  $('#cargar-oficial').onclick = async () => {
    const faltan = GRILLA_BASE.filter(c => !S.clases.some(x => x.id === c.id));
    if (!faltan.length) return toast('La grilla ya tiene todas las clases oficiales');
    await lote(faltan.map(c => ({ c: 'clases', id: c.id, data: c })));
    toast(`${faltan.length} clases cargadas`);
  };
  const c = $('#contenido-grilla');
  S.vistaGrilla === 'semana' ? grillaSemana(c) : grillaMes(c);
}

// Grilla aparte de la sala de musculación: mismo formato que las sedes, con los turnos de sala
// que cada profe cargó en su ficha (censo). Tocá un nombre para ver su ficha.
const SALA = 'Musculación';
function selectorSedes() {
  const sedes = [...new Set([...SEDES, ...S.clases.map(c => c.sede)]), SALA];
  return `<div class="seg" role="group" aria-label="Sede">${sedes.map(s => `<button data-sede="${esc(s)}" aria-pressed="${S.sede === s}">${esc(s)}</button>`).join('')}</div>`;
}
// Colores fijos por persona (para reconocer a cada uno de un vistazo)
const colorDe = clave => { let h = 0; for (const c of clave) h = (h * 31 + c.charCodeAt(0)) % 280; return 40 + h; }; // sin rojos: el rojo es "sin nadie"
const estiloPersona = clave => { const h = colorDe(clave); return `background:hsl(${h} 65% 50% / .3);border-left:4px solid hsl(${h} 70% 60%)`; };
const lunesDe = d => sumarDias(d, -((d.getDay() + 6) % 7));
const profesSala = () => S.personal.filter(p => p.estado !== 'inactivo' && ((p.roles || []).includes('musculacion') || (p.horarios || []).some(s => s.rol === 'musculacion')));
const turnosSala = () => profesSala().flatMap(p => (p.horarios || []).filter(s => s.rol === 'musculacion').map(s => ({ ...s, p })));
const INI_CLUB = Math.min(...DIAS_LABORABLES.map(d => min(HORARIO_CLUB[d][0]))), FIN_CLUB = Math.max(...DIAS_LABORABLES.map(d => min(HORARIO_CLUB[d][1])));
// Bloques de la sala de un día: turnos, ausentes (con quién los cubre) y horarios sin nadie.
// Con fecha (f) se tienen en cuenta vacaciones y reemplazos; sin fecha es la semana tipo.
function bloquesSala(d, f, turnos = turnosSala()) {
  const out = [];
  for (const t of turnos.filter(t => t.dia === d)) {
    const aus = f && ausenteEn(t.p.email, f, S.ausencias);
    out.push({ desde: t.desde, hasta: t.hasta, nombre: nombreCompleto(t.p), clave: t.p.email, tipo: aus ? 'ausente' : 'turno', email: t.p.email });
    if (aus) for (const r of reemplazosDe({ titular: t.p.email, fecha: f, desde: t.desde, hasta: t.hasta, actividad: '' }, S.reemplazos))
      out.push({ desde: r.desde, hasta: r.hasta, nombre: nomR(r), clave: r.reemplazo, tipo: 'cubre', aQuien: t.p.nombre || nombreCompleto(t.p), email: r.externo ? '' : r.reemplazo });
  }
  for (const [a, b] of huecos(d, out.filter(b => b.tipo !== 'ausente'))) out.push({ desde: a, hasta: b, nombre: 'Sin nadie', tipo: 'hueco' });
  // Si dos se superponen, van uno al lado del otro (carriles)
  out.sort((x, y) => min(x.desde) - min(y.desde) || min(y.hasta) - min(x.hasta));
  const carriles = [];
  for (const b of out) { let i = carriles.findIndex(f => f <= min(b.desde)); if (i < 0) { i = carriles.length; carriles.push(0); } carriles[i] = min(b.hasta); b.carril = i; }
  out.forEach(b => { b.de = carriles.length; });
  return out;
}
const estiloBloque = b => b.tipo === 'hueco' ? 'background:color-mix(in srgb,var(--accent) 22%,transparent);border:1px dashed var(--accent);color:var(--accent)'
  : b.tipo === 'ausente' ? 'background:repeating-linear-gradient(135deg,rgba(127,127,127,.18) 0 6px,transparent 6px 12px);border:1px dashed var(--muted);color:var(--muted)'
  : estiloPersona(b.clave);
function grillaSala(v) {
  const profes = profesSala();
  const turnos = turnosSala();
  const sinTurno = profes.filter(p => !turnos.some(t => t.p === p));
  // Semana tipo (sin fechas) o una semana real, con vacaciones y reemplazos
  const lunes = S.semanaSala ? deIso(S.semanaSala) : null;
  const fechaDe = d => lunes ? iso(sumarDias(lunes, d - 1)) : null;
  const ini = INI_CLUB, fin = FIN_CLUB;
  const PX = 46 / 60; // alto de cada minuto
  const bloquesDe = d => bloquesSala(d, fechaDe(d), turnos);
  const bloque = b => {
    const top = (min(b.desde) - ini) * PX, alto = Math.max((min(b.hasta) - min(b.desde)) * PX - 2, 16);
    const estilo = estiloBloque(b);
    return `<button class="sala-b" ${b.email ? `data-ficha="${esc(b.email)}"` : ''} style="top:${top}px;height:${alto}px;left:calc(${b.carril * 100 / b.de}% + 2px);width:calc(${100 / b.de}% - 4px);${estilo}" title="${esc(`${b.nombre} ${b.desde}–${b.hasta}`)}">
      <b>${esc(b.tipo === 'hueco' ? b.nombre : b.nombre.split(' ')[0])}</b><span>${b.desde}–${b.hasta}</span>${b.tipo === 'cubre' ? `<span>cubre a ${esc(b.aQuien)}</span>` : b.tipo === 'ausente' ? '<span>ausente</span>' : ''}</button>`;
  };
  const horas = []; for (let m = Math.ceil(ini / 60) * 60; m <= fin; m += 60) horas.push(m);
  const alto = (fin - ini) * PX;
  const semTxt = lunes ? `Semana del ${fechaCorta(iso(lunes)).slice(0, 5)} al ${fechaCorta(iso(sumarDias(lunes, 5))).slice(0, 5)}` : '';
  v.innerHTML = `<div class="acciones" style="margin-bottom:12px">${selectorSedes()}
      <div class="seg" role="group" aria-label="Semana"><button data-sem="tipo" aria-pressed="${!lunes}">Semana tipo</button><button data-sem="-1" aria-label="Semana anterior">‹</button><button data-sem="hoy" aria-pressed="${!!lunes}">${lunes ? semTxt : 'Con fechas'}</button><button data-sem="1" aria-label="Semana siguiente">›</button></div>
      <span class="leyenda"><span><span class="pill neutro">rayado</span> ausente</span><span><span class="pill sin">rojo</span> sin nadie</span></span></div>
    ${turnos.length ? `<div class="tabla-wrap"><div class="sala-cal" style="--alto:${alto}px">
      <div class="sala-col sala-horas"><div class="sala-cab">Hora</div><div class="sala-cuerpo">${horas.map(m => `<span style="top:${(m - ini) * PX}px">${hhmm(m)}</span>`).join('')}</div></div>
      ${DIAS_LABORABLES.map(d => `<div class="sala-col"><div class="sala-cab">${DIAS_CORTOS[d]}${lunes ? ' ' + fechaCorta(fechaDe(d)).slice(0, 5) : ''}</div>
        <div class="sala-cuerpo">${horas.map(m => `<i style="top:${(m - ini) * PX}px"></i>`).join('')}
          ${min(HORARIO_CLUB[d][0]) > ini ? `<div class="sala-cerrado" style="top:0;height:${(min(HORARIO_CLUB[d][0]) - ini) * PX}px"></div>` : ''}
          ${min(HORARIO_CLUB[d][1]) < fin ? `<div class="sala-cerrado" style="top:${(min(HORARIO_CLUB[d][1]) - ini) * PX}px;bottom:0"></div>` : ''}
          ${bloquesDe(d).map(bloque).join('')}</div></div>`).join('')}
    </div></div>` : '<p class="vacio">Todavía no hay turnos de sala. Aparecen cuando los profes de musculación cargan sus horarios en el censo (o desde Personal → su ficha → Editar).</p>'}
    ${sinTurno.length ? `<div class="aviso" style="margin-top:12px"><div><b>Profes de sala sin horario cargado</b><span>${sinTurno.map(p => esc(nombreCompleto(p))).join(' · ')}</span></div></div>` : ''}`;
  $$('[data-sede]', v).forEach(b => b.onclick = () => { S.sede = b.dataset.sede; render(); });
  $$('[data-sem]', v).forEach(b => b.onclick = () => {
    const k = b.dataset.sem;
    S.semanaSala = k === 'tipo' ? null : k === 'hoy' ? (S.semanaSala || iso(lunesDe(new Date()))) : iso(sumarDias(lunes || lunesDe(new Date()), +k * 7));
    render();
  });
  $$('[data-ficha]', v).forEach(b => b.onclick = () => verFicha(P(b.dataset.ficha)));
}

function grillaSemana(v) {
  if (S.sede === SALA) return grillaSala(v);
  if (S.semanaClases === undefined) S.semanaClases = iso(lunesDe(new Date())); // de entrada, la semana actual con fechas
  if (S.semanaClases) return grillaSemanaFechas(v);
  const cs = S.clases.filter(c => c.sede === S.sede);
  const horas = [...new Set(cs.map(c => c.desde))].sort();
  const confl = new Set();
  for (const p of activos()) for (const [a, b] of conflictos(p, S.clases)) { if (a.claseId) confl.add(a.claseId); if (b.claseId) confl.add(b.claseId); }
  v.innerHTML = `<div class="acciones" style="margin-bottom:12px">${selectorSedes()}
      <span class="leyenda"><span><span class="pill sin">borde rojo</span> sin profesor</span><span><span class="pill pendiente">borde amarillo</span> choque de horario</span></span></div>
    ${selectorSemanaClases()}
    <div class="tabla-wrap"><table class="grilla"><thead><tr><th>Hora</th>${DIAS_LABORABLES.map(d => `<th>${DIAS_CORTOS[d]}</th>`).join('')}</tr></thead><tbody>
    ${horas.map(h => `<tr><td class="hora">${h}</td>${DIAS_LABORABLES.map(d => `<td>${cs.filter(c => c.desde === h && c.dia === d).map(c => `
      <div class="celda ${!c.profesor ? 'sin-profe' : ''} ${confl.has(c.id) ? 'conflicto' : ''}">
        <div class="act"><span>${esc(c.actividad)}</span><button data-editar-clase="${c.id}" aria-label="Editar clase">✎</button></div>
        <select data-asignar="${c.id}" aria-label="Profesor de ${esc(c.actividad)}">${opcionesProfe(c)}</select>
        ${confl.has(c.id) ? '<span class="nota">Choca con otro horario</span>' : ''}
        ${c.profesor && P(c.profesor) && c.origen !== 'profe' && !(P(c.profesor).actividades || []).includes(c.actividad) ? '<span class="nota">No figura que dé esta actividad</span>' : ''}
      </div>`).join('')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="7"><p class="vacio">No hay clases en ${esc(S.sede)}.</p></td></tr>`}
    </tbody></table></div>`;
  $$('[data-asignar]', v).forEach(s => s.onchange = async () => {
    try { await actualizar('clases', s.dataset.asignar, { profesor: s.value, profesorNombre: s.value ? nom(s.value) : '' }); toast(s.value ? `Asignada a ${nom(s.value)}` : 'Clase sin profesor'); }
    catch { toast('No se pudo guardar', true); }
  });
  $$('[data-editar-clase]', v).forEach(b => b.onclick = () => editarClase(S.clases.find(c => c.id === b.dataset.editarClase)));
  enlazarSemanaClases(v);
}
// Semana tipo (para armar la grilla) o una semana real (quién da cada clase ese día, con faltas y reemplazos)
function selectorSemanaClases() {
  const l = S.semanaClases ? deIso(S.semanaClases) : null;
  return `<div class="acciones" style="margin-bottom:10px"><div class="seg" role="group" aria-label="Semana"><button data-semc="tipo" aria-pressed="${!l}">Semana tipo (armar)</button><button data-semc="-1" aria-label="Semana anterior">‹</button><button data-semc="hoy" aria-pressed="${!!l}">${l ? `Semana del ${fechaCorta(iso(l)).slice(0, 5)}` : 'Ver con fechas'}</button><button data-semc="1" aria-label="Semana siguiente">›</button></div>${l ? leyendaEstados() : ''}</div>`;
}
function enlazarSemanaClases(v) {
  $$('[data-sede]', v).forEach(b => b.onclick = () => { S.sede = b.dataset.sede; render(); });
  $$('[data-semc]', v).forEach(b => b.onclick = () => {
    const k = b.dataset.semc, l = S.semanaClases ? deIso(S.semanaClases) : lunesDe(new Date());
    S.semanaClases = k === 'tipo' ? null : k === 'hoy' ? (S.semanaClases || iso(lunesDe(new Date()))) : iso(sumarDias(l, +k * 7));
    render();
  });
}
// Estado de una clase en una fecha: titular, quién la cubre o si falta
function estadoClase(c, f) {
  if (!c.profesor) return { k: 'falta', txt: 'Sin profe' };
  const quien = nom(c.profesor).split(' ')[0];
  // Cuenta también el pedido sin responder: ya se busca reemplazo
  const pedido = S.ausencias.some(a => a.email === c.profesor && a.estado === 'pendiente' && a.desde <= f && a.hasta >= f);
  if (!ausenteEn(c.profesor, f, S.ausencias) && !pedido) return { k: 'tit', txt: quien };
  const n = necesidadesFuturas(f, f).find(x => x.titular === c.profesor && x.desde === c.desde && (x.actividad || '') === (c.actividad || ''))
    || { titular: c.profesor, fecha: f, dia: c.dia, desde: c.desde, hasta: c.hasta, rol: 'clases', actividad: c.actividad, sede: c.sede, claseId: c.id };
  const rs = reemplazosDe(n, S.reemplazos);
  if (faltaCubrir(n, S.reemplazos).length) return { k: 'falta', txt: 'Falta · ' + quien, n };
  return { k: estadoR(rs[0]), txt: esLibre(rs[0]) ? 'No se da' : nomR(rs[0]).split(' ')[0], n, r: rs[0] };
}
function grillaSemanaFechas(v) {
  const l = deIso(S.semanaClases), fechaDe = d => iso(sumarDias(l, d - 1)), h = hoy();
  const cs = S.clases.filter(c => c.sede === S.sede);
  const horas = [...new Set(cs.map(c => c.desde))].sort();
  const faltan = DIAS_LABORABLES.reduce((t, d) => t + cs.filter(c => c.dia === d && estadoClase(c, fechaDe(d)).k === 'falta').length, 0);
  v.innerHTML = `<div class="acciones" style="margin-bottom:12px">${selectorSedes()}<span class="pill ${faltan ? 'sin' : 'cubierto'}">${faltan ? `${faltan} clase(s) sin profe esta semana` : 'Esta semana está todo cubierto'}</span></div>
    ${selectorSemanaClases()}
    <div class="tabla-wrap"><table class="grilla"><thead><tr><th>Hora</th>${DIAS_LABORABLES.map(d => `<th class="${fechaDe(d) === h ? 'hoy' : ''}">${DIAS_CORTOS[d]} ${fechaCorta(fechaDe(d)).slice(0, 5)}</th>`).join('')}</tr></thead><tbody>
    ${horas.map(hr => `<tr><td class="hora">${hr}</td>${DIAS_LABORABLES.map(d => `<td class="${fechaDe(d) === h ? 'hoy' : ''}">${cs.filter(c => c.desde === hr && c.dia === d).map(c => { const e = estadoClase(c, fechaDe(d));
      return `<button class="chip-est est-${e.k}" data-clase-dia="${c.id}|${fechaDe(d)}" title="${esc(c.actividad)}"><b>${esc(c.actividad)}</b><span>${esc(e.txt)}</span></button>`; }).join('')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="7"><p class="vacio">No hay clases en ${esc(S.sede)}.</p></td></tr>`}
    </tbody></table></div><p class="sub">Tocá una clase para ver los datos del profe, avisar que falta o elegir quién cubre.</p>`;
  enlazarSemanaClases(v);
  $$('[data-clase-dia]', v).forEach(b => b.onclick = () => { const [id, f] = b.dataset.claseDia.split('|'); verClaseDia(S.clases.find(c => c.id === id), f); });
}
function verClaseDia(c, f) {
  if (!c) return;
  const e = estadoClase(c, f), p = c.profesor && P(c.profesor);
  const m = modal(`${cabModal(c.actividad)}<p class="sub">${esc(c.sede)} · ${fechaLarga(f)} · <span class="mono">${c.desde}–${c.hasta}</span></p>
    ${p ? `<div class="persona"><div class="avatar" style="${estiloAvatar(p.email)}">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span class="sub">Titular · <span class="mono">${esc(p.telefono || 'sin teléfono')}</span></span></div></div>` : ''}
    <span class="est est-${e.k}" style="justify-self:start">${e.k === 'tit' ? 'Viene normal' : e.k === 'falta' ? (p ? 'Falta y nadie la cubre todavía' : 'La clase no tiene profe') : e.k === 'libre' ? 'Esa clase no se da (queda libre)' : `La cubre ${esc(nomR(e.r))}${e.r.externo ? ' (externo)' : ''}`}</span>
    <div class="modal-pie">${p ? `<button class="btn ghost" id="cd-ficha">Ver ficha</button>` : ''}${p?.telefono ? `<a class="btn ghost" target="_blank" rel="noopener" href="${waLink(p.telefono, `Hola ${p.nombre}! `)}">WhatsApp</a>` : ''}
      ${!p ? '<button class="btn" id="cd-asig">Asignar profe</button>' : e.k === 'tit' && f >= hoy() ? '<button class="btn" id="cd-falta">Avisó que no viene</button>' : e.n && e.k === 'falta' ? `<button class="btn" data-resolver="${regResolver(e.n)}">Buscar quién cubre</button>` : ''}</div>`);
  $('#cd-ficha', m.el)?.addEventListener('click', () => { m.cerrar(); verFicha(p); });
  $('#cd-asig', m.el)?.addEventListener('click', () => { m.cerrar(); editarClase(c); });
  $('#cd-falta', m.el)?.addEventListener('click', async () => {
    try { await agregar('ausencias', { email: p.email, nombre: nombreCompleto(p), tipo: 'ausencia', desde: f, hasta: f, motivo: 'Avisó', estado: 'aprobada', creado: AHORA, respondida: AHORA, respondidaPor: S.user.email, cargadaPorGerencia: true }); }
    catch { return toast('No se pudo guardar', true); }
    m.cerrar(); toast(`Anotado: ${p.nombre} no viene el ${fechaCorta(f).slice(0, 5)}. Ahora elegí quién cubre.`);
    setTimeout(() => { const n = necesidadesFuturas(f, f).find(x => x.titular === p.email && x.desde === c.desde); if (n) resolver(n); }, 400);
  });
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
    d.profesorNombre = d.profesor ? nom(d.profesor) : '';
    try { await guardar('clases', c.id || idClase(d), { ...(c.creadaPor ? { origen: c.origen, creadaPor: c.creadaPor } : {}), ...d }); m.cerrar(); toast('Clase guardada'); } catch { toast('No se pudo guardar', true); }
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
    const r = aus ? cubierto({ titular: tit, fecha, desde: c.desde, hasta: c.hasta, actividad: c.actividad }, S.reemplazos) : null;
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
    <div class="leyenda" style="margin:10px 0"><span><span class="ev neutro">12 clases</span> todo cubierto</span><span><span class="ev vacaciones aprobada">reemplazo</span> clase con reemplazo</span><span><span class="ev sin">sin cubrir</span> falta profesor</span><span><span class="mini-sala" style="display:inline-block;width:40px;vertical-align:middle"><i style="left:0;width:60%;background:hsl(200 70% 55%)"></i><i style="left:60%;width:40%;background:var(--accent)"></i></span> sala de musculación (color por persona, rojo sin nadie)</span></div>
    <div class="cal">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="dn">${d}</div>`).join('')}
    ${diasCalendario(S.mesGrilla).map(d => {
      const f = iso(d); const est = estadoDelDia(f);
      const sin = est.filter(x => !x.ok).length, rem = est.filter(x => x.r).length;
      return `<button class="d ${d.getMonth() !== m - 1 ? 'fuera' : ''} ${d.getDay() === 0 ? 'dom' : ''} ${f === h ? 'hoy' : ''}" data-dia="${f}">
        <span class="n">${d.getDate()}</span>
        ${est.length ? `<span class="ev neutro">${est.length} clases</span>` : ''}
        ${rem ? `<span class="ev vacaciones aprobada">${rem} reemplazo${rem > 1 ? 's' : ''}</span>` : ''}
        ${sin ? `<span class="ev sin">${sin} sin cubrir</span>` : ''}
        ${miniSala(d.getDay(), f)}</button>`;
    }).join('')}</div>`;
  enlazarNavMes(v, 'mesGrilla');
  $$('[data-dia]', v).forEach(b => b.onclick = () => verDia(b.dataset.dia));
}
// Barritas de la sala para la celda de un día: una fila por carril, de la hora de apertura a la de cierre
function miniSala(d, f) {
  if (!HORARIO_CLUB[d] || !turnosSala().length) return '';
  const bs = bloquesSala(d, f), largo = FIN_CLUB - INI_CLUB, n = bs[0]?.de || 0;
  const pos = b => `left:${(min(b.desde) - INI_CLUB) * 100 / largo}%;width:${(min(b.hasta) - min(b.desde)) * 100 / largo}%`;
  const color = b => b.tipo === 'hueco' ? 'background:var(--accent)' : b.tipo === 'ausente' ? 'background:repeating-linear-gradient(90deg,var(--muted) 0 2px,transparent 2px 4px)' : `background:hsl(${colorDe(b.clave)} 70% 58%)`;
  return Array.from({ length: n }, (_, i) => `<span class="mini-sala">${bs.filter(b => b.carril === i).map(b => `<i style="${pos(b)};${color(b)}"></i>`).join('')}</span>`).join('');
}
// Una barra por persona: de qué hora a qué hora está ese día (turnos, clases y reemplazos)
function lineaDelDia(f) {
  const dia = deIso(f).getDay();
  if (!HORARIO_CLUB[dia]) return '';
  const filas = [];
  for (const p of activos()) {
    const ag = agenda(p, S.clases).filter(s => s.dia === dia);
    const aus = ausenteEn(p.email, f, S.ausencias);
    const cubre = S.reemplazos.filter(r => r.fecha === f && r.reemplazo === p.email);
    if (!ag.length && !cubre.length) continue;
    const pedido = !aus && S.ausencias.some(a => a.email === p.email && a.estado === 'pendiente' && a.desde <= f && a.hasta >= f);
    const necs = aus || pedido ? necesidadesFuturas(f, f).filter(n => n.titular === p.email) : [];
    filas.push({ nombre: nombreCompleto(p), email: p.email, aus: !!aus || pedido, bs: [
      ...ag.map(s => ({ desde: s.desde, hasta: s.hasta, tipo: aus || pedido ? 'ausente' : 'tit', clave: p.email, txt: s.actividad || ROL_CORTO[s.rol] })),
      // Lo que falta cubrir de quien no viene, en rojo y para tocar
      ...necs.flatMap(n => faltaCubrir(n, S.reemplazos).filter(([d, h]) => d && h).map(([d, h]) => ({ desde: d, hasta: h, tipo: 'falta', txt: 'Falta · ' + (n.actividad || ROL_CORTO[n.rol]), n }))),
      ...cubre.map(r => ({ desde: r.desde, hasta: r.hasta, tipo: estadoR(r), clave: p.email, txt: `cubre a ${(r.titularNombre || nom(r.titular)).split(' ')[0]}` })),
    ] });
  }
  // Quien cubre y no está en el sistema
  const ext = {};
  for (const r of S.reemplazos.filter(r => r.fecha === f && r.externo && !esLibre(r))) (ext[r.reemplazo] = ext[r.reemplazo] || { nombre: r.reemplazoNombre, email: '', ext: r.reemplazo, bs: [] }).bs.push({ desde: r.desde, hasta: r.hasta, tipo: 'ext', clave: r.reemplazo, txt: `cubre a ${(r.titularNombre || nom(r.titular)).split(' ')[0]}` });
  filas.push(...Object.values(ext));
  const huecosSala = turnosSala().length ? bloquesSala(dia, f).filter(b => b.tipo === 'hueco') : [];
  if (!filas.length) return '';
  filas.sort((a, b) => Math.min(...a.bs.map(x => min(x.desde))) - Math.min(...b.bs.map(x => min(x.desde))));
  const [a0, a1] = HORARIO_CLUB[dia].map(min), largo = a1 - a0;
  const tramo = b => { const d = Math.max(min(b.desde), a0), h = Math.min(min(b.hasta), a1); if (h <= d) return '';
    const est = ESTADOS_TURNO[b.tipo] ? `est-${b.tipo}` : '', tag = b.n ? 'button' : 'div';
    return `<${tag} class="${est}" ${b.n ? `data-resolver="${regResolver(b.n)}"` : ''} style="left:${(d - a0) * 100 / largo}%;width:${(h - d) * 100 / largo}%;${est ? '' : estiloBloque(b)}" title="${esc(`${b.txt || ''} ${b.desde}–${b.hasta}`)}">${esc(b.txt || '')} ${b.desde}–${b.hasta}</${tag}>`; };
  const ahora = f === hoy() ? minutosDelDia(Date.now()) : null;
  const horas = []; for (let m = Math.ceil(a0 / 60) * 60; m <= a1; m += 120) horas.push(m);
  return `<div class="linea-dia">
    <div class="ld-fila"><span></span><div class="ld-escala">${horas.map(m => `<span style="left:${(m - a0) * 100 / largo}%">${hhmm(m).slice(0, 2)}</span>`).join('')}</div></div>
    ${filas.map(x => `<div class="ld-fila"><button class="btn sm ghost ${x.ext ? 'ld-ext' : ''}" ${x.email ? `data-ficha="${esc(x.email)}"` : x.ext ? `data-ext="${esc(x.ext)}"` : ''} ${x.aus ? 'style="text-decoration:line-through;color:var(--muted)"' : ''}>${esc(x.nombre.split(' ')[0])}</button><div class="rem-barra">${ahora != null && ahora > a0 && ahora < a1 ? `<i class="ahora" style="left:${(ahora - a0) * 100 / largo}%"></i>` : ''}${x.bs.map(tramo).join('')}</div></div>`).join('')}
    ${huecosSala.length ? `<div class="ld-fila"><span style="color:var(--accent);font-size:.78rem;font-weight:700">Sala sin nadie</span><div class="rem-barra">${huecosSala.map(b => tramo({ ...b, txt: '' })).join('')}</div></div>` : ''}
  </div>`;
}
function verDia(f) {
  const est = estadoDelDia(f);
  const dia = deIso(f).getDay();
  const turnos = activos().flatMap(p => (p.horarios || []).filter(s => s.dia === dia).map(s => ({ ...s, p })));
  const m = modal(`${cabModal(fechaLarga(f))}
    ${lineaDelDia(f)}
    ${est.length ? `<h4>Clases</h4><div class="tabla-wrap"><table><thead><tr><th>Hora</th><th>Clase</th><th>Da la clase</th></tr></thead><tbody>
      ${est.map(x => `<tr><td class="mono">${x.c.desde}</td><td>${esc(x.c.actividad)} <span class="sub">· ${esc(x.c.sede)}</span></td>
        <td>${!x.tit ? '<span class="pill sin">Sin profesor</span>' : x.aus ? (x.r ? `${esc(nomsTurno({ titular: x.tit, fecha: f, desde: x.c.desde, hasta: x.c.hasta, actividad: x.c.actividad }))} <span class="pill info">reemplaza a ${esc(nom(x.tit))}</span>` : `<span class="pill sin">${esc(nom(x.tit))} ausente · sin cubrir</span>`) : esc(nom(x.tit))}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="vacio">No hay clases este día.</p>'}
    ${turnos.length ? `<h4>Turnos fijos</h4><div class="lista">${turnos.sort((a, b) => a.desde.localeCompare(b.desde)).map(t => {
      const aus = ausenteEn(t.p.email, f, S.ausencias);
      const n = { titular: t.p.email, fecha: f, desde: t.desde, hasta: t.hasta, actividad: '' };
      const falta = aus ? faltaCubrir(n, S.reemplazos) : [];
      return `<div class="item"><span><span class="rol rol-${t.rol}">${ROL_CORTO[t.rol]}</span> <span class="mono">${t.desde}–${t.hasta}</span> ${esc(nombreCompleto(t.p))}</span>
        ${aus ? `${reemplazosDe(n, S.reemplazos).length ? `<span class="pill info">cubre ${esc(nomsTurno(n))}</span>` : ''} ${falta.length ? `<span class="pill sin">sin cubrir ${falta.map(x => x.join('–')).join(', ')}</span>` : ''}` : ''}</div>`;
    }).join('')}</div>` : ''}
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cerrar</button></div>`, { ancho: true });
  $$('[data-ficha]', m.el).forEach(b => b.onclick = () => { m.cerrar(); verFicha(P(b.dataset.ficha)); });
  $$('[data-ext]', m.el).forEach(b => b.onclick = () => { m.cerrar(); verExterno(EXT(b.dataset.ext)); });
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
      const minNec = necs.filter(n => !n.generico && n.desde && n.hasta).reduce((t, n) => t + min(n.hasta) - min(n.desde), 0);
      const choques = S.ausencias.filter(x => x.id !== a.id && x.estado === 'aprobada' && x.desde <= a.hasta && x.hasta >= a.desde);
      return `<div class="item"><div><b>${esc(a.nombre || nom(a.email))} · ${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'}</b>
        <span class="sub"><span class="mono">${rangoTexto(a.desde, a.hasta)}</span>${a.motivo ? ' · ' + esc(a.motivo) : ''}</span>
        <span class="impacto"><span class="i-dias">${textoDias(a.desde, a.hasta, P(a.email), S.clases)}</span> · <span class="i-horas">${minNec ? `deja ${horasTxt(minNec)} para cubrir` : necs.length ? `${necs.length} turno(s) a confirmar` : 'no deja nada para cubrir'}</span></span>
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
    const k = r.reemplazo; por[k] = por[k] || { nombre: nomR(r), qs: {} };
    const q = r.rol === 'clases' ? r.actividad : ROL_CORTO[r.rol];
    por[k].qs[q] = (por[k].qs[q] || 0) + 1;
  }
  return Object.entries(por).map(([e, x]) => ({ email: e, nombre: x.nombre, detalle: Object.entries(x.qs).map(([q, n]) => `${q} ×${n}`).join(', ') }));
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
    t[a.tipo === 'vacaciones' ? 'vac' : 'aus'] += diasDeTrabajo(a.desde, a.hasta, P(a.email), S.clases);
  }
  const personas = [...new Set(S.ausencias.map(a => a.email))].map(e => [e, nom(e)]).sort((a, b) => a[1].localeCompare(b[1]));
  return `<div class="panel"><div class="cab"><h3>Historial</h3><div class="acciones">
      <select id="h-anio" style="width:auto">${anios.map(y => `<option ${y === anio ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select id="h-persona" style="width:auto"><option value="">Todo el personal</option>${personas.map(([e, n]) => `<option value="${esc(e)}" ${e === S.histPersona ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
    ${Object.keys(tot).length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th class="num">Días de vacaciones ${anio}</th><th class="num">Días de ausencia ${anio}</th></tr></thead><tbody>
      ${Object.values(tot).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(t => `<tr><td>${esc(t.nombre)}</td><td class="num mono">${t.vac}</td><td class="num mono">${t.aus}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${lista.length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th>Tipo</th><th>Fechas</th><th class="num">Días de trabajo</th><th>Estado</th><th>Quién cubrió</th><th></th></tr></thead><tbody>
      ${lista.map(a => `<tr><td>${esc(a.nombre || nom(a.email))}</td><td>${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'}${a.cargadaPorGerencia ? ' <span class="pill neutro">cargada por gerencia</span>' : ''}</td>
        <td class="mono">${rangoTexto(a.desde, a.hasta)}</td><td class="num mono">${diasDeTrabajo(a.desde, a.hasta, P(a.email), S.clases)}</td><td><span class="pill ${a.estado}">${ESTADOS[a.estado]}</span></td>
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

// Por qué una ausencia no genera reemplazos: sin ficha, sin clases/turnos a su nombre, o no caen en esas fechas
function motivoSinReemplazo(a, p) {
  if (!p) return `<div class="aviso"><div><b>No encontramos la ficha de ${esc(a.nombre || a.email)} en Personal</b><span>Sin ficha el sistema no sabe qué clases o turnos tiene.</span></div></div>`;
  const ag = agenda(p, S.clases);
  if (!ag.length) {
    const decl = S.clases.filter(c => (p.clasesDeclaradas || []).includes(c.id));
    return `<div class="aviso"><div><b>${esc(p.nombre)} no tiene clases ni turnos cargados a su nombre</b>
      <span>Por eso el sistema no sabe qué hay que cubrir. ${decl.length
        ? `Declaró ${decl.length} clase(s) en el censo, pero en la grilla figuran ${decl.some(c => c.profesor) ? 'a nombre de otro profe' : 'sin profesor'}: asignáselas en <b>Grilla de clases</b>.`
        : 'Cargale sus clases u horario fijo desde su ficha.'}</span>
      <button class="btn sm" data-ficha="${esc(p.email)}" style="justify-self:start">Abrir su ficha</button></div></div>`;
  }
  // Con la regla actual solo queda sin reemplazo si todos los días pedidos el club está cerrado (domingos)
  return '<p class="sub">El club está cerrado esos días (domingo): no hace falta reemplazo.</p>';
}

function verAusencia(a) {
  if (!a) return;
  const p = P(a.email);
  const necs = necesidades(a, p, S.clases);
  const sin = necs.filter(n => !cubierto(n, S.reemplazos)).length;
  const m = modal(`${cabModal(a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia')}
    <div class="persona"><div class="avatar">${esc(iniciales(p || { nombre: a.nombre }))}</div><div><b>${esc(a.nombre || nom(a.email))}</b><div>${p ? chipsRoles(p) : ''}</div></div>
      <span class="pill ${a.estado}" style="margin-left:auto">${ESTADOS[a.estado]}</span></div>
    <p><b class="mono">${rangoTexto(a.desde, a.hasta)}</b> · ${textoDias(a.desde, a.hasta, p, S.clases)}${a.motivo ? `<br><span class="sub">Motivo: ${esc(a.motivo)}</span>` : ''}${a.nota ? `<br><span class="sub">Nota de gerencia: ${esc(a.nota)}</span>` : ''}</p>
    ${p ? htmlContacto(p) : ''}
    ${a.estado !== 'rechazada' && necs.length ? `<div style="display:grid;gap:8px"><h4>Quién cubre</h4><div class="tabla-wrap"><table><thead><tr><th>Día</th><th>Horario</th><th>Qué</th><th>Cubre</th></tr></thead><tbody>
      ${necs.map(n => { const r = cubierto(n, S.reemplazos); return `<tr><td>${fechaCorta(n.fecha).slice(0, 5)} ${DIAS_CORTOS[n.dia]}</td><td class="mono">${n.desde}–${n.hasta}</td><td>${esc(n.rol === 'clases' ? queCubre(n) : ROL_CORTO[n.rol])}</td>
        <td>${r ? `<b>${esc(nomsTurno(n))}</b>` : `${reemplazosDe(n, S.reemplazos).length ? `<b>${esc(nomsTurno(n))}</b> ` : ''}<span class="pill sin">${reemplazosDe(n, S.reemplazos).length ? 'Falta ' + faltaCubrir(n, S.reemplazos).map(x => x.join('–')).join(', ') : 'Sin cubrir'}</span>`}</td></tr>`; }).join('')}
    </tbody></table></div></div>` : ''}
    <div style="display:grid;gap:8px"><h4>Reemplazo que necesita</h4>${necs.length ? htmlTipoReemplazo(necs) : motivoSinReemplazo(a, p)}
      ${necs.some(n => n.generico) ? '<span class="sub">Los días que no figuran en su horario se piden igual, con el horario a confirmar. Revisá su ficha por si le falta cargar ese día.</span>' : ''}
      ${a.estado !== 'rechazada' && necs.length ? `<span class="sub">${sin ? `${sin} de ${necs.length} todavía sin cubrir.` : 'Todo cubierto.'}</span>` : ''}</div>
    <div class="modal-pie"><button class="btn ghost" id="a-borrar" style="margin-right:auto">Eliminar</button>
      ${a.estado !== 'rechazada' ? '<button class="btn ghost" id="a-rech">Rechazar</button>' : ''}
      ${a.estado !== 'aprobada' ? '<button class="btn ok" id="a-apr">Aprobar</button>' : ''}
      ${a.estado !== 'rechazada' && necs.length ? '<button class="btn" id="a-rem">Asignar reemplazos</button>' : ''}</div>`, { ancho: true });
  $$('[data-ficha]', m.el).forEach(b => b.onclick = () => { m.cerrar(); verFicha(P(b.dataset.ficha)); });
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
        ${sinCorreo(P(a.email)) ? '' : `<button class="btn" id="r-mail">Abrir correo</button>`}
        ${aprobar && necs.length ? '<button class="btn ok" id="ir-rem">Asignar reemplazos</button>' : ''}</div>`);
    $('#ir-rem', m2.el)?.addEventListener('click', () => { m2.cerrar(); irA('reemplazos'); });
    $('#r-mail', m2.el)?.addEventListener('click', async e => {
      const como = await enviarCorreo(S.config, { para: a.email, cc: S.config.correoCC || '', asunto: t.asunto, cuerpo: t.cuerpo, responderA: destinos(S.config).correo || '' });
      if (como === 'auto') { e.target.textContent = 'Correo enviado ✓'; e.target.disabled = true; toast(`Correo enviado a ${a.email}`); }
    });
  };
}

function cargarAusencia(email = '', pre = {}) {
  const m = modal(`${cabModal('Cargar ausencia')}<p class="sub">Para cuando avisan por teléfono o en persona. Queda aprobada directamente.</p>
    <div class="form"><label>Persona<select id="ca-p">${activos().sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))).map(p => `<option value="${esc(p.email)}" ${p.email === email ? 'selected' : ''}>${esc(nombreCompleto(p))}</option>`).join('')}</select></label>
      <div class="fila"><label>Tipo<select id="ca-t"><option value="ausencia">Ausencia</option><option value="vacaciones">Vacaciones</option></select></label>
        <label>Desde<input type="date" id="ca-d" value="${hoy()}"></label><label>Hasta<input type="date" id="ca-h" value="${hoy()}"></label></div>
      <label>Motivo<input id="ca-m"></label></div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="ca-ok">Guardar</button></div>`);
  // El asistente la puede abrir ya completa (tipo, fechas y motivo)
  if (pre.tipo) $('#ca-t', m.el).value = pre.tipo;
  if (pre.desde) $('#ca-d', m.el).value = pre.desde;
  if (pre.hasta || pre.desde) $('#ca-h', m.el).value = pre.hasta || pre.desde;
  if (pre.motivo) $('#ca-m', m.el).value = pre.motivo;
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
  if (S.remVista === 'hist') return vHistorialRem(v);
  const h = hoy();
  const aus = S.ausencias.filter(a => (a.estado === 'aprobada' || a.estado === 'pendiente') && a.hasta >= h).sort((a, b) => a.desde.localeCompare(b.desde));
  let bloques = aus.map(a => {
    const necs = necesidades(a, P(a.email), S.clases).filter(n => n.fecha >= h).map(n => ({ ...n, r: cubierto(n, S.reemplazos) }));
    return { a, necs, mostrar: S.soloSinCubrir ? necs.filter(n => !n.r) : necs };
  });
  const sinNecesidades = bloques.filter(b => !b.necs.length).map(b => b.a);
  bloques = bloques.filter(b => b.necs.length);
  const total = bloques.reduce((t, b) => t + b.necs.filter(n => !n.r).length, 0);
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Detección automática</span><h1>Reemplazos</h1>
      <p class="sub">${total ? `${total} turnos o clases sin cubrir.` : 'Todo cubierto.'} El sistema propone a quien tiene el mismo rol, da esa actividad, no está de vacaciones y está libre en ese horario.</p></div>
      <div class="acciones">${tabsRem()}<div class="seg" role="group" aria-label="Filtro"><button data-f="1" aria-pressed="${S.soloSinCubrir}">Sin cubrir</button><button data-f="0" aria-pressed="${!S.soloSinCubrir}">Todos</button></div></div></div>
    <div class="acciones">${leyendaEstados()}</div>
    ${bloques.length ? bloques.map(({ a, necs, mostrar }) => {
      const p = P(a.email);
      return `<div class="panel">
        <div class="cab"><div class="persona"><div class="avatar">${esc(iniciales(p || { nombre: a.nombre }))}</div><div><b>${esc(a.nombre || nom(a.email))}</b>
          <span class="sub">${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span>${a.estado === 'pendiente' ? ' · <span class="pill pendiente">pendiente de aprobar</span>' : ''}</span></div></div>
          <span class="pill ${necs.some(n => !n.r) ? 'sin' : 'cubierto'}">${necs.filter(n => n.r).length}/${necs.length} cubiertos</span></div>
        <div style="display:grid;gap:6px"><span class="eyebrow">Necesita</span>${htmlTipoReemplazo(necs.filter(n => !n.r).length ? necs.filter(n => !n.r) : necs)}</div>
        <div>${mostrar.length ? mostrar.map(n => htmlNecesidad(n)).join('') : '<p class="vacio">Todo cubierto.</p>'}</div></div>`;
    }).join('') : '<p class="vacio">No hay ausencias aprobadas con turnos por delante.</p>'}
    ${sinNecesidades.length ? `<div class="panel"><h3>Pedidos sin reemplazos para buscar</h3>
      ${sinNecesidades.map(a => `<div style="display:grid;gap:6px"><b>${esc(a.nombre || nom(a.email))} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span></b>${motivoSinReemplazo(a, P(a.email))}</div>`).join('')}</div>` : ''}`;
  $$('[data-f]', v).forEach(b => b.onclick = () => { S.soloSinCubrir = b.dataset.f === '1'; render(); });
  enlazarTabsRem(v);
  enlazarNecesidades(v);
}
const tabsRem = () => `<div class="seg" role="group" aria-label="Vista"><button data-remv="cubrir" aria-pressed="${S.remVista !== 'hist'}">Por cubrir${sinCubrir14().length ? ` <span class="cuenta">${sinCubrir14().length}</span>` : ''}</button><button data-remv="hist" aria-pressed="${S.remVista === 'hist'}">Historial: quién cubrió</button></div>`;
const enlazarTabsRem = v => $$('[data-remv]', v).forEach(b => b.onclick = () => { S.remVista = b.dataset.remv; render(); });
// Botones de las tarjetas de "falta cubrir" (en Reemplazos y en el panel Resolver). "listo" se llama al terminar.
function enlazarNecesidades(v, listo) {
  const ok = () => listo?.();
  $$('[data-asignar-r]', v).forEach(b => b.onclick = async () => { await asignar(JSON.parse(b.dataset.n), b.dataset.asignarR); ok(); });
  $$('[data-asignar-ext]', v).forEach(b => b.onclick = async () => { await asignarExterno(JSON.parse(b.dataset.n), b.dataset.asignarExt); ok(); });
  $$('[data-libre]', v).forEach(b => b.onclick = async () => { await asignarExterno(JSON.parse(b.dataset.libre), '__libre'); ok(); });
  $$('[data-quitar-r]', v).forEach(b => b.onclick = async () => { await borrar('reemplazos', b.dataset.quitarR); toast('Reemplazo quitado'); ok(); });
  $$('[data-mas]', v).forEach(b => b.onclick = () => { b.closest('.nec').querySelectorAll('.cand[hidden]').forEach(c => { c.hidden = false; }); b.remove(); });
  $$('[data-manual]', v).forEach(b => b.onclick = () => { ok(); asignarManual(JSON.parse(b.dataset.manual)); });
  $$('[data-ext]', v).forEach(b => b.onclick = () => { ok(); verExterno(EXT(b.dataset.ext)); });
  $$('[data-ficha]', v).forEach(b => b.onclick = () => { ok(); verFicha(P(b.dataset.ficha)); });
}
// Un externo (o "queda libre") cubre lo que falta del turno
async function asignarExterno(n, id) {
  const piezas = faltaCubrir(n, S.reemplazos);
  if (!piezas.length) return toast('Ese turno ya está cubierto');
  const x = id === '__libre' ? { id: 'externo:queda-libre', nombre: 'Queda libre (sin profe)', tel: '' } : EXT(id);
  if (!x) return toast('No encontré a esa persona en Externos', true);
  const quien = { reemplazo: x.id, reemplazoNombre: x.nombre, reemplazoTel: x.tel || '', externo: true };
  try { await lote(piezas.map(([d, h]) => ({ c: 'reemplazos', id: Math.random().toString(36).slice(2, 14), data: docReemplazo(n, quien, d || n.desde, h || n.hasta) }))); }
  catch { return toast('No se pudo asignar', true); }
  toast(id === '__libre' ? `${piezas.map(p => p.join('–')).join(', ')} queda sin profe a propósito` : `${x.nombre} (externo) cubre ${queCubre(n)} el ${fechaCorta(n.fecha).slice(0, 5)}`);
}
// Historial: quién cubrió, a quién, cuándo y cuántas horas (staff y externos)
function vHistorialRem(v) {
  const meses = [...new Set([mesDe(new Date()), ...S.reemplazos.map(r => r.fecha.slice(0, 7))])].sort().reverse();
  if (!meses.includes(S.histMes)) S.histMes = meses[0];
  const xs = S.reemplazos.filter(r => r.fecha.slice(0, 7) === S.histMes && !esLibre(r) && (S.histTipo === 'todos' || (S.histTipo === 'ext') === !!r.externo))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.desde.localeCompare(b.desde));
  const por = {};
  for (const r of xs) { const k = r.reemplazo; por[k] = por[k] || { k, nombre: nomR(r), ext: !!r.externo, m: 0, n: 0 }; por[k].m += minR(r); por[k].n++; }
  const nomMes = k => `${MESES[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Todo queda guardado</span><h1>Reemplazos</h1><p class="sub">Quién cubrió a quién, cuándo y cuántas horas. Sirve para pagarle a los externos y para ver quién ayuda más.</p></div><div class="acciones">${tabsRem()}</div></div>
    <div class="acciones"><select id="hr-mes" style="width:auto">${meses.map(k => `<option value="${k}" ${k === S.histMes ? 'selected' : ''}>${nomMes(k)}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="Quiénes">${[['todos', 'Todos'], ['stf', 'Staff'], ['ext', 'Externos']].map(([k, t]) => `<button data-htipo="${k}" aria-pressed="${S.histTipo === k}">${t}</button>`).join('')}</div></div>
    ${Object.keys(por).length ? `<div class="kpis">${Object.values(por).sort((a, b) => b.m - a.m).map(x => `<button class="kpi ${x.ext ? 'kpi-ext' : ''}" ${x.ext ? `data-ext="${esc(x.k)}"` : `data-ficha="${esc(x.k)}"`}><b>${horasTxt(x.m)}</b><span>${esc(x.nombre)}${x.ext ? ' · externo' : ''} · ${x.n} ${x.n === 1 ? 'vez' : 'veces'}</span></button>`).join('')}</div>` : ''}
    <div class="panel">${xs.length ? `<div class="lista">${xs.map(r => `<div class="item fila-est ${estadoR(r)}"><div><b>${esc(nomR(r))} cubrió a ${esc((r.titularNombre || nom(r.titular)))}</b>
      <span class="sub">${fechaCorta(r.fecha)} · ${esc(queCubre(r))} · <span class="mono">${r.desde}–${r.hasta}</span> · ${horasTxt(minR(r))}</span></div>
      <div class="acciones">${r.fecha > hoy() ? '<span class="pill neutro">programado</span>' : ''}${r.externo ? '<span class="pill ext">externo</span>' : ''}</div></div>`).join('')}</div>` : `<p class="vacio">No hay reemplazos en ${nomMes(S.histMes)}.</p>`}</div>`;
  enlazarTabsRem(v);
  $('#hr-mes').onchange = e => { S.histMes = e.target.value; render(); };
  $$('[data-htipo]', v).forEach(b => b.onclick = () => { S.histTipo = b.dataset.htipo; render(); });
  $$('[data-ext]', v).forEach(b => b.onclick = () => verExterno(EXT(b.dataset.ext)));
  enlazarFichas(v);
}

function htmlNecesidad(n) {
  const nd = esc(JSON.stringify({ fecha: n.fecha, dia: n.dia, desde: n.desde, hasta: n.hasta, rol: n.rol, actividad: n.actividad, sede: n.sede, claseId: n.claseId, titular: n.titular, ausenciaId: n.ausenciaId, ...(n.generico ? { generico: true } : {}) }));
  const cab = `<div class="nec-cab"><b>${fechaLarga(n.fecha)}</b>${n.generico ? '<span class="pill neutro" title="Ese día no figura en su horario: confirmá el horario con la persona">horario a confirmar</span>' : `<span class="mono">${n.desde}–${n.hasta}</span>`}<span class="rol rol-${n.rol}">${ROL_CORTO[n.rol]}</span><span>${esc(n.rol === 'clases' ? queCubre(n) : ROLES[n.rol])}</span></div>`;
  const rs = reemplazosDe(n, S.reemplazos);
  const falta = faltaCubrir(n, S.reemplazos);
  // Quiénes ya cubren (todo el turno o una parte)
  const partes = rs.map(r => {
    const q = !r.externo && P(r.reemplazo), tel = q?.telefono || r.reemplazoTel;
    const parcial = rs.length > 1 || falta.length || r.desde !== n.desde || r.hasta !== n.hasta;
    return `<div class="acciones"><span class="pill ${esLibre(r) ? 'neutro' : r.externo ? 'ext' : 'cubierto'}">${parcial ? `<span class="mono">${r.desde}–${r.hasta}</span> · ` : ''}${esLibre(r) ? 'Queda libre (sin profe)' : `Cubre ${esc(nomR(r))}${r.externo ? ' · externo' : ''}`}</span>
      ${tel ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(tel, textoReemplazo({ ...n, desde: r.desde, hasta: r.hasta }, q || { nombre: r.reemplazoNombre.split(' ')[0] }))}">WhatsApp</a>` : ''}
      ${q ? `<button class="btn sm ghost" data-ficha="${esc(r.reemplazo)}">Ficha</button>` : ''}<button class="btn sm ghost" data-quitar-r="${r.id}">Quitar</button></div>`;
  }).join('');
  // Barra del turno: cada parte con el color de quien la cubre, lo que falta en rojo
  const largo = min(n.hasta) - min(n.desde);
  const tramo = (d, h, estilo, txt, k) => `<div class="${k ? 'est-' + k : ''}" style="left:${(min(d) - min(n.desde)) * 100 / largo}%;width:${(min(h) - min(d)) * 100 / largo}%;${estilo}" title="${esc(txt)}">${esc(txt)}</div>`;
  const barra = n.generico || !largo ? '' : `<div class="rem-barra">${rs.map(r => tramo(r.desde, r.hasta, '', `${esLibre(r) ? 'Queda libre' : nomR(r).split(' ')[0]} ${r.desde}–${r.hasta}`, estadoR(r))).join('')}
    ${falta.map(([d, h]) => tramo(d, h, '', `Falta ${d}–${h}`, 'falta')).join('')}</div>`;
  if (!falta.length) return `<div class="nec">${cab}${barra}${partes}</div>`;
  // Si ya lo cubren en parte, se buscan libres para lo que falta (no para el turno entero)
  const cs = candidatos(rs.length ? { ...n, desde: falta[0][0], hasta: falta[0][1] } : n, S.personal, S.ausencias, S.reemplazos, S.clases);
  const [fd, fh] = falta[0][0] ? falta[0] : [n.desde || '00:00', n.hasta || '23:59'];
  const exts = externos().filter(x => (x.acts || []).includes(queAct(n)) && libreExt(x, n.fecha, fd, fh));
  const htmlExt = exts.length ? `<span class="eyebrow" style="color:var(--ext)">Externos que dan ${esc(queAct(n))} (no son staff)</span><div class="cands">${exts.map(x => `<div class="cand cand-ext">
      <div class="persona"><div class="avatar av-ext">${esc(x.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div><div><b>${esc(x.nombre)}</b><span class="sub mono">${esc(x.tel || 'sin teléfono')}</span>${x.disp ? `<span class="sub">${esc(x.disp)}</span>` : ''}</div></div>
      <div class="acciones">${x.tel ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(x.tel, textoReemplazo(n, { nombre: x.nombre.split(' ')[0] }))}">WhatsApp</a>` : ''}<button class="btn sm ghost" data-ext="${esc(x.id)}">Ficha</button>
        <button class="btn sm ext" data-asignar-ext="${esc(x.id)}" data-n="${nd}">Asignar</button></div></div>`).join('')}</div>` : '';
  return `<div class="nec">${cab}${barra}${partes}
    ${cs.length ? `<span class="eyebrow" style="color:var(--ok)">Staff libre</span><div class="cands">${cs.map(({ p, carga, disponible }, i) => `<div class="cand" ${i >= 3 ? 'hidden' : ''}>
        <div class="persona"><div class="avatar">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span class="sub mono">${esc(p.telefono || 'sin teléfono')}</span><span class="sub">${esc(p.email)}</span></div></div>
        <span class="sub">${disponible ? '<span class="pill aprobada">Dijo que puede cubrir en ese horario</span> ' : ''}${carga ? `Ya cubre ${carga} este mes` : 'Sin reemplazos este mes'}</span>
        <div class="acciones">
          ${p.telefono ? `<a class="btn sm ghost" target="_blank" rel="noopener" href="${waLink(p.telefono, textoReemplazo(n, p))}">WhatsApp</a>` : ''}
          <a class="btn sm ghost" href="${mailto(p.email, '', `Reemplazo ${fechaCorta(n.fecha)} ${n.desde}`, textoReemplazo(n, p))}">Correo</a>
          <button class="btn sm ghost" data-ficha="${esc(p.email)}">Ficha</button>
          <button class="btn sm" data-asignar-r="${esc(p.email)}" data-n="${nd}">${rs.length ? 'Asignar lo que falta' : 'Asignar'}</button></div></div>`).join('')}</div>
      ${cs.length > 3 ? `<button class="btn sm ghost" data-mas style="justify-self:start">Ver ${cs.length - 3} más</button>` : ''}`
    : `<div class="aviso ${exts.length ? '' : 'mal'}"><div><b>Nadie del staff libre con ese perfil.</b><span>No hay ${n.rol === 'clases' ? `profes que den ${esc(n.actividad)}` : esc(ROLES[n.rol].toLowerCase())} del staff libres en ese horario.${exts.length ? ' Abajo están los externos.' : ' Podés cargar a otra persona (queda guardada en Externos).'}</span></div></div>`}
    ${htmlExt}
    <div class="acciones"><button class="btn sm ghost" data-manual="${nd}">Cubrir por partes u otra persona</button><button class="btn sm ghost" data-libre="${nd}">Dejar sin profe</button></div></div>`;
}

// Guarda un reemplazo de una parte del turno (por defecto, el turno entero)
const docReemplazo = (n, quien, desde = n.desde, hasta = n.hasta) => ({
  ...n, desde, hasta, turnoDesde: n.desde, turnoHasta: n.hasta, titularNombre: nom(n.titular),
  ...quien, creado: AHORA, asignadoPor: S.user.email,
});

async function asignar(n, email) {
  const q = P(email);
  // Cubre lo que falta del turno (si ya lo cubre alguien en parte, solo el resto)
  const piezas = faltaCubrir(n, S.reemplazos);
  const parcial = piezas.length !== 1 || piezas[0][0] !== n.desde || piezas[0][1] !== n.hasta;
  const quien = { reemplazo: email, reemplazoNombre: nombreCompleto(q) };
  const docs = piezas.map(([d, h]) => docReemplazo(n, quien, d, h));
  const doc = docs[0];
  try { await lote(docs.map(data => ({ c: 'reemplazos', id: Math.random().toString(36).slice(2, 14), data }))); } catch { return toast('No se pudo asignar', true); }
  toast(`${nombreCompleto(q)} cubre ${queCubre(n)} el ${fechaCorta(n.fecha)}${parcial ? ' (' + piezas.map(x => x.join('–')).join(', ') + ')' : ''}`);
  if (parcial) return;
  // ¿Puede cubrir también las demás iguales de esta ausencia?
  const a = S.ausencias.find(x => x.id === n.ausenciaId);
  if (!a) return;
  const otras = necesidades(a, P(a.email), S.clases)
    .filter(x => x.fecha >= hoy() && !(x.fecha === n.fecha && x.desde === n.desde) && x.rol === n.rol && (x.actividad || '') === (n.actividad || '') && !cubierto(x, S.reemplazos))
    .filter(x => candidatos(x, S.personal, S.ausencias, [...S.reemplazos, { ...doc }], S.clases).some(c => c.p.email === email));
  if (otras.length && await confirmar(`${esc(q.nombre)} también está libre para las otras <b>${otras.length}</b> ${n.rol === 'clases' ? esc(n.actividad) : 'turnos'} de esta ausencia. ¿Asignarlas también?`, { si: `Asignar ${otras.length} más` })) {
    await lote(otras.map(x => ({ c: 'reemplazos', id: Math.random().toString(36).slice(2, 14), data: docReemplazo(x, quien) })));
    toast(`${otras.length + 1} reemplazos asignados a ${q.nombre}`);
  }
}

// Elegir quién cubre y qué parte del turno: cualquier activo o alguien que no está en el sistema
function asignarManual(n) {
  const todos = activos().filter(p => p.email !== n.titular && !ausenteEn(p.email, n.fecha, S.ausencias)).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
  const falta = faltaCubrir(n, S.reemplazos);
  const [d0, h0] = falta[0] || [n.desde, n.hasta];
  const m = modal(`${cabModal('Asignar reemplazo')}<p class="sub">${fechaLarga(n.fecha)} · turno <span class="mono">${n.desde}–${n.hasta}</span> · ${esc(queCubre(n))}${falta.length ? ` · falta cubrir <span class="mono">${falta.map(x => x.join('–')).join(', ')}</span>` : ''}</p>
    <div class="form">
    <label>Quién cubre<select id="m-p">${todos.map(p => {
      const ocupado = agenda(p, S.clases).some(s => s.dia === n.dia && seSolapan(s.desde, s.hasta, n.desde, n.hasta));
      return `<option value="${esc(p.email)}">${esc(nombreCompleto(p))} · ${(p.roles || []).map(r => ROL_CORTO[r]).join('/')}${ocupado ? ' · ocupado en ese horario' : ''}</option>`;
    }).join('')}${externos().length ? `<optgroup label="Externos (no son staff)">${externos().map(x => `<option value="ext|${esc(x.id)}">${esc(x.nombre)} · externo${(x.acts || []).length ? ' · ' + esc(x.acts.join('/')) : ''}</option>`).join('')}</optgroup>` : ''}<option value="__externo">+ Otra persona (queda guardada en Externos)</option></select></label>
    <div class="fila" id="m-ext" hidden><label>Nombre y apellido<input id="m-nombre" placeholder="Ej. Cristian Gómez"></label><label>Teléfono (opcional)<input id="m-tel" inputmode="tel" placeholder="11 5555-1234"></label></div>
    <div class="fila"><label>Desde<input id="m-desde" type="time" step="900" value="${d0}"></label><label>Hasta<input id="m-hasta" type="time" step="900" value="${h0}"></label></div>
    <p class="sub">Si lo cubren entre varios, asigná a cada uno su parte. Por ejemplo, Franco de 12:00 a 13:00 y después otra persona de 13:00 a 17:00.</p></div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="m-ok">Asignar</button></div>`);
  const sel = $('#m-p', m.el);
  sel.onchange = () => { $('#m-ext', m.el).hidden = sel.value !== '__externo'; if (sel.value === '__externo') $('#m-nombre', m.el).focus(); };
  $('#m-ok', m.el).onclick = async () => {
    const desde = $('#m-desde', m.el).value, hasta = $('#m-hasta', m.el).value;
    if (!desde || !hasta || min(hasta) <= min(desde)) return toast('Revisá el horario: tiene que terminar después de empezar', true);
    if (!n.generico && (min(desde) < min(n.desde) || min(hasta) > min(n.hasta))) return toast(`El horario tiene que estar dentro del turno (${n.desde}–${n.hasta})`, true);
    const choca = reemplazosDe(n, S.reemplazos).find(r => seSolapan(r.desde, r.hasta, desde, hasta));
    if (choca) return toast(`Esa parte ya la cubre ${nomR(choca)} (${choca.desde}–${choca.hasta})`, true);
    let quien;
    if (sel.value === '__externo') {
      const nombre = $('#m-nombre', m.el).value.trim();
      if (!nombre) return toast('Escribí el nombre de quien cubre', true);
      quien = { reemplazo: slugExt(nombre), reemplazoNombre: nombre, reemplazoTel: $('#m-tel', m.el).value.trim(), externo: true };
      if (!EXT(quien.reemplazo)) guardarExternos([...todosExt(), { id: quien.reemplazo, nombre, tel: quien.reemplazoTel, acts: [queAct(n)].filter(Boolean), disp: '' }]).catch(() => {});
    } else if (sel.value.startsWith('ext|')) {
      const x = EXT(sel.value.slice(4));
      quien = { reemplazo: x.id, reemplazoNombre: x.nombre, reemplazoTel: x.tel || '', externo: true };
    } else {
      if (!sel.value) return;
      quien = { reemplazo: sel.value, reemplazoNombre: nom(sel.value) };
    }
    try { await agregar('reemplazos', docReemplazo(n, quien, desde, hasta)); } catch { return toast('No se pudo asignar', true); }
    m.cerrar();
    toast(`${quien.reemplazoNombre} cubre de ${desde} a ${hasta} el ${fechaCorta(n.fecha)}`);
  };
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
    ${semanaAsistencia()}
    <div class="panel"><h3>Resumen de ${MESES[+S.mesAsis.slice(5) - 1]}</h3>
      ${res.length ? `<div class="tabla-wrap"><table><thead><tr><th>Persona</th><th class="num">Días de trabajo</th><th class="num">Horas</th><th class="num">Llegadas tarde</th><th class="num">Faltas sin aviso</th><th class="num">Sin salida</th></tr></thead><tbody>
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
  $$('[data-dia-asis]', v).forEach(b => b.onclick = () => { const [e, f, k] = b.dataset.diaAsis.split('|'); diaAsistencia(e, f, k); });
  $$('[data-filtrar]', v).forEach(b => b.onclick = () => { S.personaAsis = b.dataset.filtrar; render(); });
  $('#todos')?.addEventListener('click', () => { S.personaAsis = ''; render(); });
  $('#manual').onclick = () => fichajeManual();
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

// Esta semana: un cuadrito por persona y por día. Verde vino, amarillo tarde, rojo faltó sin avisar, gris avisó.
function estadoAsis(p, f) {
  const h = hoy(), d = deIso(f).getDay();
  const ag = agenda(p, S.clases).filter(s => s.dia === d);
  if (!ag.length) return { k: 'no' };
  if (f > h) return { k: 'fut' };
  if (ausenteEn(p.email, f, S.ausencias)) return { k: 'aviso', txt: 'avisó' };
  const ini = Math.min(...ag.map(s => min(s.desde)));
  const fs = [...S.fichajes, ...S.fichajesHoy].filter(x => x.email === p.email && x.fecha === f && x.tipo === 'entrada').sort((a, b) => ms(a.ts) - ms(b.ts));
  if (fs.length) { const t = minutosDelDia(fs[0].ts) - ini; return { k: t > TOLERANCIA_TARDE ? 'tarde' : 'ok', txt: horaDe(fs[0].ts), t }; }
  if (f === h && minutosDelDia(Date.now()) <= ini + TOLERANCIA_TARDE) return { k: 'pend', txt: 'entra ' + hhmm(ini) };
  if (f !== h && f.slice(0, 7) !== S.mesAsis) return { k: 'nd' };
  return { k: 'falta', txt: f === h ? 'no fichó' : 'faltó' };
}
function semanaAsistencia() {
  const l = lunesDe(new Date()), dias = DIAS_LABORABLES.map(d => iso(sumarDias(l, d - 1))), h = hoy();
  const gente = activos().filter(p => agenda(p, S.clases).length).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
  const est = Object.fromEntries(gente.map(p => [p.email, dias.map(f => estadoAsis(p, f))]));
  // Las faltas se cuentan hasta ayer (hoy todavía pueden llegar)
  const cuenta = k => Object.values(est).flatMap(xs => xs.filter((e, i) => e.k === k && (k !== 'falta' || dias[i] < h))).length;
  return `<div class="kpis"><div class="kpi ok"><b>${S.fichajesHoy.filter(f => f.tipo === 'entrada').length ? new Set(S.fichajesHoy.filter(f => f.tipo === 'entrada').map(f => f.email)).size : 0}</b><span>ficharon hoy</span></div>
      <div class="kpi ${cuenta('tarde') ? 'aviso-k' : ''}"><b>${cuenta('tarde')}</b><span>llegadas tarde esta semana</span></div><div class="kpi ${cuenta('falta') ? 'alerta' : 'ok'}"><b>${cuenta('falta')}</b><span>faltas sin aviso esta semana</span></div></div>
    <div class="panel"><div class="cab"><h3>Esta semana</h3><span class="leyenda"><span><i class="sw est-tit"></i>vino</span><span><i class="sw est-pend"></i>tarde</span><span><i class="sw est-falta"></i>faltó sin avisar</span><span><i class="sw est-libre"></i>avisó</span></span></div>
    <div class="tabla-wrap"><div class="asis-sem"><span></span>${dias.map(f => `<span class="h ${f === h ? 'hoy' : ''}">${DIAS_CORTOS[deIso(f).getDay()]} ${fechaCorta(f).slice(0, 5)}</span>`).join('')}
      ${gente.map(p => `<button class="btn sm ghost" data-ficha="${esc(p.email)}">${esc(nombreCompleto(p).split(' ').slice(0, 2).join(' '))}</button>${est[p.email].map((e, i) => e.k === 'no' || e.k === 'fut' || e.k === 'nd' ? `<span class="dt dt-${e.k}"></span>`
        : `<button class="dt dt-${e.k}" data-dia-asis="${esc(p.email)}|${dias[i]}|${e.k}" title="${esc(e.txt || '')}">${e.k === 'ok' ? '✓' : esc(e.txt || '')}</button>`).join('')}`).join('')}</div></div>
    <span class="sub">Tocá un cuadrito rojo para justificar la falta o cargar el fichaje.</span></div>`;
}
async function diaAsistencia(email, f, k) {
  const p = P(email); if (!p) return;
  const e = estadoAsis(p, f);
  const m = modal(`${cabModal(nombreCompleto(p))}<p class="sub">${fechaLarga(f)}</p>
    <span class="est est-${e.k === 'ok' ? 'tit' : e.k === 'tarde' ? 'pend' : e.k === 'falta' ? 'falta' : 'libre'}" style="justify-self:start">${e.k === 'ok' ? `Entró ${e.txt}` : e.k === 'tarde' ? `Llegó ${e.txt}, ${e.t} minutos tarde` : e.k === 'falta' ? (f === hoy() ? 'Todavía no fichó hoy' : 'No vino y no avisó') : e.k === 'aviso' ? 'Avisó que no venía' : esc(e.txt || '')}</span>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cerrar</button>${e.k === 'falta' ? '<button class="btn ghost" id="da-fich">Vino, se olvidó de fichar</button><button class="btn ok" id="da-just">Avisó (justificar)</button>' : ''}</div>`);
  $('#da-just', m.el)?.addEventListener('click', async () => {
    await agregar('ausencias', { email, nombre: nombreCompleto(p), tipo: 'ausencia', desde: f, hasta: f, motivo: 'Justificada por gerencia', estado: 'aprobada', creado: AHORA, respondida: AHORA, respondidaPor: S.user.email, cargadaPorGerencia: true });
    m.cerrar(); toast('Falta justificada');
  });
  $('#da-fich', m.el)?.addEventListener('click', () => { m.cerrar(); const ag = agenda(p, S.clases).filter(s => s.dia === deIso(f).getDay()); fichajeManual({ email, fecha: f, hora: ag.map(s => s.desde).sort()[0], tipo: 'entrada' }); });
}

function fichajeManual(pre = {}) {
  const m = modal(`${cabModal('Fichaje manual')}<p class="sub">Para cuando alguien se olvidó de fichar. Queda marcado como manual.</p>
    <div class="form"><label>Persona<select id="fm-p">${activos().sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))).map(p => `<option value="${esc(p.email)}">${esc(nombreCompleto(p))}</option>`).join('')}</select></label>
    <div class="fila"><label>Fecha<input type="date" id="fm-f" value="${hoy()}"></label><label>Hora<input type="time" id="fm-h" value="${pad(new Date().getHours())}:${pad(new Date().getMinutes())}"></label>
      <label>Tipo<select id="fm-t"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></label></div></div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="fm-ok">Guardar</button></div>`);
  if (pre.email) $('#fm-p', m.el).value = pre.email;
  if (pre.fecha) $('#fm-f', m.el).value = pre.fecha;
  if (pre.hora) $('#fm-h', m.el).value = pre.hora;
  if (pre.tipo) $('#fm-t', m.el).value = pre.tipo;
  $('#fm-ok', m.el).onclick = async () => {
    const e = $('#fm-p', m.el).value, f = $('#fm-f', m.el).value, h = $('#fm-h', m.el).value;
    if (!e || !f || !h) return toast('Completá todos los datos', true);
    const [y, mo, d] = f.split('-').map(Number); const [hh, mm] = h.split(':').map(Number);
    const ts = new Date(y, mo - 1, d, hh, mm);
    await agregar('fichajes', { email: e, nombre: nom(e), fecha: f, mes: f.slice(0, 7), tipo: $('#fm-t', m.el).value, ts, token: 'manual', manual: true, cargadoPor: S.user.email, dispositivo: 'gerencia' });
    m.cerrar(); toast('Fichaje cargado');
  };
}

// ============================================================ EXTERNOS
// Contratados que no son staff: no tienen ficha, censo, asistencia ni vacaciones. Solo cubren reemplazos.
function vExternos(v) {
  const xs = externos(), mes = mesDe(new Date()), nomMes = MESES[+mes.slice(5) - 1];
  const q = S.buscar.toLowerCase();
  const lista = xs.filter(x => !q || `${x.nombre} ${(x.acts || []).join(' ')}`.toLowerCase().includes(q));
  v.innerHTML = `<div class="cab"><div><span class="eyebrow">Carpeta aparte · no son staff</span><h1>Externos</h1>
      <p class="sub">Profes contratados que solo cubren reemplazos. Aparecen al buscar quién cubre, siempre después del staff y en violeta. No cuentan en el censo, la asistencia ni las vacaciones.</p></div>
      <div class="acciones"><button class="btn ext" id="nuevo-ext">+ Agregar externo</button></div></div>
    <div class="acciones"><input id="buscar" placeholder="Buscar por nombre o actividad" value="${esc(S.buscar)}" style="max-width:280px"></div>
    ${lista.length ? `<div class="grid-3">${lista.map(x => { const rs = S.reemplazos.filter(r => r.reemplazo === x.id && r.fecha.slice(0, 7) === mes), m = rs.reduce((t, r) => t + minR(r), 0);
      return `<button class="tarjeta tarjeta-ext" data-ext="${esc(x.id)}"><div class="persona"><div class="avatar av-ext">${esc(x.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div><div><b>${esc(x.nombre)}</b><span class="sub mono">${esc(x.tel || 'sin teléfono')}</span></div></div>
        <div class="pie"><span class="pill ext">Externo</span>${(x.acts || []).map(a => `<span class="pill neutro">${esc(a)}</span>`).join('')}</div>
        ${x.disp ? `<span class="sub">${esc(x.disp)}</span>` : ''}
        <span class="est est-ext">${rs.length ? `${rs.length} ${rs.length === 1 ? 'reemplazo' : 'reemplazos'} · ${horasTxt(m)} en ${nomMes}` : `Sin reemplazos en ${nomMes}`}</span>
        ${x.auto ? '<span class="sub">Se sumó solo porque cubrió un reemplazo. Tocá para completar sus datos.</span>' : ''}</button>`; }).join('')}</div>`
    : `<div class="vacio-grande"><b>${q ? 'No encontré a nadie con eso.' : 'Todavía no hay externos.'}</b><span>Tocá "+ Agregar externo" para guardar a un profe contratado. También se suman solos cuando cargás a "otra persona" en un reemplazo.</span></div>`}`;
  $('#nuevo-ext').onclick = () => editarExterno();
  $('#buscar').oninput = e => { S.buscar = e.target.value; clearTimeout(vExternos.t); vExternos.t = setTimeout(() => { render(); const i = $('#buscar'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $$('[data-ext]', v).forEach(b => b.onclick = () => verExterno(EXT(b.dataset.ext)));
}
function verExterno(x) {
  if (!x) return toast('No encontré a esa persona', true);
  const rs = S.reemplazos.filter(r => r.reemplazo === x.id).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.desde.localeCompare(b.desde));
  const meses = [...new Set([mesDe(new Date()), ...rs.map(r => r.fecha.slice(0, 7))])].sort().reverse();
  let mes = meses[0];
  const cuerpo = () => { const del = rs.filter(r => r.fecha.slice(0, 7) === mes), m = del.reduce((t, r) => t + minR(r), 0);
    return `<div class="seg" role="group" aria-label="Mes">${meses.map(k => `<button data-xm="${k}" aria-pressed="${k === mes}">${MESES[+k.slice(5) - 1]}</button>`).join('')}</div>
      <div class="kpis"><div class="kpi kpi-ext"><b>${del.length}</b><span>reemplazos</span></div><div class="kpi kpi-ext"><b>${horasTxt(m)}</b><span>para pagar</span></div><div class="kpi"><b>${new Set(del.map(r => r.titular)).size}</b><span>personas cubiertas</span></div></div>
      ${del.length ? `<div class="lista">${del.map(r => `<div class="item"><span><span class="mono">${fechaCorta(r.fecha).slice(0, 5)}</span> · cubrió a <b>${esc((r.titularNombre || nom(r.titular)).split(' ')[0])}</b> · ${esc(queCubre(r))}</span><span class="mono">${r.desde}–${r.hasta}</span></div>`).join('')}</div>` : '<p class="sub">No cubrió nada este mes.</p>'}`; };
  const resumen = () => { const del = rs.filter(r => r.fecha.slice(0, 7) === mes), m = del.reduce((t, r) => t + minR(r), 0);
    return `${x.nombre} · ${MESES[+mes.slice(5) - 1]} ${mes.slice(0, 4)}: ${del.length} reemplazos, ${horasTxt(m)}\n` + del.slice().reverse().map(r => `${fechaCorta(r.fecha)} ${r.desde}-${r.hasta} cubrió a ${r.titularNombre || nom(r.titular)} (${queCubre(r)})`).join('\n'); };
  const m = modal(`${cabModal('Externo')}<div class="persona"><div class="avatar av-ext">${esc(x.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div><div><b>${esc(x.nombre)}</b><span class="sub">Externo · no es staff</span></div></div>
    <div class="lista"><div class="item"><span class="sub">Celular</span><span class="mono">${esc(x.tel || '—')}</span></div><div class="item"><span class="sub">Cubre</span><span>${esc((x.acts || []).join(', ') || 'a confirmar')}</span></div><div class="item"><span class="sub">Puede</span><span>${esc(x.disp || 'a confirmar')}</span></div></div>
    <h4>Historial de reemplazos</h4><div id="x-cuerpo" style="display:grid;gap:10px">${cuerpo()}</div>
    <div class="modal-pie"><button class="btn ghost" id="x-quitar" style="margin-right:auto">Quitar de la carpeta</button>${x.tel ? `<a class="btn ghost" target="_blank" rel="noopener" href="${waLink(x.tel, `Hola ${x.nombre.split(' ')[0]}! `)}">WhatsApp</a>` : ''}<button class="btn ghost" id="x-copiar">Copiar resumen para pagarle</button><button class="btn" id="x-editar">Editar</button></div>`, { ancho: true });
  const enlazarMes = () => $$('[data-xm]', m.el).forEach(b => b.onclick = () => { mes = b.dataset.xm; $('#x-cuerpo', m.el).innerHTML = cuerpo(); enlazarMes(); });
  enlazarMes();
  $('#x-copiar', m.el).onclick = () => copiar(resumen());
  $('#x-editar', m.el).onclick = () => { m.cerrar(); editarExterno(x); };
  $('#x-quitar', m.el).onclick = async () => {
    if (!(await confirmar(`¿Quitar a <b>${esc(x.nombre)}</b> de la carpeta de externos? Sus reemplazos quedan guardados en el historial.`, { si: 'Quitar' }))) return;
    await guardarExternos(todosExt().map(y => y.id === x.id ? { ...y, oculto: true } : y)); m.cerrar(); toast('Quitado de Externos');
  };
}
function editarExterno(x = null) {
  const acts = [...new Set([...ACTIVIDADES_BASE, ...S.clases.map(c => c.actividad), 'Musculación', 'Recepción', 'Limpieza', ...(x?.acts || [])])].filter(Boolean).sort();
  const m = modal(`${cabModal(x ? 'Editar externo' : 'Agregar externo')}<p class="sub">Contratado que solo cubre reemplazos. No entra al staff, al censo ni a la asistencia.</p>
    <div class="form"><label>Nombre y apellido<input id="x-n" value="${esc(x?.nombre || '')}" placeholder="Ej. Paula Ruiz"></label>
      <label>Celular<input id="x-t" inputmode="tel" value="${esc(x?.tel || '')}" placeholder="11 5555-1234"></label>
      <div><span class="sub">Qué puede cubrir (tocá todas las que van)</span><div class="checks" id="x-acts">${acts.map(a => `<button type="button" class="chip-sel" aria-pressed="${(x?.acts || []).includes(a)}" data-act="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>
      <label>Cuándo puede<input id="x-d" value="${esc(x?.disp || '')}" placeholder="Ej. martes y jueves a la mañana"></label></div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn ext" id="x-ok">Guardar en Externos</button></div>`);
  $$('[data-act]', m.el).forEach(b => b.onclick = () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true'));
  $('#x-ok', m.el).onclick = async () => {
    const nombre = $('#x-n', m.el).value.trim();
    if (!nombre) { $('#x-n', m.el).focus(); return toast('Escribí el nombre', true); }
    const id = x?.id || slugExt(nombre);
    if (!x && EXT(id) && !EXT(id).oculto) return toast('Ya hay un externo con ese nombre', true);
    if (!x && S.personal.some(p => sinTildes(nombreCompleto(p)) === sinTildes(nombre))) return toast('Esa persona ya está en el staff', true);
    const dato = { id, nombre, tel: $('#x-t', m.el).value.trim(), acts: $$('[data-act][aria-pressed="true"]', m.el).map(b => b.dataset.act), disp: $('#x-d', m.el).value.trim() };
    const lista = todosExt().filter(y => y.id !== id);
    try { await guardarExternos([...lista, dato]); } catch { return toast('No se pudo guardar', true); }
    m.cerrar(); toast(`${nombre.split(' ')[0]} quedó guardado en Externos`);
  };
}

// ============================================================ AJUSTES
function vAjustes(v) {
  const url = f => new URL(f, location.href).href;
  const c = S.config;
  v.innerHTML = `<div class="cab"><div><h1>Ajustes</h1></div></div>
    <div class="grid-2">
      <div class="panel"><h3>A dónde llegan los pedidos</h3>
        <p class="sub">Los pedidos de vacaciones y ausencias le llegan a este correo. Al pedir, el profe también puede avisar por WhatsApp a recepción y a gerencia con el mensaje ya escrito.</p>
        <div class="form"><label>Correo de gerencia<input id="aj-g" type="email" value="${esc(c.correoGerencia || '')}" placeholder="${esc(CORREO_GERENCIA)} (predeterminado)"></label>
          <span class="sub">Si lo dejás vacío se usa ${esc(CORREO_GERENCIA)}. Si lo cambiás, también hay que agregarlo en el script "Correos Coghlan" (lista DESTINOS), porque el script solo manda a los correos de esa lista.</span>
          <label>Con copia a (opcional, separados por coma)<input id="aj-cc" value="${esc(c.correoCC || '')}"></label>
          <label>WhatsApp de recepción<input id="aj-wr" inputmode="tel" value="${esc(c.whatsappRecepcion || '')}" placeholder="11 5555-5555"></label>
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
    await guardar('config', 'general', { correoGerencia: $('#aj-g').value.trim(), correoCC: $('#aj-cc').value.trim(), whatsappGerencia: $('#aj-wa').value.trim(), whatsappRecepcion: $('#aj-wr').value.trim() }, { merge: true });
    toast('Guardado');
  };
  $('#aj-auto').onclick = async () => {
    const u = $('#aj-url').value.trim();
    if (u && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) return toast('La URL tiene que ser la de script.google.com y terminar en /exec', true);
    await guardar('config', 'general', { correoScriptUrl: u, correoClave: $('#aj-clave').value.trim() }, { merge: true });
    toast(u ? 'Envío automático activado' : 'Envío automático desactivado');
  };
  $('#aj-probar')?.addEventListener('click', async () => {
    await enviarCorreo(S.config, { para: destinos(S.config).correo, asunto: 'Prueba · Coghlan Club', cuerpo: 'Si te llegó este correo, el envío automático funciona.' });
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
    { sel: '[data-tab="grilla"]', antes: enTab('grilla'), titulo: 'Grilla de clases', texto: `<p>La semana de clases por sede, con el profe de cada una. <b>La van armando los profes</b>: cuando completan el censo agregan sus clases y aparecen acá al instante, con su nombre. También hay un calendario del mes.</p>
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

// ============================================================ ASISTENTE (IA)
// Ayuda a usar TODA la app a quien no se lleva bien con la tecnología:
// - "Para resolver hoy": lo pendiente, con botones de un toque (no necesita IA).
// - Preguntas con palabras comunes (escritas o dictadas por voz). Claude contesta corto, lleva a la
//   pantalla que corresponde y propone acciones. Nada se hace sin que alguien toque el botón y confirme.
// La app arma un resumen de los datos y se lo manda al script de Google (el mismo de los correos), que le pregunta a Claude.
const PREGUNTAS = ['¿Cuántos profesores tenemos?', '¿Qué falta cubrir esta semana?', '¿Quién falta hoy?', '¿Quién está libre mañana a la tarde?', '¿Hay vacaciones para aprobar?', '¿Quién falta completar el censo?', '¿Cómo se usa esta pantalla?'];
const AS = { abierto: false, chat: [], esperando: false, escuchando: false };
const NOMBRE_TAB = Object.fromEntries(TABS);

const SISTEMA_ASISTENTE = `Sos el asistente de la app de gerencia de Coghlan Club, un gimnasio de Buenos Aires (Washington 2558, Coghlan). Te usan los socios del club, que no se llevan bien con la tecnología: tu trabajo es que puedan hacer TODO desde acá, sin buscar botones.
Respondé en castellano rioplatense, muy corto y claro: 1 a 4 oraciones, sin tecnicismos ni listas largas. Usá nombres de pila. Si te piden algo que se hace con un botón, ofrecé el botón en "acciones" en vez de explicar dónde está.
Basate solo en los DATOS que vienen en cada mensaje. Si algo no está, decilo.

La app (pestañas de arriba):
- Hoy: quién vino, quién falta y qué hay sin cubrir hoy.
- Censo: los profes completan su ficha desde el link; acá se ve quién falta y se aprueban.
- Personal: fichas de cada persona (datos, horarios, celular para fichar, PIN si no tiene celular).
- Grilla de clases: las clases por sede (Sede, Anexo, Aranceladas) y la sala de Musculación con barras de color; Calendario del mes con barras por día.
- Vacaciones y ausencias: pedidos para aprobar o rechazar, calendario e historial.
- Reemplazos: quién cubre a quién; un turno se puede cubrir por partes y con alguien que no está en el sistema.
- Asistencia: fichajes del QR, llegadas tarde, faltas sin aviso (se pueden justificar) y fichaje manual.
- Ajustes: correos, WhatsApp, cuenta de recepción.

Para buscar quién puede cubrir: mismo rol (y misma actividad si es una clase), que no esté de vacaciones ese día y que no tenga otro turno, clase o reemplazo que se superponga. Preferí a quien marcó que puede cubrir en esa franja y a quien tiene menos reemplazos en el mes.

"acciones" (máximo 4), cada una con "tipo" y "etiqueta" (texto corto del botón, ej. "Asignar a Diego 11 a 12"). En los campos que una acción no usa, poné "". Tipos:
- "ir": llevar a una pestaña ("tab": hoy, censo, personal, grilla, vacaciones, reemplazos, asistencia o ajustes).
- "ver_ficha" ("email"), "ver_dia" ("fecha"), "ver_pedido" ("ausenciaId"): abrir el detalle.
- "asignar": que alguien cubra a un titular una fecha, de "desde" a "hasta", dentro de un turno de turnos_a_cubrir. "reemplazo" = email de quien cubre; si no está en el personal, email vacío y su nombre en "reemplazoNombre".
- "quitar_reemplazo" ("reemplazoId").
- "aprobar" / "rechazar": un pedido pendiente ("ausenciaId").
- "aprobar_ficha" ("email"): una ficha nueva del censo.
- "habilitar_celular" ("email"): cuando alguien cambió de celular y no puede fichar.
- "cargar_ausencia": cuando alguien avisó por teléfono ("email", "tipoAusencia" vacaciones o ausencia, "fecha" = desde, "hasta", "motivo").
- "justificar_falta" ("email", "fecha"): una falta sin aviso que en realidad avisó.
- "fichaje_manual" ("email", "fecha", "desde" = hora, "tipoFichaje" entrada o salida): cuando alguien se olvidó de fichar.
- "mensaje_censo": copiar el mensaje para mandar el link del censo por WhatsApp.
No inventes emails ni ids: copialos de los datos.`;

const CAMPOS_ACCION = ['tipo', 'etiqueta', 'tab', 'email', 'fecha', 'desde', 'hasta', 'ausenciaId', 'reemplazoId', 'titular', 'reemplazo', 'reemplazoNombre', 'tipoAusencia', 'tipoFichaje', 'motivo'];
const TIPOS_ACCION = ['preguntar', 'todas', 'whatsapp', 'ir', 'ver_ficha', 'ver_dia', 'ver_pedido', 'asignar', 'quitar_reemplazo', 'aprobar', 'rechazar', 'aprobar_ficha', 'habilitar_celular', 'cargar_ausencia', 'justificar_falta', 'fichaje_manual', 'mensaje_censo'];
const ESQUEMA_ASISTENTE = {
  type: 'object', additionalProperties: false, required: ['respuesta', 'acciones'],
  properties: {
    respuesta: { type: 'string' },
    acciones: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: CAMPOS_ACCION,
      properties: Object.fromEntries(CAMPOS_ACCION.map(k => [k, k === 'tipo' ? { type: 'string', enum: TIPOS_ACCION } : { type: 'string' }])),
    } },
  },
};
// Acción con los campos vacíos completos (para las que arma la app sin IA)
const accion = (tipo, etiqueta, campos = {}) => ({ ...Object.fromEntries(CAMPOS_ACCION.map(k => [k, ''])), tipo, etiqueta, ...campos });

// Lo pendiente, calculado por la app (anda aunque la IA no esté conectada)
function paraHoy() {
  const items = [];
  for (const a of pendientesAus().slice(0, 3)) items.push({ txt: `${(a.nombre || nom(a.email)).split(' ')[0]} pide ${a.tipo === 'vacaciones' ? 'vacaciones' : 'faltar'} · ${rangoTexto(a.desde, a.hasta)}`,
    acc: [accion('aprobar', 'Aprobar', { ausenciaId: a.id }), accion('rechazar', 'Rechazar', { ausenciaId: a.id }), accion('ver_pedido', 'Ver', { ausenciaId: a.id })] });
  if (pendientesAus().length > 3) items.push({ txt: `Hay ${pendientesAus().length - 3} pedidos más`, acc: [accion('ir', 'Ver todos', { tab: 'vacaciones' })] });
  const sin = sinCubrir14();
  if (sin.length) items.push({ txt: `${sin.length} turno(s) sin cubrir en las próximas 2 semanas`, acc: [accion('ir', 'Ver reemplazos', { tab: 'reemplazos' })] });
  for (const p of pendientesFicha().slice(0, 3)) items.push({ txt: `Ficha nueva de ${nombreCompleto(p)}`, acc: [accion('aprobar_ficha', 'Aprobar', { email: p.email }), accion('ver_ficha', 'Ver', { email: p.email })] });
  for (const p of pedidosCelular()) items.push({ txt: `${nombreCompleto(p)} cambió de celular`, acc: [accion('habilitar_celular', 'Habilitar', { email: p.email })] });
  const csp = clasesSinProfe().length;
  if (csp) items.push({ txt: `${csp} clase(s) sin profesor en la grilla`, acc: [accion('ir', 'Ver grilla', { tab: 'grilla' })] });
  const ayer = iso(sumarDias(new Date(), -1));
  const faltas = faltasSinAviso(S.personal, S.clases, S.fichajes, S.ausencias, iso(sumarDias(new Date(), -7)) < `${S.mesAsis}-01` ? `${S.mesAsis}-01` : iso(sumarDias(new Date(), -7)), ayer);
  for (const f of faltas.slice(-3)) items.push({ txt: `${f.nombre.split(' ')[0]} no fichó el ${fechaCorta(f.fecha).slice(0, 5)}`,
    acc: [accion('justificar_falta', 'Avisó: justificar', { email: f.email, fecha: f.fecha }), accion('fichaje_manual', 'Se olvidó de fichar', { email: f.email, fecha: f.fecha })] });
  return items;
}

// Resumen compacto de lo que la IA necesita saber (hoy y las próximas 5 semanas)
function datosAsistente() {
  const h = hoy(), hasta = iso(sumarDias(new Date(), 35));
  const franja = s => `${DIAS_CORTOS[s.dia]} ${s.desde}-${s.hasta}`;
  const ini = iso(sumarDias(new Date(), -7)) < `${S.mesAsis}-01` ? `${S.mesAsis}-01` : iso(sumarDias(new Date(), -7));
  return {
    hoy: `${fechaLarga(h)} (${h})`,
    pantalla_actual: NOMBRE_TAB[S.tab] || S.tab,
    horario_club: DIAS_LABORABLES.map(d => `${DIAS_CORTOS[d]} ${HORARIO_CLUB[d].join('-')}`).join(', '),
    personal: S.personal.filter(p => p.estado !== 'inactivo').map(p => ({
      email: p.email, nombre: nombreCompleto(p), estado: p.estado || 'activo', roles: (p.roles || []).map(r => ROL_CORTO[r]), actividades: p.actividades || [],
      telefono: p.telefono || '', sin_celular: !!p.sinCelular, pidio_habilitar_celular: !!(p.pedidoDispositivo?.id && p.pedidoDispositivo.id !== p.dispositivo),
      horario: agenda(p, S.clases).map(s => `${franja(s)} ${s.actividad || ROL_CORTO[s.rol]}${s.sede ? ' (' + s.sede + ')' : ''}`),
      puede_cubrir: p.disponible || [],
      reemplazos_este_mes: S.reemplazos.filter(r => r.reemplazo === p.email && r.fecha.slice(0, 7) === h.slice(0, 7)).length,
    })),
    censo: estadoCenso().filas.filter(f => f.estado !== 'listo').map(f => ({ nombre: f.r.nombre || '', estado: ESTADO_CENSO[f.estado]?.[0] || f.estado })),
    vacaciones_y_ausencias: S.ausencias.filter(a => a.hasta >= h && a.estado !== 'rechazada').map(a => ({
      ausenciaId: a.id, email: a.email, nombre: a.nombre || nom(a.email), tipo: a.tipo, desde: a.desde, hasta: a.hasta, estado: a.estado, motivo: a.motivo || '',
      dias_de_trabajo: diasDeTrabajo(a.desde, a.hasta, P(a.email), S.clases),
    })),
    turnos_a_cubrir: necesidadesFuturas(h, hasta).map(n => ({
      titular: n.titular, titularNombre: nom(n.titular), fecha: n.fecha, desde: n.generico ? '' : n.desde, hasta: n.generico ? '' : n.hasta,
      horario_a_confirmar: !!n.generico, que: n.rol === 'clases' ? queCubre(n) : ROLES[n.rol],
      cubren: reemplazosDe(n, S.reemplazos).map(r => `${nomR(r)} ${r.desde}-${r.hasta}`), falta: faltaCubrir(n, S.reemplazos).map(x => x.join('-')),
    })),
    reemplazos_asignados: S.reemplazos.filter(r => r.fecha >= h && r.fecha <= hasta).map(r => ({
      reemplazoId: r.id, fecha: r.fecha, desde: r.desde, hasta: r.hasta, titular: r.titular, titularNombre: r.titularNombre || nom(r.titular), cubre: nomR(r), cubreEmail: r.externo ? '' : r.reemplazo,
    })),
    clases_sin_profesor: clasesSinProfe().map(c => `${DIAS_CORTOS[c.dia]} ${c.desde} ${c.actividad} (${c.sede})`),
    faltas_sin_aviso_ultimos_dias: faltasSinAviso(S.personal, S.clases, S.fichajes, S.ausencias, ini, iso(sumarDias(new Date(), -1))).map(f => ({ email: f.email, nombre: f.nombre, fecha: f.fecha })),
  };
}

// ---------- Asistente gratis: entiende las preguntas más comunes, sin IA paga y sin mandar datos afuera ----------
const sinTildes = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const FRANJA_MIN = { m: [420, 720], t: [720, 1020], n: [1020, 1320] };
const AYUDA_TAB = {
  hoy: 'Acá ves quién vino hoy, quién falta y qué turnos quedan sin cubrir. Arriba están los números del día.',
  censo: 'Acá ves quién completó la ficha del censo y quién falta. Con "Copiar mensaje" mandás el link por WhatsApp. Las fichas nuevas se aprueban en Personal.',
  personal: 'Acá están las fichas de todos. Tocá una persona para ver sus datos, horarios y faltas. Con "+ Cargar persona" cargás a alguien a mano, y ahí mismo podés agregar sus clases con horario.',
  grilla: 'Acá están las clases de cada sede. El botón Musculación muestra la sala con barras de color. "Calendario del mes" muestra cada día: tocá un día para ver quién está y a qué hora.',
  externos: 'Acá están los profes contratados que no son staff: solo cubren reemplazos. Con "+ Agregar externo" guardás uno nuevo. Tocá uno para ver cuántas horas cubrió en el mes y copiar el resumen para pagarle.',
  vacaciones: 'Acá llegan los pedidos de vacaciones y ausencias. Tocá uno para aprobarlo o rechazarlo. Con "Cargar ausencia" anotás cuando alguien avisa por teléfono.',
  reemplazos: 'Acá ves quién cubre a quién. Rojo es lo que falta. Tocá "Asignar" o "Cubrir por partes u otra persona" para elegir quién cubre y en qué horario.',
  asistencia: 'Acá ves los fichajes del mes, las llegadas tarde y las faltas sin aviso. Si alguien avisó, tocá "Justificar". Si se olvidó de fichar, usá "+ Fichaje manual".',
  ajustes: 'Acá se configuran los correos, el WhatsApp de recepción y la cuenta de la PC de recepción.',
};

// Palabras del texto, sin tildes ni signos
const palabras = t => sinTildes(t).replace(/[^a-z0-9ñ:/ ]/g, ' ').split(/\s+/).filter(Boolean);
// Distancia entre dos palabras (cuántas letras cambian): sirve para entender errores de tipeo
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// ¿Aparece alguna de estas raíces? Tolera errores ("vacaiones" = vacaciones, "reemplaxo" = reemplazo)
function dice(ws, raices) {
  return raices.some(k => ws.some(w => {
    if (w.startsWith(k)) return true;
    const tol = k.length >= 7 ? 2 : k.length >= 4 ? 1 : 0;
    return tol && w.length >= k.length - 1 && lev(w.slice(0, k.length), k) <= tol;
  }));
}

// Personas nombradas en el texto, en el orden en que aparecen (tolera tildes y errores de tipeo)
function personasEn(t) {
  const ws = palabras(t);
  const igual = (w, x) => x && (w === x || (x.length >= 4 && w.length >= 4 && lev(w, x) <= 1));
  const out = [];
  for (const p of S.personal.filter(p => p.estado !== 'inactivo')) {
    const nom = sinTildes(p.nombre).split(' ')[0], ape = sinTildes(p.apellido).split(' ')[0];
    let pos = -1, pts = 0;
    // exacto vale más que parecido (así "Rosa" no se confunde con "Sosa")
    ws.forEach((w, i) => { for (const x of [nom, ape]) if (igual(w, x)) { pts += w === x ? 3 : 1; if (pos < 0) pos = i; } });
    if (pts) out.push({ p, pos, pts });
  }
  // Si dos se llaman igual, gana el que coincide en nombre y apellido
  const mejor = {};
  for (const x of out) if (!mejor[x.pos] || x.pts > mejor[x.pos].pts) mejor[x.pos] = x;
  return Object.values(mejor).sort((a, b) => a.pos - b.pos).map(x => x.p);
}
const personaEn = t => personasEn(t)[0] || null;

const DIAS_TXT = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
// "12/11" o "12" (del mes, o del próximo si ya pasó)
function fechaNum(dd, mm) {
  const h = new Date();
  let y = h.getFullYear(), m = mm ? +mm : h.getMonth() + 1;
  if (!mm && +dd < h.getDate() - 7) m++;
  if (m > 12) { m = 1; y++; }
  if (mm && m < h.getMonth() + 1 - 2) y++;
  return `${y}-${pad(m)}-${pad(+dd)}`;
}
// Fecha de la que se habla: hoy, mañana, ayer, un día de la semana, 12/11 o "el 12"
function fechaEn(t) {
  const n = sinTildes(t), h = new Date();
  if (/pasado manana/.test(n)) return iso(sumarDias(h, 2));
  if (/\bayer\b/.test(n)) return iso(sumarDias(h, -1));
  if (/\bmanana\b/.test(n.replace(/(a|por|de|en) la manana/g, ''))) return iso(sumarDias(h, 1));
  const m = n.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) return fechaNum(m[1], m[2]);
  const i = DIAS_TXT.findIndex(d => n.includes(d));
  if (i >= 0) { const dif = (i - h.getDay() + 7) % 7; return iso(sumarDias(h, /proximo|que viene/.test(n) && dif === 0 ? 7 : dif)); }
  const el = n.match(/\bel (\d{1,2})\b(?!\s*(:|hs|h\b|horas))/);
  if (el) return fechaNum(el[1]);
  if (/\bhoy\b/.test(n)) return hoy();
  return null;
}
// "del 10 al 20", "del 10/12 al 20/12", "desde el lunes hasta el viernes"
function rangoEn(t) {
  const n = sinTildes(t);
  const m = n.match(/del? (\d{1,2})(?:\/(\d{1,2}))? (?:al|hasta el|hasta) (\d{1,2})(?:\/(\d{1,2}))?/);
  if (m) { const d = fechaNum(m[1], m[2] || m[4]); let h = fechaNum(m[3], m[4] || m[2]); if (h < d) h = fechaNum(m[3], m[4] || String(+d.slice(5, 7) + 1)); return [d, h]; }
  const dd = n.match(/(?:desde el|del) (lunes|martes|miercoles|jueves|viernes|sabado|domingo) (?:hasta el|al) (lunes|martes|miercoles|jueves|viernes|sabado|domingo)/);
  if (dd) { const a = fechaEn(dd[1]), b = fechaEn(dd[2]); return [a, b < a ? iso(sumarDias(deIso(b), 7)) : b]; }
  const f = fechaEn(t); return f ? [f, f] : null;
}
// "de 11 a 12", "11 a 12hs", "de 13:30 a 17", "a las 11"
function horasEn(t) {
  const n = sinTildes(t).replace(/(\d)\s*hs?\b/g, '$1').replace(/(\d) horas/g, '$1');
  const hh = (h, m) => `${pad(+h)}:${pad(+(m || 0))}`;
  const r = n.match(/(?:de |desde (?:las )?)?(\d{1,2})(?::(\d{2}))? (?:a|hasta|-) (?:las )?(\d{1,2})(?::(\d{2}))?/);
  if (r && +r[1] <= 23 && +r[3] <= 23 && +r[3] > +r[1]) return [hh(r[1], r[2]), hh(r[3], r[4])];
  const u = n.match(/a las (\d{1,2})(?::(\d{2}))?/);
  return u ? [hh(u[1], u[2]), null] : null;
}
function fechasEn(t) {
  const n = sinTildes(t).replace(/(\d)\s*hs?\b/g, '$1');
  const out = new Set();
  for (const m of n.matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)) out.add(fechaNum(m[1], m[2]));
  for (const m of n.matchAll(/\b(?:el|dia|y|los|del)\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?::|\/|a \d|hasta|al \d))/g)) if (+m[1] >= 1 && +m[1] <= 31) out.add(fechaNum(m[1]));
  DIAS_TXT.forEach((d, i) => { if (new RegExp(`\\b${d}\\b`).test(n)) { const h = new Date(); out.add(iso(sumarDias(h, (i - h.getDay() + 7) % 7))); } });
  if (!out.size) { const f = fechaEn(t); if (f) out.add(f); }
  return [...out].sort();
}
const franjaEn = t => { const n = sinTildes(t); return /(a|por|de|en) la manana/.test(n) ? 'm' : /tarde/.test(n) ? 't' : /noche/.test(n) ? 'n' : null; };

// Quién está libre una fecha (y franja): no está de vacaciones y no tiene turno, clase ni reemplazo que se superponga
function libresEn(f, fr) {
  const dia = deIso(f).getDay();
  const [a, b] = fr ? FRANJA_MIN[fr] : HORARIO_CLUB[dia] ? HORARIO_CLUB[dia].map(min) : [0, 0];
  const ocupado = p => agenda(p, S.clases).some(s => s.dia === dia && min(s.desde) < b && min(s.hasta) > a)
    || S.reemplazos.some(r => r.reemplazo === p.email && r.fecha === f && min(r.desde) < b && min(r.hasta) > a);
  return activos().filter(p => !ausenteEn(p.email, f, S.ausencias) && !ocupado(p))
    .map(p => ({ p, dijo: !!fr && (p.disponible || []).includes(`${dia}-${fr}`) }))
    .sort((x, y) => y.dijo - x.dijo || nombreCompleto(x.p).localeCompare(nombreCompleto(y.p)));
}
// Un turno sin cubrir con el mejor candidato listo para asignar
function propuestaCubrir(n) {
  const [d, h] = faltaCubrir(n, S.reemplazos)[0] || [n.desde, n.hasta];
  const parte = { ...n, desde: d, hasta: h };
  const c = candidatos(parte, S.personal, S.ausencias, S.reemplazos, S.clases)[0];
  const txt = `${fechaCorta(n.fecha).slice(0, 5)} ${n.generico ? '(horario a confirmar)' : `${d}–${h}`} · ${nom(n.titular).split(' ')[0]} · ${n.rol === 'clases' ? queCubre(n) : ROL_CORTO[n.rol]}`;
  return { txt, acc: c ? accion('asignar', `${c.p.nombre} cubre el ${fechaCorta(n.fecha).slice(0, 5)}${n.generico ? '' : ' ' + d}`, { titular: n.titular, fecha: n.fecha, desde: n.generico ? '' : d, hasta: n.generico ? '' : h, reemplazo: c.p.email }) : null };
}

// Actividades que se mencionan ("¿quién da zumba?")
function actividadEn(t) {
  const n = sinTildes(t);
  const todas = [...new Set([...ACTIVIDADES_BASE, ...S.clases.map(c => c.actividad)])].sort((a, b) => b.length - a.length);
  return todas.find(a => n.includes(sinTildes(a))) || todas.find(a => palabras(a).every(w => w.length < 4 || palabras(t).some(x => x.length >= 4 && lev(x, w) <= 1))) || null;
}

// Preguntas de ejemplo: cuando algo no se entiende, se ofrecen las más parecidas como botones
const EJEMPLOS = ['¿Cuántos profesores tenemos?', '¿Qué falta cubrir esta semana?', '¿Quién falta hoy?', '¿Quién está libre mañana a la tarde?',
  '¿Hay vacaciones para aprobar?', '¿Cuántas clases hay por semana?', '¿Quién llegó tarde este mes?', '¿Quién falta completar el censo?',
  '¿Cuántas personas hay en recepción?', '¿Qué clases no tienen profe?', '¿Quién trabaja mañana?', '¿Cómo se usa esta pantalla?'];
function responderLocal(texto) {
  const n = sinTildes(texto), ws = palabras(texto);
  const ps = personasEn(texto), quien = ps[0] || null, f = fechaEn(texto), fr = franjaEn(texto), hs = horasEn(texto), fs = fechasEn(texto);
  // Si hay más de una acción, un botón extra las hace todas juntas (con una sola confirmación)
  const conTodas = acc => acc.length > 1 ? [...acc.slice(0, 3), { ...accion('todas', `Hacer las ${acc.length}`), sub: acc }] : acc;
  const listar = (xs, max = 5) => xs.slice(0, max).join(' · ') + (xs.length > max ? ` y ${xs.length - max} más` : '');
  const pila = p => (p?.nombre || '').split(' ')[0];
  const R = (respuesta, acciones = []) => ({ respuesta, acciones: acciones.filter(Boolean).slice(0, 4) });
  // Rol del que se habla (para "la sala queda libre", "recepción sin nadie")
  const rolTxt = dice(ws, ['sala', 'muscul']) ? 'musculacion' : dice(ws, ['recep']) ? 'recepcion' : dice(ws, ['limpi']) ? 'limpieza' : null;

  // ----- Soluciones que dicta gerencia -----
  // "La sala queda libre de 11 a 12 el 10 y el 12": ese hueco se deja sin cubrir a propósito (deja de figurar como pendiente)
  if (!/quien/.test(n) && !(/clases? sin profe/.test(n) && !hs) && (/sin profe|sin nadie|nadie la cubre|no se cubre|no hace falta|se cierra|cerrad/.test(n) || (dice(ws, ['queda', 'deja', 'dejar', 'dejala', 'dejalo']) && dice(ws, ['libre', 'disponib', 'vacia', 'sin cubrir', 'abierta'])))) {
    const dias = fs.length ? fs : [hoy()];
    const nec = dias.flatMap(d => necesidadesFuturas(d, d)).filter(x => faltaCubrir(x, S.reemplazos).length
      && (!rolTxt || x.rol === rolTxt) && (!quien || x.titular === quien.email)
      && (!hs || x.generico || (min(hs[0]) < min(x.hasta) && min(hs[1] || x.hasta) > min(x.desde))));
    if (!nec.length) return R(`No encontré turnos sin cubrir${rolTxt ? ' de ' + ROL_CORTO[rolTxt].toLowerCase() : ''} ${dias.map(d => fechaCorta(d).slice(0, 5)).join(' y ')}${hs ? ` de ${hs[0]} a ${hs[1] || ''}` : ''}.`);
    const acc = nec.map(x => {
      const [d, h] = hs ? [x.generico ? hs[0] : (min(hs[0]) > min(x.desde) ? hs[0] : x.desde), x.generico ? (hs[1] || x.hasta) : (min(hs[1] || x.hasta) < min(x.hasta) ? hs[1] : x.hasta)] : faltaCubrir(x, S.reemplazos)[0];
      return accion('asignar', `Libre ${fechaCorta(x.fecha).slice(0, 5)} ${d}–${h}`, { titular: x.titular, fecha: x.fecha, desde: d, hasta: h, reemplazoNombre: 'Queda libre (sin profe)' });
    });
    return R(`Entendido: ${acc.length === 1 ? 'ese horario queda' : 'esos horarios quedan'} sin profe a propósito y ya no figuran como pendientes. Tocá para confirmar.`, conTodas(acc));
  }

  // ----- Ayuda -----
  if (/como (se usa|uso|hago|funciona)|que hago aca|que es esto|esta pantalla|^ayuda/.test(n))
    return R(`Estás en ${NOMBRE_TAB[S.tab]}. ${AYUDA_TAB[S.tab] || ''} Si querés, preguntame directamente lo que necesitás.`);
  if (/que (podes|sabes) hacer|que te puedo (pedir|preguntar)/.test(n))
    return R('Puedo decirte cuántos profes hay y quiénes son, cuántas clases hay, qué falta cubrir, quién está libre, quién cubre a quién, horarios, teléfonos y PIN. Y hacer cosas: asignar reemplazos, aprobar o cargar vacaciones, ausencias y fichajes. Por ejemplo: "que Diego cubra a Roberto el martes de 11 a 12".');

  // ----- Órdenes -----
  // Asignar un reemplazo: "que Diego cubra a Roberto el martes de 11 a 12", "Diego reemplaza a Roberto el 10"
  // Quien cubre puede no estar en el sistema: "que Cris cubra a Roberto el 10 de 13 a 17"
  const externo = ps.length === 1 && dice(ws, ['cubr', 'reempl']) ? (sinTildes(texto).match(/(?:que |pone(?:le)? a |asigna(?:le)? a )?\b([a-zñ]{3,})\b (?:cubra|cubre|reemplace|reemplaza|va a cubrir)/) || [])[1] : null;
  if (externo && !['que', 'quien', 'nadie', 'alguien', 'el', 'la'].includes(externo) && !personasEn(externo).length) {
    const titular = ps[0];
    const nec = (fs.length ? fs.flatMap(d => necesidadesFuturas(d, d)) : necesidadesFuturas(hoy(), iso(sumarDias(new Date(), 35)))).filter(x => x.titular === titular.email && faltaCubrir(x, S.reemplazos).length);
    const turnos = hs ? nec.filter(x => x.generico || (min(hs[0]) >= min(x.desde) && min(hs[1] || x.hasta) <= min(x.hasta))) : nec;
    if (!turnos.length) return R(`No encontré turnos de ${pila(titular)} sin cubrir${hs ? ` de ${hs[0]} a ${hs[1] || ''}` : ''}.`);
    const nombre = externo[0].toUpperCase() + externo.slice(1);
    const acc = turnos.map(x => { const [d, h] = hs ? [hs[0], hs[1] || x.hasta] : faltaCubrir(x, S.reemplazos)[0];
      return accion('asignar', `${nombre} cubre ${fechaCorta(x.fecha).slice(0, 5)} ${d}–${h}`, { titular: x.titular, fecha: x.fecha, desde: d, hasta: h, reemplazoNombre: nombre }); });
    return R(`${nombre} no está en el sistema: lo anoto igual como reemplazo de ${pila(titular)}. Tocá para confirmar.`, conTodas(acc));
  }
  if (ps.length >= 2 && dice(ws, ['cubr', 'reempl', 'asign', 'pone', 'suplan'])) {
    const fecha = fs.length === 1 ? fs[0] : null;
    const nec = (fs.length > 1 ? fs.flatMap(d => necesidadesFuturas(d, d)) : necesidadesFuturas(fecha || hoy(), fecha || iso(sumarDias(new Date(), 35))));
    // El titular es el que tiene un turno para cubrir; el otro es quien cubre
    const titular = ps.find(p => nec.some(x => x.titular === p.email)) || ps[1];
    const otro = ps.find(p => p !== titular);
    const deEl = nec.filter(x => x.titular === titular.email && faltaCubrir(x, S.reemplazos).length);
    if (!deEl.length) return R(`No encontré turnos de ${pila(titular)} sin cubrir${fecha ? ' el ' + fechaLarga(fecha) : ''}.`, [accion('ir', 'Ver reemplazos', { tab: 'reemplazos' })]);
    const turnos = hs ? deEl.filter(x => x.generico || (min(hs[0]) >= min(x.desde) && min(hs[1] || x.hasta) <= min(x.hasta))) : deEl;
    if (!turnos.length) return R(`Ese horario no está dentro de los turnos de ${pila(titular)}: ${listar(deEl.map(x => `${fechaCorta(x.fecha).slice(0, 5)} ${x.desde}–${x.hasta}`))}.`);
    const acc = turnos.map(x => {
      const [d, h] = hs ? [hs[0], hs[1] || x.hasta] : faltaCubrir(x, S.reemplazos)[0];
      return accion('asignar', `${pila(otro)} cubre ${fechaCorta(x.fecha).slice(0, 5)} ${d}–${h}`, { titular: x.titular, fecha: x.fecha, desde: d, hasta: h, reemplazo: otro.email });
    });
    return R(`Listo para asignar: ${pila(otro)} cubre a ${pila(titular)}${acc.length > 1 ? ` (${acc.length} turnos)` : ''}. Tocá para confirmar.`, conTodas(acc));
  }
  // Aprobar / rechazar
  if (dice(ws, ['aproba', 'acepta', 'autoriz', 'rechaz', 'denega', 'negale'])) {
    const pend = pendientesAus().filter(a => !quien || a.email === quien.email);
    const ok = !dice(ws, ['rechaz', 'denega', 'negale']);
    if (/ficha|censo/.test(n)) {
      const fichas = pendientesFicha().filter(p => !quien || p.email === quien.email);
      return fichas.length ? R(`${fichas.length === 1 ? 'Ficha' : 'Fichas'} para aprobar: ${listar(fichas.map(nombreCompleto))}.`, fichas.map(p => accion('aprobar_ficha', `Aprobar a ${pila(p)}`, { email: p.email })))
        : R('No hay fichas para aprobar.');
    }
    if (!pend.length) return R(quien ? `${pila(quien)} no tiene pedidos pendientes.` : 'No hay pedidos para responder.');
    return R(`${pend.length === 1 ? 'Este es el pedido' : 'Estos son los pedidos'}: ${listar(pend.map(a => `${(a.nombre || nom(a.email)).split(' ')[0]} ${rangoTexto(a.desde, a.hasta)}`), 3)}.`,
      pend.slice(0, 3).map(a => accion(ok ? 'aprobar' : 'rechazar', `${ok ? 'Aprobar' : 'Rechazar'} a ${(a.nombre || nom(a.email)).split(' ')[0]} ${fechaCorta(a.desde).slice(0, 5)}`, { ausenciaId: a.id })));
  }
  // Sacar un reemplazo: "sacá a Diego del reemplazo del martes"
  if (quien && dice(ws, ['saca', 'quita', 'borra', 'elimin']) && dice(ws, ['reempl', 'cubr'])) {
    const rs = S.reemplazos.filter(r => (r.reemplazo === quien.email || r.titular === quien.email) && r.fecha >= hoy() && (!f || r.fecha === f));
    return rs.length ? R(`Estos son los reemplazos de ${pila(quien)}. Tocá el que querés sacar.`, rs.slice(0, 4).map(r => accion('quitar_reemplazo', `Sacar ${nomR(r).split(' ')[0]} ${fechaCorta(r.fecha).slice(0, 5)} ${r.desde}`, { reemplazoId: r.id })))
      : R(`No encontré reemplazos de ${pila(quien)}${f ? ' el ' + fechaLarga(f) : ''}.`);
  }
  // Habilitar celular
  if (quien && dice(ws, ['celular', 'telefono nuevo', 'habilit', 'cambio de cel'])) {
    if (dice(ws, ['habilit', 'cambi', 'nuevo', 'no puede fichar', 'liber']))
      return R(`Te dejo el botón para habilitar el celular de ${pila(quien)}.`, [accion('habilitar_celular', `Habilitar celular de ${pila(quien)}`, { email: quien.email })]);
  }
  // Vacaciones o ausencias que alguien avisó: "Diego avisó que el jueves no viene", "cargá vacaciones a Rosa del 10 al 20"
  if (quien && (dice(ws, ['avis', 'enferm', 'medic', 'vacacion', 'licencia', 'falta', 'faltar', 'no viene', 'carga', 'anota']) && (/no (viene|va a venir|puede)|avis|enferm|medic|carg|anot|licencia/.test(n) || dice(ws, ['vacacion'])))
      && !/(cubre|libre|pedido|pendiente)/.test(n)) {
    const rg = rangoEn(texto);
    if (rg) {
      const vac = dice(ws, ['vacacion']);
      return R(`Te abro ${vac ? 'las vacaciones' : 'la ausencia'} de ${pila(quien)} ${rg[0] === rg[1] ? 'del ' + fechaLarga(rg[0]) : 'del ' + rangoTexto(rg[0], rg[1])}. Revisá y tocá Guardar.`,
        [accion('cargar_ausencia', `Cargar ${vac ? 'vacaciones' : 'ausencia'} de ${pila(quien)}`, { email: quien.email, tipoAusencia: vac ? 'vacaciones' : 'ausencia', fecha: rg[0], hasta: rg[1], motivo: /medic/.test(n) ? 'Médico' : /enferm/.test(n) ? 'Enfermedad' : '' })]);
    }
  }
  // Se olvidó de fichar
  if (quien && dice(ws, ['olvid', 'fichaj', 'fich'])) {
    const sal = /salida|se fue|salio/.test(n);
    return R(`Te abro el fichaje manual de ${pila(quien)}${f ? ' del ' + fechaLarga(f) : ''}.`, [accion('fichaje_manual', `Fichaje manual de ${pila(quien)}`, { email: quien.email, fecha: f || hoy(), desde: hs?.[0] || '', tipoFichaje: sal ? 'salida' : 'entrada' })]);
  }
  // Justificar falta
  if (quien && dice(ws, ['justific'])) {
    return R(`Te dejo el botón para justificar la falta de ${pila(quien)}${f ? ' del ' + fechaLarga(f) : ''}.`, [accion('justificar_falta', `Justificar falta de ${pila(quien)}`, { email: quien.email, fecha: f || iso(sumarDias(new Date(), -1)) })]);
  }
  // Mandar mensaje / llamar
  if (quien && dice(ws, ['telefon', 'celu', 'numero', 'llam', 'whats', 'wasap', 'mensaj', 'escrib', 'contact'])) {
    return quien.telefono ? R(`El teléfono de ${nombreCompleto(quien)} es ${quien.telefono}.${quien.emergenciaTel ? ` Emergencia: ${quien.emergenciaNombre || ''} ${quien.emergenciaTel}.` : ''}`, [accion('whatsapp', `WhatsApp a ${pila(quien)}`, { email: quien.email }), accion('ver_ficha', 'Ver ficha', { email: quien.email })])
      : R(`${pila(quien)} no tiene teléfono cargado.`, [accion('ver_ficha', 'Ver ficha', { email: quien.email })]);
  }
  // PIN
  if (quien && /\bpin\b/.test(n)) return R(quien.sinCelular ? `El PIN de ${pila(quien)} es ${quien.pin || '(sin PIN)'}. Lo usa en la PC de recepción.` : `${pila(quien)} ficha con su celular, no tiene PIN.`, [accion('ver_ficha', 'Ver ficha', { email: quien.email })]);

  // ----- Consultas -----
  // Cantidades y listados: "¿cuántos profesores tenemos?", "lista de recepción", "¿cuántas clases de pilates hay?", "el staff"
  const pideCuenta = dice(ws, ['staff', 'plantel', 'nomina'])
    || /cuant|cunat|cuamt|cantidad|\blistado?\b|\btotal\b|quienes (son|estan|trabajan|dan|tenemos|hay)|nombrame|decime (los|las|todos|quienes)|todos los|todas las/.test(n);
  if (pideCuenta && !quien && !f && !dice(ws, ['libre', 'disponib', 'cubr', 'reempl', 'vacacion', 'pedido', 'llegada', 'fich', 'pendient'])
      && !/tarde|horas|falt/.test(n)) {
    const act = actividadEn(texto);
    const sede = SEDES.find(x => ws.includes(sinTildes(x)));
    const deProfes = dice(ws, ['profe', 'instruct', 'docent', 'entrenad', 'coach']);
    // Clases de la grilla
    if (dice(ws, ['clase']) && !deProfes) {
      const cs = S.clases.filter(c => (!act || c.actividad === act) && (!sede || c.sede === sede));
      const porSede = SEDES.map(x => [x, cs.filter(c => c.sede === x).length]).filter(x => x[1]);
      const porAct = [...new Set(cs.map(c => c.actividad))];
      const sinP = cs.filter(c => !c.profesor).length;
      return R(cs.length ? `Hay ${cs.length} clase${cs.length > 1 ? 's' : ''} por semana${act ? ' de ' + act : ''}${sede ? ' en ' + sede : ''}${!sede && porSede.length > 1 ? ` (${porSede.map(([x, k]) => `${k} en ${x}`).join(', ')})` : ''}.${!act && porAct.length ? ` Son ${porAct.length} actividades distintas.` : ''}${sinP ? ` ${sinP} no ${sinP > 1 ? 'tienen' : 'tiene'} profe.` : ' Todas tienen profe.'}`
        : `No hay clases${act ? ' de ' + act : ''}${sede ? ' en ' + sede : ''} en la grilla.`, [accion('ir', 'Ver grilla', { tab: 'grilla' })]);
    }
    // Personas del equipo
    const rolQ = dice(ws, ['sala', 'muscul']) ? ['musculacion'] : dice(ws, ['recep']) ? ['recepcion'] : dice(ws, ['limpi']) ? ['limpieza'] : deProfes || act ? ['clases', 'musculacion'] : null;
    const gente = activos().filter(p => (!rolQ || (p.roles || []).some(r => rolQ.includes(r)))
      && (!act || (p.actividades || []).includes(act) || S.clases.some(c => c.profesor === p.email && c.actividad === act))
      && (!sede || S.clases.some(c => c.profesor === p.email && c.sede === sede)))
      .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)));
    const [uno, varios] = !rolQ ? ['persona', 'personas'] : rolQ.length === 2 ? ['profe', 'profes'] : rolQ[0] === 'musculacion' ? ['profe de sala', 'profes de sala'] : [`persona en ${ROL_CORTO[rolQ[0]].toLowerCase()}`, `personas en ${ROL_CORTO[rolQ[0]].toLowerCase()}`];
    const filtro = `${act ? ' que dan ' + act : ''}${sede ? ' en ' + sede : ''}`;
    const desglose = (rolQ || Object.keys(ROLES)).map(r => [r, gente.filter(p => (p.roles || []).includes(r)).length]).filter(x => x[1]);
    const ambos = rolQ?.length === 2 ? gente.filter(p => ['clases', 'musculacion'].every(r => (p.roles || []).includes(r))).length : 0;
    const porAprobar = pendientesFicha().filter(p => !rolQ || (p.roles || []).some(r => rolQ.includes(r))).length;
    if (!gente.length) return R(`No encontré ${varios}${filtro}.${porAprobar ? ` Hay ${porAprobar} ficha(s) esperando aprobación.` : ''}`, [accion('ir', 'Ver personal', { tab: 'personal' })]);
    return R(`${gente.length === 1 ? `Hay 1 ${uno}` : `Tenemos ${gente.length} ${varios}`}${filtro}${!act && !sede && desglose.length > 1 ? `: ${desglose.map(([r, k]) => `${k} de ${ROL_CORTO[r].toLowerCase()}`).join(', ')}${ambos ? ` (${ambos} hace${ambos > 1 ? 'n' : ''} las dos cosas)` : ''}` : ''}. ${gente.length > 1 ? 'Son' : 'Es'}: ${listar(gente.map(nombreCompleto), 12)}.${porAprobar ? ` Además hay ${porAprobar} ficha(s) esperando aprobación.` : ''}`,
      [accion('ir', 'Ver personal', { tab: 'personal' }), ...(gente.length <= 3 ? gente.map(p => accion('ver_ficha', `Ficha de ${pila(p)}`, { email: p.email })) : [])]);
  }
  // Quién está libre
  if (dice(ws, ['libre', 'disponib', 'puede cubrir', 'quien puede'])) {
    const fecha = f || hoy();
    let ls = libresEn(fecha, fr);
    const act = actividadEn(texto);
    if (act) ls = ls.filter(x => (x.p.actividades || []).includes(act));
    if (dice(ws, ['sala', 'muscul'])) ls = ls.filter(x => (x.p.roles || []).includes('musculacion'));
    if (dice(ws, ['recep'])) ls = ls.filter(x => (x.p.roles || []).includes('recepcion'));
    const cuando = `${fechaLarga(fecha)}${fr ? ' a la ' + FRANJAS[fr].toLowerCase() : ''}`;
    return R(ls.length ? `Libres el ${cuando}${act ? ' que dan ' + act : ''}: ${listar(ls.map(x => `${nombreCompleto(x.p)}${x.dijo ? ' (dijo que puede)' : ''}`), 8)}.` : `El ${cuando} no encontré a nadie libre${act ? ' que dé ' + act : ''}.`,
      ls.slice(0, 3).map(x => accion('whatsapp', `WhatsApp a ${pila(x.p)}`, { email: x.p.email })));
  }
  // Quién cubre a alguien
  if (quien && dice(ws, ['cubr', 'reempl'])) {
    const rs = S.reemplazos.filter(r => r.titular === quien.email && r.fecha >= hoy()).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desde.localeCompare(b.desde));
    const falta = necesidadesFuturas(hoy(), iso(sumarDias(new Date(), 35))).filter(x => x.titular === quien.email && faltaCubrir(x, S.reemplazos).length);
    const props = falta.slice(0, 3).map(propuestaCubrir).filter(x => x.acc);
    return R(`${rs.length ? `A ${pila(quien)} lo cubren: ${listar(rs.map(r => `${nomR(r).split(' ')[0]} ${fechaCorta(r.fecha).slice(0, 5)} ${r.desde}–${r.hasta}`), 6)}.` : `A ${pila(quien)} no lo cubre nadie todavía.`}${falta.length ? ` Falta cubrir ${falta.length} turno(s).` : ''}`,
      props.map(x => x.acc).concat(falta.length > props.length ? [accion('ir', 'Ver reemplazos', { tab: 'reemplazos' })] : []));
  }
  // Quién da una actividad
  const act = actividadEn(texto);
  if (act && dice(ws, ['quien', 'da ', 'dan', 'profe', 'clase', 'cuando', 'horario', 'hay'])) {
    const cs = S.clases.filter(c => c.actividad === act).sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde));
    const saben = activos().filter(p => (p.actividades || []).includes(act));
    return R(`${act}: ${cs.length ? listar(cs.map(c => `${DIAS_CORTOS[c.dia]} ${c.desde} ${c.sede} (${c.profesor ? nom(c.profesor).split(' ')[0] : 'sin profe'})`), 8) : 'no hay clases en la grilla'}.${saben.length ? ` Saben darla: ${listar(saben.map(nombreCompleto), 6)}.` : ''}`,
      [accion('ir', 'Ver grilla', { tab: 'grilla' })]);
  }
  // Horario de alguien / resumen de una persona
  if (quien && dice(ws, ['horario', 'trabaj', 'clases', 'cuando viene', 'que dias', 'turno', 'agenda'])) {
    const ag = agenda(quien, S.clases);
    return R(ag.length ? `${pila(quien)}: ${listar(ag.map(s => `${DIAS_CORTOS[s.dia]} ${s.desde}–${s.hasta} ${s.actividad || ROL_CORTO[s.rol]}`), 10)}.` : `${pila(quien)} no tiene horarios cargados.`,
      [accion('ver_ficha', `Ver ficha de ${pila(quien)}`, { email: quien.email })]);
  }
  // Asistencia: llegadas tarde, horas, faltas
  if (dice(ws, ['tarde', 'llego', 'llegada', 'horas', 'asisten', 'falto', 'faltas']) && !/a la tarde|por la tarde/.test(n)) {
    const ags = Object.fromEntries(S.personal.map(p => [p.email, agenda(p, S.clases)]));
    const res = resumenAsistencia(jornadas(S.fichajes, ags, Object.fromEntries(S.personal.map(p => [p.email, nombreCompleto(p)]))));
    const mes = MESES[+S.mesAsis.slice(5) - 1];
    if (quien) {
      const r = res.find(x => x.email === quien.email);
      return R(r ? `${pila(quien)} en ${mes}: ${r.dias} días, ${fmtMin(r.minutos)} trabajadas, ${r.tardes} llegada(s) tarde.` : `${pila(quien)} no tiene fichajes en ${mes}.`, [accion('ir', 'Ver asistencia', { tab: 'asistencia' })]);
    }
    const tardes = res.filter(x => x.tardes).sort((a, b) => b.tardes - a.tardes);
    return R(tardes.length ? `Llegadas tarde en ${mes}: ${listar(tardes.map(x => `${x.nombre.split(' ')[0]} (${x.tardes})`), 6)}.` : `En ${mes} nadie llegó tarde.`, [accion('ir', 'Ver asistencia', { tab: 'asistencia' })]);
  }
  // Clases sin profe
  if (/sin profe/.test(n) || (dice(ws, ['clase']) && dice(ws, ['sin', 'falta', 'libre']))) {
    const csp = clasesSinProfe();
    return R(csp.length ? `Clases sin profesor: ${listar(csp.map(c => `${DIAS_CORTOS[c.dia]} ${c.desde} ${c.actividad} (${c.sede})`), 6)}.` : 'Todas las clases tienen profesor.', [accion('ir', 'Ver grilla', { tab: 'grilla' })]);
  }
  // Qué falta cubrir
  if (dice(ws, ['cubr', 'reempl', 'hueco'])) {
    const hasta = iso(sumarDias(new Date(), /mes/.test(n) ? 30 : 7));
    const sin = necesidadesFuturas(f || hoy(), f || hasta).filter(x => faltaCubrir(x, S.reemplazos).length);
    if (!sin.length) return R(f ? `El ${fechaLarga(f)} está todo cubierto.` : 'Está todo cubierto. 👍');
    const props = sin.slice(0, 3).map(propuestaCubrir);
    return R(`Falta cubrir ${sin.length} turno(s): ${listar(props.map(x => x.txt), 3)}.`, props.map(x => x.acc).concat([accion('ir', 'Ver todos', { tab: 'reemplazos' })]));
  }
  // Vacaciones / pedidos
  if (dice(ws, ['vacacion', 'pedido', 'pendient', 'licencia', 'ausencia'])) {
    const pend = pendientesAus();
    const prox = S.ausencias.filter(a => a.estado === 'aprobada' && a.hasta >= hoy() && (!quien || a.email === quien.email)).sort((a, b) => a.desde.localeCompare(b.desde));
    if (quien) return R(prox.length ? `${pila(quien)}: ${listar(prox.map(a => `${a.tipo} ${rangoTexto(a.desde, a.hasta)} (${textoDias(a.desde, a.hasta, P(a.email), S.clases)})`))}.` : `${pila(quien)} no tiene vacaciones ni ausencias por delante.`);
    if (!pend.length) return R(`No hay pedidos para responder.${prox.length ? ` Próximas: ${listar(prox.map(a => `${(a.nombre || nom(a.email)).split(' ')[0]} ${rangoTexto(a.desde, a.hasta)}`), 4)}.` : ''}`);
    const a = pend[0];
    return R(`Hay ${pend.length} pedido(s): ${listar(pend.map(x => `${(x.nombre || nom(x.email)).split(' ')[0]} ${rangoTexto(x.desde, x.hasta)}`), 4)}.`,
      [accion('aprobar', `Aprobar a ${(a.nombre || '').split(' ')[0]}`, { ausenciaId: a.id }), accion('rechazar', 'Rechazar', { ausenciaId: a.id }), accion('ir', 'Ver todos', { tab: 'vacaciones' })]);
  }
  // Censo
  if (dice(ws, ['censo', 'ficha'])) {
    const { filas } = estadoCenso();
    const faltan = filas.filter(x => x.estado === 'sin-enviar' || x.estado === 'enviado');
    const porAprobar = pendientesFicha();
    return R(`${faltan.length ? `Faltan completar el censo: ${listar(faltan.map(x => x.r.nombre || ''), 6)}.` : 'Todos completaron el censo.'}${porAprobar.length ? ` Hay ${porAprobar.length} ficha(s) para aprobar.` : ''}`,
      [accion('mensaje_censo', 'Copiar mensaje del censo'), ...porAprobar.slice(0, 2).map(p => accion('aprobar_ficha', `Aprobar a ${pila(p)}`, { email: p.email })), accion('ir', 'Ver censo', { tab: 'censo' })]);
  }
  // Quién trabaja un día (y franja)
  if (f && dice(ws, ['quien', 'trabaj', 'esta', 'viene', 'hay'])) {
    const dia = deIso(f).getDay(), [a0, a1] = fr ? FRANJA_MIN[fr] : [0, 1440];
    const van = activos().map(p => ({ p, ag: agenda(p, S.clases).filter(s => s.dia === dia && min(s.desde) < a1 && min(s.hasta) > a0) })).filter(x => x.ag.length);
    const aus = van.filter(x => ausenteEn(x.p.email, f, S.ausencias));
    return R(`El ${fechaLarga(f)}${fr ? ' a la ' + FRANJAS[fr].toLowerCase() : ''} trabajan: ${listar(van.filter(x => !aus.includes(x)).map(x => `${pila(x.p)} ${x.ag[0].desde}`), 10)}.${aus.length ? ` No vienen: ${listar(aus.map(x => pila(x.p)))}.` : ''}`, [accion('ver_dia', 'Ver el día con barras', { fecha: f })]);
  }
  // Quién falta / quién vino hoy
  if (dice(ws, ['falta', 'vino', 'ausent', 'quien esta', 'hoy'])) {
    const fecha = f || hoy();
    const aus = S.ausencias.filter(a => a.estado === 'aprobada' && a.desde <= fecha && a.hasta >= fecha);
    const sin = necesidadesFuturas(fecha, fecha).filter(x => faltaCubrir(x, S.reemplazos).length);
    return R(`${aus.length ? `El ${fechaLarga(fecha)} no vienen: ${listar(aus.map(a => (a.nombre || nom(a.email)).split(' ')[0]))}.` : `El ${fechaLarga(fecha)} no falta nadie con aviso.`}${sin.length ? ` Quedan ${sin.length} turno(s) sin cubrir.` : ''}`,
      [accion('ver_dia', 'Ver el día', { fecha }), sin.length ? accion('ir', 'Ver reemplazos', { tab: 'reemplazos' }) : null]);
  }
  // Ir a una pantalla
  const tab = Object.keys(NOMBRE_TAB).find(k => dice(ws, [sinTildes(NOMBRE_TAB[k]).split(' ')[0]]));
  if (tab) return R(`Te llevo a ${NOMBRE_TAB[tab]}.`, [accion('ir', `Ir a ${NOMBRE_TAB[tab]}`, { tab })]);
  // Solo un nombre: resumen de la persona
  if (quien) {
    const ag = agenda(quien, S.clases);
    const prox = S.ausencias.filter(a => a.email === quien.email && a.estado !== 'rechazada' && a.hasta >= hoy());
    return R(`${nombreCompleto(quien)} · ${(quien.roles || []).map(r => ROL_CORTO[r]).join(', ') || 'sin rol'} · ${resumenSemana(ag)}${prox.length ? ` · ${prox[0].tipo} ${rangoTexto(prox[0].desde, prox[0].hasta)}` : ''}.`,
      [accion('ver_ficha', `Ver ficha de ${pila(quien)}`, { email: quien.email }), quien.telefono ? accion('whatsapp', `WhatsApp a ${pila(quien)}`, { email: quien.email }) : null]);
  }
  if (/^(hola|buen|gracias|ok|dale|genial|listo|perfecto|joya|barbaro|bien)/.test(n)) return R(/^(hola|buen)/.test(n) ? '¡Hola! Preguntame lo que necesites o tocá una de las preguntas de abajo.' : '👍 Cuando necesites algo, escribime.');
  // No quedó claro: ofrece las preguntas que más se parecen, para tocar y listo
  const parecidas = EJEMPLOS.map(q => ({ q, pts: palabras(q).filter(w => w.length >= 4 && ws.some(x => x.length >= 4 && (x.startsWith(w.slice(0, Math.max(4, w.length - 2))) || lev(x, w) <= 1))).reduce((t, w) => t + w.length, 0) }))
    .sort((a, b) => b.pts - a.pts).slice(0, 3);
  return R(parecidas[0].pts ? '¿Quisiste preguntar alguna de estas? Tocá la que va.' : 'No estoy seguro de qué necesitás. Tocá una de estas o escribilo de otra forma (por ejemplo "que Diego cubra a Roberto el martes de 11 a 12").',
    parecidas.map(x => accion('preguntar', x.q, { texto: x.q })));
}

async function preguntarIA(texto) {
  const c = S.config || {};
  // Sin IA paga: responde la app con sus propias reglas (gratis y sin mandar datos afuera)
  if (!c.asistenteIA && !(DEMO && window.__asistentePrueba)) return responderLocal(texto);
  // Historial: solo texto (los datos van frescos en el último mensaje)
  const mensajes = AS.chat.filter(m => !m.error && !m.local).slice(-8).map(m => ({ role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto }));
  mensajes.push({ role: 'user', content: `DATOS (actualizados ahora):\n${JSON.stringify(datosAsistente())}\n\nPREGUNTA: ${texto}` });
  if (DEMO) {
    return window.__asistentePrueba(texto, datosAsistente());
  }
  if (!c.correoScriptUrl) throw new Error('Falta conectar el script de Google en Ajustes.');
  const r = await fetch(c.correoScriptUrl, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ tipo: 'asistente', clave: c.correoClave || '', system: SISTEMA_ASISTENTE, mensajes, formato: { type: 'json_schema', schema: ESQUEMA_ASISTENTE } }),
  });
  const txt = await r.text();
  let d; try { d = JSON.parse(txt); } catch { throw new Error(txt.includes('clave incorrecta') ? 'La clave del script no coincide (Ajustes).' : 'El script todavía no tiene el asistente. Hay que actualizarlo.'); }
  if (d.error) throw new Error(d.error);
  const m = d.cuerpo || {};
  if (d.status !== 200) throw new Error(m.error?.message || `Claude respondió con error ${d.status}`);
  if (m.stop_reason === 'refusal') return { respuesta: 'Esa consulta no la puedo responder. Probá preguntarlo de otra forma.', acciones: [] };
  const bloque = (m.content || []).find(b => b.type === 'text');
  try { return JSON.parse(bloque?.text || ''); } catch { return { respuesta: bloque?.text || 'No entendí la respuesta. Probá de nuevo.', acciones: [] }; }
}

async function ejecutarAccion(x, sinConfirmar = false) {
  const persona = () => { const p = P(x.email); if (!p) toast('No encontré a esa persona', true); return p; };
  switch (x.tipo) {
    case 'preguntar': return enviarPregunta(x.texto);
    case 'ir': if (NOMBRE_TAB[x.tab]) { if (innerWidth < 900) cerrarAsistente(); irA(x.tab); } return;
    case 'ver_ficha': { const p = persona(); if (p) verFicha(p); return; }
    case 'ver_dia': if (x.fecha) verDia(x.fecha); return;
    case 'ver_pedido': { const a = S.ausencias.find(a => a.id === x.ausenciaId); return a ? verAusencia(a) : toast('No encontré ese pedido', true); }
    case 'aprobar': case 'rechazar': {
      const a = S.ausencias.find(a => a.id === x.ausenciaId);
      if (!a) return toast('No encontré ese pedido', true);
      return responder(a, x.tipo === 'aprobar');
    }
    case 'aprobar_ficha': {
      const p = persona(); if (!p) return;
      if (await confirmar(`¿Aprobar la ficha de <b>${esc(nombreCompleto(p))}</b>? Sus clases pasan a la grilla.`, { si: 'Aprobar' })) aprobarFicha(p);
      return;
    }
    case 'habilitar_celular': { const p = persona(); if (p) habilitarCelular(p); return; }
    case 'cargar_ausencia': return cargarAusencia(x.email, { tipo: x.tipoAusencia, desde: x.fecha, hasta: x.hasta, motivo: x.motivo });
    case 'fichaje_manual': return fichajeManual({ email: x.email, fecha: x.fecha, hora: x.desde, tipo: x.tipoFichaje });
    case 'justificar_falta': {
      const p = persona(); if (!p || !x.fecha) return;
      if (!(await confirmar(`¿Justificar la falta de <b>${esc(nombreCompleto(p))}</b> del ${fechaLarga(x.fecha)}? Queda como ausencia avisada.`, { si: 'Justificar' }))) return;
      await agregar('ausencias', { email: p.email, nombre: nombreCompleto(p), tipo: 'ausencia', desde: x.fecha, hasta: x.fecha, motivo: 'Justificada por gerencia', estado: 'aprobada', creado: AHORA, respondida: AHORA, respondidaPor: S.user.email, cargadaPorGerencia: true });
      pintarAsistente(); return toast('Falta justificada');
    }
    case 'mensaje_censo': return copiar(msjCenso(''));
    case 'todas': {
      if (!(await confirmar(`¿Hacer todo esto?<br>• ${x.sub.map(a => esc(a.etiqueta)).join('<br>• ')}`, { si: 'Sí, hacer todo' }))) return;
      for (const a of x.sub) await ejecutarAccion(a, true);
      return;
    }
    case 'whatsapp': { const p = persona(); if (p?.telefono) open(waLink(p.telefono, `Hola ${p.nombre}! `), '_blank'); else if (p) toast('No tiene teléfono cargado', true); return; }
    case 'quitar_reemplazo': {
      const r = S.reemplazos.find(r => r.id === x.reemplazoId);
      if (!r) return toast('Ese reemplazo ya no está', true);
      if (!(await confirmar(`¿Sacar a <b>${esc(nomR(r))}</b> del ${fechaCorta(r.fecha)} (${r.desde}–${r.hasta})?`, { si: 'Sacar', peligro: true }))) return;
      await borrar('reemplazos', r.id); return toast('Reemplazo quitado');
    }
    case 'asignar': {
      // El turno tiene que existir y el horario tiene que caer dentro (y no pisar a otro que ya cubre)
      const n = necesidadesFuturas(x.fecha, x.fecha).find(n => n.titular === x.titular && (n.generico || !x.desde || (min(x.desde) >= min(n.desde) && min(x.hasta) <= min(n.hasta))));
      if (!n) return toast('Ese turno ya no figura para cubrir', true);
      const desde = x.desde || n.desde, hasta = x.hasta || n.hasta;
      const choca = reemplazosDe(n, S.reemplazos).find(r => seSolapan(r.desde, r.hasta, desde, hasta));
      if (choca) return toast(`Esa parte ya la cubre ${nomR(choca)} (${choca.desde}–${choca.hasta})`, true);
      const q = x.reemplazo && P(x.reemplazo);
      const nombre = q ? nombreCompleto(q) : x.reemplazoNombre;
      if (!nombre) return toast('Falta saber quién cubre', true);
      if (!sinConfirmar && !(await confirmar(`<b>${esc(nombre)}</b> cubre a <b>${esc(nom(n.titular))}</b> el ${fechaLarga(n.fecha)} de <b>${desde}</b> a <b>${hasta}</b>.`, { si: 'Asignar' }))) return;
      const quien = q ? { reemplazo: q.email, reemplazoNombre: nombre }
        : { reemplazo: 'externo:' + nombre.toLowerCase().replace(/\s+/g, '-'), reemplazoNombre: nombre, reemplazoTel: '', externo: true };
      try { await agregar('reemplazos', docReemplazo(n, quien, desde, hasta)); } catch { return toast('No se pudo asignar', true); }
      return toast(`${nombre.split(' ')[0]} cubre de ${desde} a ${hasta}`);
    }
  }
}

const botonAccion = (x, ref) => `<button class="btn sm ${['rechazar', 'quitar_reemplazo', 'ver_ficha', 'ver_dia', 'ver_pedido'].includes(x.tipo) ? 'ghost' : ''}" data-acc="${ref}">${esc(x.etiqueta || x.tipo)}</button>`;
function pintarAsistente() {
  const el = document.getElementById('asistente');
  if (!el) return;
  el.classList.toggle('abierto', AS.abierto);
  const pend = paraHoy();
  el.querySelector('.as-cuenta').textContent = pend.length || '';
  el.querySelector('.as-cuenta').hidden = !pend.length;
  if (!AS.abierto) return;
  AS.hoy = pend;
  const lista = el.querySelector('.as-chat');
  lista.innerHTML = (AS.chat.length ? '' : `<div class="as-hoy"><b>${pend.length ? 'Para resolver hoy' : 'Todo al día'}</b>
      ${pend.length ? pend.map((it, i) => `<div class="as-item"><span>${esc(it.txt)}</span><div class="as-acc">${it.acc.map((x, j) => botonAccion(x, `h${i}:${j}`)).join('')}</div></div>`).join('')
        : '<p class="sub">No hay pedidos, fichas ni turnos sin cubrir. Preguntame lo que necesites.</p>'}</div>
      <p class="sub">Preguntame con tus palabras, escribiendo o con el micrófono 🎤. Por ejemplo:</p>`)
    + AS.chat.map((m, i) => m.rol === 'yo' ? `<div class="as-yo">${esc(m.texto)}</div>`
      : `<div class="as-ia ${m.error ? 'error' : ''}">${esc(m.texto)}${(m.acciones || []).length ? `<div class="as-acc">${m.acciones.map((x, j) => botonAccion(x, `${i}:${j}`)).join('')}</div>` : ''}</div>`).join('')
    + (AS.esperando ? '<div class="as-ia as-pensando">Pensando…</div>' : '');
  el.querySelector('.as-chips').innerHTML = PREGUNTAS.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('');
  el.querySelector('.as-sub').textContent = `Estás en: ${NOMBRE_TAB[S.tab] || ''}`;
  el.querySelector('[data-as-mic]').classList.toggle('activo', AS.escuchando);
  lista.scrollTop = AS.chat.length ? lista.scrollHeight : 0;
}

async function enviarPregunta(texto) {
  texto = (texto || '').trim();
  if (!texto || AS.esperando) return;
  AS.chat.push({ rol: 'yo', texto }); AS.esperando = true; pintarAsistente();
  try { const r = await preguntarIA(texto); AS.chat.push({ rol: 'ia', texto: r.respuesta || '', acciones: (r.acciones || []).filter(x => TIPOS_ACCION.includes(x.tipo)) }); }
  catch (e) { AS.chat.push({ rol: 'ia', texto: e.message || 'No pude conectarme. Probá de nuevo.', error: true }); }
  AS.esperando = false; pintarAsistente();
}

// Dictado por voz (Chrome y Safari): toca el micrófono y habla
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
function dictar() {
  if (!Reconocimiento) return toast('Este navegador no permite dictar. Probá con Chrome.', true);
  const rec = new Reconocimiento();
  rec.lang = 'es-AR'; rec.interimResults = true;
  const input = document.querySelector('#asistente .as-form input');
  rec.onresult = e => { input.value = [...e.results].map(r => r[0].transcript).join(''); if (e.results[e.results.length - 1].isFinal) { enviarPregunta(input.value); input.value = ''; } };
  rec.onend = () => { AS.escuchando = false; pintarAsistente(); };
  rec.onerror = () => toast('No te escuché. Revisá el permiso del micrófono.', true);
  AS.escuchando = true; pintarAsistente(); rec.start();
}

function cerrarAsistente() { AS.abierto = false; pintarAsistente(); }

// El panel vive fuera de la pantalla principal, así no se borra cuando la app se redibuja
function montarAsistente() {
  if (document.getElementById('asistente')) return pintarAsistente();
  const el = document.createElement('div');
  el.id = 'asistente';
  el.innerHTML = `<button class="as-boton" data-as-abrir aria-label="Abrir el asistente"><span aria-hidden="true">✨</span> ¿Qué necesitás? <span class="as-cuenta" hidden></span></button>
    <section class="as-panel" role="dialog" aria-label="Asistente">
      <div class="as-cab"><div><b>✨ Asistente</b><span class="as-sub sub"></span></div><div class="acciones"><button class="btn sm ghost" data-as-nuevo>Empezar de nuevo</button><button class="btn sm ghost" data-as-cerrar aria-label="Cerrar">✕</button></div></div>
      <div class="as-chat"></div>
      <div class="as-chips"></div>
      <form class="as-form"><button type="button" class="btn ghost as-mic" data-as-mic aria-label="Dictar con la voz">🎤</button><input placeholder="Escribí o tocá el micrófono" aria-label="Tu pregunta"><button class="btn" type="submit">Enviar</button></form>
    </section>`;
  document.body.appendChild(el);
  if (!Reconocimiento) el.querySelector('[data-as-mic]').hidden = true;
  el.addEventListener('click', e => {
    if (e.target.closest('[data-as-abrir]')) { AS.abierto = true; pintarAsistente(); }
    else if (e.target.closest('[data-as-cerrar]')) cerrarAsistente();
    else if (e.target.closest('[data-as-nuevo]')) { AS.chat = []; pintarAsistente(); }
    else if (e.target.closest('[data-as-mic]')) dictar();
    const q = e.target.closest('[data-q]'); if (q) enviarPregunta(q.dataset.q);
    const b = e.target.closest('[data-acc]');
    if (b) {
      const [i, j] = b.dataset.acc.replace('h', '').split(':').map(Number);
      ejecutarAccion(b.dataset.acc.startsWith('h') ? AS.hoy[i].acc[j] : AS.chat[i].acciones[j]);
    }
  });
  el.querySelector('.as-form').onsubmit = e => { e.preventDefault(); const i = e.target.querySelector('input'); enviarPregunta(i.value); i.value = ''; };
  pintarAsistente();
}
