import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction, update } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import './Game.css'

const Game = () => {
  const { currentRoom, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);
  const [localClicks, setLocalClicks] = useState(0);
  const navigate = useNavigate();

  const CLICKS_PER_CONTAINER = 15;

  useEffect(() => {
    if (!currentRoom || !myStation) {
      navigate('/');
      return;
    }

    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      setRoomData(data);
      
      // Se atingir 100, fim de jogo
      if (data?.production?.finished_total >= 100) {
        navigate('/results');
      }
    });

    return () => unsubscribe();
  }, [currentRoom, myStation, navigate]);

  const handleWork = () => {
    const newClicks = localClicks + 1;

    if (newClicks >= CLICKS_PER_CONTAINER) {
      // COMPLETOU UM CONTAINER! Lógica de transferência:
      completeContainer();
      setLocalClicks(0);
    } else {
      setLocalClicks(newClicks);
    }
  };

  const completeContainer = () => {
    const productionRef = ref(db, `rooms/${currentRoom}/production`);

    runTransaction(productionRef, (currentData) => {
      if (!currentData) return currentData;

      if (myStation === 'station_A') {
        currentData.wip_A_B++;
      } else if (myStation === 'station_B') {
        currentData.wip_A_B--;
        currentData.wip_B_C++;
      } else if (myStation === 'station_C') {
        currentData.wip_B_C--;
        currentData.wip_C_D++;
      } else if (myStation === 'station_D') {
        currentData.wip_C_D--;
        currentData.wip_D_E++;
      } else if (myStation === 'station_E') {
        currentData.wip_D_E--;
        currentData.finished_total++;
      }

      return currentData;
    });
  };

  if (!roomData) return <div>Carregando fábrica...</div>;

  const prod = roomData.production;
  
  // Lógica de trava do botão
  const hasMaterial = 
    myStation === 'station_A' || 
    (myStation === 'station_B' && prod.wip_A_B > 0) ||
    (myStation === 'station_C' && prod.wip_B_C > 0) ||
    (myStation === 'station_D' && prod.wip_C_D > 0) ||
    (myStation === 'station_E' && prod.wip_D_E > 0);

  return (
    <div className="game-container">
      <h2>Estação {myStation.split('_')[1]} - {currentRoom.toUpperCase()}</h2>
      
      {/* Visualização da Linha de Produção */}
      <div className="production-line">
        <div className="station-node">A <br/> <span className="wip-badge">{prod.wip_A_B}</span></div>
        <div className="wip-arrow">→</div>
        <div className="station-node">B <br/> <span className="wip-badge">{prod.wip_B_C}</span></div>
        <div className="wip-arrow">→</div>
        <div className="station-node">C <br/> <span className="wip-badge">{prod.wip_C_D}</span></div>
        <div className="wip-arrow">→</div>
        <div className="station-node">D <br/> <span className="wip-badge">{prod.wip_D_E}</span></div>
        <div className="wip-arrow">→</div>
        <div className="station-node">E <br/> <strong>{prod.finished_total}</strong></div>
      </div>

      <div className="work-area">
        <h3>{hasMaterial ? "TRABALHE!" : "AGUARDANDO MATERIAL..."}</h3>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${(localClicks / CLICKS_PER_CONTAINER) * 100}%` }}
          ></div>
        </div>

        <button 
          className="click-button"
          onClick={handleWork}
          disabled={!hasMaterial}
        >
          {localClicks} / {CLICKS_PER_CONTAINER} <br/>
          CLIQUES
        </button>

        <p style={{ marginTop: '20px' }}>
          {myStation === 'station_A' ? "Você é o início da linha" : `Estoque disponível para você: ${
            myStation === 'station_B' ? prod.wip_A_B :
            myStation === 'station_C' ? prod.wip_B_C :
            myStation === 'station_D' ? prod.wip_C_D :
            prod.wip_D_E
          }`}
        </p>
      </div>
    </div>
  );
};

export default Game;