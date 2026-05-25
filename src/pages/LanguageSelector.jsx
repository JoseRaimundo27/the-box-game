import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-selector">
      <button 
        className={`lang-btn ${i18n.language === 'pt' ? 'active' : ''}`} 
        onClick={() => changeLanguage('pt')}
        title="Português"
      >
        🇧🇷
      </button>
      <button 
        className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`} 
        onClick={() => changeLanguage('en')}
        title="English"
      >
        🇺🇸
      </button>
      <button 
        className={`lang-btn ${i18n.language === 'es' ? 'active' : ''}`} 
        onClick={() => changeLanguage('es')}
        title="Español (Chile)"
      >
        🇨🇱
      </button>
    </div>
  );
};

export default LanguageSelector;