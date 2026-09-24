import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next';
import './Selection.css';
import Footer from './Footer';

const Selection = () => {
  const { currentRoom, user, setMyStation } = useGame();
  const [roomData, setRoomData] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // 1. Carrega os dados da sala
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

  // 2. Atualiza no GameContext a lista de estações do jogador
  useEffect(() => {
    if (roomData?.players && user?.uid) {
      const myStationsList = Object.keys(roomData.players).filter(
        (sKey) => roomData.players[sKey].uid === user.uid
      );
      setMyStation(myStationsList);
    }
  }, [roomData, user, setMyStation]);

  // 3. Lógica de Contagem Regressiva Automática
  useEffect(() => {
    if (!roomData?.players) return;

    const stations = ['station_A', 'station_B', 'station_C', 'station_D', 'station_E'];
    // Verifica se as 5 mesas têm um jogador E se todos deram ready
    const allReady = stations.every((s) => 
      roomData.players[s]?.uid !== "" && roomData.players[s]?.isReady === true
    );

    if (allReady) {
      setCountdown(5); // Inicia contagem
    } else {
      setCountdown(null); // Cancela se alguém tirar o ready
    }
  }, [roomData]);

  // 4. Executa o timer da contagem
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      navigate('/game');
      return;
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate]);


  // Função para selecionar/deselecionar a mesa
  const selectStation = (stationKey) => {
    const stationRef = ref(db, `rooms/${currentRoom}/players/${stationKey}`);
    const storedName = sessionStorage.getItem('playerName') || "Jogador";

    runTransaction(stationRef, (currentData) => {
      if (!currentData) return { uid: user.uid, name: storedName, isReady: false };

      // Se a estação já pertence a este jogador -> DESMARCA
      if (currentData.uid === user.uid) {
        return { uid: "", name: "", isReady: false };
      }

      // Se a estação estiver livre -> SELECIONA
      if (currentData.uid === "") {
        return { uid: user.uid, name: storedName, isReady: false };
      }

      return;
    });
  };

  // Função para alternar o status de PRONTO
  const toggleReady = (e, stationKey, currentReadyStatus) => {
    e.stopPropagation(); // Evita que o clique desmarque a mesa

    const stationRef = ref(db, `rooms/${currentRoom}/players/${stationKey}`);
    runTransaction(stationRef, (currentData) => {
      if (currentData && currentData.uid === user.uid) {
        currentData.isReady = !currentReadyStatus;
      }
      return currentData;
    });
  };

  if (!roomData) return <div className="loading">{t('selection.loading', 'Carregando...')}</div>;

  const stations = ['station_A', 'station_B', 'station_C', 'station_D', 'station_E'];

  return (
    <div className="selection-container">
      <h2>{t('selection.room_title', 'Sala')} {currentRoom.toUpperCase()}</h2>
      <p>{t('selection.subtitle', 'Selecione suas estações e clique em Pronto')}</p>

      <div className="stations-grid">
        {stations.map((s) => {
          const player = roomData.players[s];
          const isMine = player?.uid === user?.uid;
          const isOccupied = player?.uid !== "" && !isMine;
          const isReady = player?.isReady === true;

          return (
            <div 
              key={s} 
              className={`station-card ${isOccupied ? 'occupied' : ''} ${isMine ? 'selected' : ''} ${isReady ? 'ready-glow' : ''}`}
              onClick={() => !isOccupied && selectStation(s)}
            >
              <span className="station-name">{s.split('_')[1]}</span>
              
              <small>
                {isMine 
                  ? t('selection.you', 'Você') 
                  : isOccupied 
                    ? t('selection.occupied', 'Ocupado') 
                    : t('selection.available', 'Livre')}
              </small>

              {/* Botão de Ready apenas para o dono da estação */}
              {isMine && (
                <button 
                  className={`btn-ready-station ${isReady ? 'active' : ''}`}
                  onClick={(e) => toggleReady(e, s, isReady)}
                >
                  {isReady ? '✅ ' + t('selection.ready', 'Pronto') : t('selection.click_ready', 'Dar Pronto')}
                </button>
              )}

              {/* Indicador visual para outras mesas que já estão prontas */}
              {isOccupied && isReady && (
                <div className="ready-badge">✅ {t('selection.ready', 'Pronto')}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Área inferior: Contagem Regressiva ou Mensagem de Espera */}
      <div className="status-area">
        {countdown !== null ? (
          <h2 className="countdown-text">
            {t('selection.starting_in', 'Iniciando em')} {countdown}...
          </h2>
        ) : (
          <p style={{ marginTop: '20px', color: '#666', fontWeight: 'bold' }}>
            {t('selection.waiting_players', 'Aguardando todos selecionarem e darem Pronto...')}
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Selection;