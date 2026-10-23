// Datos de ejemplo para el modo demo (personas ficticias).
import { GRILLA_BASE, agenda, seSolapan, iso, sumarDias, rangoFechas, deIso, min, hhmm, mesDe, necesidades, candidatos, cubierto } from './logica.js';

const T = (dias, desde, hasta, rol) => dias.map(dia => ({ dia, desde, hasta, rol }));
const LV = [1, 2, 3, 4, 5];

const PERSONAS = [
  ['Lucía', 'Fernández', ['clases'], ['Funcional', 'Power Funcional', 'Bootcamp Funcional', 'Fuerza en Movimiento'], []],
  ['Martín', 'Acosta', ['clases', 'musculacion'], ['Indoor Cycle', 'Funcional', 'Bootcamp Funcional'], []],
  ['Valeria', 'Ríos', ['clases'], ['Hatha Yoga', 'Yoga Integral', 'Yoga Dinámico', 'Stretching'], []],
  ['Diego', 'Paredes', ['musculacion', 'clases'], ['Local', 'Full Body', 'Super Training'], [...T(LV, '07:00', '14:00', 'musculacion'), ...T([6], '09:00', '14:00', 'musculacion')]],
  ['Nicolás', 'Benítez', ['musculacion'], [], [...T(LV, '14:00', '22:00', 'musculacion'), ...T([6], '14:00', '19:00', 'musculacion')]],
  ['Florencia', 'Molina', ['clases'], ['Zumba', 'Step Local', 'Local', 'Stretching'], []],
  ['Tomás', 'Quiroga', ['clases', 'musculacion'], ['Boxeo', 'Fuerza en Movimiento', 'Super Training', 'Full Body'], []],
  ['Agustina', 'Sosa', ['recepcion'], [], [...T(LV, '07:00', '14:30', 'recepcion'), ...T([6], '09:00', '14:00', 'recepcion')]],
  ['Julián', 'Ortiz', ['recepcion'], [], [...T(LV, '14:30', '22:00', 'recepcion'), ...T([6], '14:00', '19:00', 'recepcion')]],
  ['Rosa', 'Medina', ['limpieza'], [], [...T(LV, '07:00', '11:00', 'limpieza'), ...T([6], '09:00', '12:00', 'limpieza')]],
  ['Ramón', 'Villalba', ['limpieza', 'recepcion'], [], [...T(LV, '17:00', '22:00', 'limpieza')]],
  ['Hernán', 'Castro', ['clases'], ['Taekwondo', 'Taekwondo Infantil', 'Karate', 'Jiu-Jitsu'], []],
  ['Mariana', 'López', ['clases'], ['Gimnasia Rítmica y Expresiva', 'Zumba', 'Yoga Dinámico', 'Hatha Yoga'], []],
  ['Pablo', 'Romero', ['clases', 'musculacion'], ['Funcional', 'Indoor Cycle', 'Fuerza en Movimiento', 'Power Funcional', 'Boxeo'], []],
];

