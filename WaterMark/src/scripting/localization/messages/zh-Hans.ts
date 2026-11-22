// Simplified Chinese. Drafted with AI assistance; needs review by a native speaker before release.
import type { Messages } from './en.ts'

export const zhHans: Messages = {
  'app.name': 'WaterMark',
  'lang.label': '语言',
  'lang.pending': '{language}（审核中）',
  'lang.translatedNotice': '界面文字已翻译。官方警告以发布时的语言显示。',

  'status.loading': '正在加载…',
  'status.error': '此信息未能加载。请稍后再试。',
  'status.retry': '重试',
  'status.unknown': '未知',
  'status.noData': '此地点暂无数据。这并不代表没有洪水风险。',
  'status.noActiveAlerts': '目前此处未发现生效中的官方警报。这并不代表该区域安全。',

  'data.officialWarning': '官方警告',
  'data.forecast': '预报',
  'data.observation': '实测',
  'data.scenario': '模型情景',
  'data.historical': '过往记录',
  'data.source': '来源：{source}',
  'data.observedAt': '测量时间：{time}',
  'data.issuedAt': '发布时间：{time}',
  'data.validRange': '有效期：{from} 至 {to}',
  'data.fetchedAt': '获取时间：{time}',

  'official.asIssued': '{source} 发布的官方原文',
  'official.originalLanguage': '原文语言：{language}',
  'official.unofficialTranslation': '非官方翻译',
  'official.translationNote': '此翻译可能有误。以上官方原文为准。',
  'official.openSource': '打开 {source} 的原文',

  'auth.signIn': '登录',
  'auth.signOut': '退出登录',
  'auth.guest': '以访客身份浏览',
  'auth.signedInAs': '已登录：{name}',
  'auth.loading': '正在检查登录状态…',
  'auth.expired': '您的登录已过期。您可以继续使用地图，或重新登录。',
  'auth.error': '登录功能暂时无法使用。无需账户，地图和洪水数据仍可正常使用。',
  'auth.optional': '账户是可选的。地图上的所有功能都无需账户即可使用。',
  'auth.requiredForFeature': '登录后可保存地点和通知设置。',

  'voice.unavailable': '{language} 暂不支持语音引导。所有信息都会显示在屏幕上。',
  'voice.notice': '语音引导只是辅助功能。请务必查看屏幕上的警告和来源。',
}
