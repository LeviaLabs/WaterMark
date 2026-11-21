// Russian. Drafted with AI assistance; needs review by a native speaker before release.
import type { Messages } from './en.ts'

export const ru: Messages = {
  'app.name': 'WaterMark',
  'lang.label': 'Язык',
  'lang.pending': '{language} (на проверке)',
  'lang.translatedNotice': 'Текст интерфейса переведён. Официальные предупреждения показаны на языке, на котором они выпущены.',

  'status.loading': 'Загрузка…',
  'status.error': 'Эти данные не загрузились. Попробуйте ещё раз через минуту.',
  'status.retry': 'Повторить',
  'status.unknown': 'Неизвестно',
  'status.noData': 'Для этого места нет данных. Это не значит, что риска наводнения нет.',
  'status.noActiveAlerts': 'Сейчас здесь нет действующих официальных предупреждений. Это не значит, что район безопасен.',

  'data.officialWarning': 'Официальное предупреждение',
  'data.forecast': 'Прогноз',
  'data.observation': 'Измерено',
  'data.scenario': 'Модельный сценарий',
  'data.historical': 'Прошлые записи',
  'data.source': 'Источник: {source}',
  'data.observedAt': 'Измерено {time}',
  'data.issuedAt': 'Выпущено {time}',
  'data.validRange': 'Действует с {from} по {to}',
  'data.fetchedAt': 'Получено {time}',

  'official.asIssued': 'Официальный текст от {source}, как он был выпущен',
  'official.originalLanguage': 'Язык оригинала: {language}',
  'official.unofficialTranslation': 'Неофициальный перевод',
  'official.translationNote': 'В переводе возможны ошибки. Действующей версией является официальный текст выше.',
  'official.openSource': 'Открыть оригинал от {source}',

  'auth.signIn': 'Войти',
  'auth.signOut': 'Выйти',
  'auth.guest': 'Вы просматриваете как гость',
  'auth.signedInAs': 'Вы вошли как {name}',
  'auth.loading': 'Проверяем вход…',
  'auth.expired': 'Срок вашего входа истёк. Вы можете продолжать пользоваться картой или войти снова.',
  'auth.error': 'Вход сейчас не работает. Карта и данные о наводнениях доступны без аккаунта.',
  'auth.optional': 'Аккаунт не обязателен. Всё на карте работает без него.',
  'auth.requiredForFeature': 'Войдите, чтобы сохранять места и настройки уведомлений.',

  'voice.unavailable': 'Голосовые подсказки на языке «{language}» пока недоступны. Вся информация показана на экране.',
  'voice.notice': 'Голосовые подсказки — дополнительная функция. Всегда проверяйте предупреждения и источники на экране.',
}
