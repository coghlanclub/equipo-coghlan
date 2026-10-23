// Guía paso a paso: oscurece la pantalla, resalta un botón y explica para qué sirve.
// Cada app registra sus pasos con registrarGuia() y pone botonGuia() en su barra.
// La primera vez que alguien entra, la guía arranca sola; después se abre con el botón "? Guía".

export const botonGuia = () => '<button class="btn sm ghost guia-btn" data-guia aria-label="Ver la guía de uso"><span aria-hidden="true">?</span> Guía</button>';

const vista = clave => { try { return localStorage.getItem('guia-' + clave) === 'vista'; } catch { return false; } };
const marcarVista = clave => { try { localStorage.setItem('guia-' + clave, 'vista'); } catch {} };

let abierta = null;

// pasos: función que devuelve [{ sel, titulo, texto, tip, antes, opcional }]
//   sel: selector del elemento a resaltar (sin sel, la tarjeta va centrada)
//   antes: se ejecuta antes de mostrar el paso (por ejemplo, cambiar de pestaña)
//   opcional: si el elemento no está en pantalla, el paso se saltea
// listo: selector que indica que la pantalla principal ya está dibujada (para arrancar sola)
export function registrarGuia({ clave, pasos, listo, alTerminar }) {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-guia]')) abrirGuia(pasos(), alTerminar);
  });
  if (vista(clave)) return;
  const intentar = () => {
    if (abierta || vista(clave) || !document.querySelector(listo)) return false;
    marcarVista(clave);
    setTimeout(() => abrirGuia(pasos(), alTerminar), 500);
    return true;
  };
  if (intentar()) return;
  const obs = new MutationObserver(() => { if (intentar()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
}

export function abrirGuia(todos, alTerminar) {
  if (abierta) abierta.cerrar();
  let i = 0, raf = 0, ultimoRect = '';
  const capa = document.createElement('div');
  capa.className = 'guia-capa';
  capa.innerHTML = `<div class="guia-foco" hidden></div>
    <div class="guia-card" role="dialog" aria-modal="true" aria-labelledby="guia-t">
      <div class="guia-paso"></div>
      <h3 id="guia-t"></h3>
      <div class="guia-texto"></div>
      <div class="guia-tip" hidden></div>
      <div class="guia-pie">
        <div class="guia-puntos" aria-hidden="true"></div>
        <div class="acciones">
          <button class="btn sm ghost" data-g="salir">Salir</button>
          <button class="btn sm ghost" data-g="atras">Anterior</button>
          <button class="btn sm" data-g="sig">Siguiente</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(capa);
  const foco = capa.querySelector('.guia-foco'), card = capa.querySelector('.guia-card');
  // Un paso opcional sin su elemento se saltea (si tiene "antes", recién se sabe al mostrarlo)
  const pasos = () => todos.filter(p => !p.opcional || !p.sel || p.antes || document.querySelector(p.sel));

  const ubicar = () => {
    const lista = pasos(); const p = lista[i];
    const el = p?.sel && document.querySelector(p.sel);
    const b = el?.getBoundingClientRect();
    // Si el elemento es más alto que la pantalla, se resalta solo la parte visible
    const r = b && { left: b.left, width: b.width, top: Math.max(b.top, 8), bottom: Math.min(b.bottom, innerHeight - 8) };
    if (r) r.height = Math.max(0, r.bottom - r.top);
    const clave = r ? [r.top, r.left, r.width, r.height, innerWidth, innerHeight].map(Math.round).join() : 'centro' + innerWidth;
    if (clave !== ultimoRect) {
      ultimoRect = clave;
      const m = 6, cw = card.offsetWidth, ch = card.offsetHeight, vw = innerWidth, vh = innerHeight;
      if (r && r.width) {
        foco.hidden = false;
        Object.assign(foco.style, { top: r.top - m + 'px', left: r.left - m + 'px', width: r.width + m * 2 + 'px', height: r.height + m * 2 + 'px' });
        let top, left = Math.min(Math.max(16, r.left + r.width / 2 - cw / 2), vw - cw - 16);
        if (vw < 600) { top = r.top + r.height / 2 < vh / 2 ? vh - ch - 16 : 16; left = (vw - cw) / 2; }
        else if (r.bottom + m + 12 + ch < vh) top = r.bottom + m + 12;
        else if (r.top - m - 12 - ch > 0) top = r.top - m - 12 - ch;
        else { top = vh - ch - 16; left = vw - cw - 16; }
        Object.assign(card.style, { top: top + 'px', left: left + 'px' });
      } else {
        foco.hidden = true;
        Object.assign(card.style, { top: Math.max(16, (vh - ch) / 2) + 'px', left: (vw - cw) / 2 + 'px' });
      }
    }
    raf = requestAnimationFrame(ubicar);
  };

  let turno = 0;
  const mostrar = async () => {
    const yo = ++turno;
    const lista = pasos(); const p = lista[i];
    if (!p) return cerrar(true);
    // "antes" puede redibujar la pantalla (cambiar de pestaña): se espera a que termine
    if (p.antes) { await p.antes(); await new Promise(r => setTimeout(r, 80)); }
    if (yo !== turno) return; // ya se pidió otro paso mientras tanto
    const el = p.sel && document.querySelector(p.sel);
    if (p.sel && !el && p.opcional) { todos.splice(todos.indexOf(p), 1); return mostrar(); }
    if (el) {
      const r = el.getBoundingClientRect();
      const alto = r.height > innerHeight * 0.6;
      // los elementos altos se muestran desde arriba, dejando lugar para la barra fija
      if (alto) scrollTo({ top: scrollY + r.top - 120, behavior: 'smooth' });
      else if (r.top < 70 || r.bottom > innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    const n = pasos().length;
    capa.querySelector('.guia-paso').textContent = `Paso ${i + 1} de ${n}`;
    capa.querySelector('#guia-t').textContent = p.titulo;
    capa.querySelector('.guia-texto').innerHTML = p.texto;
    const tip = capa.querySelector('.guia-tip');
    tip.hidden = !p.tip; tip.innerHTML = p.tip ? `<b>Tip</b> ${p.tip}` : '';
    capa.querySelector('.guia-puntos').innerHTML = Array.from({ length: n }, (_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('');
    capa.querySelector('[data-g="atras"]').hidden = i === 0;
    capa.querySelector('[data-g="sig"]').textContent = i === n - 1 ? 'Terminar' : 'Siguiente';
    ultimoRect = '';
    capa.querySelector('[data-g="sig"]').focus({ preventScroll: true });
  };

  const ir = d => { const n = pasos().length; i = Math.max(0, Math.min(n, i + d)); if (i >= n) return cerrar(true); mostrar(); };
  const tecla = e => {
    if (e.key === 'Escape') cerrar(false);
    else if (e.key === 'ArrowRight') ir(1);
    else if (e.key === 'ArrowLeft') ir(-1);
  };
  function cerrar(completa) {
    cancelAnimationFrame(raf);
    removeEventListener('keydown', tecla);
    capa.remove();
    abierta = null;
    alTerminar?.(completa);
  }
  capa.addEventListener('click', e => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    if (b.dataset.g === 'salir') cerrar(false);
    else ir(b.dataset.g === 'sig' ? 1 : -1);
  });
  addEventListener('keydown', tecla);
  abierta = { cerrar };
  mostrar();
  raf = requestAnimationFrame(ubicar);
}
