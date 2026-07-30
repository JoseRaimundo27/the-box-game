import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, set, update, get } from 'firebase/database';
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [activeTab, setActiveTab] = useState(1); // Controla qual round estamos editando no modal
  
  const defaultRoundConfig = {
    prices: { A: 1, B: 2, C: 3, D: 4, E: 5 },
    stockNeeded: { A: 1, B: 3, C: 1, D: 2, E: 2}, // voltando para 13122
    productionGoal: 100,
    timeLimit: 300 // 5 minutos por padrão
  };

  // Estado local para armazenar as regras dos 4 rounds
  const [roundsConfig, setRoundsConfig] = useState({
    1: { ...defaultRoundConfig }, // Round de Teste
    2: { ...defaultRoundConfig }, // Round Oficial 1
    3: { ...defaultRoundConfig }, // Round Oficial 2
    4: { ...defaultRoundConfig }  // Round Oficial 3
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

  // FUNÇÃO EXCLUSIVA DO ADMIN PARA EXPORTAR HISTÓRICO DAS PARTIDAS EM CSV
  const handleExportCSV = async () => {
    try {
      const historyRef = ref(db, 'match_history');
      const snapshot = await get(historyRef);
      const historyData = snapshot.val();

      if (!historyData) {
        alert("Nenhum dado de histórico de partidas foi encontrado para exportação.");
        return;
      }

      const records = Object.values(historyData);

      const headers = [
        "ID_Sessao",
        "Data_Hora",
        "Sala",
        "Round",
        "Meta_Producao",
        "Producao_Entregue",
        "Taxa_Conclusao_Pct",
        "Lead_Time_Segundos",
        "WIP_Final",
        "WIP_Medio",
        "Custo_WIP_Final"
      ];

      const rows = records.map(record => {
        return [
          record.sessionId || "",
          record.dateTime || "",
          record.roomId || "",
          record.round || "",
          record.productionGoal !== undefined ? record.productionGoal : "",
          record.productionDelivered !== undefined ? record.productionDelivered : "",
          record.completionRatePct !== undefined ? record.completionRatePct : "",
          record.leadTimeSeconds !== undefined ? record.leadTimeSeconds : "",
          record.wipFinal !== undefined ? record.wipFinal : "",
          record.wipAverage !== undefined ? record.wipAverage : "",
          record.wipFinancialImpactFinal !== undefined ? record.wipFinancialImpactFinal : ""
        ].join(";");
      });

      const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `historico_partidas_${Date.now()}.csv`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar e exportar planilha CSV:", error);
      alert("Ocorreu um erro técnico ao gerar a planilha de exportação.");
    }
  };

  // FUNÇÃO EXCLUSIVA DO ADMIN PARA EXPORTAR OS FEEDBACKS DOS JOGADORES EM CSV
  const handleExportFeedbackCSV = async () => {
    try {
      const feedbackRef = ref(db, 'player_feedbacks');
      const snapshot = await get(feedbackRef);
      const feedbackData = snapshot.val();

      if (!feedbackData) {
        alert("Nenhum feedback de jogador foi encontrado para exportação.");
        return;
      }

      const records = Object.entries(feedbackData).map(([id, val]) => ({ id, ...val }));

      const headers = [
        "ID_Feedback",
        "Data_Hora",
        "Sala",
        "Nome_Jogador",
        "Cargo",
        "Empresa",
        "Nota_Rating",
        "Comentario"
      ];

      const rows = records.map(record => {
        const formattedDate = record.timestamp ? new Date(record.timestamp).toLocaleString("pt-BR") : "";
        // Remove quebras de linha e escapa aspas para não quebrar o arquivo CSV
        const cleanComment = (record.comment || "").replace(/;/g, ",").replace(/\n/g, " ");

        return [
          record.id || "",
          formattedDate,
          record.roomId || "",
          record.playerName || "",
          record.playerOccupation || "",
          record.playerCompany || "",
          record.rating !== undefined ? record.rating : "",
          `"${cleanComment}"`
        ].join(";");
      });

      const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `feedbacks_jogadores_${Date.now()}.csv`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar e exportar planilha de feedbacks:", error);
      alert("Ocorreu um erro técnico ao gerar a planilha de feedbacks.");
    }
  };

  // Abre o modal carregando as configurações atuais salvos no banco (ou defaults)
  const handleOpenConfig = (roomId, currentRoomData) => {
    setSelectedRoomId(roomId);
    
    if (currentRoomData.config && currentRoomData.config.rounds) {
      setRoundsConfig(currentRoomData.config.rounds);
    } else {
      setRoundsConfig({
        1: { ...defaultRoundConfig },
        2: { ...defaultRoundConfig },
        3: { ...defaultRoundConfig },
        4: { ...defaultRoundConfig }
      });
    }
    setActiveTab(1); // Sempre abre na aba do Round 1
    setIsModalOpen(true);
  };

  // Salva os dados de todos os rounds diretamente na respectiva sala do Firebase
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      const configRef = ref(db, `rooms/${selectedRoomId}/config/rounds`);
      await set(configRef, roundsConfig);
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
          <div className="admin-buttons-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* BOTÃO EXPORTAR PARTIDAS */}
            <button 
              className="btn-success-export" 
              onClick={handleExportCSV}
              style={{
                backgroundColor: '#2ecc71',
                color: '#fff',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2ecc71'}
            >
              📊 {t('lobby.spreadsheet')} (CSV)
            </button>

            {/* BOTÃO EXPORTAR FEEDBACKS */}
            <button 
              className="btn-feedback-export" 
              onClick={handleExportFeedbackCSV}
              style={{
                backgroundColor: '#f39c12',
                color: '#fff',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d35400'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f39c12'}
            >
              ⭐ Feedbacks (CSV)
            </button>

            <button className="btn-danger-reset" onClick={handleResetDatabase}>
              {t('lobby.btn_reset')}
            </button>
          </div>
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
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2>{t('config_modal.title')} {selectedRoomId.replace('_', ' ').toUpperCase()}</h2>
            
            {/* ABAS DOS ROUNDS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ecf0f1', paddingBottom: '10px' }}>
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setActiveTab(num)}
                  style={{
                    padding: '8px 15px',
                    backgroundColor: activeTab === num ? '#3498db' : '#ecf0f1',
                    color: activeTab === num ? 'white' : '#7f8c8d',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Round {num} {num === 1 ? '(Teste)' : ''}
                </button>
              ))}
            </div>

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
                        value={roundsConfig[activeTab].prices[letter]}
                        onChange={(e) => setRoundsConfig({
                          ...roundsConfig,
                          [activeTab]: {
                            ...roundsConfig[activeTab],
                            prices: { ...roundsConfig[activeTab].prices, [letter]: parseInt(e.target.value) || 1 }
                          }
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
                        value={roundsConfig[activeTab].stockNeeded[letter]}
                        onChange={(e) => setRoundsConfig({
                          ...roundsConfig,
                          [activeTab]: {
                            ...roundsConfig[activeTab],
                            stockNeeded: { ...roundsConfig[activeTab].stockNeeded, [letter]: parseInt(e.target.value) || 1 }
                          }
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
                      value={roundsConfig[activeTab].productionGoal}
                      onChange={(e) => setRoundsConfig({
                        ...roundsConfig,
                        [activeTab]: { ...roundsConfig[activeTab], productionGoal: parseInt(e.target.value) || 20 }
                      })}
                    />
                  </div>

                  <div className="input-field-vertical">
                    <label>
                      {t('config_modal.time_limit')} <small style={{color: '#95a5a6'}}>{t('config_modal.time_limit_sub')}</small>
                    </label>
                    <input 
                      type="number" 
                      min="0"
                      value={roundsConfig[activeTab].timeLimit}
                      onChange={(e) => setRoundsConfig({
                        ...roundsConfig,
                        [activeTab]: { ...roundsConfig[activeTab], timeLimit: parseInt(e.target.value) || 0 }
                      })}
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