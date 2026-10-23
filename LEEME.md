# Equipo Coghlan · Coghlan Club

Tres apps separadas, cada una con su link y su ícono, conectadas a la misma base de datos:

| Archivo | Quién la usa | Qué hace |
|---|---|---|
| `profesor.html` (link `/` o `/profe`) | Profes, recepción, limpieza | Censo (ficha), horario semanal, fichar con QR, pedir vacaciones / avisar ausencia por correo, ver sus fichajes y reemplazos |
| `gerencia.html` (link `/gerencia`) | Gerencia | Aprobar fichas, grilla de clases, calendario de vacaciones, reemplazos automáticos, asistencia del mes |
| `tablet.html` (link `/qr`) | Tablet de recepción | QR que cambia cada 30 segundos + fichajes del día |

Mientras `js/config.js` diga `PEGAR_AQUI`, todo funciona en **modo demo** con datos de ejemplo guardados en el navegador.

## Puesta en marcha (una sola vez)

1. **Crear el proyecto Firebase**: https://console.firebase.google.com → *Agregar proyecto* → nombre `coghlan-personal` (sin Analytics).
2. **Login con Google**: *Authentication* → *Comenzar* → *Google* → Habilitar → elegir tu correo de asistencia → Guardar.
3. **Base de datos**: *Firestore Database* → *Crear base de datos* → ubicación `southamerica-east1 (São Paulo)` → modo producción.
4. **Reglas**: en Firestore → pestaña *Reglas*, pegar todo `firestore.rules`, cambiar `tu_correo@gmail.com` por tu correo de gerencia y *Publicar*.
5. **Configuración web**: ⚙ *Configuración del proyecto* → *Tus apps* → ícono `</>` → registrar la app → copiar el bloque `firebaseConfig` dentro de `FIREBASE_CONFIG` en `js/config.js`. En `ADMIN_EMAILS` poner el mismo correo del paso 4.
6. **Publicar**: subir la carpeta a un repo nuevo de GitHub e importarlo en Vercel (no necesita build: *Framework Preset → Other*).
7. **Dominio autorizado**: Firebase → *Authentication* → *Configuración* → *Dominios autorizados* → agregar el dominio de Vercel (ej. `coghlan-personal.vercel.app`).

## Correos automáticos (opcional, recomendado)

Sin configurar nada, al pedir vacaciones o avisar una ausencia se abre la app de correo del profe con el mensaje listo y él toca Enviar.
Para que el pedido le llegue solo a gerencia (y las respuestas al profe), instalá `correo-automatico.gs` (instrucciones adentro) y pegá la URL en Gerencia → Ajustes.

## Primer uso

1. Entrar a `/gerencia.html` con tu cuenta.
2. *Grilla de clases* → **Cargar grilla oficial** (Sede, Anexo y Clases aranceladas).
3. *Ajustes* → correo de gerencia (a donde llegan los pedidos de vacaciones y ausencias).
4. *Personal* → **Copiar link del censo** y mandarlo por WhatsApp a todo el personal.
5. A medida que completan la ficha, aparecen en *Personal → Fichas nuevas por aprobar*. **Aprobar y cargar clases** pasa sus clases a la grilla.
6. En la tablet de recepción abrir `/tablet.html`, entrar con la cuenta de gerencia y dejarla en pantalla completa enchufada.

## Guardar la app en el celular

- **Android**: abrir el link en Chrome → menú ⋮ → *Instalar app* o *Agregar a pantalla principal*.
- **iPhone**: abrir el link en Safari → *Compartir* → *Agregar a inicio*.

Para fichar, el profe abre la app → **Fichar** → apunta al QR de la tablet. También funciona escaneando el QR con la cámara del celular.

## Cómo detecta los reemplazos

Cuando aprobás una ausencia, el sistema cruza las fechas con la agenda de esa persona (turnos fijos + clases de la grilla) y arma la lista de lo que queda sin cubrir: qué rol, qué actividad, qué sede y qué horario. Para cada hueco propone a quien:

- tiene el mismo rol (y da esa actividad, si es una clase),
- no está de vacaciones o ausente ese día,
- no tiene otro turno o clase en ese horario,
- y tiene menos reemplazos en el mes (reparte la carga).

## Un celular por persona

El primer celular desde el que entra cada profe queda vinculado. Si entra desde otro, ve "Tu cuenta ya está en otro celular" y puede pedir el cambio; gerencia lo habilita en Personal o desde su ficha.

## Personal sin celular

En Gerencia → Personal → Cargar persona, marcá "Ficha sin celular". Se le asigna un PIN de 4 números (no necesita correo). En la tablet toca "Fichar sin celular", elige su nombre y pone el PIN. Las vacaciones y ausencias de esas personas las carga gerencia.

## Seguridad

- Cada profe solo ve su ficha, sus pedidos, sus fichajes y sus reemplazos.
- El fichaje se rechaza si el QR venció (dura unos 70 segundos) y la hora la pone el servidor, no el celular.
- Solo gerencia ve el código vigente del QR, los calendarios y la asistencia de todos.

## Archivos

```
profesor.html         app del profe          → js/profesor.js
gerencia.html         panel de gerencia      → js/gerencia.js
tablet.html           QR de recepción        → js/tablet.js
fichar.html           destino del QR si se escanea con la cámara → js/fichar.js
js/config.js          ← lo único que hay que editar
js/logica.js          grilla oficial, reemplazos, jornadas, textos de correo
js/datos.js           Firebase / modo demo
firestore.rules       reglas de seguridad
```
