// Guardar la app en la pantalla de inicio: detecta el celular y el navegador y muestra los pasos con dibujos.
// En iPhone la app guardada no comparte datos con Safari, así que conviene guardarla ANTES de entrar.
import { $, modal, cabModal, copiar, toast } from './ui.js';

const ua = navigator.userAgent;
export const esIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAndroid = /android/i.test(ua);
export const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// iPhone abierto en el navegador (no desde el ícono): ahí no se vincula el celular ni se ficha
export const iosEnNavegador = () => esIOS && !instalada();
const navegador = () =>
  /CriOS/i.test(ua) ? 'chrome-ios' : /FxiOS|EdgiOS|OPiOS/i.test(ua) ? 'otro-ios' : esIOS ? 'safari'
    : /SamsungBrowser/i.test(ua) ? 'samsung' : esAndroid ? 'chrome' : 'pc';

// Instalación de un toque en Android (Chrome avisa que se puede instalar)
let pedidoInstalar = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedidoInstalar = e; document.querySelectorAll('[data-instalar-ya]').forEach(b => { b.hidden = false; }); });
addEventListener('appinstalled', () => { pedidoInstalar = null; toast('¡Listo! La app quedó en tu pantalla de inicio.'); });
async function instalarYa() {
  if (!pedidoInstalar) return abrirGuiaInstalar();
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice.catch(() => {});
  pedidoInstalar = null;
}

// Dibujos de los botones que hay que tocar
const ICONO = {
  compartir: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  agregar: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  hamburguesa: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};
const boton = (icono, texto) => `<span class="inst-boton">${ICONO[icono] || ''}${texto ? `<span>${texto}</span>` : ''}</span>`;
const paso = (n, html) => `<li class="inst-paso"><span class="inst-n">${n}</span><div>${html}</div></li>`;

const PASOS = {
  safari: () => [
    `Tocá el botón ${boton('compartir', 'Compartir')} abajo, en el centro de la pantalla. <span class="sub">(En iPad está arriba a la derecha.)</span>`,
    `Deslizá hacia arriba y tocá ${boton('agregar', 'Agregar a inicio')}. <span class="sub">Si no aparece, tocá "Más" o "Editar acciones" y activalo.</span>`,
    'Tocá <b>Agregar</b>, arriba a la derecha.',
    'Cerrá Safari y abrí la app desde el <b>ícono del logo de los 40 años</b>. Ahí entrá con Google.',
  ],
  'chrome-ios': () => [
    `Tocá ${boton('compartir', 'Compartir')} arriba a la derecha, en la barra de la dirección.`,
    `Tocá ${boton('agregar', 'Agregar a pantalla de inicio')}. <span class="sub">Si no aparece, copiá el link y abrilo en <b>Safari</b>.</span>`,
    'Tocá <b>Agregar</b>.',
    'Abrí la app desde el <b>ícono del logo de los 40 años</b> y entrá con Google.',
  ],
  'otro-ios': () => [
    'En iPhone la app se guarda desde <b>Safari</b>. Tocá <b>Copiar link</b> (abajo), abrí <b>Safari</b> y pegalo en la barra de arriba.',
    `Después tocá ${boton('compartir', 'Compartir')} y ${boton('agregar', 'Agregar a inicio')}.`,
    'Abrí la app desde el <b>ícono del logo de los 40 años</b>.',
  ],
  chrome: () => [
    `Tocá el menú ${boton('menu')} arriba a la derecha.`,
    'Tocá <b>Agregar a la pantalla principal</b> o <b>Instalar aplicación</b>.',
    'Tocá <b>Instalar</b> (o <b>Agregar</b>) para confirmar.',
    'Abrí la app desde el <b>ícono del logo de los 40 años</b> en tu pantalla de inicio.',
  ],
  samsung: () => [
    `Tocá el menú ${boton('hamburguesa')} abajo a la derecha.`,
    'Tocá <b>Agregar página a</b> y elegí <b>Pantalla de inicio</b>.',
    'Tocá <b>Agregar</b>.',
    'Abrí la app desde el <b>ícono del logo de los 40 años</b>.',
  ],
  pc: () => [
    'La app del profe se usa en el <b>celular</b>. Abrí este mismo link en tu celular (podés copiarlo con el botón de abajo y mandártelo por WhatsApp).',
    'En el celular, abrilo en <b>Chrome</b> (Android) o <b>Safari</b> (iPhone) y tocá <b>"? Cómo guardarla"</b>.',
  ],
};
const TITULO = { safari: 'iPhone (Safari)', 'chrome-ios': 'iPhone (Chrome)', 'otro-ios': 'iPhone', chrome: 'Android (Chrome)', samsung: 'Android (Samsung)', pc: 'Computadora' };

