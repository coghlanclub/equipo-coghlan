// Consentimiento para el tratamiento de datos personales (Ley 25.326).
// Si se cambia el texto, subir la VERSION: las fichas guardan qué versión firmó cada persona.
export const VERSION = '1 · octubre 2026';

export const TITULO = 'Consentimiento para el uso de datos personales';

export const PUNTOS = [
  ['Quién guarda los datos', 'Coghlan Club, con domicilio en Washington 2558, Coghlan, Ciudad de Buenos Aires, es responsable de la base de datos de su personal.'],
  ['Qué datos', 'Nombre y apellido, DNI, celular, contacto de emergencia, dirección, rol, clases y horarios, cuándo puedo cubrir reemplazos, y el registro de mis entradas, salidas, vacaciones y ausencias.'],
  ['Para qué se usan', 'Exclusiva y únicamente para fines laborales: organizar la grilla y los horarios, registrar la asistencia, gestionar vacaciones, ausencias y reemplazos, y contactarme a mí o a mi contacto de emergencia por temas de trabajo o ante una urgencia.'],
  ['Para qué NO se usan', 'No se usan con fines publicitarios ni comerciales, no se venden y no se comparten con terceros, salvo que la ley lo exija.'],
  ['Quién los ve', 'Solo la gerencia de Coghlan Club. Cada persona ve únicamente su propia ficha. Los datos se guardan en servidores con acceso protegido.'],
  ['Mis derechos', 'Puedo pedir en cualquier momento ver, corregir o borrar mis datos, escribiendo a gerencia. Si dejo de trabajar en el club, puedo pedir que se borren, salvo lo que la ley obligue a conservar.'],
  ['Es voluntario', 'Dar estos datos es necesario para organizar mi trabajo en el club. Si no los doy, gerencia no puede asignarme horarios ni registrar mi asistencia por este sistema.'],
];

export const LEYENDA = 'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.';

export const DECLARACION = 'Leí este consentimiento y acepto que Coghlan Club guarde y use mis datos personales solo para fines laborales, en los términos de la Ley 25.326.';

export function htmlConsentimiento(esc = s => s) {
  return `<div class="consentimiento">
    <h3>${TITULO}</h3>
    <p class="sub">Ley 25.326 de Protección de los Datos Personales · versión ${VERSION}</p>
    ${PUNTOS.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}
    <p class="sub" style="font-size:.78rem">${esc(LEYENDA)}</p>
  </div>`;
}
