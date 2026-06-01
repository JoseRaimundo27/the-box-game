import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, runTransaction } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Game.css';

const Game = () => {
  const { currentRoom, myStation } = useGame();
  const [roomData, setRoomData] = useState(null);
  const [localStartTime] = useState(Date.now()); // Sincronização de backup do timer
  const [timeLeft, setTimeLeft] = useState(null);
  
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const colors = { A: "blue-A", B: "green-B", C: "red-C", D: "grey-D", E: "purple-E" };

  // 1. CARREGAMENTO DINÂMICO DAS CONFIGURAÇÕES DA SALA (com fallback para valores padrão)
  const config = roomData?.config || {
    prices: { A: 1, B: 2, C: 3, D: 4, E: 5 },
    stockNeeded: { A: 1, B: 3, C: 1, D: 2, E: 2 },
    productionGoal: 100,
    timeLimit: 300
  };

  const ITEM_PRICES = config.prices;
  const META_PRODUCAO = config.productionGoal;

  // 2. REGRAS DA ESTAÇÃO AGORA SÃO DINÂMICAS
  const specs = {
    station_A: { stockNeeded: config.stockNeeded.A, wipNeeded: 0, nextWip: 'ab' },
    station_B: { stockNeeded: config.stockNeeded.B, wipNeeded: 1, nextWip: 'bc', prevWip: 'ab' },
    station_C: { stockNeeded: config.stockNeeded.C, wipNeeded: 1, nextWip: 'cd', prevWip: 'bc' },
    station_D: { stockNeeded: config.stockNeeded.D, wipNeeded: 1, nextWip: 'de', prevWip: 'cd' },
    station_E: { stockNeeded: config.stockNeeded.E, wipNeeded: 1, nextWip: 'finish', prevWip: 'de' }
  };

  // 3. CÁLCULO FINANCEIRO DINÂMICO DOS ESTÁGIOS DO WIP
  const WIP_STAGE_PRICES = {
    ab: (config.stockNeeded.A * ITEM_PRICES.A),
    bc: (config.stockNeeded.A * ITEM_PRICES.A) + (config.stockNeeded.B * ITEM_PRICES.B),
    cd: (config.stockNeeded.A * ITEM_PRICES.A) + (config.stockNeeded.B * ITEM_PRICES.B) + (config.stockNeeded.C * ITEM_PRICES.C),
    de: (config.stockNeeded.A * ITEM_PRICES.A) + (config.stockNeeded.B * ITEM_PRICES.B) + (config.stockNeeded.C * ITEM_PRICES.C) + (config.stockNeeded.D * ITEM_PRICES.D)
  };

  // Função auxiliar para formatação de moeda
  const formatCurrency = (value) => {
    if (i18n.language === 'en') return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    if (i18n.language === 'es') return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // 4. FUNÇÕES DINÂMICAS DE MONTAGEM DOS BLOCOS NA MESA
  // Verifica quais blocos de estações anteriores já compõem o WIP que chegou
  const buildWipBlocks = (stationLetter) => {
    let blocks = [];
    const order = ['A', 'B', 'C', 'D', 'E'];
    for (let l of order) {
      if (l === stationLetter) break;
      for (let i = 0; i < config.stockNeeded[l]; i++) blocks.push(colors[l]);
    }
    return blocks;
  };

  const getComposition = (letter, work) => {
    let comp = [];
    if (work.wipItems > 0) comp.push(...buildWipBlocks(letter));
    for (let i = 0; i < work.stockItems; i++) comp.push(colors[letter]);
    return comp;
  };

  const getGabaritoComposition = (letter) => {
    let comp = buildWipBlocks(letter);
    for (let i = 0; i < config.stockNeeded[letter]; i++) comp.push(colors[letter]);
    return comp;
  };

  // Conexão principal com o Firebase
  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => setRoomData(snapshot.val()));
    return () => unsubscribe();
  }, [currentRoom]);

  // Efeito de Encerramento por Meta ou por Tempo
  useEffect(() => {
    // 1. Checa se bateu a meta de produção configurada
    if (roomData?.production?.finished_total >= META_PRODUCAO) {
      navigate('/results');
      return;
    }

    // 2. Lógica do Timer (Contagem Regressiva)
    const limit = roomData?.config?.timeLimit || 0;
    if (limit > 0) {
      const start = roomData?.metadata?.startedAt || localStartTime;
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const remaining = limit - elapsed;
        
        if (remaining <= 0) {
          clearInterval(interval);
          navigate('/results'); // Força o fim quando o tempo zera!
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null); // Jogo de tempo infinito
    }
  }, [roomData?.production?.finished_total, roomData?.config?.timeLimit, roomData?.metadata?.startedAt, META_PRODUCAO, navigate, localStartTime]);

  if (!roomData) return <div className="loading">{t('game.loading')}</div>;
  const prod = roomData.production;

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

          // Grava no histórico de tempo usando o preço dinâmico do turno
          const ab = current.wips.ab || 0;
          const bc = current.wips.bc || 0;
          const cd = current.wips.cd || 0;
          const de = current.wips.de || 0;
          const snapshotWipValue = (ab * WIP_STAGE_PRICES.ab) + (bc * WIP_STAGE_PRICES.bc) + (cd * WIP_STAGE_PRICES.cd) + (de * WIP_STAGE_PRICES.de);

          const snapshot = {
            count: current.finished_total,
            wip_total: ab + bc + cd + de,
            wip_value: snapshotWipValue,
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
      <div className="game-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', backgroundColor: '#2c3e50', color: 'white' }}>
        <div className="production-progress">
          <strong>{t('game.progress')}</strong> {prod.finished_total} / {META_PRODUCAO}
          
          {/* TIMER REGRESSIVO */}
          {timeLeft !== null && (
            <span style={{ marginLeft: '25px', color: '#e74c3c', fontWeight: 'bold', fontSize: '1.1em' }}>
              ⏱️ {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}

          {/* EXIBIÇÃO DO CUSTO WIP */}
          <span style={{ marginLeft: '25px', color: '#f1c40f', fontWeight: 'bold' }}>
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
          const gabaritoComp = getGabaritoComposition(letter);
          
          // Lógica de "isFull" atualizada! Se baseia estritamente no tamanho do array de gabarito gerado
          const totalExpectedBlocks = gabaritoComp.length;
          const isFull = composition.length === totalExpectedBlocks;
          
          // Garante que o grid na UI não quebre se o Admin pedir mais de 9 blocos na mesma mesa
          const gridSlotsCount = Math.max(9, totalExpectedBlocks);

          // CÁLCULO DO CUSTO NA MESA DINÂMICO
          const costOnBench = composition.reduce((acc, currentClass) => {
            const itemLetter = currentClass.split('-')[1]; 
            return acc + (ITEM_PRICES[itemLetter] || 0);
          }, 0);

          return (
            <React.Fragment key={letter}>
              <div className={`station-card ${isMe ? 'is-me' : ''}`}>
                <div className="station-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t('game.station_label')} {letter}</span>
                  <span style={{ color: '#2ecc71', fontSize: '0.85em' }}>
                    {t('game.bench_cost')} {formatCurrency(costOnBench)}
                  </span>
                </div>
                
                <div className="work-bench">
                  <div className={`cube-grid ${letter === 'E' ? 'final-container' : ''}`}>
                    {[...Array(gridSlotsCount)].map((_, i) => (
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
                    {[...Array(gridSlotsCount)].map((_, i) => (
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