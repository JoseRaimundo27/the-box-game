import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useGame } from '../context/GameContext';
import './Game.css';

const Game = () => {
  const { currentRoom, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);

  const colors = { A: "blue-A", B: "green-B", C: "red-C", D: "grey-D", E: "purple-E" };

  const specs = {
    station_A: { stockNeeded: 1, wipNeeded: 0, nextWip: 'ab' },
    station_B: { stockNeeded: 3, wipNeeded: 1, nextWip: 'bc', prevWip: 'ab' },
    station_C: { stockNeeded: 1, wipNeeded: 1, nextWip: 'cd', prevWip: 'bc' },
    station_D: { stockNeeded: 2, wipNeeded: 1, nextWip: 'de', prevWip: 'cd' },
    station_E: { stockNeeded: 2, wipNeeded: 1, nextWip: 'finish', prevWip: 'de' }
  };

  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => setRoomData(snapshot.val()));
    return () => unsubscribe();
  }, [currentRoom]);

  if (!roomData) return <div className="loading">Carregando...</div>;
  const prod = roomData.production;

  // Monta o array visual baseado no seu requisito exato de herança
  const getComposition = (letter, work) => {
    let comp = [];
    const hasWip = work.wipItems > 0;

    if (letter === 'A') {
      if (work.stockItems > 0) comp.push(colors.A);
    } 
    else if (letter === 'B') {
      if (hasWip) comp.push(colors.A); // 1 de A
      for (let i = 0; i < work.stockItems; i++) comp.push(colors.B); // + 3 de B
    } 
    else if (letter === 'C') {
      if (hasWip) comp.push(colors.A, colors.B, colors.B, colors.B); // 4 do WIP
      if (work.stockItems > 0) comp.push(colors.C); // + 1 de C
    } 
    else if (letter === 'D') {
      if (hasWip) comp.push(colors.A, colors.B, colors.B, colors.B, colors.C); // 5 do WIP
      for (let i = 0; i < work.stockItems; i++) comp.push(colors.D); // + 2 de D
    } 
    else if (letter === 'E') {
      if (hasWip) comp.push(colors.A, colors.B, colors.B, colors.B, colors.C, colors.D, colors.D); // 7 do WIP
      for (let i = 0; i < work.stockItems; i++) comp.push(colors.E); // + 2 de E
    }
    return comp;
  };

  const handleAction = (type) => {
    const sLetter = myStation.split('_')[1];
    const mySpec = specs[myStation];
    runTransaction(ref(db, `rooms/${currentRoom}/production`), (current) => {
      if (!current) return current;
      if (type === 'STOCK' && current.workAreas[sLetter].stockItems < mySpec.stockNeeded) {
        current.stocks[sLetter]--;
        current.workAreas[sLetter].stockItems++;
      }
      if (type === 'WIP' && current.wips[mySpec.prevWip] > 0 && current.workAreas[sLetter].wipItems === 0) {
        current.wips[mySpec.prevWip]--;
        current.workAreas[sLetter].wipItems = 1;
      }
      if (type === 'SEND') {
        if (mySpec.nextWip === 'finish') current.finished_total++;
        else current.wips[mySpec.nextWip]++;
        current.workAreas[sLetter] = { stockItems: 0, wipItems: 0 };
      }
      return current;
    });
  };

  return (
    <div className="game-screen">
      <div className="factory-floor">
        {['A', 'B', 'C', 'D', 'E'].map((letter) => {
          const isMe = myStation === `station_${letter}`;
          const work = prod.workAreas[letter];
          const composition = getComposition(letter, work);
          const isFull = composition.length === (specs[`station_${letter}`].stockNeeded + (letter === 'A' ? 0 : (letter === 'B' ? 1 : (letter === 'C' ? 4 : (letter === 'D' ? 5 : 7)))));

          return (
            <React.Fragment key={letter}>
              <div className={`station-card ${isMe ? 'is-me' : ''}`}>
                <div className="station-label">Estação {letter}</div>
                <div className="work-bench">
                  {/* Container E tem a borda especial tracejada */}
                  <div className={`cube-grid ${letter === 'E' ? 'final-container' : ''}`}>
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className={`slot ${composition[i] ? `filled ${composition[i]}` : 'empty'}`} />
                    ))}
                  </div>
                </div>
                <div className="station-controls">
                  <button disabled={!isMe || work.stockItems >= specs[`station_${letter}`].stockNeeded || prod.stocks[letter] <= 0} onClick={() => handleAction('STOCK')}>Stock</button>
                  {letter !== 'A' && <button disabled={!isMe || work.wipItems > 0 || prod.wips[specs[`station_${letter}`].prevWip] <= 0} onClick={() => handleAction('WIP')}>WIP</button>}
                  <button className="btn-send" disabled={!isMe || !isFull} onClick={() => handleAction('SEND')}>Enviar</button>
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