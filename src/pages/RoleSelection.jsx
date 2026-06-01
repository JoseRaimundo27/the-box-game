import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './RoleSelection.css'; // Você pode criar um CSS estilizado para esta tela

const RoleSelection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');

  // CÓDIGO/PIN MOCKADO PARA ACESSO DO ADMINISTRADOR
  const ADMIN_PIN = "admin123"; 

  const handleSelectPlayer = () => {
    sessionStorage.setItem('isAdmin', 'false'); // Define que NÃO é admin
    navigate('/lobby');
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('isAdmin', 'true'); // Define que É admin
      navigate('/lobby');
    } else {
      alert(t('role_selection.alert_error'));
      setPin('');
    }
  };

  return (
    <div className="role-selection-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center', gap: '20px' }}>
      <h1>{t('role_selection.title')}</h1>
      <p>{t('role_selection.subtitle')}</p>

      {!showPinInput ? (
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Botão Jogador Comum */}
          <button 
            className="role-btn player-btn" 
            onClick={handleSelectPlayer}
            style={{ padding: '15px 30px', fontSize: '1.2em', cursor: 'pointer', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
            {t('role_selection.btn_player')}
          </button>

          {/* Botão Abrir Campo de Admin */}
          <button 
            className="role-btn admin-btn" 
            onClick={() => setShowPinInput(true)}
            style={{ padding: '15px 30px', fontSize: '1.2em', cursor: 'pointer', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
            {t('role_selection.btn_admin')}
          </button>
        </div>
      ) : (
        /* Formulário de Input do PIN */
        <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
          <label style={{ fontWeight: 'bold' }}>{t('role_selection.pin_prompt')}</label>
          <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder={t('role_selection.pin_placeholder')}
            autoFocus
            style={{ padding: '10px', fontSize: '1em', textAlign: 'center', borderRadius: '5px', border: '1px solid #ccc' }}
          />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button type="submit" style={{ padding: '8px 20px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>
              {t('role_selection.btn_confirm')}
            </button>
            <button type="button" onClick={() => { setShowPinInput(false); setPin(''); }} style={{ padding: '8px 20px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>
              {t('role_selection.btn_cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default RoleSelection;