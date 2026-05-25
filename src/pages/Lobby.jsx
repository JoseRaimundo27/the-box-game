import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, set } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useTranslation } from 'react-i18next'; // <--- IMPORTANTE: Importamos o hook de tradução
import './Lobby.css';
import resetData from '../../reset.json'; 

const Lobby = () => {
  const [rooms, setRooms] = useState({});
  const { setCurrentRoom } = useGame();
  const navigate = useNavigate();
  const { t } = useTranslation(); // <--- Habilitamos a função t() que busca as palavras nos JSONs

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
        await set(roomsRef, resetData);
        alert("Banco de dados reiniciado com sucesso!");
      } catch (error) {
        console.error("Erro ao resetar o banco de dados:", error);
      }
    }
  };

  const countPlayers = (playersObj) => {
    if (!playersObj) return 0;
    return Object.values(playersObj).filter(p => p.uid !== "").length;
  };

  return (
    <div className="lobby-container">
      <div className="lobby-header-actions">
        {/* USANDO TRADUÇÃO: Troca de texto fixo por t('chave.filho') */}
        <h1>{t('lobby.title')}</h1>
        <button className="btn-danger-reset" onClick={handleResetDatabase}>
          {t('lobby.btn_reset')}
        </button>
      </div>
      
      <p>{t('lobby.subtitle')}</p>

      <div className="rooms-grid">
        {Object.keys(rooms).map((roomId) => {
          const room = rooms[roomId];
          const playerCount = countPlayers(room.players);

          return (
            <div key={roomId} className="room-card">
              <h3>{roomId.replace('_', ' ').toUpperCase()}</h3>
              
              {/* USANDO TRADUÇÃO: Status da sala dinâmico */}
              <span className={`status-badge ${room.metadata?.status === 'waiting' ? 'status-waiting' : 'status-playing'}`}>
                {room.metadata?.status === 'waiting' ? t('lobby.status_waiting') : t('lobby.status_playing')}
              </span>
              
              <p>{t('lobby.players')} <strong>{playerCount} / 5</strong></p>
              
              {/* USANDO TRADUÇÃO: Texto dos botões dinâmico */}
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
    </div>
  );
};

export default Lobby;