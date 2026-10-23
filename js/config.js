// ============================================================
//  CONFIGURACIÓN — lo único que hay que tocar
// ============================================================
// 1) Pegá acá la configuración de tu proyecto Firebase
//    (Consola Firebase → ⚙ Configuración del proyecto → Tus apps → App web).
//    Mientras diga PEGAR_AQUI, la app funciona en MODO DEMO con datos de ejemplo
//    guardados solo en ese navegador.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAu9ySO2oNFtqqGpQyBIMdd86utNN0pTh8',
  authDomain: 'coghlan-personal.firebaseapp.com',
  projectId: 'coghlan-personal',
  storageBucket: 'coghlan-personal.firebasestorage.app',
  messagingSenderId: '546072620014',
  appId: '1:546072620014:web:8617d8c314fbb0089e7cff',
};

// 2) Correos de Google con acceso a la pantalla de gerencia.
//    Tienen que coincidir con los de firestore.rules (función esAdminFijo).
//    Más administradores se pueden sumar después desde Gerencia → Ajustes.
export const ADMIN_EMAILS = ['carlosags1996@gmail.com'];

// 3) Cada cuántos segundos cambia el QR de la tablet.
export const QR_SEGUNDOS = 30;
