import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Selection.css';

const Selection = () => {
  const { currentRoom, user, setMyStation, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);
  const navigate = useNavigate();

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
      // Se a vaga já tiver um UID e não for o meu, cancela
      if (currentData && currentData.uid !== "") {
        return; 
      }
      // Se estiver vazia, ocupa
      return { uid: user.uid, name: "Jogador" }; 
    }).then((result) => {
      if (result.committed) {
        setMyStation(stationKey);
      } else {
        alert("Esta estação acabou de ser ocupada!");
      }
    });
  };

  if (!roomData) return <div>Carregando sala...</div>;

  const stations = ['station_A', 'station_B', 'station_C', 'station_D', 'station_E'];
  const allReady = stations.every(s => roomData.players[s].uid !== "");

  return (
    <div className="selection-container">
      <h2>Sala: {currentRoom.toUpperCase()}</h2>
      <p>Escolha sua posição na linha de produção:</p>

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
              <small>{isOccupied ? (isMine ? "Você" : "Ocupado") : "Disponível"}</small>
            </div>
          );
        })}
      </div>

      {allReady && (
        <button className="btn-start" onClick={() => navigate('/game')}>
          IR PARA A FÁBRICA
        </button>
      )}
      
      {!allReady && <p style={{marginTop: '20px', color: '#666'}}>Aguardando todos os jogadores...</p>}
    </div>
  );
};

export default Selection;