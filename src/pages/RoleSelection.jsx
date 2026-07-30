import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './RoleSelection.css'; 

const RoleSelection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Estados para o fluxo do Admin
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');

  // Estados para o fluxo do Jogador (Novo Formulário)
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [playerInfo, setPlayerInfo] = useState({
    name: '',
    occupation: '',
    company: ''
  });

  // CÓDIGO/PIN MOCKADO PARA ACESSO DO ADMINISTRADOR
  const ADMIN_PIN = "admin123"; 

  // Abre o modal de jogador
  const handleOpenPlayerModal = () => {
    setIsPlayerModalOpen(true);
  };

  // Submete as informações do jogador e vai para o lobby
  const handlePlayerSubmit = (e) => {
    e.preventDefault();
    
    if (!playerInfo.name.trim()) {
      alert(t('role_selection.player_modal.alert_name_required'));
      return;
    }

    // Define perfil como jogador e salva os dados na sessão
    sessionStorage.setItem('isAdmin', 'false');
    sessionStorage.setItem('playerName', playerInfo.name);
    sessionStorage.setItem('playerOccupation', playerInfo.occupation);
    sessionStorage.setItem('playerCompany', playerInfo.company);
    
    navigate('/lobby');
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem('isAdmin', 'true'); 
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
            onClick={handleOpenPlayerModal}
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

      {/* MODAL DE COLETA DE DADOS DO JOGADOR */}
      {isPlayerModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px',
            textAlign: 'left',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50', textAlign: 'center' }}>{t('role_selection.player_modal.title')}</h2>
            <p style={{ fontSize: '0.9em', color: '#7f8c8d', marginBottom: '20px', textAlign: 'center' }}>
              {t('role_selection.player_modal.subtitle')}
            </p>

            <form onSubmit={handlePlayerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#333' }}>{t('role_selection.player_modal.label_name')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('role_selection.player_modal.placeholder_name')}
                  value={playerInfo.name}
                  onChange={(e) => setPlayerInfo({ ...playerInfo, name: e.target.value })}
                  style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#333' }}>{t('role_selection.player_modal.label_occupation')}</label>
                <input 
                  type="text" 
                  placeholder={t('role_selection.player_modal.placeholder_occupation')}
                  value={playerInfo.occupation}
                  onChange={(e) => setPlayerInfo({ ...playerInfo, occupation: e.target.value })}
                  style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.9em', color: '#333' }}>{t('role_selection.player_modal.label_company')}</label>
                <input 
                  type="text" 
                  placeholder={t('role_selection.player_modal.placeholder_company')}
                  value={playerInfo.company}
                  onChange={(e) => setPlayerInfo({ ...playerInfo, company: e.target.value })}
                  style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                  {t('role_selection.player_modal.btn_submit')}
                </button>
                <button type="button" onClick={() => setIsPlayerModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                  {t('role_selection.player_modal.btn_cancel')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RoleSelection;