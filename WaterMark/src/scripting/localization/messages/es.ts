// Spanish. Drafted with AI assistance; needs review by a native speaker before release.
import type { Messages } from './en.ts'

export const es: Messages = {
  'app.name': 'WaterMark',
  'lang.label': 'Idioma',
  'lang.pending': '{language} (en revisión)',
  'lang.translatedNotice': 'El texto de la interfaz está traducido. Las advertencias oficiales se muestran en el idioma en que se emitieron.',

  'status.loading': 'Cargando…',
  'status.error': 'Esta información no se cargó. Inténtelo de nuevo en un momento.',
  'status.retry': 'Intentar de nuevo',
  'status.unknown': 'Desconocido',
  'status.noData': 'No hay datos para este lugar. Eso no significa que no haya riesgo de inundación.',
  'status.noActiveAlerts': 'No se encontraron alertas oficiales activas aquí en este momento. Eso no significa que la zona esté segura.',

  'data.officialWarning': 'Advertencia oficial',
  'data.forecast': 'Pronóstico',
  'data.observation': 'Medido',
  'data.scenario': 'Escenario modelado',
  'data.historical': 'Registros anteriores',
  'data.source': 'Fuente: {source}',
  'data.observedAt': 'Medido {time}',
  'data.issuedAt': 'Emitido {time}',
  'data.validRange': 'Válido del {from} al {to}',
  'data.fetchedAt': 'Obtenido {time}',

  'official.asIssued': 'Texto oficial de {source}, tal como se emitió',
  'official.originalLanguage': 'Idioma original: {language}',
  'official.unofficialTranslation': 'Traducción no oficial',
  'official.translationNote': 'Esta traducción puede contener errores. El texto oficial de arriba es la versión válida.',
  'official.openSource': 'Abrir el original de {source}',

  'auth.signIn': 'Iniciar sesión',
  'auth.signOut': 'Cerrar sesión',
  'auth.guest': 'Navegando como invitado',
  'auth.signedInAs': 'Sesión iniciada como {name}',
  'auth.loading': 'Comprobando la sesión…',
  'auth.expired': 'Su sesión ha caducado. Puede seguir usando el mapa o volver a iniciar sesión.',
  'auth.error': 'El inicio de sesión no funciona en este momento. El mapa y los datos de inundación funcionan sin cuenta.',
  'auth.optional': 'La cuenta es opcional. Todo el mapa funciona sin ella.',
  'auth.requiredForFeature': 'Inicie sesión para guardar lugares y preferencias de notificación.',

  'voice.unavailable': 'La guía hablada todavía no está disponible en {language}. Toda la información se muestra en pantalla.',
  'voice.notice': 'La guía hablada es un complemento. Revise siempre las advertencias y las fuentes en pantalla.',
}
