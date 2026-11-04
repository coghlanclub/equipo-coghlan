/**
 * Coghlan Club · Envío automático de correos y asistente con IA
 *
 * 1) Correos: los pedidos de vacaciones y ausencias le llegan a gerencia solos,
 *    sin que el profe tenga que tocar "Enviar" en su app de correo.
 *    Los correos salen desde el Gmail con el que crees este script.
 * 2) Asistente: el panel "Preguntale al asistente" de Gerencia le pregunta a Claude por acá,
 *    así la clave de Claude queda guardada en este script y nunca en la app (que es pública).
 *
 * Cómo instalarlo (5 minutos, una sola vez):
 * 1. Entrá a https://script.google.com con el Gmail de gerencia → "Nuevo proyecto".
 * 2. Borrá lo que aparece y pegá todo este archivo.
 * 3. Cambiá CLAVE por una palabra secreta (ej. coghlan-2026-xk8).
 * 4. Para el asistente: pegá tu clave de Claude (console.anthropic.com → API keys) en CLAUDE_KEY.
 * 5. Arriba a la derecha: Implementar → Nueva implementación → tipo "Aplicación web".
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 *    Tocá Implementar y aceptá los permisos (enviar correos y conectarse a un servicio externo).
 * 6. Copiá la "URL de la aplicación web" (termina en /exec).
 * 7. En la app: Gerencia → Ajustes → Envío automático de correos → pegá la URL y la misma CLAVE → Guardar.
 *
 * Límite de Gmail: 100 destinatarios por día (alcanza de sobra para el club).
 */
const CLAVE = 'CAMBIAR_POR_UNA_CLAVE';
// Solo puede mandar a estos correos (el del gym). Si cambia el correo del gym, cambialo acá también.
const DESTINOS = ['gerencia@coghlanclub.com.ar'];
// Clave de Claude para el asistente. No la compartas con nadie.
const CLAUDE_KEY = 'PEGAR_CLAVE_DE_CLAUDE';
const MODELO = 'claude-opus-5-5';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return salida('clave incorrecta');
    if (d.tipo === 'asistente') return asistente(d);
    if (!d.para || !d.asunto || !d.cuerpo) return salida('faltan datos');
    if (DESTINOS.indexOf(String(d.para).toLowerCase()) < 0) return salida('destino no permitido');
    // En la bandeja aparece el nombre de quien pide (ej. "Martín Acosta vía Coghlan Club") y Responder le contesta a esa persona
    const opciones = { name: d.nombre ? d.nombre + ' vía Coghlan Club' : 'Coghlan Club' };
    if (d.responderA) opciones.replyTo = d.responderA;
    // MailApp solo pide permiso para ENVIAR correos (no puede leer ni borrar los de la cuenta)
    MailApp.sendEmail(d.para, d.asunto, d.cuerpo, opciones);
    return salida('ok');
  } catch (err) {
    return salida('error: ' + err);
  }
}

// Le pasa la pregunta (con los datos del club que arma la app) a Claude y devuelve la respuesta.
// Si un control de seguridad frena la consulta, "fallbacks" la reintenta sola con otro modelo.
function asistente(d) {
  if (!CLAUDE_KEY || CLAUDE_KEY.indexOf('PEGAR') === 0) return json({ error: 'Falta pegar la clave de Claude en el script.' });
  const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify({
      model: MODELO, max_tokens: 8000, system: d.system, messages: d.mensajes,
      output_config: { effort: 'low', format: d.formato }, fallbacks: 'default',
    }),
  });
  return json({ status: r.getResponseCode(), cuerpo: JSON.parse(r.getContentText()) });
}

function salida(t) { return ContentService.createTextOutput(t); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Ejecutalo una vez desde el editor para aceptar los permisos (enviar correos y conectarse a Claude).
function autorizar() { MailApp.getRemainingDailyQuota(); UrlFetchApp.getRequest('https://api.anthropic.com/v1/messages'); }
