// Formulario de ficha / censo. Lo usa el profe (alta y edición) y la gerencia.
import { esc, ROLES, ROL_CORTO, ROLES_TURNO, DIAS, DIAS_CORTOS, DIAS_LABORABLES, ACTIVIDADES_BASE, SEDES, HORARIO_CLUB, dentroHorarioClub, min, SIN_CORREO, sinCorreo, slug, pinAleatorio, FRANJAS, FRANJAS_HORA } from './logica.js';
import { $, $$, toast } from './ui.js';

// modo: 'profe' (las clases quedan declaradas para que gerencia apruebe) o 'gerencia' (asigna directo)
export function htmlFormFicha(p = {}, { modo = 'profe', clases = [] } = {}) {
  const marcadas = new Set(modo === 'gerencia' ? clases.filter(c => c.profesor && c.profesor === p.email).map(c => c.id) : (p.clasesDeclaradas || []));
  const acts = [...new Set([...ACTIVIDADES_BASE, ...(p.actividades || [])])];
  return `<form class="form" id="form-ficha" novalidate>
    <div class="fila">
      <label>Nombre<input id="f-nombre" required value="${esc(p.nombre)}" autocomplete="given-name"></label>
      <label>Apellido<input id="f-apellido" required value="${esc(p.apellido)}" autocomplete="family-name"></label>
    </div>
    <div class="fila">
      <label>Teléfono (WhatsApp)<input id="f-telefono" required inputmode="tel" placeholder="11 5555-5555" value="${esc(p.telefono)}" autocomplete="tel"></label>
      <label>Correo de Google<input id="f-email" type="email" value="${sinCorreo(p) ? '' : esc(p.email)}" placeholder="${modo === 'gerencia' ? 'Vacío si no tiene celular' : ''}" ${modo === 'profe' || (p.email && !sinCorreo(p)) ? 'readonly' : ''}></label>
    </div>
    ${modo === 'gerencia' ? `<div class="panel" style="padding:12px;gap:10px;background:var(--bg)">
      <label class="check" style="justify-self:start"><input type="checkbox" id="f-sincel" ${p.sinCelular ? 'checked' : ''}> Ficha sin celular (con PIN en la PC de recepción)</label>
      <div class="fila" id="f-pin-fila" ${p.sinCelular ? '' : 'hidden'}>
        <label>PIN de 4 números<input id="f-pin" inputmode="numeric" maxlength="4" value="${esc(p.pin || pinAleatorio())}" class="mono"></label>
        <span class="sub" style="align-self:end">Dáselo en un papel. Lo usa en la PC de recepción: toca su nombre y pone el PIN.</span>
      </div></div>` : ''}

    <div class="form">
      <div class="fila">
        <label>Contacto de emergencia (nombre)<input id="f-emn" value="${esc(p.emergenciaNombre)}" placeholder="Ej.: María (esposa)"></label>
        <label>Celular de emergencia<input id="f-emt" inputmode="tel" value="${esc(p.emergenciaTel)}"></label>
      </div>
      <div class="fila">
        <label>Dirección<input id="f-dir" value="${esc(p.direccion)}" placeholder="Calle, número, piso, barrio"></label>
        <label>DNI<input id="f-dni" inputmode="numeric" value="${esc(p.dni)}"></label>
      </div>
    </div>

    <div style="display:grid;gap:6px"><span class="eyebrow">Tu rol en el club</span>
      <div class="checks">${Object.entries(ROLES).map(([k, v]) =>
        `<label class="check"><input type="checkbox" name="rol" value="${k}" ${(p.roles || []).includes(k) ? 'checked' : ''}> ${v}</label>`).join('')}</div>
      <span class="sub">Se puede marcar más de uno.</span></div>

    <div id="bloque-clases" style="display:grid;gap:12px">
      <div style="display:grid;gap:6px"><span class="eyebrow">Actividades que sabés dar</span>
        <div class="checks" id="f-acts">${acts.map(a =>
          `<label class="check"><input type="checkbox" name="act" value="${esc(a)}" ${(p.actividades || []).includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}</div>
        <span class="sub">Con esto el sistema sabe a quién llamar cuando falta alguien.</span></div>

      <div style="display:grid;gap:8px"><span class="eyebrow">${modo === 'gerencia' ? 'Clases asignadas en la grilla' : 'Clases que das hoy en la grilla'}</span>
        <span class="sub">${modo === 'gerencia' ? 'Marcar acá asigna la clase a esta persona.' : 'Tildá cada clase que tenés a cargo. Gerencia lo confirma.'}</span>
        <div id="f-grilla">${SEDES.map(sede => {
          const cs = clases.filter(c => c.sede === sede);
          if (!cs.length) return '';
          return `<details class="panel" style="padding:10px 12px" ${cs.some(c => marcadas.has(c.id)) ? 'open' : ''}>
            <summary style="cursor:pointer;font-weight:700">${sede} <span class="sub" data-cuenta="${sede}"></span></summary>
            <div style="display:grid;gap:8px;margin-top:10px">${DIAS_LABORABLES.map(d => {
              const del = cs.filter(c => c.dia === d).sort((a, b) => a.desde.localeCompare(b.desde));
              if (!del.length) return '';
              return `<div class="fila-dia"><b>${DIAS[d]}</b><div class="checks">${del.map(c => {
                const ocupada = modo === 'gerencia' && c.profesor && c.profesor !== p.email;
                return `<label class="check" data-act="${esc(c.actividad)}" title="${ocupada ? 'Hoy la da ' + esc(c.profesor) : ''}"><input type="checkbox" name="clase" value="${c.id}" data-sede="${sede}" ${marcadas.has(c.id) ? 'checked' : ''}>
                  <span class="mono">${c.desde}</span> ${esc(c.actividad)}${ocupada ? ' <span class="sub">(ocupada)</span>' : ''}</label>`;
              }).join('')}</div></div>`;
            }).join('')}</div></details>`;
        }).join('') || '<p class="vacio">La grilla todavía no está cargada.</p>'}</div>
        <label class="check" style="justify-self:start"><input type="checkbox" id="f-filtrar" checked> Mostrar solo mis actividades</label>
      </div>
    </div>

    <div id="bloque-turnos" style="display:grid;gap:8px">
      <span class="eyebrow">Turnos fijos (sala, recepción, limpieza)</span>
      <span class="sub">Lunes a viernes de 07:00 a 22:00 · sábados de 09:00 a 19:00.</span>
      <div id="f-turnos" class="lista"></div>
      <div class="panel" style="padding:12px;gap:10px">
        <div class="checks" id="t-dias">${DIAS_LABORABLES.map(d => `<label class="check"><input type="checkbox" value="${d}" ${d < 6 ? 'checked' : ''}> ${DIAS_CORTOS[d]}</label>`).join('')}</div>
        <div class="fila">
          <label>Desde<input id="t-desde" type="time" value="07:00" step="900"></label>
          <label>Hasta<input id="t-hasta" type="time" value="14:00" step="900"></label>
          <label>Rol<select id="t-rol"></select></label>
        </div>
        <button type="button" class="btn ghost" id="t-agregar">+ Agregar turno</button>
      </div>
    </div>
    <div style="display:grid;gap:8px"><span class="eyebrow">¿Cuándo podés cubrir reemplazos?</span>
      <span class="sub">Marcá los momentos en que podrías venir a cubrir a un compañero. Con esto gerencia te llama primero a vos.</span>
      <div class="tabla-wrap"><table style="min-width:320px"><thead><tr><th></th>${Object.entries(FRANJAS).map(([k, v]) => `<th style="text-align:center">${v}<br><span class="mono" style="font-weight:400">${FRANJAS_HORA[k]}</span></th>`).join('')}</tr></thead><tbody>
        ${DIAS_LABORABLES.map(d => `<tr><td><b>${DIAS_CORTOS[d]}</b></td>${Object.keys(FRANJAS).map(k => d === 6 && k === 'n' ? '<td></td>' : `<td style="text-align:center"><input type="checkbox" name="disp" value="${d}-${k}" ${(p.disponible || []).includes(`${d}-${k}`) ? 'checked' : ''} style="width:22px;height:22px;min-height:0;accent-color:var(--accent)" aria-label="${DIAS[d]} ${FRANJAS[k]}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>

    ${modo === 'gerencia' ? `<div class="panel" style="padding:12px;gap:8px;background:var(--bg)"><b>Consentimiento de datos (Ley 25.326)</b>
      ${p.consentimiento?.aceptado ? `<span class="pill aprobada" style="justify-self:start">Firmado ${p.consentimiento.papel ? 'en papel' : 'en la app'} · ${new Date(p.consentimiento.fecha).toLocaleDateString('es-AR')}</span>`
        : `<label class="check" style="justify-self:start"><input type="checkbox" id="f-papel"> Firmó el consentimiento en papel (guardalo en su legajo)</label>`}
      <a class="btn sm ghost" style="justify-self:start" target="_blank" rel="noopener" href="consentimiento.html#${encodeURIComponent(`${p.nombre || ''} ${p.apellido || ''}`.trim())}">Imprimir consentimiento para firmar</a></div>` : ''}
    ${modo === 'gerencia' ? `<label>Estado<select id="f-estado">
      <option value="activo" ${(p.estado || 'activo') === 'activo' ? 'selected' : ''}>Activo</option>
      <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>Ficha por aprobar</option>
      <option value="inactivo" ${p.estado === 'inactivo' ? 'selected' : ''}>Inactivo (ya no trabaja)</option></select></label>` : ''}
  </form>`;
}

export function activarFormFicha(el, p = {}) {
  let turnos = (p.horarios || []).map(t => ({ ...t }));
  const roles = () => $$('input[name=rol]:checked', el).map(i => i.value);
  const acts = () => $$('input[name=act]:checked', el).map(i => i.value);

  const pintarTurnos = () => {
    turnos.sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde));
    $('#f-turnos', el).innerHTML = turnos.length ? turnos.map((t, i) => `<div class="item"><div>
      <span><b>${DIAS[t.dia]}</b> <span class="mono">${t.desde}–${t.hasta}</span> <span class="rol rol-${t.rol}">${ROL_CORTO[t.rol]}</span></span></div>
      <button type="button" class="btn sm ghost" data-quitar="${i}">Quitar</button></div>`).join('') : '<p class="vacio">Sin turnos cargados.</p>';
  };
  const actualizar = () => {
    const rs = roles();
    $('#bloque-clases', el).hidden = !rs.includes('clases');
    const rt = rs.filter(r => ROLES_TURNO.includes(r));
    $('#bloque-turnos', el).hidden = !rt.length;
    const sel = $('#t-rol', el); const prev = sel.value;
    sel.innerHTML = rt.map(r => `<option value="${r}">${ROL_CORTO[r]}</option>`).join('');
    if (rt.includes(prev)) sel.value = prev;
    const filtrar = $('#f-filtrar', el)?.checked; const as = acts();
    $$('#f-grilla .check', el).forEach(c => {
      const marcada = c.querySelector('input').checked;
      c.hidden = filtrar && as.length > 0 && !as.includes(c.dataset.act) && !marcada;
    });
    $$('#f-grilla .fila-dia', el).forEach(f => { f.hidden = !$$('.check', f).some(c => !c.hidden); });
    $$('[data-cuenta]', el).forEach(s => {
      const n = $$(`input[name=clase][data-sede="${s.dataset.cuenta}"]:checked`, el).length;
      s.textContent = n ? `· ${n} marcada${n > 1 ? 's' : ''}` : '';
    });
  };
  el.addEventListener('change', actualizar);
  $('#f-sincel', el)?.addEventListener('change', e => { $('#f-pin-fila', el).hidden = !e.target.checked; });
  $('#f-turnos', el).addEventListener('click', e => {
    const b = e.target.closest('[data-quitar]'); if (!b) return;
    turnos.splice(+b.dataset.quitar, 1); pintarTurnos();
  });
  $('#t-agregar', el).onclick = () => {
    const dias = $$('#t-dias input:checked', el).map(i => +i.value);
    const desde = $('#t-desde', el).value, hasta = $('#t-hasta', el).value, rol = $('#t-rol', el).value;
    if (!dias.length || !desde || !hasta || !rol) return toast('Elegí días, horario y rol', true);
    if (min(hasta) <= min(desde)) return toast('La hora de salida tiene que ser después de la de entrada', true);
    const fuera = [];
    for (const dia of dias) {
      const t = { dia, desde, hasta, rol };
      if (!dentroHorarioClub(t)) { fuera.push(DIAS_CORTOS[dia]); continue; }
      if (!turnos.some(x => x.dia === dia && x.desde === desde && x.hasta === hasta && x.rol === rol)) turnos.push(t);
    }
    if (fuera.length) toast(`No se cargó ${fuera.join(', ')}: queda fuera del horario del club (sábados ${HORARIO_CLUB[6].join('–')})`, true);
    pintarTurnos();
  };
  pintarTurnos(); actualizar();

  return {
    leer() {
      const d = {
        nombre: $('#f-nombre', el).value.trim(),
        apellido: $('#f-apellido', el).value.trim(),
        telefono: $('#f-telefono', el).value.trim(),
        email: $('#f-email', el).value.trim().toLowerCase(),
        roles: roles(),
      };
      d.actividades = d.roles.includes('clases') ? acts() : [];
      d.clases = d.roles.includes('clases') ? $$('input[name=clase]:checked', el).map(i => i.value) : [];
      d.horarios = turnos.filter(t => d.roles.includes(t.rol));
      d.dni = $('#f-dni', el).value.replace(/\D/g, '');
      d.direccion = $('#f-dir', el).value.trim();
      d.emergenciaNombre = $('#f-emn', el).value.trim();
      d.emergenciaTel = $('#f-emt', el).value.trim();
      d.disponible = $$('input[name=disp]:checked', el).map(i => i.value);
      const est = $('#f-estado', el); if (est) d.estado = est.value;
      if ($('#f-papel', el)?.checked) d.consentimiento = { aceptado: true, papel: true, nombre: `${d.nombre} ${d.apellido}`, dni: d.dni, fecha: Date.now(), version: 'papel' };
      const sc = $('#f-sincel', el);
      if (sc) {
        d.sinCelular = sc.checked;
        if (sc.checked) {
          d.pin = $('#f-pin', el).value.trim();
          if (!/^\d{4}$/.test(d.pin)) { toast('El PIN tiene que ser de 4 números', true); return null; }
        } else d.pin = '';
        if (!d.email && sc.checked) d.email = (p.email && sinCorreo(p)) ? p.email : `${slug(d.nombre + '.' + d.apellido).replace(/-/g, '.')}${SIN_CORREO}`;
      }
      const faltan = [];
      if (!d.nombre) faltan.push('nombre');
      if (!d.apellido) faltan.push('apellido');
      if (!d.telefono) faltan.push('teléfono');
      if (!sinCorreo(d) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) faltan.push('correo (o marcá Ficha sin celular)');
      if (!d.roles.length) faltan.push('rol');
      if (faltan.length) { toast('Falta completar: ' + faltan.join(', '), true); return null; }
      if (d.roles.includes('clases') && !d.actividades.length) { toast('Marcá al menos una actividad que sabés dar', true); return null; }
      return d;
    },
  };
}
