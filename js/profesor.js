globalThis.__app = 'profe';
import { DEMO, AHORA, alCambiarUsuario, salir, obtener, escuchar, escucharDoc, guardar, actualizar, agregar, borrar } from './datos.js';
import {
  esc, hoy, mesDe, MESES, ESTADOS, rangoTexto, diasEntre, fechaLarga, nombreCompleto, mailto, mailSolicitud, jornadas, agenda,
  horaDe, fmtMin, ms, queCubre, TOLERANCIA_TARDE, hhmm, deIso, sumarDias, iso, modeloDispositivo, fechaCorta,
} from './logica.js';
import { $, toast, modal, cabModal, confirmar, copiar, pantallaLogin, prepararDemo, registrarApp, ayudaInstalar, htmlFicha, htmlAgenda, idDispositivo } from './ui.js';
import { censoProfe } from './censo-form.js';
import { htmlConsentimiento } from './consentimiento.js';
import { flujoFichar, fichajesDeHoy } from './fichaje.js';
import { enviarCorreo, envioAutomatico } from './correo.js';
import { waLink } from './logica.js';
import { botonGuia, registrarGuia } from './guia.js';

const app = $('#app');
const S = { user: null, persona: undefined, clases: [], ausencias: [], cubro: [], meCubren: [], fichajes: [], config: {} };
let subs = [];
const limpiar = () => { subs.forEach(u => u()); subs = []; };

await prepararDemo();
registrarApp();

alCambiarUsuario(u => {
  limpiar(); S.user = u; S.persona = undefined;
  if (!u) return pantallaLogin(app, { titulo: 'Mi ficha', texto: 'Entrá con tu cuenta de Google para ver tus horarios, fichar y pedir vacaciones o ausencias.' });
  app.innerHTML = '<main><p class="sub">Cargando…</p></main>';
  const e = u.email;
  subs.push(
    escucharDoc('personal', e, p => { S.persona = p; pintar(); }),
    escucharDoc('config', 'general', c => { S.config = c || {}; }),
    escuchar('clases', [], c => { S.clases = c; pintar(); }, errorPermisos),
    escuchar('ausencias', [['email', '==', e]], a => { S.ausencias = a; pintar(); }),
    escuchar('reemplazos', [['reemplazo', '==', e]], r => { S.cubro = r; pintar(); }),
    escuchar('reemplazos', [['titular', '==', e]], r => { S.meCubren = r; pintar(); }),
    escuchar('fichajes', [['email', '==', e], ['mes', '==', mesDe(new Date())]], f => { S.fichajes = f; pintar(); }),
  );
});
function errorPermisos(e) { if (e?.code === 'permission-denied') return; toast('Sin conexión con la base de datos', true); }

function barra() {
  return `<header class="barra"><div class="barra-in">
    <a class="marca" href="profesor.html">coghlan<b>club</b><small>Mi ficha</small></a>
    <div class="der">${botonGuia()}<span class="sub" style="font-size:.8rem">${esc(S.user.email)}</span><button class="btn sm ghost" id="salir">Salir</button></div>
  </div></header>`;
}
function enlazarBarra() { $('#salir').onclick = () => salir(); }

let tPintar = 0;
function pintar() { cancelAnimationFrame(tPintar); tPintar = requestAnimationFrame(render); }

function render() {
  if (!S.user || S.persona === undefined) return;
  const p = S.persona;
  if (!p) return renderCenso();
  if (p.estado === 'pendiente') return renderPendiente(p);
  if (p.estado === 'inactivo') {
    app.innerHTML = barra() + '<main><div class="aviso"><div><b>Tu ficha está dada de baja.</b><span>Si es un error, hablá con gerencia.</span></div></div></main>';
    return enlazarBarra();
  }
  // Un solo celular por persona: el primero queda vinculado; para cambiarlo, habilita gerencia.
  const miId = idDispositivo();
  if (p.dispositivo && p.dispositivo !== miId) return renderBloqueado(p, miId);
  if (!p.dispositivo && !vinculando) {
    vinculando = true;
    actualizar('personal', p.email, { dispositivo: miId, dispositivoModelo: modeloDispositivo(navigator.userAgent), dispositivoDesde: Date.now() })
      .catch(e => console.error(e)).finally(() => { vinculando = false; });
  }
  if (p.estado === 'pendiente') return renderPendiente(p);
  renderPrincipal(p);
}
let vinculando = false;

