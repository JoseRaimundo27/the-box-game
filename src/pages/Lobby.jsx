import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, set } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import './Lobby.css';
import resetData from '../../reset.json';

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

  //Função para resetar BD

  const handleResetDatabase = async () => {
    const confirmacao = window.confirm(
      "ATENÇÃO: Você tem certeza que deseja resetar TODAS as salas? Isso apagará o progresso e o histórico de todos os jogadores!"
    );

    if (confirmacao) {
      try {
        const roomsRef = ref(db, 'rooms');

        await set(roomsRef, resetData.rooms);

        alert("Banco de dados reiniciado com sucesso! Todas as salas voltaram ao estado inicial.");
      } catch (error) {
        console.error("Erro ao resetar o banco de dados:", error);
        alert("Ops! Ocorreu um erro ao tentar resetar o banco de dados. Verifique o console.");
      }
    }
  };

  // Função para contar quantos players já entraram
  const countPlayers = (playersObj) => {
    return Object.values(playersObj).filter(p => p.uid !== "").length;
  };

  return (
    <div className="lobby-container">
      {/* Criamos uma estrutura de header para alinhar o título e o botão de reset de forma elegante */}
      <div className="lobby-header-actions">
        <h1>The Box Game - Salas Disponíveis</h1>
        <button className="btn-danger-reset" onClick={handleResetDatabase}>
          🔄 Resetar Fábrica (Limpar Tudo)
        </button>
      </div>
      
      <p>Escolha uma sala para iniciar a simulação de produção.</p>

      <div className="rooms-grid">
        {Object.keys(rooms).map((roomId) => {
          const room = rooms[roomId];
          const playerCount = countPlayers(room.players);

          return (
            <div key={roomId} className="room-card">
              <h3>{roomId.replace('_', ' ').toUpperCase()}</h3>
              <span className={`status-badge ${room.metadata?.status === 'waiting' ? 'status-waiting' : 'status-playing'}`}>
                {room.metadata?.status === 'waiting' ? 'Aguardando' : 'Em Jogo'}
              </span>
              
              <p>Jogadores: <strong>{playerCount} / 5</strong></p>
              
              <button 
                className="btn-enter"
                onClick={() => handleJoinRoom(roomId)}
                disabled={playerCount >= 5 || room.metadata?.status !== 'waiting'}
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