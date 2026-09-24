import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next'; // <--- IMPORTANTE: Importando o hook de tradução
import './Selection.css';
import Footer from './Footer';

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

  useEffect(() => {
    if (roomData?.players && user?.uid) {
      const myStationsList = Object.keys(roomData.players).filter(
        (sKey) => roomData.players[sKey].uid === user.uid
      );
      setMyStation(myStationsList);
    }
  }, [roomData, user, setMyStation]);

  const selectStation = (stationKey) => {
    const stationRef = ref(db, `rooms/${currentRoom}/players/${stationKey}`);
    const storedName = sessionStorage.getItem('playerName') || "Jogador";

    runTransaction(stationRef, (currentData) => {
      if (!currentData) return { uid: user.uid, name: storedName };

      // Se a estação já pertence a este jogador -> DESMARCA (libera a estação)
      if (currentData.uid === user.uid) {
        return { uid: "", name: "" };
      }

      // Se a estação estiver livre -> SELECIONA para o jogador
      if (currentData.uid === "") {
        return { uid: user.uid, name: storedName };
      }

      // Se pertence a outro jogador -> não altera nada
      return;
    });
  };

  // Tela de carregamento traduzida
  if (!roomData) return <div className="loading">{t('selection.loading')}</div>;

  const stations = ['station_A', 'station_B', 'station_C', 'station_D', 'station_E'];
  const allReady = stations.every((s) => roomData.players[s]?.uid !== "");

  return (
    <div className="selection-container">
      {/* Título e subtítulos */}
      <h2>{t('selection.room_title')} {currentRoom.toUpperCase()}</h2>
      <p>{t('selection.subtitle')}</p>

      <div className="stations-grid">
        {stations.map((s) => {
          const player = roomData.players[s];
          const isMine = player?.uid === user?.uid;
          const isOccupied = player?.uid !== "" && !isMine;

          return (
            <div 
              key={s} 
              className={`station-card ${isOccupied ? 'occupied' : ''} ${isMine ? 'selected' : ''}`}
              onClick={() => !isOccupied && selectStation(s)}
            >
              <span className="station-name">{s.split('_')[1]}</span>
              {/* Status traduzido dinamicamente */}
              <small>
                {isMine 
                  ? t('selection.you') 
                  : isOccupied 
                    ? t('selection.occupied') 
                    : t('selection.available')}
              </small>
            </div>
          );
        })}
      </div>

      {/* Botão de início e texto de espera */}
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

      <Footer />
    </div>
  );
};

export default Selection;