export function abrirGuiaInstalar() {
  const actual = navegador();
  const pestanas = [['safari', 'iPhone'], ['chrome', 'Android'], ['samsung', 'Samsung']];
  const m = modal(`${cabModal('Guardá la app en tu celular')}
    <p class="sub">Así queda como una app más, con el ícono de Coghlan Club, y la abrís con un toque.</p>
    <div class="inst-pestanas" role="tablist">${pestanas.map(([k, t]) => `<button class="check" role="tab" data-p="${k}">${t}</button>`).join('')}</div>
    <div id="inst-detalle"></div>
    <div class="modal-pie"><button class="btn ghost" id="inst-copiar">Copiar link</button><button class="btn" data-cerrar>Entendido</button></div>`);
  const pintar = k => {
    m.el.querySelectorAll('[data-p]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.p === k || (k === 'chrome-ios' || k === 'otro-ios') && b.dataset.p === 'safari')));
    $('#inst-detalle', m.el).innerHTML = `<p class="eyebrow" style="margin:6px 0 0">${TITULO[k]}${k === actual ? ' · tu celular' : ''}</p>
      ${k === 'chrome' && pedidoInstalar ? '<button class="btn grande bloque" data-instalar-ya>Instalar ahora</button>' : ''}
      ${['safari', 'chrome-ios', 'otro-ios'].includes(k) ? '<div class="aviso info"><div><b>Importante en iPhone</b><span>Guardala <b>antes</b> de entrar con Google y usá siempre el ícono. Si entrás por Safari, la app lo toma como otro celular.</span></div></div>' : ''}
      <ol class="inst-pasos">${PASOS[k]().map((h, i) => paso(i + 1, h)).join('')}</ol>`;
  };
  m.el.addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (b) pintar(b.dataset.p);
    if (e.target.closest('[data-instalar-ya]')) { m.cerrar(); instalarYa(); }
  });
  $('#inst-copiar', m.el).onclick = () => copiar(location.href.split('#')[0]);
  pintar(actual);
}

// Tarjeta que invita a guardar la app (no aparece si ya se abrió desde el ícono)
export function ayudaInstalar({ antesDeEntrar = false } = {}) {
  if (instalada()) return '';
  const k = navegador();
  if (k === 'pc' && !antesDeEntrar) return '';
  const titulo = esIOS && antesDeEntrar ? 'Primero guardá la app en tu iPhone' : 'Guardá la app en tu celular';
  const texto = k === 'pc' ? 'La app del profe se usa en el celular. Abrí este link en tu celular para guardarla.'
    : esIOS ? (antesDeEntrar ? 'En iPhone, guardala en la pantalla de inicio <b>antes</b> de entrar, y después abrila siempre desde el ícono. Así podés fichar.'
      : 'Para fichar, abrí la app desde el ícono de tu pantalla de inicio. Si todavía no la guardaste, te mostramos cómo.')
      : 'Queda con el ícono de Coghlan Club y la abrís con un toque, como cualquier app.';
  return `<div class="aviso info inst-tarjeta"><div><b>📲 ${titulo}</b><span>${texto}</span>
    <div class="acciones">
      ${esAndroid ? `<button class="btn" data-instalar-ya ${pedidoInstalar ? '' : 'hidden'}>Instalar ahora</button>` : ''}
      <button class="btn ${esAndroid && pedidoInstalar ? 'ghost' : ''}" data-guia-instalar>Ver cómo guardarla</button>
    </div></div></div>`;
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-guia-instalar]')) abrirGuiaInstalar();
  else if (e.target.closest('.inst-tarjeta [data-instalar-ya]')) instalarYa();
});
