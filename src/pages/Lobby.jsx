import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, set, get } from 'firebase/database';
import JSZip from 'jszip';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next'; 
import './Lobby.css';
import resetData from '../../reset.json'; 
import Footer from './Footer';

const Lobby = () => {
  const [rooms, setRooms] = useState({});
  const { setCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { t } = useTranslation(); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [activeTab, setActiveTab] = useState(1); 
  const [isExportingCharts, setIsExportingCharts] = useState(false);
  
  const defaultRoundConfig = {
    prices: { A: 1, B: 2, C: 3, D: 4, E: 5 },
    stockNeeded: { A: 1, B: 3, C: 1, D: 2, E: 2 }, 
    productionGoal: 100,
    timeLimit: 20 
  };

  const [roundsConfig, setRoundsConfig] = useState({
    1: { ...defaultRoundConfig }, 
    2: { ...defaultRoundConfig }, 
    3: { ...defaultRoundConfig }, 
    4: { ...defaultRoundConfig }  
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

  // ==========================================
  // PARSER DE DADOS DO MATCH_HISTORY
  // ==========================================
  const parseMatchRecords = (historyData) => {
    let records = [];
    if (!historyData) return records;

    // Varre todas as salas (ex: sala_01, sala_02...)
    Object.entries(historyData).forEach(([roomId, roomRounds]) => {
      if (roomRounds && typeof roomRounds === 'object') {
        // Varre todos os rounds (ex: round_1, round_2...)
        Object.entries(roomRounds).forEach(([roundKey, record]) => {
          if (record && typeof record === 'object') {
            const ts = record.timestamp || 0;
            records.push({
              roomId: record.roomId || roomId,
              round: record.round || roundKey.replace('round_', ''),
              leadTime: record.leadTime !== undefined ? record.leadTime : "",
              avgWip: record.avgWip !== undefined ? record.avgWip : "",
              financialImpact: record.financialImpact !== undefined ? record.financialImpact : "",
              completionRate: record.completionRate !== undefined ? record.completionRate : "",
              finalWip: record.finalWip !== undefined ? record.finalWip : "",
              finishedTotal: record.finishedTotal !== undefined ? record.finishedTotal : "",
              goal: record.goal !== undefined ? record.goal : "",
              timestamp: ts,
              dateTime: ts ? new Date(ts).toLocaleString("pt-BR") : ""
            });
          }
        });
      }
    });

    // Ordena do mais antigo para o mais recente por data/hora
    records.sort((a, b) => a.timestamp - b.timestamp);
    return records;
  };

  const generateCSVDownload = (records, filenamePrefix) => {
    const headers = [
      "Date",
      "Room",
      "Round",
      "Production_Goal",
      "Delivered_Production",
      "Completion_Rate_Pct",
      "Lead_Time_Seconds",
      "Final_WIP",
      "Avg_WIP",
      "Final_WIP_Cost"
    ];

    const rows = records.map(record => {
      return [
        record.dateTime || "",
        record.roomId || "",
        record.round || "",
        record.goal,
        record.finishedTotal,
        record.completionRate,
        record.leadTime,
        record.finalWip,
        record.avgWip,
        record.financialImpact
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}_${Date.now()}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. EXPORTAR TODAS AS PARTIDAS DE TODAS AS SALAS
  const handleExportCSV = async () => {
    try {
      const historyRef = ref(db, 'match_history');
      const snapshot = await get(historyRef);
      const historyData = snapshot.val();

      if (!historyData) {
        alert("Nenhum dado de histórico de partidas foi encontrado para exportação.");
        return;
      }

      const records = parseMatchRecords(historyData);

      if (records.length === 0) {
        alert("Nenhum registro válido de partida foi encontrado.");
        return;
      }

      generateCSVDownload(records, "historico_todas_partidas");
    } catch (error) {
      console.error("Erro ao gerar e exportar planilha CSV:", error);
      alert("Ocorreu um erro técnico ao gerar a planilha de exportação.");
    }
  };

  // EXPORTAR FEEDBACKS DOS JOGADORES
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
      "Date",
      "Room",
      "Player_name",
      "Occupation",
      "Company",
      "Age",        
      "Rating",      
      "Comments"     
    ];

    const rows = records.map(record => {
      const formattedDate = record.timestamp ? new Date(record.timestamp).toLocaleString("pt-BR") : "";
      const cleanComment = (record.comment || "").replace(/;/g, ",").replace(/\n/g, " ");

      return [
        record.id || "",
        formattedDate,
        record.roomId || "",
        record.playerName || "",
        record.playerOccupation || "",
        record.playerCompany || "",
        record.playerAge || "", // 👈 Faltava este campo aqui!
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
    setActiveTab(1); 
    setIsModalOpen(true);
  };

  // ==========================================
  // EXPORTAR GRÁFICOS (savedChart) DA SALA EM ZIP
  // ==========================================
  // Retorna [{ round, imageData }] apenas dos rounds que já têm gráfico salvo
  const getSavedCharts = (roomRounds) => {
    if (!roomRounds || typeof roomRounds !== 'object') return [];
    // Object.entries funciona tanto para objeto quanto para array (Firebase converte chaves 1,2,3... em array)
    return Object.entries(roomRounds)
      .filter(([, roundData]) => roundData?.savedChart?.imageData)
      .map(([roundKey, roundData]) => ({
        round: roundKey,
        imageData: roundData.savedChart.imageData,
      }))
      .sort((a, b) => Number(a.round) - Number(b.round));
  };

  const handleExportRoomCharts = async () => {
    if (!selectedRoomId) return;
    setIsExportingCharts(true);
    try {
      const snapshot = await get(ref(db, `rooms/${selectedRoomId}/rounds`));
      const charts = getSavedCharts(snapshot.val());

      if (charts.length === 0) {
        alert("Esta sala ainda não possui gráficos salvos. É preciso jogar ao menos um round primeiro.");
        return;
      }

      const zip = new JSZip();
      charts.forEach(({ round, imageData }) => {
        // imageData vem como "data:image/png;base64,XXXX" -> pega só a parte base64
        const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        zip.file(`${selectedRoomId}_round_${round}.png`, base64, { base64: true });
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `graficos_${selectedRoomId}_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao exportar gráficos da sala:", error);
      alert("Ocorreu um erro técnico ao exportar os gráficos da sala.");
    } finally {
      setIsExportingCharts(false);
    }
  };

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

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  const countPlayers = (playersObj) => {
    if (!playersObj) return 0;
    return Object.values(playersObj).filter(p => p.uid !== "").length;
  };

  // Usa os dados ao vivo de `rooms` para saber se a sala selecionada já tem gráficos salvos
  const savedChartsCount = selectedRoomId ? getSavedCharts(rooms[selectedRoomId]?.rounds).length : 0;
  const hasSavedCharts = savedChartsCount > 0;

  return (
    <div className="lobby-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '90vh' }}>
      <div className="lobby-header-actions">
        <h1>{t('lobby.title')}</h1>
        
        <div className="actions-buttons-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && (
            <div className="admin-buttons-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* BOTÃO TODAS AS PARTIDAS */}
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
                {t('lobby.btn_all_games', '📊 Todas as Partidas (CSV)')}
                
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

          {/* 🚪 BOTÃO DE LOGOUT */}
          <button 
            className="btn-logout" 
            onClick={handleLogout}
            style={{
              backgroundColor: '#e74c3c',
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
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
          >
            🚪 {t('lobby.btn_logout', 'Sair')}
          </button>
        </div>
        
      </div>
      
      <p>{t('lobby.subtitle')}</p>

      <div className="rooms-grid">
        {Object.keys(rooms).map((roomId) => {
          const room = rooms[roomId];
          const playerCount = countPlayers(room.players);

          return (
            <div key={roomId} className="room-card">
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
              
              {/* EXPORTAR GRÁFICOS DA SALA (só habilita se a sala já foi jogada) */}
              <fieldset>
                <legend>Gráficos da sala</legend>
                <button
                  type="button"
                  onClick={handleExportRoomCharts}
                  disabled={!hasSavedCharts || isExportingCharts}
                  title={hasSavedCharts ? 'Baixar ZIP com os gráficos de todos os rounds jogados' : 'Disponível após a sala ser jogada'}
                  style={{
                    backgroundColor: hasSavedCharts ? '#8e44ad' : '#bdc3c7',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 15px',
                    borderRadius: '5px',
                    cursor: hasSavedCharts && !isExportingCharts ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold'
                  }}
                >
                  {isExportingCharts
                    ? 'Gerando ZIP...'
                    : `🖼️ Exportar gráficos (ZIP)${hasSavedCharts ? ` — ${savedChartsCount} round(s)` : ''}`}
                </button>
                {!hasSavedCharts && (
                  <small style={{ display: 'block', marginTop: '6px', color: '#95a5a6' }}>
                    Esta sala ainda não foi jogada.
                  </small>
                )}
              </fieldset>

              <div className="modal-actions-wrapper">
                <button type="submit" className="btn-modal-save">{t('config_modal.btn_save')}</button>
                <button type="button" className="btn-modal-close" onClick={() => setIsModalOpen(false)}>{t('config_modal.btn_close')}</button>
              </div>
            </form>
            
          </div>
        </div>
      )}

      <Footer/>

    </div>
  );
};

export default Lobby;