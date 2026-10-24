// Envío de correos.
// Si en Gerencia → Ajustes está cargado el "envío automático" (Google Apps Script), el correo sale solo
// desde el Gmail de gerencia. Si no, se abre la app de correo del celular con el mensaje listo.
import { DEMO } from './datos.js';
import { mailto } from './logica.js';
import { CORREO_GERENCIA, WHATSAPP_RECEPCION } from './config.js';

// A quién le llegan los pedidos: lo de Gerencia → Ajustes, o lo predeterminado de config.js
export const destinos = (config = {}) => ({
  correo: config.correoGerencia || CORREO_GERENCIA,
  cc: config.correoCC || '',
  waGerencia: config.whatsappGerencia || '',
  waRecepcion: config.whatsappRecepcion || WHATSAPP_RECEPCION,
});

// La URL y la clave del script se cargan en Gerencia → Ajustes (no van en el código, que es público)
const scriptUrl = config => config?.correoScriptUrl || '';
export const envioAutomatico = config => !!scriptUrl(config);
// El script solo manda al correo del gym; a cualquier otro destino se abre la app de correo
const automaticoA = (config, para) => envioAutomatico(config) && String(para).toLowerCase() === destinos(config).correo.toLowerCase();

// Devuelve 'auto' (salió solo) o 'manual' (se abrió la app de correo)
export async function enviarCorreo(config, { para, cc = '', asunto, cuerpo, responderA = '', nombre = '' }) {
  if (automaticoA(config, para)) {
    if (DEMO) return 'auto';
    try {
      await fetch(scriptUrl(config), {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ clave: config.correoClave || '', para, asunto, cuerpo, responderA, nombre }),
      });
      return 'auto';
    } catch (e) { console.error('Envío automático falló', e); }
  }
  location.href = mailto(para, cc, asunto, cuerpo);
  return 'manual';
}
