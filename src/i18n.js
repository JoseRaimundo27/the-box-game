import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importamos os nossos dicionários
import pt from './locales/pt.json';
import en from './locales/en.json';
import es from './locales/es.json';

i18n
  .use(initReactI18next) // Conecta o i18next ao React
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es } 
    },
    lng: 'es', // Idioma padrão que a tela carrega quando abre
    fallbackLng: 'en', // Se faltar alguma palavra no PT ou ES, ele usa o EN como salva-vidas
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;