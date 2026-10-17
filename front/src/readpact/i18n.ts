import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
void i18n.use(initReactI18next).init({
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
  resources: { zh: { translation: {} } },
})
export default i18n
