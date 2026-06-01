import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, set, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next'; 
import './Lobby.css';
import resetData from '../../reset.json'; 

const Lobby = () => {
  const [rooms, setRooms] = useState({});
  const { setCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { t } = useTranslation(); 

  // Controle de Estado do Modal de Configuração
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  
  // Estado local do formulário de configurações
  const [configForm, setConfigForm] = useState({
    prices: { A: 1, B: 2, C: 3, D: 4, E: 5 },
    stockNeeded: { A: 1, B: 3, C: 1, D: 2, E: 2 },
    productionGoal: 100,
    timeLimit: 300 // 5 minutos por padrão
  });

  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setRooms(data);
    });
    return () => unsubscribe();
  }, []);

  const handleJoinRoom = (roomId) => {
    setCurrentRoom(roomId);
    navigate('/selection');
  };

  const handleResetDatabase = async () => {
    const confirmacao = window.confirm(
      "ATENÇÃO: Você tem certeza que deseja resetar TODAS as salas? Isso apagará o progresso e o histórico de todos os jogadores!"
    );

    if (confirmacao) {
      try {
        const roomsRef = ref(db, 'rooms');
        await set(roomsRef, resetData.rooms);
        alert("Banco de dados reiniciado com sucesso!");
      } catch (error) {
        console.error("Erro ao resetar o banco de dados:", error);
      }
    }
  };

  // Abre o modal carregando as configurações atuais salvos no banco (ou defaults)
  const handleOpenConfig = (roomId, currentRoomData) => {
    setSelectedRoomId(roomId);
    
    if (currentRoomData.config) {
      setConfigForm({
        prices: currentRoomData.config.prices || { A: 1, B: 2, C: 3, D: 4, E: 5 },
        stockNeeded: currentRoomData.config.stockNeeded || { A: 1, B: 3, C: 1, D: 2, E: 2 },
        productionGoal: currentRoomData.config.productionGoal || 100,
        timeLimit: currentRoomData.config.timeLimit !== undefined ? currentRoomData.config.timeLimit : 300
      });
    }
    setIsModalOpen(true);
  };

  // Salva os dados customizados diretamente na respectiva sala do Firebase
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const configRef = ref(db, `rooms/${selectedRoomId}/config`);
      await set(configRef, configForm);
      alert(`${t('config_modal.alert_success')} ${selectedRoomId.replace('_', ' ').toUpperCase()}`);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    }
  };

  const countPlayers = (playersObj) => {
    if (!playersObj) return 0;
    return Object.values(playersObj).filter(p => p.uid !== "").length;
  };

  return (
    <div className="lobby-container">
      <div className="lobby-header-actions">
        <h1>{t('lobby.title')}</h1>
        {isAdmin && (
          <button className="btn-danger-reset" onClick={handleResetDatabase}>
            {t('lobby.btn_reset')}
          </button>
        )}
      </div>
      
      <p>{t('lobby.subtitle')}</p>

      <div className="rooms-grid">
        {Object.keys(rooms).map((roomId) => {
          const room = rooms[roomId];
          const playerCount = countPlayers(room.players);

          return (
            <div key={roomId} className="room-card">
              {/* BOTÃO DE ENGRENAGEM EXCLUSIVO DO ADMIN */}
              {isAdmin && (
                <button 
                  className="btn-room-config" 
                  onClick={() => handleOpenConfig(roomId, room)}
                  title="Configurar Parâmetros da Sala"
                >
                  ⚙️
                </button>
              )}

              <h3>{roomId.replace('_', ' ').toUpperCase()}</h3>
              
              <span className={`status-badge ${room.metadata?.status === 'waiting' ? 'status-waiting' : 'status-playing'}`}>
                {room.metadata?.status === 'waiting' ? t('lobby.status_waiting') : t('lobby.status_playing')}
              </span>
              
              <p>{t('lobby.players')} <strong>{playerCount} / 5</strong></p>
              
              <button 
                className="btn-enter"
                onClick={() => handleJoinRoom(roomId)}
                disabled={playerCount >= 5 || room.metadata?.status !== 'waiting'}
              >
                {playerCount >= 5 ? t('lobby.btn_full') : t('lobby.btn_enter')}
              </button>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CONFIGURAÇÃO DO ADMINISTRADOR */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('config_modal.title')} {selectedRoomId.replace('_', ' ').toUpperCase()}</h2>
            
            <form onSubmit={handleSaveConfig}>
              
              {/* SEÇÃO 1: PREÇOS DAS CAIXINHAS */}
              <fieldset>
                <legend>{t('config_modal.tab_prices')}</legend>
                <div className="config-row-inputs">
                  {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                    <div key={letter} className="input-group-block">
                      <label>Caixa {letter}</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="5" 
                        value={configForm.prices[letter]}
                        onChange={(e) => setConfigForm({
                          ...configForm,
                          prices: { ...configForm.prices, [letter]: parseInt(e.target.value) || 1 }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* SEÇÃO 2: NÚMERO DE CAIXINHAS NA BANCADA */}
              <fieldset>
                <legend>{t('config_modal.tab_stations')}</legend>
                <div className="config-row-inputs">
                  {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                    <div key={letter} className="input-group-block">
                      <label>Estação {letter}</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="9" 
                        value={configForm.stockNeeded[letter]}
                        onChange={(e) => setConfigForm({
                          ...configForm,
                          stockNeeded: { ...configForm.stockNeeded, [letter]: parseInt(e.target.value) || 1 }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* SEÇÃO 3: REGRAS E METAS GERAIS */}
              <fieldset>
                <legend>{t('config_modal.tab_rules')}</legend>
                <div className="form-double-column">
                  <div className="input-field-vertical">
                    <label>{t('config_modal.production_goal')}</label>
                    <input 
                      type="number" 
                      min="1"
                      value={configForm.productionGoal}
                      onChange={(e) => setConfigForm({ ...configForm, productionGoal: parseInt(e.target.value) || 20 })}
                    />
                  </div>

                  <div className="input-field-vertical">
                    <label>
                      {t('config_modal.time_limit')} <small style={{color: '#95a5a6'}}>{t('config_modal.time_limit_sub')}</small>
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      value={configForm.timeLimit}
                      onChange={(e) => setConfigForm({ ...configForm, timeLimit: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </fieldset>

              {/* BOTÕES DE AÇÃO DO MODAL */}
              <div className="modal-actions-wrapper">
                <button type="submit" className="btn-modal-save">{t('config_modal.btn_save')}</button>
                <button type="button" className="btn-modal-close" onClick={() => setIsModalOpen(false)}>{t('config_modal.btn_close')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Lobby;