function renderBloqueado(p, miId) {
  const pedido = p.pedidoDispositivo?.id === miId;
  app.innerHTML = barra() + `<main><div class="panel" style="max-width:560px">
    <span class="eyebrow">Celular no habilitado</span><h1>Tu cuenta ya está en otro celular</h1>
    <p class="sub">Por seguridad cada persona usa la app en un solo celular (${esc(p.dispositivoModelo || 'otro dispositivo')}${p.dispositivoDesde ? ', desde el ' + fechaCorta(new Date(p.dispositivoDesde).toISOString().slice(0, 10)) : ''}). Si cambiaste de celular, pedile a gerencia que habilite este.</p>
    ${pedido ? '<div class="aviso info"><div><b>Pedido enviado</b><span>Cuando gerencia lo habilite, esta pantalla se actualiza sola.</span></div></div>'
      : '<button class="btn grande" id="pedir-disp">Pedir a gerencia que habilite este celular</button>'}
  </div></main>`;
  enlazarBarra();
  $('#pedir-disp')?.addEventListener('click', async () => {
    try { await actualizar('personal', p.email, { pedidoDispositivo: { id: miId, modelo: modeloDispositivo(navigator.userAgent), fecha: Date.now() } }); toast('Pedido enviado a gerencia'); }
    catch { toast('No se pudo enviar el pedido', true); }
  });
}

// ---------- Censo (primera vez) ----------
function renderCenso(previa = {}) {
  const dn = (S.user.displayName || '').includes('@') ? '' : (S.user.displayName || '');
  const persona = { nombre: dn.split(' ')[0], apellido: dn.split(' ').slice(1).join(' '), ...previa };
  censoProfe(app, {
    persona, clases: S.clases, barra: barra(), alSalir: enlazarBarra,
    alEnviar: async ({ clases, ...resto }) => {
      try {
        await guardar('personal', S.user.email, {
          ...resto, email: S.user.email, clasesDeclaradas: clases, estado: 'pendiente', creado: previa.creado || AHORA, actualizado: AHORA,
          dispositivo: previa.dispositivo || idDispositivo(), dispositivoModelo: previa.dispositivoModelo || modeloDispositivo(navigator.userAgent), dispositivoDesde: previa.dispositivoDesde || Date.now(),
        });
        toast('Ficha enviada a gerencia');
      } catch (e) { console.error(e); toast('No se pudo guardar. Revisá la conexión y probá de nuevo.', true); throw e; }
    },
  });
}

function verConsentimiento(p) {
  const c = p.consentimiento;
  modal(`${cabModal('Mi consentimiento')}<div class="caja-texto" style="max-height:none">${htmlConsentimiento(esc)}</div>
    ${c ? `<div class="aviso ok"><div><b>Firmado por ${esc(c.nombre)} · DNI ${esc(c.dni)}</b><span>${fechaCorta(new Date(c.fecha).toISOString().slice(0, 10))} · versión ${esc(c.version)}</span></div></div>`
      : '<div class="aviso"><div><b>Sin firma digital</b><span>Si lo firmaste en papel, lo tiene gerencia.</span></div></div>'}
    <div class="modal-pie"><button class="btn" data-cerrar>Cerrar</button></div>`, { ancho: true });
}

