// Envío de correos.
// Si en Gerencia → Ajustes está cargado el "envío automático" (Google Apps Script), el correo sale solo
// desde el Gmail de gerencia. Si no, se abre la app de correo del celular con el mensaje listo.
import { DEMO } from './datos.js';
import { mailto } from './logica.js';

export const envioAutomatico = config => !!(config && config.correoScriptUrl);

// Devuelve 'auto' (salió solo) o 'manual' (se abrió la app de correo)
export async function enviarCorreo(config, { para, cc = '', asunto, cuerpo, responderA = '' }) {
  if (envioAutomatico(config)) {
    if (DEMO) return 'auto';
    try {
      await fetch(config.correoScriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ clave: config.correoClave || '', para, cc, asunto, cuerpo, responderA }),
      });
      return 'auto';
    } catch (e) { console.error('Envío automático falló', e); }
  }
  location.href = mailto(para, cc, asunto, cuerpo);
  return 'manual';
}
