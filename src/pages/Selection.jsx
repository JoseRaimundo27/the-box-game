import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next'; // <--- IMPORTANTE: Importando o hook de tradução
import './Selection.css';

const Selection = () => {
  const { currentRoom, user, setMyStation, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation(); // <--- Habilitando a função t()

  useEffect(() => {
    if (!currentRoom) {
      navigate('/');
      return;
    }

    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoomData(snapshot.val());
    });

    return () => unsubscribe();
  }, [currentRoom, navigate]);

  const selectStation = (stationKey) => {
    const stationRef = ref(db, `rooms/${currentRoom}/players/${stationKey}`);

    runTransaction(stationRef, (currentData) => {
      if (currentData && currentData.uid !== "") {
        return; 
      }
      return { uid: user.uid, name: "Jogador" }; 
    }).then((result) => {
      if (result.committed) {
        setMyStation(stationKey);
      } else {
        // Alerta traduzido para caso a estação seja ocupada no milissegundo anterior
        alert(t('selection.alert_busy')); 
      }
    });
  };

  // Tela de carregamento traduzida
  if (!roomData) return <div className="loading">{t('selection.loading')}</div>;

  const stations = ['station_A', 'station_B', 'station_C', 'station_D', 'station_E'];
  const allReady = stations.every(s => roomData.players[s].uid !== "");

  return (
    <div className="selection-container">
      {/* Título e subtítulos traduzidos */}
      <h2>{t('selection.room_title')} {currentRoom.toUpperCase()}</h2>
      <p>{t('selection.subtitle')}</p>

      <div className="stations-grid">
        {stations.map((s) => {
          const isOccupied = roomData.players[s].uid !== "";
          const isMine = roomData.players[s].uid === user?.uid;

          return (
            <div 
              key={s} 
              className={`station-card ${isOccupied ? 'occupied' : ''} ${isMine ? 'selected' : ''}`}
              onClick={() => !isOccupied && selectStation(s)}
            >
              <span className="station-name">{s.split('_')[1]}</span>
              {/* Status das caixas traduzidos dinamicamente */}
              <small>
                {isOccupied 
                  ? (isMine ? t('selection.you') : t('selection.occupied')) 
                  : t('selection.available')}
              </small>
            </div>
          );
        })}
      </div>

      {/* Botão de início e texto de espera traduzidos */}
      {allReady && (
        <button className="btn-start" onClick={() => navigate('/game')}>
          {t('selection.btn_start')}
        </button>
      )}
      
      {!allReady && (
        <p style={{ marginTop: '20px', color: '#666' }}>
          {t('selection.waiting_players')}
        </p>
      )}
    </div>
  );
};

export default Selection;