function renderPendiente(p) {
  const decl = S.clases.filter(c => (p.clasesDeclaradas || []).includes(c.id));
  app.innerHTML = barra() + `<main>
    <div class="aviso info"><div><b>Tu ficha está en revisión</b><span>Gerencia la tiene que aprobar. Mientras tanto podés corregirla.</span></div></div>
    <div class="panel">${htmlFicha(p, [], { extra: `<div style="display:grid;gap:6px"><h4>Clases que declaraste</h4>${htmlAgenda(decl.map(c => ({ ...c, rol: 'clases' })))}</div>` })}
      <button class="btn ghost" id="editar">Corregir mi ficha</button></div>
    ${ayudaInstalar()}
  </main>`;
  enlazarBarra();
  $('#editar').onclick = () => renderCenso(p);
}

// ---------- Pantalla principal ----------
function renderPrincipal(p) {
  const h = hoy();
  const misSol = [...S.ausencias].sort((a, b) => b.desde.localeCompare(a.desde));
  const cubro = S.cubro.filter(r => r.fecha >= h).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desde.localeCompare(b.desde));
  const meCubren = S.meCubren.filter(r => r.fecha >= h).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ag = agenda(p, S.clases);
  const js = jornadas(S.fichajes, { [p.email]: ag });
  const total = js.reduce((t, j) => t + (j.minutos || 0), 0);
  const deHoy = S.fichajes.filter(f => f.fecha === h).sort((a, b) => ms(a.ts) - ms(b.ts));
  const ult = deHoy.at(-1);
  const hoyAg = ag.filter(s => s.dia === new Date().getDay());
  const dentro = ult?.tipo === 'entrada';

  app.innerHTML = barra() + `<main>
    <div class="cab"><div><span class="eyebrow">${fechaLarga(h)}</span><h1>Hola, ${esc(p.nombre)}</h1></div></div>

    <div class="panel" style="gap:14px" id="p-fichar">
      <div class="cab"><div><h3>Fichar</h3>
        <p class="sub">${ult ? `Última marca hoy: <b>${ult.tipo}</b> a las <span class="mono">${horaDe(ult.ts)}</span>` : 'Todavía no marcaste hoy.'}
        ${hoyAg.length ? ` · Hoy entrás <span class="mono">${hoyAg[0].desde}</span>` : ''}</p></div>
        <span class="pill ${dentro ? 'activo' : 'neutro'}">${dentro ? 'En el club' : 'Fuera del club'}</span></div>
      <button class="btn grande bloque" id="fichar">${dentro ? 'Fichar salida' : 'Fichar entrada'} · escanear QR</button>
      <p class="sub">El QR está en la PC de recepción y cambia cada 30 segundos.</p>
    </div>

    <div class="grid-2">
      <div style="display:grid;gap:18px">
        <div class="panel" id="p-pedidos"><h3>Pedidos a gerencia</h3>
          <div class="acciones"><button class="btn" id="pedir-vac">Solicitar vacaciones</button><button class="btn ghost" id="pedir-aus">Avisar ausencia</button></div>
          <div class="lista">${misSol.length ? misSol.map(a => `<div class="item"><div>
              <b>${a.tipo === 'vacaciones' ? 'Vacaciones' : 'Ausencia'} · <span class="mono">${rangoTexto(a.desde, a.hasta)}</span></b>
              <span class="sub">${diasEntre(a.desde, a.hasta)} día(s)${a.motivo ? ' · ' + esc(a.motivo) : ''}${a.nota ? ' · Gerencia: ' + esc(a.nota) : ''}</span></div>
              <div class="acciones"><span class="pill ${a.estado}">${ESTADOS[a.estado]}</span>
              ${a.estado === 'pendiente' ? `<button class="btn sm ghost" data-cancelar="${a.id}">Cancelar</button>` : ''}</div></div>`).join('')
            : '<p class="vacio">No tenés pedidos.</p>'}</div>
        </div>

        ${cubro.length || meCubren.length ? `<div class="panel" id="p-reemplazos"><h3>Reemplazos</h3><div class="lista">
          ${cubro.map(r => `<div class="item"><div><b>Cubrís ${esc(queCubre(r))}</b><span class="sub">${fechaLarga(r.fecha)} · <span class="mono">${r.desde}–${r.hasta}</span> · en lugar de ${esc(r.titularNombre || r.titular)}</span></div><span class="pill info">Te toca</span></div>`).join('')}
          ${meCubren.map(r => `<div class="item"><div><b>Te cubre ${esc(r.reemplazoNombre || r.reemplazo)}</b><span class="sub">${fechaLarga(r.fecha)} · <span class="mono">${r.desde}–${r.hasta}</span> · ${esc(queCubre(r))}</span></div><span class="pill aprobada">Cubierto</span></div>`).join('')}
        </div></div>` : ''}

        <div class="panel" id="p-fichajes"><div class="cab"><h3>Mis fichajes de ${MESES[new Date().getMonth()]}</h3><span class="mono sub">${fmtMin(total)} trabajadas</span></div>
          ${js.length ? `<div class="tabla-wrap"><table><thead><tr><th>Día</th><th>Entrada</th><th>Salida</th><th class="num">Horas</th></tr></thead><tbody>
            ${js.map(j => `<tr><td>${fechaCorto(j.fecha)}</td>
              <td class="mono ${j.tardanza > TOLERANCIA_TARDE ? 'tarde' : ''}">${j.entrada ? horaDe(j.entrada.ts) : '—'}${j.tardanza > TOLERANCIA_TARDE ? ` <span class="sub">(+${j.tardanza}′)</span>` : ''}</td>
              <td class="mono">${j.salida ? horaDe(j.salida.ts) : '<span class="sub">sin salida</span>'}</td>
              <td class="num mono">${j.minutos != null ? fmtMin(j.minutos) : '—'}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="vacio">Todavía no hay fichajes este mes.</p>'}
        </div>
      </div>

      <div style="display:grid;gap:18px">
        <div class="panel" id="p-ficha">${htmlFicha(p, S.clases)}
          <div class="acciones"><button class="btn sm ghost" id="editar-tel">Cambiar teléfono</button><button class="btn sm ghost" id="actualizar-ficha">Avisar cambios de horario</button><button class="btn sm ghost" id="ver-consent">Mi consentimiento</button></div>
        </div>
        ${ayudaInstalar()}
      </div>
    </div>
  </main>`;
  enlazarBarra();
  $('#fichar').onclick = () => flujoFichar(p);
  $('#pedir-vac').onclick = () => abrirSolicitud('vacaciones');
  $('#pedir-aus').onclick = () => abrirSolicitud('ausencia');
  $('#editar-tel').onclick = editarTelefono;
  $('#actualizar-ficha').onclick = () => avisoCambio(p);
  $('#ver-consent').onclick = () => verConsentimiento(p);
  app.querySelectorAll('[data-cancelar]').forEach(b => b.onclick = async () => {
    if (!(await confirmar('¿Cancelar este pedido?', { si: 'Sí, cancelar', peligro: true }))) return;
    try { await borrar('ausencias', b.dataset.cancelar); toast('Pedido cancelado'); } catch { toast('No se pudo cancelar', true); }
  });
}
const fechaCorto = f => { const d = deIso(f); return `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]} ${d.getDate()}`; };

function editarTelefono() {
  const m = modal(`${cabModal('Cambiar teléfono')}<label>Teléfono (WhatsApp)<input id="nuevo-tel" inputmode="tel" value="${esc(S.persona.telefono)}"></label>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn" id="ok-tel">Guardar</button></div>`);
  $('#ok-tel', m.el).onclick = async () => {
    const t = $('#nuevo-tel', m.el).value.trim(); if (!t) return toast('Escribí un teléfono', true);
    try { await actualizar('personal', S.persona.email, { telefono: t }); m.cerrar(); toast('Teléfono actualizado'); } catch { toast('No se pudo guardar', true); }
  };
}

function avisoCambio(p) {
  const para = S.config.correoGerencia || '';
  const asunto = `Cambio de horario – ${nombreCompleto(p)}`;
  const cuerpo = `Hola, gerencia de Coghlan Club:\n\nLes aviso que cambió mi horario. Desde el __/__/____:\n\n- \n\nSaludos,\n${nombreCompleto(p)}`;
  modal(`${cabModal('Avisar cambio de horario')}<p class="sub">Los horarios los actualiza gerencia. Mandales el detalle por correo.</p>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cerrar</button><a class="btn" href="${mailto(para, '', asunto, cuerpo)}">Abrir correo</a></div>`);
}

// ---------- Solicitud formal (vacaciones / ausencia) ----------
function abrirSolicitud(tipo) {
  const p = S.persona;
  const manana = iso(sumarDias(new Date(), 1));
  const ini = tipo === 'vacaciones' ? iso(sumarDias(new Date(), 15)) : hoy();
  let editado = false;
  const m = modal(`${cabModal(tipo === 'vacaciones' ? 'Solicitar vacaciones' : 'Avisar ausencia')}
    <p class="sub">Elegí las fechas: el correo formal se arma solo. Al enviar queda registrado en el sistema ${envioAutomatico(S.config) ? 'y el correo le llega a gerencia automáticamente' : 'y se abre tu app de correo con el mensaje listo'}.</p>
    <div class="form">
      <div class="fila">
        <label>Desde<input id="s-desde" type="date" value="${ini}" min="${tipo === 'vacaciones' ? manana : hoy()}"></label>
        <label>Hasta (inclusive)<input id="s-hasta" type="date" value="${ini}" min="${tipo === 'vacaciones' ? manana : hoy()}"></label>
      </div>
      ${tipo === 'ausencia' ? '<label>Motivo<input id="s-motivo" placeholder="Ej.: turno médico, trámite, viaje"></label>' : ''}
      <div id="s-impacto"></div>
      <div class="correo">
        <div class="campo"><span>Para</span><input id="s-para" type="email" value="${esc(S.config.correoGerencia || '')}" placeholder="correo de gerencia"></div>
        <div class="campo"><span>CC</span><input id="s-cc" value="${esc(S.config.correoCC || '')}" placeholder="opcional"></div>
        <div class="campo"><span>Asunto</span><input id="s-asunto"></div>
        <textarea id="s-cuerpo" aria-label="Texto del correo"></textarea>
      </div>
    </div>
    <div class="modal-pie"><button class="btn ghost" data-cerrar>Cancelar</button><button class="btn ghost" id="s-copiar">Copiar texto</button><button class="btn" id="s-enviar">Enviar pedido</button></div>`, { ancho: true });
  const v = id => $(id, m.el)?.value.trim() || '';
  const regenerar = () => {
    let d = v('#s-desde'), h = v('#s-hasta');
    if (d && (!h || h < d)) { $('#s-hasta', m.el).value = d; h = d; }
    $('#s-hasta', m.el).min = d || '';
    if (!editado) {
      const t = mailSolicitud({ tipo, desde: d, hasta: h, motivo: v('#s-motivo'), persona: p });
      $('#s-asunto', m.el).value = t.asunto; $('#s-cuerpo', m.el).value = t.cuerpo;
    }
    const n = d && h ? diasEntre(d, h) : 0;
    const ag = agenda(p, S.clases);
    let turnos = 0;
    if (n && n < 120) for (let x = deIso(d); x <= deIso(h); x.setDate(x.getDate() + 1)) turnos += ag.filter(s => s.dia === x.getDay()).length;
    $('#s-impacto', m.el).innerHTML = n ? `<p class="sub"><b class="mono">${n}</b> día(s) · ${turnos ? `quedan <b>${turnos}</b> turnos/clases para cubrir; gerencia se encarga del reemplazo.` : 'no tenés turnos esos días.'}</p>` : '';
  };
  ['#s-desde', '#s-hasta', '#s-motivo'].forEach(id => $(id, m.el)?.addEventListener('input', regenerar));
  $('#s-cuerpo', m.el).addEventListener('input', () => { editado = true; });
  $('#s-asunto', m.el).addEventListener('input', () => { editado = true; });
  regenerar();
  $('#s-copiar', m.el).onclick = () => copiar(`Para: ${v('#s-para')}\nAsunto: ${v('#s-asunto')}\n\n${$('#s-cuerpo', m.el).value}`, $('#s-cuerpo', m.el));
  $('#s-enviar', m.el).onclick = async () => {
    const desde = v('#s-desde'), hasta = v('#s-hasta'), para = v('#s-para');
    if (!desde || !hasta) return toast('Elegí las fechas', true);
    if (hasta < desde) return toast('La fecha "hasta" tiene que ser igual o posterior a "desde"', true);
    if (!para) return toast('Falta el correo de gerencia', true);
    if (tipo === 'ausencia' && !v('#s-motivo')) return toast('Escribí el motivo', true);
    const pisa = S.ausencias.find(a => a.estado !== 'rechazada' && a.desde <= hasta && a.hasta >= desde);
    if (pisa) return toast(`Ya tenés un pedido para esas fechas (${rangoTexto(pisa.desde, pisa.hasta)})`, true);
    try {
      await agregar('ausencias', { email: p.email, nombre: nombreCompleto(p), tipo, desde, hasta, motivo: v('#s-motivo'), estado: 'pendiente', creado: AHORA });
    } catch (e) { console.error(e); return toast('No se pudo registrar el pedido', true); }
    const asunto = v('#s-asunto'), cuerpo = $('#s-cuerpo', m.el).value;
    m.cerrar();
    const urgente = tipo === 'ausencia' && desde <= iso(sumarDias(new Date(), 1));
    const como = await enviarCorreo(S.config, { para, cc: v('#s-cc'), asunto, cuerpo, responderA: p.email });
    const wa = S.config.whatsappGerencia ? waLink(S.config.whatsappGerencia, `${asunto}\n\n${cuerpo}`) : '';
    modal(`${cabModal('Pedido registrado')}
      <div class="lista">
        <div class="item"><span>Quedó registrado en el sistema de gerencia</span><span class="pill aprobada">Listo</span></div>
        <div class="item"><span>${como === 'auto' ? `Correo enviado a ${esc(para)}` : 'Se abrió tu app de correo con el mensaje listo: tocá Enviar'}</span><span class="pill ${como === 'auto' ? 'aprobada' : 'pendiente'}">${como === 'auto' ? 'Enviado' : 'Falta Enviar'}</span></div>
      </div>
      ${wa ? `<div class="aviso ${urgente ? 'mal' : 'info'}"><div><b>${urgente ? 'Es para hoy o mañana: avisá también por WhatsApp' : '¿Querés avisar también por WhatsApp?'}</b>
        <a class="btn ${urgente ? '' : 'ghost'}" target="_blank" rel="noopener" href="${wa}" style="justify-self:start">Avisar a gerencia por WhatsApp</a></div></div>` : ''}
      <p class="sub">Cuando gerencia responda, lo vas a ver en "Pedidos a gerencia"${como === 'auto' ? ' y te llega un correo' : ''}.</p>
      <div class="modal-pie"><button class="btn" data-cerrar>Listo</button></div>`);
  };
}

if (DEMO) window.__S = S;
export { hhmm };

// ---------- Guía de uso ----------
registrarGuia({
  clave: 'profe', listo: '#fichar',
  pasos: () => !document.querySelector('#fichar') ? [
    { titulo: 'Completá tu ficha', texto: `<p>Antes de usar la app, gerencia necesita tus datos. Son <b>5 pasos</b>:</p>
      <ul><li><b>Datos</b>: nombre, celular, contacto de emergencia y dirección.</li><li><b>Rol</b>: qué hacés en el club.</li>
      <li><b>Horarios</b>: tocá tus clases en la grilla o cargá tu turno fijo.</li><li><b>Consentimiento</b>: el permiso para usar tus datos (solo laboral).</li><li><b>Revisar y enviar</b>.</li></ul>
      <p>Cuando gerencia la aprueba, se habilita fichar, pedir vacaciones y ver tu horario.</p>`,
      tip: 'Si te equivocás en algo, podés volver al paso anterior antes de enviar.' },
  ] : [
    { titulo: 'Bienvenido a Mi ficha', texto: `<p>Esta es tu app del club. Desde acá:</p>
      <ul><li>marcás tu entrada y salida,</li><li>pedís vacaciones o avisás si faltás,</li><li>ves tu horario, tus reemplazos y tus horas del mes.</li></ul>
      <p>Te mostramos para qué sirve cada parte. Son menos de un minuto.</p>`,
      tip: 'Podés avanzar con las flechas del teclado o salir con Esc.' },
    { sel: '#fichar', titulo: 'Fichar entrada y salida', texto: `<p>Tocalo <b>al llegar</b> y <b>al irte</b>. Se abre la cámara: apuntá al QR que está en la <b>PC de recepción</b>.</p>
      <p>Cuando estás adentro, el botón cambia a <b>"Fichar salida"</b> y arriba dice <b>"En el club"</b>.</p>`,
      tip: 'El QR cambia cada 30 segundos, así que no sirve una foto. Si te dice "venció", escaneá de nuevo.' },
    { sel: '#pedir-vac', titulo: 'Solicitar vacaciones', texto: `<p>Elegís las fechas y el correo para gerencia <b>se arma solo</b>. Solo revisás y enviás.</p>
      <p>El pedido aparece abajo con su estado: <b>Pendiente</b>, <b>Aprobada</b> o <b>Rechazada</b>.</p>`,
      tip: 'Mientras esté pendiente lo podés cancelar con el botón "Cancelar".' },
    { sel: '#pedir-aus', titulo: 'Avisar una ausencia', texto: `<p>Para cuando no vas a poder venir: enfermedad, trámite, imprevisto.</p>
      <p>Si es <b>para hoy o mañana</b>, te ofrece avisar también por <b>WhatsApp</b> a gerencia para que llegue rápido.</p>`,
      tip: 'Avisá lo antes posible: así gerencia consigue quién te cubra.' },
    { sel: '#p-reemplazos', opcional: true, titulo: 'Tus reemplazos', texto: `<ul><li><b>"Te cubre…"</b>: quién da tu clase o turno mientras no estás.</li>
      <li><b>"Cubrís…"</b>: una clase o turno de otro que te toca a vos.</li></ul>` },
    { sel: '#p-fichajes', titulo: 'Tus horas del mes', texto: `<p>Cada día que fichaste, con la hora de entrada, la de salida y las horas trabajadas. Arriba, el total del mes.</p>
      <p>Si llegaste <b>más de 10 minutos tarde</b>, la hora se marca en rojo con los minutos de demora.</p>` },
    { sel: '#p-ficha', titulo: 'Tu ficha y tu horario', texto: `<p>Tus datos, tu contacto de emergencia y tu <b>horario semanal</b>.</p>
      <ul><li><b>Cambiar teléfono</b>: si cambiaste de número.</li><li><b>Avisar cambios de horario</b>: si tus clases o tu turno cambiaron.</li><li><b>Mi consentimiento</b>: el permiso de datos que firmaste.</li></ul>` },
    { sel: '[data-guia]', titulo: '¿Te olvidaste algo?', texto: '<p>Tocá <b>"? Guía"</b> cuando quieras para ver esta explicación de nuevo.</p>',
      tip: 'Guardá la app en la pantalla de inicio del celular: así la abrís con un toque, como cualquier otra app.' },
  ],
});
