// Lógica pura (sin base de datos): grilla, fechas, agendas, reemplazos, fichajes y textos de correo.

export const ROLES = {
  musculacion: 'Profesor de sala de musculación',
  clases: 'Profesor de clases',
  recepcion: 'Recepción',
  limpieza: 'Personal de limpieza',
};
export const ROL_CORTO = { musculacion: 'Sala', clases: 'Clases', recepcion: 'Recepción', limpieza: 'Limpieza' };
export const ROLES_TURNO = ['musculacion', 'recepcion', 'limpieza']; // los de clases salen de la grilla
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DIAS_LABORABLES = [1, 2, 3, 4, 5, 6];
export const HORARIO_CLUB = {
  1: ['07:00', '22:00'], 2: ['07:00', '22:00'], 3: ['07:00', '22:00'],
  4: ['07:00', '22:00'], 5: ['07:00', '22:00'], 6: ['09:00', '19:00'],
};
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const ESTADOS = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada' };
export const SEDES = ['Sede', 'Anexo', 'Aranceladas'];
export const DURACION_CLASE = 60; // minutos por defecto
export const TOLERANCIA_TARDE = 10; // minutos

// ---------- Grilla oficial (agenda de clases presenciales) ----------
// [sede, hora, actividad, días]  (1 = lunes ... 6 = sábado)
const G = [
  ['Sede', '08:00', 'Local', [1, 2, 3, 4, 5]],
  ['Sede', '09:00', 'Full Body', [2, 4]],
  ['Sede', '09:30', 'Step Local', [6]],
  ['Sede', '10:00', 'Super Training', [1, 3, 5]],
  ['Sede', '11:00', 'Zumba', [6]],
  ['Sede', '14:30', 'Stretching', [1]],
  ['Sede', '14:30', 'Full Body', [2, 4]],
  ['Sede', '14:30', 'Hatha Yoga', [3, 5]],
  ['Sede', '18:00', 'Local', [1, 3, 5]],
  ['Sede', '18:00', 'Zumba', [2, 4]],
  ['Sede', '19:00', 'Stretching', [1, 3, 5]],
  ['Sede', '19:00', 'Local', [2, 4]],
  ['Sede', '20:00', 'Local', [2, 4]],

  ['Anexo', '07:00', 'Fuerza en Movimiento', [2, 4]],
  ['Anexo', '08:00', 'Funcional', [1, 3, 5]],
  ['Anexo', '08:00', 'Fuerza en Movimiento', [2, 4]],
  ['Anexo', '08:00', 'Indoor Cycle', [1, 3, 5]],
  ['Anexo', '09:00', 'Funcional', [1, 2, 3, 4, 5]],
  ['Anexo', '09:30', 'Yoga Integral', [5]],
  ['Anexo', '10:00', 'Power Funcional', [1, 3, 5]],
  ['Anexo', '10:00', 'Funcional', [2, 4]],
  ['Anexo', '10:00', 'Fuerza en Movimiento', [6]],
  ['Anexo', '10:30', 'Yoga Dinámico', [1]],
  ['Anexo', '10:30', 'Yoga Integral', [3, 5]],
  ['Anexo', '11:00', 'Funcional', [1, 2, 3, 4, 5]],
  ['Anexo', '11:00', 'Indoor Cycle', [6]],
  ['Anexo', '12:00', 'Fuerza en Movimiento', [1, 2, 3, 4, 5]],
  ['Anexo', '12:00', 'Indoor Cycle', [6]],
  ['Anexo', '13:00', 'Funcional', [1, 2, 3, 4, 5]],
  ['Anexo', '17:00', 'Funcional', [1, 3, 5]],
  ['Anexo', '17:00', 'Yoga Dinámico', [2, 4]],
  ['Anexo', '18:00', 'Funcional', [1, 2, 3, 4]],
  ['Anexo', '18:00', 'Boxeo', [5]],
  ['Anexo', '18:30', 'Indoor Cycle', [1, 2, 3, 4, 5]],
  ['Anexo', '19:00', 'Bootcamp Funcional', [1, 3, 5]],
  ['Anexo', '19:30', 'Indoor Cycle', [1, 3]],
  ['Anexo', '20:00', 'Bootcamp Funcional', [1, 3, 5]],
  ['Anexo', '20:00', 'Boxeo', [2, 4]],

  ['Aranceladas', '08:30', 'Gimnasia Rítmica y Expresiva', [1, 3, 5]],
  ['Aranceladas', '08:45', 'Jiu-Jitsu', [2, 4]],
  ['Aranceladas', '10:00', 'Gimnasia Rítmica y Expresiva', [1, 3, 5]],
  ['Aranceladas', '18:00', 'Taekwondo Infantil', [1, 3, 5]],
  ['Aranceladas', '19:00', 'Taekwondo Infantil', [1, 3, 5]],
  ['Aranceladas', '20:00', 'Taekwondo', [1, 3, 5]],
  ['Aranceladas', '20:00', 'Karate', [2, 4]],
];