function rnd(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

export function datosDemo() {
  const r = rnd(7);
  const quitarTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const personal = PERSONAS.map(([nombre, apellido, roles, actividades, horarios], i) => ({
    email: `${quitarTildes(nombre)}.${quitarTildes(apellido)}@demo.com`,
    nombre, apellido, roles, actividades, horarios,
    telefono: `11 5${String(100 + i * 37).padStart(3, '0')}-${String(1000 + i * 611).slice(0, 4)}`,
    estado: 'activo', clasesDeclaradas: [], creado: Date.now() - 86400000 * 60,
  }));

  // Una persona con la cuenta en otro celular (para mostrar el bloqueo)
  Object.assign(personal.find(p => p.nombre === 'Florencia'), { dispositivo: 'otro-celular', dispositivoModelo: 'Android · Moto G32', dispositivoDesde: Date.now() - 86400000 * 40 });
  // Personal sin celular: ficha con PIN en la tablet
  Object.assign(personal.find(p => p.nombre === 'Rosa'), { email: 'rosa.medina@sin-correo', sinCelular: true, pin: '4821' });
  Object.assign(personal.find(p => p.nombre === 'Ramón'), { email: 'ramon.villalba@sin-correo', sinCelular: true, pin: '7305' });

  // Datos personales y disponibilidad de ejemplo
  const disp = { Lucía: ['1-t', '2-t', '4-t', '6-m'], Pablo: ['2-m', '4-m', '1-n', '3-n'], Tomás: ['1-t', '3-t', '5-t'], Mariana: ['2-m', '4-m', '6-m'] };
  personal.forEach((p, i) => Object.assign(p, {
    dni: String(28000000 + i * 1234567).slice(0, 8), nacimiento: `19${80 + (i % 18)}-0${1 + (i % 9)}-1${i % 9}`,
    emergenciaNombre: ['Ana (hermana)', 'Jorge (padre)', 'Laura (pareja)'][i % 3], emergenciaTel: `11 4${String(100 + i * 53).slice(0, 3)}-${String(2000 + i * 377).slice(0, 4)}`,
    direccion: ['Av. Monroe 3400, Coghlan', 'Pedro I. Rivera 4100, Villa Urquiza', 'Washington 2300, Belgrano R', 'Av. Congreso 3900, Coghlan'][i % 4],
    consentimiento: p.nombre === 'Florencia' ? null : { aceptado: true, papel: !!p.sinCelular, nombre: `${p.nombre} ${p.apellido}`, dni: String(28000000 + i * 1234567).slice(0, 8), fecha: Date.now() - 86400000 * 50, version: p.sinCelular ? 'papel' : '1 · octubre 2026' },
    disponible: disp[p.nombre] || [],
  }));

  // Ficha nueva esperando aprobación (así se ve el censo)
  personal.push({
    email: 'sofia.navarro@demo.com', nombre: 'Sofía', apellido: 'Navarro', telefono: '11 6234-5512',
    roles: ['clases'], actividades: ['Funcional', 'Indoor Cycle', 'Yoga Integral'], horarios: [],
    clasesDeclaradas: ['anexo-6-1100-indoor-cycle', 'anexo-6-1200-indoor-cycle'],
    emergenciaNombre: 'Pablo (hermano)', emergenciaTel: '11 6888-1200', direccion: 'Melián 2800, Coghlan', dni: '38123456',
    consentimiento: { aceptado: true, nombre: 'Sofía Navarro', dni: '38123456', fecha: Date.now() - 3600000 * 5, version: '1 · octubre 2026' },
    estado: 'pendiente', creado: Date.now() - 3600000 * 5,
  });

  // Asignar la grilla balanceando carga
  const clases = GRILLA_BASE.map(c => ({ ...c }));
  const carga = {};
  const activos = personal.filter(p => p.estado === 'activo');
  for (const c of [...clases].sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde))) {
    const cand = activos.filter(p => p.actividades.includes(c.actividad))
      .filter(p => !agenda(p, clases).some(s => s.dia === c.dia && seSolapan(s.desde, s.hasta, c.desde, c.hasta)))
      .sort((a, b) => (carga[a.email] || 0) - (carga[b.email] || 0));
    if (cand.length) { c.profesor = cand[0].email; carga[c.profesor] = (carga[c.profesor] || 0) + 1; }
  }
  // Dos clases sin profesor para mostrar el aviso
  clases.find(c => c.id === 'anexo-6-1100-indoor-cycle').profesor = '';
  clases.find(c => c.id === 'anexo-6-1200-indoor-cycle').profesor = '';
  personal.forEach(p => { p.clasesDeclaradas = p.estado === 'activo' ? clases.filter(c => c.profesor === p.email).map(c => c.id) : p.clasesDeclaradas; });

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = n => iso(sumarDias(hoy, n));
  const ausencias = {
    a1: { email: 'martin.acosta@demo.com', nombre: 'Martín Acosta', tipo: 'vacaciones', desde: f(4), hasta: f(10), motivo: '', estado: 'aprobada', creado: Date.now() - 86400000 * 10, respondida: Date.now() - 86400000 * 8 },
    a2: { email: 'valeria.rios@demo.com', nombre: 'Valeria Ríos', tipo: 'vacaciones', desde: f(18), hasta: f(25), motivo: '', estado: 'pendiente', creado: Date.now() - 86400000 },
    a3: { email: 'agustina.sosa@demo.com', nombre: 'Agustina Sosa', tipo: 'ausencia', desde: f(1), hasta: f(1), motivo: 'Trámite personal', estado: 'aprobada', creado: Date.now() - 86400000 * 2, respondida: Date.now() - 86400000 },
    a4: { email: 'tomas.quiroga@demo.com', nombre: 'Tomás Quiroga', tipo: 'ausencia', desde: f(2), hasta: f(3), motivo: 'Torneo de boxeo', estado: 'pendiente', creado: Date.now() - 3600000 * 3 },
  };

  // Reemplazos ya asignados (algunos quedan sin cubrir a propósito)
  const reemplazos = {};
  const lista = [];
  const ausArr = Object.entries(ausencias).map(([id, a]) => ({ id, ...a })).filter(a => a.estado === 'aprobada');
  let k = 0;
  for (const a of ausArr) {
    const tit = personal.find(p => p.email === a.email);
    necesidades(a, tit, clases).forEach((n, i) => {
      if (a.id === 'a1' && i % 4 === 3) return; // dejar huecos para mostrar
      const c = candidatos(n, personal, ausArr, lista, clases)[0];
      if (!c) return;
      const r = { ...n, titularNombre: `${tit.nombre} ${tit.apellido}`, reemplazo: c.p.email, reemplazoNombre: `${c.p.nombre} ${c.p.apellido}`, creado: Date.now() };
      lista.push(r); reemplazos['r' + k++] = r;
    });
  }

  // Fichajes del mes en curso hasta ayer
  const fichajes = {};
  let n = 0;
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  for (let d = new Date(desde); d < hoy; d.setDate(d.getDate() + 1)) {
    const fecha = iso(d); const dia = d.getDay();
    for (const p of activos) {
      const s = agenda(p, clases).filter(x => x.dia === dia);
      if (!s.length || r() < 0.04) continue;
      const ini = Math.min(...s.map(x => min(x.desde))); const fin = Math.max(...s.map(x => min(x.hasta)));
      const ent = ini - 15 + Math.floor(r() * (r() < 0.12 ? 40 : 18));
      const sal = fin + Math.floor(r() * 12);
      const ts = m => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60).getTime();
      const base = { email: p.email, nombre: `${p.nombre} ${p.apellido}`, fecha, mes: mesDe(d), token: 'demo', dispositivo: 'demo' };
      fichajes['f' + n++] = { ...base, tipo: 'entrada', ts: ts(ent) };
      if (r() > 0.03) fichajes['f' + n++] = { ...base, tipo: 'salida', ts: ts(sal) };
    }
  }

  return {
    personal: Object.fromEntries(personal.map(p => [p.email, p])),
    clases: Object.fromEntries(clases.map(c => [c.id, c])),
    ausencias, reemplazos, fichajes,
    config: { general: { correoGerencia: 'gerencia@coghlanclub.demo', correoCC: '', whatsappGerencia: '11 0000-0000', correoScriptUrl: 'https://script.google.com/macros/s/demo/exec', correoClave: 'demo' } },
    admins: {},
    recepcion: { 'recepcion@coghlanclub.demo': { agregadoPor: 'gerencia@coghlanclub.demo' } },
    censo: Object.fromEntries([
      ...personal.map(p => ({ nombre: `${p.nombre} ${p.apellido}`, telefono: p.telefono, email: p.email, enviado: Date.now() - 86400000 * 6 })),
      { nombre: 'Gabriel Paz', telefono: '11 6012-3344', enviado: Date.now() - 86400000 * 3 },
      { nombre: 'Marta Díaz', telefono: '11 6123-9087', enviado: Date.now() - 86400000 * 2 },
      { nombre: 'Oscar Luna', telefono: '11 6234-1122' },
      { nombre: 'Elena Sosa', telefono: '11 6345-7788' },
    ].map((r, i) => ['c' + i, { ...r, creado: Date.now() - 86400000 * 7 }])),
    qr: {},
  };
}
export { hhmm };
