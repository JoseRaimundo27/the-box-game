import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import './Game.css';

const Game = () => {
  const { currentRoom, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);

  const navigate = useNavigate();

  const colors = { A: "blue-A", B: "green-B", C: "red-C", D: "grey-D", E: "purple-E" };
  const META_PRODUCAO = 100; // Constante para a meta

  const specs = {
    station_A: { stockNeeded: 1, wipNeeded: 0, nextWip: 'ab' },
    station_B: { stockNeeded: 3, wipNeeded: 1, nextWip: 'bc', prevWip: 'ab' },
    station_C: { stockNeeded: 1, wipNeeded: 1, nextWip: 'cd', prevWip: 'bc' },
    station_D: { stockNeeded: 2, wipNeeded: 1, nextWip: 'de', prevWip: 'cd' },
    station_E: { stockNeeded: 2, wipNeeded: 1, nextWip: 'finish', prevWip: 'de' }
  };

  const getGabaritoComposition = (letter) => {
    let g = [];
    if (letter === 'A') g.push(colors.A);
    if (letter === 'B') g.push(colors.A, colors.B, colors.B, colors.B);
    if (letter === 'C') g.push(colors.A, colors.B, colors.B, colors.B, colors.C);
    if (letter === 'D') g.push(colors.A, colors.B, colors.B, colors.B, colors.C, colors.D, colors.D);
    if (letter === 'E') g.push(colors.A, colors.B, colors.B, colors.B, colors.C, colors.D, colors.D, colors.E, colors.E);
    return g;
  };

  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => setRoomData(snapshot.val()));
    return () => unsubscribe();
  }, [currentRoom]);

  // Redirecionamento automático ao bater a meta
  useEffect(() => {
    if (roomData?.production?.finished_total >= META_PRODUCAO) {
      navigate('/results');
    }
  }, [roomData?.production?.finished_total, navigate]);

  if (!roomData) return <div className="loading">Carregando...</div>;
  const prod = roomData.production;

  const getComposition = (letter, work) => {
    let comp = [];
    const hasWip = work.wipItems > 0;

    if (letter === 'A') {
      if (work.stockItems > 0) comp.push(colors.A);
    } 
    else if (letter === 'B') {
      if (hasWip) comp.push(colors.A); 
      for (let i = 0; i < work.stockItems; i++) comp.push(colors.B); 
    } 
    else if (letter === 'C') {
      if (hasWip) comp.push(colors.A, colors.B, colors.B, colors.B); 
      if (work.stockItems > 0) comp.push(colors.C); 
    } 
    else if (letter === 'D') {
      if (hasWip) comp.push(colors.A, colors.B, colors.B, colors.B, colors.C); 
      for (let i = 0; i < work.stockItems; i++) comp.push(colors.D); 
    } 
    else if (letter === 'E') {
      if (hasWip) comp.push(colors.A, colors.B, colors.B, colors.B, colors.C, colors.D, colors.D); 
      for (let i = 0; i < work.stockItems; i++) comp.push(colors.E); 
    }
    return comp;
  };

  const handleAction = (type) => {
    const sLetter = myStation.split('_')[1];
    const mySpec = specs[myStation];
    
    const prodRef = ref(db, `rooms/${currentRoom}/production`);

    runTransaction(prodRef, (current) => {
      if (!current) return current;

      if (type === 'STOCK') {
        if (current.workAreas[sLetter].stockItems < mySpec.stockNeeded && current.stocks[sLetter] > 0) {
          current.stocks[sLetter]--;
          current.workAreas[sLetter].stockItems++;
        }
      }

      if (type === 'WIP') {
        if (current.wips[mySpec.prevWip] > 0 && current.workAreas[sLetter].wipItems === 0) {
          current.wips[mySpec.prevWip]--;
          current.workAreas[sLetter].wipItems = 1;
        }
      }

      if (type === 'SEND') {
        const isFinished = mySpec.nextWip === 'finish'; 

        if (isFinished) { 
          current.finished_total++;

          const snapshot = {
            count: current.finished_total,
            wip_total: (current.wips.ab || 0) + (current.wips.bc || 0) + (current.wips.cd || 0) + (current.wips.de || 0),
            timestamp: Date.now()
          };

          const historyRef = ref(db, `rooms/${currentRoom}/history/${snapshot.timestamp}`);
          
          import('firebase/database').then(({ set }) => {
            set(historyRef, snapshot);
          });
        } else {
          current.wips[mySpec.nextWip]++;
        }

        current.workAreas[sLetter] = { stockItems: 0, wipItems: 0 };
      }

      return current;
    });
  };

  // Botão para forçar a ida para os resultados
  const handleForceEnd = () => {
    navigate('/results');
  };

  return (
    <div className="game-screen">
      {/* BARRA SUPERIOR ADICIONADA AQUI */}
      <div className="game-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#2c3e50', color: 'white' }}>
        <div className="production-progress">
          <strong>Progresso:</strong> {prod.finished_total} / {META_PRODUCAO}
        </div>
        <button 
          onClick={handleForceEnd} 
          style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          📊 Encerrar Turno (Estatísticas)
        </button>
      </div>

      <div className="factory-floor">
        {['A', 'B', 'C', 'D', 'E'].map((letter) => {
          const isMe = myStation === `station_${letter}`;
          const work = prod.workAreas[letter];
          const composition = getComposition(letter, work);
          const isFull = composition.length === (specs[`station_${letter}`].stockNeeded + (letter === 'A' ? 0 : (letter === 'B' ? 1 : (letter === 'C' ? 4 : (letter === 'D' ? 5 : 7)))));

          const gabaritoComp = getGabaritoComposition(letter);
          return (
            <React.Fragment key={letter}>
              <div className={`station-card ${isMe ? 'is-me' : ''}`}>
                <div className="station-label">Station {letter}</div>
                <div className="work-bench">
                  <div className={`cube-grid ${letter === 'E' ? 'final-container' : ''}`}>
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className={`slot ${composition[i] ? `filled ${composition[i]}` : 'empty'}`} />
                    ))}
                  </div>
                </div>
                <div className="station-controls">
                  <button disabled={!isMe || work.stockItems >= specs[`station_${letter}`].stockNeeded || prod.stocks[letter] <= 0} onClick={() => handleAction('STOCK')}>Stock</button>
                  {letter !== 'A' && <button disabled={!isMe || work.wipItems > 0 || prod.wips[specs[`station_${letter}`].prevWip] <= 0} onClick={() => handleAction('WIP')}>WIP</button>}
                  <button className="btn-send" disabled={!isMe || !isFull} onClick={() => handleAction('SEND')}>Send</button>
                </div>
                
                <div className="reference-gabarito">
                  <div className="gabarito-title">Gabarito de Entrega</div>
                  <div className={`cube-grid gabarito-grid ${letter === 'E' ? 'final-container-ref' : ''}`}>
                    {[...Array(9)].map((_, i) => (
                      <div key={`g-${i}`} className={`slot slot-gabarito ${gabaritoComp[i] ? `filled ${gabaritoComp[i]}` : 'empty-gabarito'}`} />
                    ))}
                  </div>
                </div>

              </div>
              {letter !== 'E' && (
                <div className="wip-flow-indicator">
                  <div className="wip-triangle"><span className="wip-value">{prod.wips[specs[`station_${letter}`].nextWip]}</span></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Game;