export function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
export function idClase(c) { return `${slug(c.sede)}-${c.dia}-${c.desde.replace(':', '')}-${slug(c.actividad)}`; }

export const GRILLA_BASE = G.flatMap(([sede, desde, actividad, dias]) =>
  dias.map(dia => {
    const c = { sede, dia, desde, hasta: sumarMin(desde, DURACION_CLASE), actividad, profesor: '' };
    return { id: idClase(c), ...c };
  }));
export const ACTIVIDADES_BASE = [...new Set(G.map(g => g[2]))].sort((a, b) => a.localeCompare(b));

// ---------- Utilidades ----------
export function pad(n) { return String(n).padStart(2, '0'); }
export function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function deIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function hoy() { return iso(new Date()); }
export function mesDe(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function sumarDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function rangoFechas(desde, hasta) {
  const out = []; const d = deIso(desde); const h = deIso(hasta);
  while (d <= h) { out.push(iso(d)); d.setDate(d.getDate() + 1); }
  return out;
}
export function diasEntre(desde, hasta) { return rangoFechas(desde, hasta).length; }
export function min(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
export function hhmm(m) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
export function sumarMin(t, n) { return hhmm(min(t) + n); }
export function seSolapan(a1, a2, b1, b2) { return min(a1) < min(b2) && min(b1) < min(a2); }
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fechaCorta(s) { if (!s) return '__/__/____'; const d = deIso(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
export function fechaLarga(s) { const d = deIso(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; }
export function rangoTexto(desde, hasta) { return desde === hasta ? fechaCorta(desde) : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`; }
export function ms(ts) { if (ts == null) return Date.now(); if (ts.toMillis) return ts.toMillis(); if (ts instanceof Date) return ts.getTime(); return +ts; }
export function horaDe(ts) { const d = new Date(ms(ts)); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function minutosDelDia(ts) { const d = new Date(ms(ts)); return d.getHours() * 60 + d.getMinutes(); }
export function fmtMin(m) { return `${Math.floor(m / 60)}h ${pad(Math.round(m % 60))}m`; }
export function nombreCompleto(p) { return `${p?.nombre || ''} ${p?.apellido || ''}`.trim() || p?.email || ''; }
export function iniciales(p) { return (((p?.nombre || '?')[0] || '') + ((p?.apellido || '')[0] || '')).toUpperCase(); }
export function tokenAleatorio() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return Array.from(a, b => (b % 36).toString(36)).join('');
}
export function dentroHorarioClub(s) {
  const h = HORARIO_CLUB[s.dia];
  return !!h && min(s.desde) >= min(h[0]) && min(s.hasta) <= min(h[1]) && min(s.desde) < min(s.hasta);
}
export const activo = p => p && (p.estado || 'activo') === 'activo';

// ---------- Agenda de cada persona ----------
// Une los turnos fijos (sala, recepción, limpieza) con las clases asignadas de la grilla.
export function agenda(p, clases = []) {
  if (!p) return [];
  const turnos = (p.horarios || []).map(s => ({ ...s, tipo: 'turno' }));
  const cls = clases.filter(c => c.profesor && c.profesor === p.email).map(c => ({
    dia: c.dia, desde: c.desde, hasta: c.hasta, rol: 'clases', actividad: c.actividad, sede: c.sede, claseId: c.id, tipo: 'clase',
  }));
  return [...turnos, ...cls].sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde));
}
export function horasSemanales(p, clases) { return agenda(p, clases).reduce((t, s) => t + (min(s.hasta) - min(s.desde)), 0) / 60; }

export function ausenteEn(email, fecha, ausencias) {
  return ausencias.some(a => a.email === email && a.estado === 'aprobada' && a.desde <= fecha && a.hasta >= fecha);
}

// Turnos y clases que deja descubiertos una ausencia. Siempre se busca reemplazo:
// - cuentan sus clases y turnos, y las clases que declaró en el censo que todavía no tienen profe;
// - si no tiene nada cargado, se pide un reemplazo por cada día que abre el club (horario a confirmar).
export function necesidades(aus, titular, clases) {
  if (!titular) return [];
  const declaradas = clases.filter(c => !c.profesor && (titular.clasesDeclaradas || []).includes(c.id))
    .map(c => ({ dia: c.dia, desde: c.desde, hasta: c.hasta, rol: 'clases', actividad: c.actividad, sede: c.sede, claseId: c.id }));
  const ag = [...agenda(titular, clases), ...declaradas];
  const out = [];
  for (const f of rangoFechas(aus.desde, aus.hasta)) {
    const dia = deIso(f).getDay();
    const base = { fecha: f, dia, titular: titular.email, ausenciaId: aus.id };
    for (const s of ag) if (s.dia === dia) {
      out.push({ ...base, desde: s.desde, hasta: s.hasta, rol: s.rol, actividad: s.actividad || '', sede: s.sede || '', claseId: s.claseId || '' });
    }
    if (!ag.length && HORARIO_CLUB[dia]) {
      out.push({ ...base, desde: HORARIO_CLUB[dia][0], hasta: HORARIO_CLUB[dia][1], rol: (titular.roles || [])[0] || 'clases', actividad: '', sede: '', claseId: '', generico: true });
    }
  }
  return out;
}

// Resumen de qué tipo de reemplazo hace falta: { 'Profesor de clases': {Funcional: 3}, 'Recepción': {turnos: 2} }
export function tipoReemplazo(necs) {
  const out = {};
  for (const n of necs) {
    const k = ROLES[n.rol];
    out[k] = out[k] || {};
    const sub = n.rol === 'clases' ? n.actividad : 'turnos';
    out[k][sub] = (out[k][sub] || 0) + 1;
  }
  return out;
}

export function cubierto(n, reemplazos) {
  return reemplazos.find(r => r.titular === n.titular && r.fecha === n.fecha && r.desde === n.desde && r.hasta === n.hasta && (r.actividad || '') === (n.actividad || ''));
}

// Quién puede cubrir: mismo rol (y misma actividad si es clase), presente ese día y libre en ese horario.
export function candidatos(n, personal, ausencias, reemplazos, clases) {
  return personal
    .filter(p => activo(p) && p.email !== n.titular)
    .filter(p => (p.roles || []).includes(n.rol))
    .filter(p => n.rol !== 'clases' || !n.actividad || (p.actividades || []).includes(n.actividad))
    .filter(p => !ausenteEn(p.email, n.fecha, ausencias))
    // Si el horario es "a confirmar" (no tenía nada cargado) no se descarta a nadie por horario
    .filter(p => n.generico || !agenda(p, clases).some(s => s.dia === n.dia && seSolapan(s.desde, s.hasta, n.desde, n.hasta)))
    .filter(p => n.generico || !reemplazos.some(r => r.reemplazo === p.email && r.fecha === n.fecha && seSolapan(r.desde, r.hasta, n.desde, n.hasta)))
    .map(p => ({ p, disponible: (p.disponible || []).includes(franjaDe(n.dia, n.desde)), carga: reemplazos.filter(r => r.reemplazo === p.email && r.fecha.slice(0, 7) === n.fecha.slice(0, 7)).length }))
    .sort((a, b) => (b.disponible - a.disponible) || a.carga - b.carga || nombreCompleto(a.p).localeCompare(nombreCompleto(b.p)));
}

// Franjas del horario del club sin nadie cubriendo un rol (sala, recepción).
export function huecos(dia, slots) {
  const h = HORARIO_CLUB[dia]; if (!h) return [];
  const [a, b] = h.map(min);
  const iv = slots.map(s => [min(s.desde), min(s.hasta)]).sort((x, y) => x[0] - y[0]);
  let cur = a; const out = [];
  for (const [s, e] of iv) { if (s > cur) out.push([cur, Math.min(s, b)]); cur = Math.max(cur, e); if (cur >= b) break; }
  if (cur < b) out.push([cur, b]);
  return out.filter(([s, e]) => e > s).map(([s, e]) => [hhmm(s), hhmm(e)]);
}

// Conflictos de la grilla: misma persona en dos lugares a la vez.
export function conflictos(p, clases) {
  const ag = agenda(p, clases); const out = [];
  for (let i = 0; i < ag.length; i++) for (let j = i + 1; j < ag.length; j++) {
    const a = ag[i], b = ag[j];
    if (a.dia === b.dia && seSolapan(a.desde, a.hasta, b.desde, b.hasta)) out.push([a, b]);
  }
  return out;
}

// ---------- Fichajes ----------
export function inicioPrevisto(slots, fecha) {
  const dia = deIso(fecha).getDay();
  const ss = (slots || []).filter(s => s.dia === dia).map(s => min(s.desde));
  return ss.length ? Math.min(...ss) : null;
}

// Arma jornadas (entrada + salida) por persona y día. agendas: { email: [slots] }
export function jornadas(fichajes, agendas = {}, nombres = {}) {
  const orden = [...fichajes].sort((a, b) => ms(a.ts) - ms(b.ts));
  const grupos = new Map();
  for (const f of orden) { const k = f.email + '|' + f.fecha; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(f); }
  const out = [];
  for (const [k, lista] of grupos) {
    const [email, fecha] = k.split('|');
    const prev = inicioPrevisto(agendas[email], fecha);
    let abierta = null, primera = true;
    const cerrar = (e, s) => {
      out.push({
        email, fecha, nombre: nombres[email] || (e || s).nombre || email,
        entrada: e || null, salida: s || null,
        minutos: e && s ? Math.max(0, Math.round((ms(s.ts) - ms(e.ts)) / 60000)) : null,
        previsto: primera ? prev : null,
        tardanza: primera && prev != null && e ? minutosDelDia(e.ts) - prev : null,
      });
      primera = false;
    };
    for (const f of lista) {
      if (f.tipo === 'entrada') { if (abierta) cerrar(abierta, null); abierta = f; }
      else { cerrar(abierta, f); abierta = null; }
    }
    if (abierta) cerrar(abierta, null);
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre));
}

export function resumenAsistencia(js) {
  const r = {};
  for (const j of js) {
    const x = r[j.email] = r[j.email] || { email: j.email, nombre: j.nombre, dias: new Set(), minutos: 0, tardes: 0, sinSalida: 0 };
    x.dias.add(j.fecha);
    x.minutos += j.minutos || 0;
    if (j.tardanza != null && j.tardanza > TOLERANCIA_TARDE) x.tardes++;
    if (j.entrada && !j.salida) x.sinSalida++;
  }
  return Object.values(r).map(x => ({ ...x, dias: x.dias.size })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ---------- Correos y mensajes ----------
export function mailto(para, cc, asunto, cuerpo) {
  const q = [];
  if (cc) q.push('cc=' + encodeURIComponent(cc));
  q.push('subject=' + encodeURIComponent(asunto));
  q.push('body=' + encodeURIComponent(cuerpo));
  return `mailto:${encodeURIComponent(para || '').replace(/%40/g, '@').replace(/%2C/g, ',')}?${q.join('&')}`;
}

export function mailSolicitud({ tipo, desde, hasta, motivo, persona }) {
  const nom = nombreCompleto(persona);
  const rol = (persona.roles || []).map(r => ROLES[r]).join(' / ');
  const firma = `\n\nSaludos,\n${nom}${rol ? '\n' + rol : ''}${persona.telefono ? '\nTel: ' + persona.telefono : ''}`;
  const n = desde && hasta && hasta >= desde ? diasEntre(desde, hasta) : null;
  if (tipo === 'vacaciones') {
    return {
      asunto: `Solicitud de vacaciones – ${nom}`,
      cuerpo: `Hola, gerencia de Coghlan Club:\n\nPor medio de la presente solicito formalmente mis vacaciones desde el ${fechaCorta(desde)} hasta el ${fechaCorta(hasta)} inclusive${n ? ` (${n} ${n === 1 ? 'día' : 'días'})` : ''}.\n\nQuedo a la espera de la confirmación.${firma}`,
    };
  }
  const cuando = desde && desde === hasta ? `el día ${fechaCorta(desde)}` : `desde el ${fechaCorta(desde)} hasta el ${fechaCorta(hasta)} inclusive`;
  return {
    asunto: `Aviso de ausencia – ${nom}`,
    cuerpo: `Hola, gerencia de Coghlan Club:\n\nPor medio de la presente informo formalmente que no voy a poder asistir ${cuando}.${motivo ? `\n\nMotivo: ${motivo}` : ''}\n\nQuedo a disposición para coordinar el reemplazo.${firma}`,
  };
}

export function mailRespuesta(aus, persona, aprobada, nota = '') {
  const que = aus.tipo === 'vacaciones' ? 'vacaciones' : 'ausencia';
  const nom = persona?.nombre || '';
  if (aprobada) {
    return {
      asunto: `${aus.tipo === 'vacaciones' ? 'Vacaciones aprobadas' : 'Ausencia confirmada'} – ${rangoTexto(aus.desde, aus.hasta)}`,
      cuerpo: `Hola ${nom}:\n\nTe confirmamos que tu solicitud de ${que} del ${rangoTexto(aus.desde, aus.hasta)} quedó aprobada.${nota ? `\n\n${nota}` : ''}\n\nSaludos,\nGerencia Coghlan Club`,
    };
  }
  return {
    asunto: `Solicitud de ${que} – ${rangoTexto(aus.desde, aus.hasta)}`,
    cuerpo: `Hola ${nom}:\n\nNo podemos aprobar tu solicitud de ${que} del ${rangoTexto(aus.desde, aus.hasta)}.${nota ? `\n\nMotivo: ${nota}` : ''}\n\nCualquier cosa lo hablamos.\n\nSaludos,\nGerencia Coghlan Club`,
  };
}

export function waNumero(tel) {
  let n = (tel || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('54')) return n.startsWith('549') ? n : '549' + n.slice(2);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('15') && n.length === 10) n = '11' + n.slice(2);
  if (n.length === 12 && n.startsWith('11') && n.slice(2, 4) === '15') n = '11' + n.slice(4);
  return '549' + n;
}
export function waLink(tel, texto) { return `https://wa.me/${waNumero(tel)}?text=${encodeURIComponent(texto)}`; }
export function queCubre(n) { return n.rol === 'clases' && n.actividad ? `${n.actividad}${n.sede ? ' (' + n.sede + ')' : ''}` : ROLES[n.rol]; }
export function textoReemplazo(n, p) {
  return `Hola ${p.nombre}, ¿podés cubrir ${queCubre(n)} el ${fechaLarga(n.fecha)} de ${n.desde} a ${n.hasta} en Coghlan Club? Avisame. ¡Gracias!`;
}

// ---------- Dispositivo, personal sin celular y faltas ----------
export const SIN_CORREO = '@sin-correo';
export const sinCorreo = p => (p?.email || '').endsWith(SIN_CORREO);
export function modeloDispositivo(ua = '') {
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) { const m = ua.match(/Android[^;]*;\s*([^;)]+)/); return 'Android' + (m && !/^K$|wv/.test(m[1]) ? ' · ' + m[1].trim() : ''); }
  if (/mac/i.test(ua)) return 'Mac';
  if (/windows/i.test(ua)) return 'Windows';
  return 'Otro dispositivo';
}
export function pinAleatorio() { const a = new Uint16Array(1); crypto.getRandomValues(a); return String(1000 + (a[0] % 9000)); }

// Días con turno sin fichaje ni ausencia aprobada (hasta ayer)
export function faltasSinAviso(personal, clases, fichajes, ausencias, desde, hasta) {
  const out = [];
  const conEntrada = new Set(fichajes.filter(f => f.tipo === 'entrada').map(f => f.email + '|' + f.fecha));
  for (const f of rangoFechas(desde, hasta)) {
    const dia = deIso(f).getDay();
    for (const p of personal) {
      if (!activo(p)) continue;
      if (p.creado && ms(p.creado) > deIso(f).getTime() + 86400000) continue;
      const ag = agenda(p, clases).filter(s => s.dia === dia);
      if (!ag.length || conEntrada.has(p.email + '|' + f) || ausenteEn(p.email, f, ausencias)) continue;
      out.push({ email: p.email, nombre: nombreCompleto(p), fecha: f, turnos: ag });
    }
  }
  return out;
}

// Disponibilidad para cubrir reemplazos: día + franja (m = mañana 7–12, t = tarde 12–17, n = noche 17–22)
export const FRANJAS = { m: 'Mañana', t: 'Tarde', n: 'Noche' };
export const FRANJAS_HORA = { m: '07–12', t: '12–17', n: '17–22' };
export function franjaDe(dia, desde) { const h = min(desde); return `${dia}-${h < 720 ? 'm' : h < 1020 ? 't' : 'n'}`; }
export const normTel = t => waNumero(t).slice(-8);
