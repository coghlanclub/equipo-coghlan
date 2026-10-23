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
 *    Tocá Implementar y aceptá los permisos de Gmail.
 * 5. Copiá la "URL de la aplicación web" (termina en /exec).
 * 6. En la app: Gerencia → Ajustes → Envío automático de correos → pegá la URL y la misma CLAVE → Guardar.
 *
 * Límite de Gmail: 100 destinatarios por día (alcanza de sobra para el club).
 */
const CLAVE = 'CAMBIAR_POR_UNA_CLAVE';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return salida('clave incorrecta');
    if (!d.para || !d.asunto || !d.cuerpo) return salida('faltan datos');
    const opciones = { name: 'Coghlan Club' };
    if (d.cc) opciones.cc = d.cc;
    if (d.responderA) opciones.replyTo = d.responderA;
    GmailApp.sendEmail(d.para, d.asunto, d.cuerpo, opciones);
    return salida('ok');
  } catch (err) {
    return salida('error: ' + err);
  }
}

function salida(t) { return ContentService.createTextOutput(t); }
