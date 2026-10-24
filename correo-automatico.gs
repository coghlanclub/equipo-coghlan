/**
 * Coghlan Club · Envío automático de correos
 *
 * Con esto los pedidos de vacaciones y ausencias le llegan a gerencia solos,
 * sin que el profe tenga que tocar "Enviar" en su app de correo.
 * Los correos salen desde el Gmail con el que crees este script.
 *
 * Cómo instalarlo (5 minutos, una sola vez):
 * 1. Entrá a https://script.google.com con el Gmail de gerencia → "Nuevo proyecto".
 * 2. Borrá lo que aparece y pegá todo este archivo.
 * 3. Cambiá CLAVE por una palabra secreta (ej. coghlan-2026-xk8).
 * 4. Arriba a la derecha: Implementar → Nueva implementación → tipo "Aplicación web".
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 *    Tocá Implementar y aceptá el permiso de enviar correos.
 * 5. Copiá la "URL de la aplicación web" (termina en /exec).
 * 6. En la app: Gerencia → Ajustes → Envío automático de correos → pegá la URL y la misma CLAVE → Guardar.
 *
 * Límite de Gmail: 100 destinatarios por día (alcanza de sobra para el club).
 */
const CLAVE = 'CAMBIAR_POR_UNA_CLAVE';
// Solo puede mandar a estos correos (el del gym). Si cambia el correo del gym, cambialo acá también.
const DESTINOS = ['correo-del-gym@gmail.com'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return salida('clave incorrecta');
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

function salida(t) { return ContentService.createTextOutput(t); }
