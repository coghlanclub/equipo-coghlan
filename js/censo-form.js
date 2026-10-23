// Censo del profe: paso a paso en el celular.
// 1 Tus datos · 2 Tu rol · 3 Tus horarios · 4 Consentimiento · 5 Revisar y enviar
import {
  esc, ROLES, ROL_CORTO, ROLES_TURNO, DIAS, DIAS_CORTOS, DIAS_LABORABLES, SEDES, ACTIVIDADES_BASE, HORARIO_CLUB,
  dentroHorarioClub, min, FRANJAS, FRANJAS_HORA, fechaCorta, iso,
} from './logica.js';
import { $, $$, toast } from './ui.js';
import { htmlConsentimiento, DECLARACION, VERSION } from './consentimiento.js';

const PASOS = ['Tus datos', 'Tu rol', 'Tus horarios', 'Consentimiento', 'Revisar y enviar'];
const ROL_TXT = {
  musculacion: 'Atiendo la sala de musculación en un horario fijo',
  clases: 'Doy clases de la grilla (funcional, yoga, indoor, boxeo…)',
  recepcion: 'Atiendo la recepción en un horario fijo',
  limpieza: 'Hago la limpieza en un horario fijo',
};

export function censoProfe(cont, { persona = {}, clases = [], barra = '', alEnviar, alSalir }) {
  const d = {
    nombre: persona.nombre || '', apellido: persona.apellido || '', telefono: persona.telefono || '',
    emergenciaNombre: persona.emergenciaNombre || '', emergenciaTel: persona.emergenciaTel || '', direccion: persona.direccion || '',
    roles: [...(persona.roles || [])], clases: [...(persona.clasesDeclaradas || [])], horarios: (persona.horarios || []).map(h => ({ ...h })),
    actividadesExtra: (persona.actividades || []).filter(a => !clases.some(c => c.actividad === a && (persona.clasesDeclaradas || []).includes(c.id))),
    disponible: [...(persona.disponible || [])],
    dni: persona.consentimiento?.dni || persona.dni || '', firma: '', acepto: false,
  };
  let paso = 0, diaGrilla = 1;

  const v = (sel) => $(sel, cont)?.value?.trim() ?? '';
  function guardarPaso() {
    if (paso === 0) {
      Object.assign(d, { nombre: v('#c-nombre'), apellido: v('#c-apellido'), telefono: v('#c-tel'), emergenciaNombre: v('#c-emn'), emergenciaTel: v('#c-emt'), direccion: v('#c-dir') });
    }
    if (paso === 3) { d.dni = v('#c-dni').replace(/\D/g, ''); d.firma = v('#c-firma'); d.acepto = $('#c-acepto', cont).checked; }
  }
  function validar() {
    if (paso === 0) {
      const f = [];
      if (!d.nombre) f.push('nombre'); if (!d.apellido) f.push('apellido'); if (d.telefono.replace(/\D/g, '').length < 8) f.push('tu celular');
      if (d.emergenciaTel.replace(/\D/g, '').length < 8) f.push('celular de emergencia'); if (!d.emergenciaNombre) f.push('a quién llamar en una emergencia');
      if (!d.direccion) f.push('dirección');
      if (f.length) { toast('Falta: ' + f.join(', '), true); return false; }
    }
    if (paso === 1 && !d.roles.length) { toast('Elegí al menos un rol', true); return false; }
    if (paso === 2) {
      if (d.roles.includes('clases') && !d.clases.length) { toast('Tocá en la grilla las clases que das', true); return false; }
      const rt = d.roles.filter(r => ROLES_TURNO.includes(r));
      const sinTurno = rt.filter(r => !d.horarios.some(h => h.rol === r));
      if (sinTurno.length) { toast('Cargá tu horario de ' + sinTurno.map(r => ROL_CORTO[r].toLowerCase()).join(' y '), true); return false; }
    }
    if (paso === 3) {
      if (d.dni.length < 7) { toast('Escribí tu DNI', true); return false; }
      const norm = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (norm(d.firma) !== norm(`${d.nombre} ${d.apellido}`)) { toast(`Para firmar, escribí tu nombre y apellido igual que arriba: ${d.nombre} ${d.apellido}`, true); return false; }
      if (!d.acepto) { toast('Tenés que marcar que aceptás', true); return false; }
    }
    return true;
  }

  function cuerpo() {
    if (paso === 0) return `
      <p class="sub">Los datos que gerencia necesita para organizar tu trabajo y ubicarte.</p>
      <div class="form">
        <div class="fila"><label>Nombre<input id="c-nombre" value="${esc(d.nombre)}" autocomplete="given-name"></label>
          <label>Apellido<input id="c-apellido" value="${esc(d.apellido)}" autocomplete="family-name"></label></div>
        <label>Tu celular (WhatsApp)<input id="c-tel" inputmode="tel" placeholder="11 5555-5555" value="${esc(d.telefono)}" autocomplete="tel"></label>
        <div class="panel" style="padding:12px;gap:10px;background:var(--bg)"><b>En caso de emergencia</b>
          <div class="fila"><label>¿A quién llamamos?<input id="c-emn" placeholder="Ej.: María, mi esposa" value="${esc(d.emergenciaNombre)}"></label>
            <label>Su celular<input id="c-emt" inputmode="tel" placeholder="11 5555-5555" value="${esc(d.emergenciaTel)}"></label></div></div>
        <label>Dirección<input id="c-dir" placeholder="Calle, número, piso, barrio" value="${esc(d.direccion)}" autocomplete="street-address"></label>
      </div>`;
    if (paso === 1) return `
      <p class="sub">¿Qué hacés en el club? Si hacés más de una cosa, marcá todas.</p>
      <div style="display:grid;gap:10px">${Object.entries(ROLES).map(([k, t]) => `
        <button type="button" class="opcion ${d.roles.includes(k) ? 'sel' : ''}" data-rol="${k}" aria-pressed="${d.roles.includes(k)}">
          <span class="tilde">${d.roles.includes(k) ? '✓' : ''}</span><span><b>${t}</b><span class="sub">${ROL_TXT[k]}</span></span></button>`).join('')}</div>`;
    if (paso === 2) return htmlHorarios();
    if (paso === 3) return `
      <div class="caja-texto">${htmlConsentimiento(esc)}</div>
      <div class="form">
        <label>Tu DNI<input id="c-dni" inputmode="numeric" placeholder="Solo números" value="${esc(d.dni)}"></label>
        <label>Firmá escribiendo tu nombre y apellido<input id="c-firma" placeholder="${esc(`${d.nombre} ${d.apellido}`)}" value="${esc(d.firma)}" autocomplete="off" style="font-family:'Brush Script MT','Segoe Script',cursive;font-size:1.35rem"></label>
        <label class="check" style="align-items:flex-start;border-radius:10px;padding:10px 12px"><input type="checkbox" id="c-acepto" ${d.acepto ? 'checked' : ''} style="margin-top:3px"> <span>${DECLARACION}</span></label>
        <span class="sub">Fecha: ${fechaCorta(iso(new Date()))}. Te queda una copia en tu ficha.</span>
      </div>`;
    return htmlResumen();
  }

  function htmlHorarios() {
    const quiereClases = d.roles.includes('clases');
    const rt = d.roles.filter(r => ROLES_TURNO.includes(r));
    let h = '';
    if (quiereClases) {
      const delDia = clases.filter(c => c.dia === diaGrilla).sort((a, b) => a.desde.localeCompare(b.desde));
      const marcadas = clases.filter(c => d.clases.includes(c.id)).sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde));
      h += `<div style="display:grid;gap:10px"><b>Tocá las clases que das hoy</b>
        <div class="seg dias" role="group" aria-label="Día">${DIAS_LABORABLES.map(x => {
          const n = clases.filter(c => c.dia === x && d.clases.includes(c.id)).length;
          return `<button type="button" data-dia="${x}" aria-pressed="${x === diaGrilla}">${DIAS_CORTOS[x]}${n ? `<span class="cuenta">${n}</span>` : ''}</button>`;
        }).join('')}</div>
        ${SEDES.map(sede => {
          const cs = delDia.filter(c => c.sede === sede);
          return cs.length ? `<div style="display:grid;gap:6px"><span class="eyebrow">${sede}</span>${cs.map(c => `
            <button type="button" class="opcion fina ${d.clases.includes(c.id) ? 'sel' : ''}" data-clase="${c.id}" aria-pressed="${d.clases.includes(c.id)}">
              <span class="tilde">${d.clases.includes(c.id) ? '✓' : ''}</span><span class="mono">${c.desde}</span><b>${esc(c.actividad)}</b></button>`).join('')}</div>` : '';
        }).join('') || '<p class="vacio">Ese día no hay clases.</p>'}
        <div class="panel" style="padding:12px;gap:6px;background:var(--bg)"><b>Marcaste ${marcadas.length} clase${marcadas.length === 1 ? '' : 's'}</b>
          ${marcadas.length ? `<span class="sub">${marcadas.map(c => `${DIAS_CORTOS[c.dia]} ${c.desde} ${esc(c.actividad)}`).join(' · ')}</span>` : '<span class="sub">Elegí el día arriba y tocá tus clases.</span>'}</div>
        <details><summary style="cursor:pointer;font-weight:600">¿Sabés dar otras actividades? (opcional)</summary>
          <div class="checks" style="margin-top:8px">${ACTIVIDADES_BASE.map(a => `<label class="check"><input type="checkbox" name="extra" value="${esc(a)}" ${d.actividadesExtra.includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div>
          <span class="sub">Sirve para que te llamen si hace falta un reemplazo.</span></details>
      </div>`;
    }
    if (rt.length) {
      h += `<div style="display:grid;gap:10px;margin-top:${quiereClases ? '18px' : '0'}"><b>Tu horario fijo de ${rt.map(r => ROL_CORTO[r].toLowerCase()).join(' / ')}</b>
        <span class="sub">Lunes a viernes 07:00–22:00 · sábados 09:00–19:00</span>
        <div class="lista">${d.horarios.length ? d.horarios.sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde)).map((t, i) => `<div class="item"><span><b>${DIAS[t.dia]}</b> <span class="mono">${t.desde}–${t.hasta}</span> <span class="rol rol-${t.rol}">${ROL_CORTO[t.rol]}</span></span><button type="button" class="btn sm ghost" data-quitar="${i}">Quitar</button></div>`).join('') : '<p class="vacio">Todavía no cargaste horarios.</p>'}</div>
        <div class="panel" style="padding:12px;gap:10px;background:var(--bg)">
          <span class="sub">1. Marcá los días · 2. Poné desde y hasta · 3. Agregar</span>
          <div class="checks" id="t-dias">${DIAS_LABORABLES.map(x => `<label class="check"><input type="checkbox" value="${x}" ${x < 6 ? 'checked' : ''}> ${DIAS_CORTOS[x]}</label>`).join('')}</div>
          <div class="fila"><label>Desde<input id="t-desde" type="time" value="07:00" step="900"></label><label>Hasta<input id="t-hasta" type="time" value="14:00" step="900"></label>
            ${rt.length > 1 ? `<label>Para<select id="t-rol">${rt.map(r => `<option value="${r}">${ROL_CORTO[r]}</option>`).join('')}</select></label>` : `<input type="hidden" id="t-rol" value="${rt[0]}">`}</div>
          <button type="button" class="btn" id="t-agregar">Agregar horario</button></div></div>`;
    }
    h += `<details style="margin-top:18px"><summary style="cursor:pointer;font-weight:600">¿Podés cubrir a un compañero? (opcional)</summary>
      <span class="sub">Marcá cuándo podrías venir a cubrir. Gerencia te llama primero a vos.</span>
      <div class="tabla-wrap" style="margin-top:8px"><table style="min-width:300px"><thead><tr><th></th>${Object.entries(FRANJAS).map(([k, t]) => `<th style="text-align:center">${t}<br><span class="mono" style="font-weight:400">${FRANJAS_HORA[k]}</span></th>`).join('')}</tr></thead><tbody>
      ${DIAS_LABORABLES.map(x => `<tr><td><b>${DIAS_CORTOS[x]}</b></td>${Object.keys(FRANJAS).map(k => x === 6 && k === 'n' ? '<td></td>' : `<td style="text-align:center"><input type="checkbox" name="disp" value="${x}-${k}" ${d.disponible.includes(`${x}-${k}`) ? 'checked' : ''} style="width:24px;height:24px;min-height:0;accent-color:var(--accent)" aria-label="${DIAS[x]} ${FRANJAS[k]}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div></details>`;
    return h;
  }

  function htmlResumen() {
    const cs = clases.filter(c => d.clases.includes(c.id)).sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde));
    const fila = (t, val, p) => `<div class="item"><div><span class="sub">${t}</span><b>${val}</b></div><button type="button" class="btn sm ghost" data-ir="${p}">Cambiar</button></div>`;
    return `<p class="sub">Revisá que esté todo bien y enviá. Gerencia lo aprueba y te avisa.</p>
      <div class="lista">
        ${fila('Nombre', esc(`${d.nombre} ${d.apellido}`), 0)}
        ${fila('Celular', `<span class="mono">${esc(d.telefono)}</span>`, 0)}
        ${fila('Emergencia', `${esc(d.emergenciaNombre)} · <span class="mono">${esc(d.emergenciaTel)}</span>`, 0)}
        ${fila('Dirección', esc(d.direccion), 0)}
        ${fila('Rol', d.roles.map(r => ROLES[r]).join(' · '), 1)}
        ${cs.length ? fila('Clases', cs.map(c => `${DIAS_CORTOS[c.dia]} ${c.desde} ${esc(c.actividad)} (${c.sede})`).join('<br>'), 2) : ''}
        ${d.horarios.length ? fila('Horario fijo', d.horarios.map(t => `${DIAS_CORTOS[t.dia]} ${t.desde}–${t.hasta} ${ROL_CORTO[t.rol]}`).join('<br>'), 2) : ''}
        ${fila('Consentimiento', `Firmado por ${esc(d.firma)} · DNI ${esc(d.dni)}`, 3)}
      </div>`;
  }

  function render() {
    cont.innerHTML = barra + `<main style="max-width:640px">
      <div style="display:grid;gap:8px"><span class="eyebrow">Censo del equipo · paso ${paso + 1} de ${PASOS.length}</span><h1>${PASOS[paso]}</h1>
        <div style="display:grid;grid-template-columns:repeat(${PASOS.length},1fr);gap:4px">${PASOS.map((_, i) => `<span style="height:5px;border-radius:9px;background:${i <= paso ? 'var(--accent)' : 'var(--surface-2)'}"></span>`).join('')}</div></div>
      <div class="panel">${cuerpo()}</div>
      <div class="pie-pasos">
        ${paso > 0 ? '<button type="button" class="btn ghost grande" id="atras">Atrás</button>' : '<span></span>'}
        ${paso < PASOS.length - 1 ? '<button type="button" class="btn grande" id="sig">Siguiente</button>' : '<button type="button" class="btn grande ok" id="enviar">Enviar mi ficha</button>'}
      </div></main>`;
    alSalir?.(cont);
    $('#atras', cont)?.addEventListener('click', () => { guardarPaso(); paso--; render(); scrollTo(0, 0); });
    $('#sig', cont)?.addEventListener('click', () => { guardarPaso(); if (!validar()) return; paso++; render(); scrollTo(0, 0); });
    $('#enviar', cont)?.addEventListener('click', async e => {
      e.target.disabled = true;
      const acts = [...new Set([...clases.filter(c => d.clases.includes(c.id)).map(c => c.actividad), ...d.actividadesExtra])];
      const salida = {
        nombre: d.nombre, apellido: d.apellido, telefono: d.telefono, emergenciaNombre: d.emergenciaNombre, emergenciaTel: d.emergenciaTel,
        direccion: d.direccion, dni: d.dni, roles: d.roles, actividades: d.roles.includes('clases') ? acts : [],
        clases: d.roles.includes('clases') ? d.clases : [], horarios: d.horarios.filter(h => d.roles.includes(h.rol)), disponible: d.disponible,
        consentimiento: { aceptado: true, nombre: d.firma, dni: d.dni, fecha: Date.now(), version: VERSION, dispositivo: navigator.userAgent.slice(0, 120) },
      };
      try { await alEnviar(salida); } catch { e.target.disabled = false; }
    });
    cont.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { paso = +b.dataset.ir; render(); scrollTo(0, 0); });
    cont.querySelectorAll('[data-rol]').forEach(b => b.onclick = () => {
      const k = b.dataset.rol; d.roles = d.roles.includes(k) ? d.roles.filter(x => x !== k) : [...d.roles, k]; render();
    });
    cont.querySelectorAll('[data-dia]').forEach(b => b.onclick = () => { diaGrilla = +b.dataset.dia; render(); });
    cont.querySelectorAll('[data-clase]').forEach(b => b.onclick = () => {
      const id = b.dataset.clase; d.clases = d.clases.includes(id) ? d.clases.filter(x => x !== id) : [...d.clases, id];
      const y = scrollY; render(); scrollTo(0, y);
    });
    cont.querySelectorAll('input[name=extra]').forEach(i => i.onchange = () => { d.actividadesExtra = $$('input[name=extra]:checked', cont).map(x => x.value); });
    cont.querySelectorAll('input[name=disp]').forEach(i => i.onchange = () => { d.disponible = $$('input[name=disp]:checked', cont).map(x => x.value); });
    cont.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { d.horarios.splice(+b.dataset.quitar, 1); const y = scrollY; render(); scrollTo(0, y); });
    $('#t-agregar', cont)?.addEventListener('click', () => {
      const dias = $$('#t-dias input:checked', cont).map(i => +i.value);
      const desde = v('#t-desde'), hasta = v('#t-hasta'), rol = $('#t-rol', cont).value;
      if (!dias.length) return toast('Marcá los días', true);
      if (!desde || !hasta || min(hasta) <= min(desde)) return toast('Revisá la hora de entrada y de salida', true);
      const fuera = [];
      for (const dia of dias) {
        const t = { dia, desde, hasta, rol };
        if (!dentroHorarioClub(t)) { fuera.push(DIAS_CORTOS[dia]); continue; }
        if (!d.horarios.some(x => x.dia === dia && x.desde === desde && x.hasta === hasta && x.rol === rol)) d.horarios.push(t);
      }
      if (fuera.length) toast(`${fuera.join(', ')}: fuera del horario del club (sábados ${HORARIO_CLUB[6].join('–')})`, true);
      const y = scrollY; render(); scrollTo(0, y);
    });
  }
  render();
}
