import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Game.css';

// 1. DEFINIÇÃO ESTÁTICA DOS PREÇOS DAS CAIXINHAS
const ITEM_PRICES = { A: 1, B: 2, C: 3, D: 4, E: 5 };

// 2. CUSTO ACUMULADO UNITÁRIO DE CADA ESTÁGIO DO WIP
const WIP_STAGE_PRICES = {
  ab: ITEM_PRICES.A,                                                        // $1
  bc: ITEM_PRICES.A + (3 * ITEM_PRICES.B),                                  // $7
  cd: ITEM_PRICES.A + (3 * ITEM_PRICES.B) + ITEM_PRICES.C,                  // $10
  de: ITEM_PRICES.A + (3 * ITEM_PRICES.B) + ITEM_PRICES.C + (2 * ITEM_PRICES.D) // $18
};

const Game = () => {
  const { currentRoom, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const colors = { A: "blue-A", B: "green-B", C: "red-C", D: "grey-D", E: "purple-E" };
  const META_PRODUCAO = 100;

  const specs = {
    station_A: { stockNeeded: 1, wipNeeded: 0, nextWip: 'ab' },
    station_B: { stockNeeded: 3, wipNeeded: 1, nextWip: 'bc', prevWip: 'ab' },
    station_C: { stockNeeded: 1, wipNeeded: 1, nextWip: 'cd', prevWip: 'bc' },
    station_D: { stockNeeded: 2, wipNeeded: 1, nextWip: 'de', prevWip: 'cd' },
    station_E: { stockNeeded: 2, wipNeeded: 1, nextWip: 'finish', prevWip: 'de' }
  };

  // Função auxiliar para formatar dinheiro em tempo real com base no idioma
  const formatCurrency = (value) => {
    if (i18n.language === 'en') {
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    } else if (i18n.language === 'es') {
      return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  useEffect(() => {
    if (roomData?.production?.finished_total >= META_PRODUCAO) {
      navigate('/results');
    }
  }, [roomData?.production?.finished_total, navigate]);

  if (!roomData) return <div className="loading">{t('game.loading')}</div>;
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

  // CÁLCULO DO VALOR FINANCEIRO REAL TOTAL DO WIP FLUTUANTE
  const totalWipValue = 
    ((prod.wips?.ab || 0) * WIP_STAGE_PRICES.ab) +
    ((prod.wips?.bc || 0) * WIP_STAGE_PRICES.bc) +
    ((prod.wips?.cd || 0) * WIP_STAGE_PRICES.cd) +
    ((prod.wips?.de || 0) * WIP_STAGE_PRICES.de);

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

          // CALCULANDO VALOR DO WIP DINAMICAMENTE PARA SALVAR NO HISTÓRICO
          const ab = current.wips.ab || 0;
          const bc = current.wips.bc || 0;
          const cd = current.wips.cd || 0;
          const de = current.wips.de || 0;
          const snapshotWipValue = (ab * WIP_STAGE_PRICES.ab) + (bc * WIP_STAGE_PRICES.bc) + (cd * WIP_STAGE_PRICES.cd) + (de * WIP_STAGE_PRICES.de);

          const snapshot = {
            count: current.finished_total,
            wip_total: ab + bc + cd + de,
            wip_value: snapshotWipValue, // <--- ADICIONADO: Histórico agora monitora valor em dinheiro!
            timestamp: Date.now()
          };

          const historyRef = ref(db, `rooms/${currentRoom}/history/${snapshot.timestamp}`);
          import('firebase/database').then(({ set }) => { set(historyRef, snapshot); });
        } else {
          current.wips[mySpec.nextWip]++;
        }

        current.workAreas[sLetter] = { stockItems: 0, wipItems: 0 };
      }

      return current;
    });
  };

  return (
    <div className="game-screen">
      <div className="game-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px'}}>
        <div className="production-progress">
          <strong>{t('game.progress')}</strong> {prod.finished_total} / {META_PRODUCAO}
          <span style={{ marginLeft: '25px', color: '#e67e22', fontWeight: 'bold' }}>
            {t('game.wip_cost')} {formatCurrency(totalWipValue)}
          </span>
        </div>
        <button onClick={() => navigate('/results')} style={{ backgroundColor: '#f39c12', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
          {t('game.btn_force_end')}
        </button>
      </div>

      <div className="factory-floor">
        {['A', 'B', 'C', 'D', 'E'].map((letter) => {
          const isMe = myStation === `station_${letter}`;
          const work = prod.workAreas[letter];
          const composition = getComposition(letter, work);
          const isFull = composition.length === (specs[`station_${letter}`].stockNeeded + (letter === 'A' ? 0 : (letter === 'B' ? 1 : (letter === 'C' ? 4 : (letter === 'D' ? 5 : 7)))));
          const gabaritoComp = getGabaritoComposition(letter);

          // CÁLCULO EM TEMPO REAL DO CUSTO NA MESA DA ESTAÇÃO ATUAL
          const costOnBench = composition.reduce((acc, currentClass) => {
            const itemLetter = currentClass.split('-')[1]; // Extrai a letra da classe (ex: 'blue-A' vira 'A')
            return acc + (ITEM_PRICES[itemLetter] || 0);
          }, 0);

          return (
            <React.Fragment key={letter}>
              <div className={`station-card ${isMe ? 'is-me' : ''}`}>
                <div className="station-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('game.station_label')} {letter}</span>
                  {/* EXIBIÇÃO DO CUSTO NA MESA */}
                  <span style={{ color: '#2ecc71', fontSize: '0.85em' }}>
                    {t('game.bench_cost')} {formatCurrency(costOnBench)}
                  </span>
                </div>
                
                <div className="work-bench">
                  <div className={`cube-grid ${letter === 'E' ? 'final-container' : ''}`}>
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className={`slot ${composition[i] ? `filled ${composition[i]}` : 'empty'}`} />
                    ))}
                  </div>
                </div>
                
                <div className="station-controls">
                  <button disabled={!isMe || work.stockItems >= specs[`station_${letter}`].stockNeeded || prod.stocks[letter] <= 0} onClick={() => handleAction('STOCK')}>
                    {t('game.btn_stock')}
                  </button>
                  {letter !== 'A' && (
                    <button disabled={!isMe || work.wipItems > 0 || prod.wips[specs[`station_${letter}`].prevWip] <= 0} onClick={() => handleAction('WIP')}>
                      {t('game.btn_wip')}
                    </button>
                  )}
                  <button className="btn-send" disabled={!isMe || !isFull} onClick={() => handleAction('SEND')}>
                    {t('game.btn_send')}
                  </button>
                </div>
                
                <div className="reference-gabarito">
                  <div className="gabarito-title">{t('game.gabarito_title')}</div>
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