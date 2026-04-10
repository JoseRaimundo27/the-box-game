import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Lobby.css';

const Lobby = () => {
  const [rooms, setRooms] = useState({});
  const { setCurrentRoom } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    // Referência para o nó 'rooms' que criamos no JSON
    const roomsRef = ref(db, 'rooms');
    
    // Escuta mudanças em todas as salas simultaneamente
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setRooms(data);
    });

    return () => unsubscribe(); // Limpa a conexão ao sair da tela
  }, []);

  const handleJoinRoom = (roomId) => {
    setCurrentRoom(roomId);
    navigate('/selection'); // Vai para a tela de escolher A, B, C...
  };

  // Função para contar quantos players já entraram
  const countPlayers = (playersObj) => {
    return Object.values(playersObj).filter(p => p.uid !== "").length;
  };

  return (
    <div className="lobby-container">
      <h1>The Box Game - Salas Disponíveis</h1>
      <p>Escolha uma sala para iniciar a simulação de produção.</p>

      <div className="rooms-grid">
        {Object.keys(rooms).map((roomId) => {
          const room = rooms[roomId];
          const playerCount = countPlayers(room.players);

          return (
            <div key={roomId} className="room-card">
              <h3>{roomId.replace('_', ' ').toUpperCase()}</h3>
              <span className={`status-badge ${room.metadata.status === 'waiting' ? 'status-waiting' : 'status-playing'}`}>
                {room.metadata.status === 'waiting' ? 'Aguardando' : 'Em Jogo'}
              </span>
              
              <p>Jogadores: <strong>{playerCount} / 5</strong></p>
              
              <button 
                className="btn-enter"
                onClick={() => handleJoinRoom(roomId)}
                disabled={playerCount >= 5 || room.metadata.status !== 'waiting'}
              >
                {playerCount >= 5 ? 'Sala Cheia' : 'Entrar na Sala'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Lobby;