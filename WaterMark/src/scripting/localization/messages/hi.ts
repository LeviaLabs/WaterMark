// Hindi. Candidate language pending team confirmation (README section 9).
// Drafted with AI assistance; needs review by a native speaker before release.
import type { Messages } from './en.ts'

export const hi: Messages = {
  'app.name': 'WaterMark',
  'lang.label': 'भाषा',
  'lang.pending': '{language} (समीक्षा में)',
  'lang.translatedNotice': 'इंटरफ़ेस का पाठ अनुवादित है। आधिकारिक चेतावनियाँ उसी भाषा में दिखाई जाती हैं जिसमें वे जारी की गई थीं।',

  'status.loading': 'लोड हो रहा है…',
  'status.error': 'यह जानकारी लोड नहीं हुई। थोड़ी देर बाद फिर से कोशिश करें।',
  'status.retry': 'फिर से कोशिश करें',
  'status.unknown': 'अज्ञात',
  'status.noData': 'इस जगह के लिए कोई डेटा नहीं है। इसका मतलब यह नहीं है कि बाढ़ का कोई खतरा नहीं है।',
  'status.noActiveAlerts': 'अभी यहाँ कोई सक्रिय आधिकारिक अलर्ट नहीं मिला। इसका मतलब यह नहीं है कि यह इलाका सुरक्षित है।',

  'data.officialWarning': 'आधिकारिक चेतावनी',
  'data.forecast': 'पूर्वानुमान',
  'data.observation': 'मापा गया',
  'data.scenario': 'मॉडल आधारित परिदृश्य',
  'data.historical': 'पिछले रिकॉर्ड',
  'data.source': 'स्रोत: {source}',
  'data.observedAt': 'मापा गया {time}',
  'data.issuedAt': 'जारी किया गया {time}',
  'data.validRange': '{from} से {to} तक मान्य',
  'data.fetchedAt': 'प्राप्त किया गया {time}',

  'official.asIssued': '{source} का आधिकारिक पाठ, जैसा जारी किया गया',
  'official.originalLanguage': 'मूल भाषा: {language}',
  'official.unofficialTranslation': 'अनौपचारिक अनुवाद',
  'official.translationNote': 'इस अनुवाद में गलतियाँ हो सकती हैं। ऊपर दिया गया आधिकारिक पाठ ही मान्य संस्करण है।',
  'official.openSource': '{source} का मूल पाठ खोलें',

  'auth.signIn': 'साइन इन करें',
  'auth.signOut': 'साइन आउट करें',
  'auth.guest': 'अतिथि के रूप में देख रहे हैं',
  'auth.signedInAs': '{name} के रूप में साइन इन',
  'auth.loading': 'साइन-इन की जाँच हो रही है…',
  'auth.expired': 'आपका साइन-इन समाप्त हो गया है। आप नक्शे का उपयोग जारी रख सकते हैं, या फिर से साइन इन कर सकते हैं।',
  'auth.error': 'साइन-इन अभी काम नहीं कर रहा है। नक्शा और बाढ़ डेटा बिना खाते के भी काम करते हैं।',
  'auth.optional': 'खाता वैकल्पिक है। नक्शे की हर सुविधा बिना खाते के काम करती है।',
  'auth.requiredForFeature': 'जगहें और सूचना से जुड़ी पसंद सहेजने के लिए साइन इन करें।',

  'voice.unavailable': '{language} में बोलकर मार्गदर्शन अभी उपलब्ध नहीं है। सारी जानकारी स्क्रीन पर दिखाई जाती है।',
  'voice.notice': 'बोलकर मार्गदर्शन एक अतिरिक्त सुविधा है। स्क्रीन पर दी गई चेतावनियाँ और स्रोत हमेशा देखें।',
}
