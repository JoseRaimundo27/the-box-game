import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue, update } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import './Results.css';

const CONSULTING_COLORS = [
  "#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#e74c3c", "#1abc9c", "#95a5a6"
];

const Results = () => {
  const { currentRoom } = useGame();
  const [data, setData] = useState([]);
  const [comparativeData, setComparativeData] = useState([]); 
  const [activeRooms, setActiveRooms] = useState([]); 
  const [kpis, setKpis] = useState({ totalTime: 0, avgWip: 0, financialImpact: 0 , completionRate: 0, finalWip: 0});
  const [globalRank, setGlobalRank] = useState([]);
  
  // NOVOS ESTADOS PARA O SISTEMA DE ROUNDS
  const [currentRound, setCurrentRound] = useState(1);
  const [evolutionData, setEvolutionData] = useState([]); // Guarda a evolução da sala nos 3 rounds

  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const getRoomColor = (roomId, index) => {
    if (roomId === (currentRoom || "sala_01")) return "#3498db"; 
    return CONSULTING_COLORS[(index + 1) % CONSULTING_COLORS.length];
  };

  useEffect(() => {
    const roomsRef = ref(db, 'rooms');

    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const allRooms = snapshot.val();
      if (!allRooms) return;

      const roomID = currentRoom || "sala_01"; 
      const localRoom = allRooms[roomID];
      
      // Captura o round ativo da sala
      const activeRound = localRoom?.metadata?.currentRound || 1;
      setCurrentRound(activeRound);

      // ==========================================
      // PROCESSAMENTO DE EVOLUÇÃO DOS ROUNDS (Histórico da Sala Atual)
      // ==========================================
      const evData = [];
      for (let i = 1; i <= 3; i++) {
        const roundHistory = localRoom?.rounds?.[i]?.history;
        if (roundHistory) {
          const histArr = Object.entries(roundHistory)
            .map(([k, v]) => ({ timestamp: Number(v.timestamp), wip: Number(v.wip_total) }))
            .sort((a, b) => a.timestamp - b.timestamp);

          if (histArr.length > 0) {
            const start = histArr[0].timestamp;
            const last = histArr[histArr.length - 1].timestamp;
            const leadTime = Math.max(0, (last - start) / 1000);
            const avgWip = histArr.reduce((acc, h) => acc + h.wip, 0) / histArr.length;
            
            evData.push({
              roundName: `Round ${i}`,
              leadTime: Number(leadTime.toFixed(1)),
              avgWip: Number(avgWip.toFixed(2))
            });
          }
        }
      }
      setEvolutionData(evData);

      // ==========================================
      // PROCESSAMENTO DE DADOS LOCAIS DO ROUND ATUAL
      // ==========================================
      const currentHistoryObj = localRoom?.rounds?.[activeRound]?.history;
      
      if (currentHistoryObj) {
        const historyArray = Object.entries(currentHistoryObj)
          .map(([key, val]) => ({
            timestamp: Number(val.timestamp) || parseInt(key) || Date.now(),
            count: Number(val.count) || 0,
            wip: Number(val.wip_total) || 0,
            wipPriceValue: Number(val.wip_value) || 0 
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        if (historyArray.length > 0) {
          const startTime = historyArray[0].timestamp;
          
          const formattedData = historyArray.map(item => ({
            ...item,
            timeLabel: `${Math.max(0, Math.floor((item.timestamp - startTime) / 1000))}s`
          }));

          setData(formattedData);

          const lastTime = historyArray[historyArray.length - 1].timestamp;
          const totalTime = Math.max(0, (lastTime - startTime) / 1000); 
          
          const sumWip = historyArray.reduce((acc, item) => acc + item.wip, 0);
          const avgWip = sumWip / historyArray.length;
          
          const finalFinancialValue = historyArray[historyArray.length - 1].wipPriceValue;
          const lastCount = historyArray[historyArray.length - 1].count; 
          const percentage = (lastCount / 100) * 100; 
          const finalWip = historyArray[historyArray.length - 1].wip;

          let formattedFinancial = finalFinancialValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          if (i18n.language === 'en') formattedFinancial = finalFinancialValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          else if (i18n.language === 'es') formattedFinancial = finalFinancialValue.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

          setKpis({
            totalTime: Number(totalTime).toFixed(1),
            avgWip: Number(avgWip).toFixed(2),
            financialImpact: formattedFinancial,
            completionRate: percentage.toFixed(0),
            finalWip: finalWip
          });
        } else {
            setData([]); // Reseta se não houver dados no round
        }
      }

      // ==========================================
      // PROCESSAMENTO COMPARATIVO GLOBAL (No Round Atual)
      // ==========================================
      const roomsListData = [];
      const processedRoomsHistories = {};

      Object.entries(allRooms).forEach(([id, roomVal]) => {
        // Busca apenas o histórico do round que está sendo jogado
        const rHistory = roomVal?.rounds?.[activeRound]?.history;
        const rProduction = roomVal?.rounds?.[activeRound]?.production;

        if (rHistory) {
          const hist = Object.entries(rHistory)
            .map(([key, val]) => ({
              timestamp: Number(val.timestamp) || parseInt(key) || Date.now(),
              count: Number(val.count) || 0,
              wip: Number(val.wip_total) || 0,
              wipPriceValue: Number(val.wip_value) || 0
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          if (hist.length > 0) {
            const start = hist[0].timestamp;
            processedRoomsHistories[id] = hist.map(item => ({
              ...item,
              elapsed: Math.max(0, Math.floor((item.timestamp - start) / 1000))
            }));

            const finalTime = Math.max(0, (hist[hist.length - 1].timestamp - start) / 1000);
            roomsListData.push({
              id: id,
              time: Number(finalTime).toFixed(1),
              finished: rProduction?.finished_total || 0,
              avgWip: (hist.reduce((acc, h) => acc + h.wip, 0) / hist.length).toFixed(2)
            });
          }
        }
      });

      roomsListData.sort((a, b) => {
        if (b.finished !== a.finished) return b.finished - a.finished;
        return Number(a.time) - Number(b.time);
      });
      setGlobalRank(roomsListData);

      // ALINHAMENTO DINÂMICO DE TIMELINE MULTISSALAS
      const roomIdsWithHistory = Object.keys(processedRoomsHistories);
      setActiveRooms(roomIdsWithHistory);

      if (roomIdsWithHistory.length > 0) {
        const maxSecs = Math.min(1200, Math.max(...Object.values(processedRoomsHistories).map(h => h[h.length - 1].elapsed || 0)));
        let step = 1;
        if (maxSecs > 600) step = 15;
        else if (maxSecs > 300) step = 5;
        else if (maxSecs > 100) step = 2;

        const alignedTimeline = [];
        for (let sec = 0; sec <= maxSecs; sec += step) {
          const secondNode = { time: sec, timeLabel: `${sec}s` };
          roomIdsWithHistory.forEach(rId => {
            const rHist = processedRoomsHistories[rId];
            let lastEntry = rHist[0];
            for (let entry of rHist) {
              if (entry.elapsed <= sec) lastEntry = entry;
              else break;
            }
            secondNode[`${rId}_count`] = lastEntry.count;
            secondNode[`${rId}_wipVal`] = lastEntry.wipPriceValue;
          });
          alignedTimeline.push(secondNode);
        }
        setComparativeData(alignedTimeline);
      }
    });

    return () => unsubscribe();
  }, [currentRoom, i18n.language]);

  // FUNÇÃO PARA AVANÇAR DE ROUND
  const handleNextRound = () => {
    if (currentRound < 3) {
      const roomID = currentRoom || "sala_01";
      const metaRef = ref(db, `rooms/${roomID}/metadata`);
      update(metaRef, { currentRound: currentRound + 1 }).then(() => {
        navigate('/game');
      });
    } else {
      navigate('/');
    }
  };

  return (
    <div className="results-container">
      <header className="results-header">
        <h1>{t('results.header_title')} (Round {currentRound})</h1>
        <p>{t('results.room_label')} {currentRoom?.toUpperCase()}</p>
      </header>

      {/* SEÇÃO DE INDICADORES LOCAIS */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>{t('results.kpis.lead_time')}</h3>
          <p className="value">{kpis.totalTime}s</p>
          <span className="label">{t('results.kpis.lead_time_sub')}</span>
        </div>
        <div className="kpi-card">
          <h3>{t('results.kpis.wip_total')}</h3>
          <p className="value">{kpis.finalWip} un</p>
          <span className="label">{t('results.kpis.wip_total_sub')}</span>
        </div>
        <div className="kpi-card highlight">
          <h3>{t('results.kpis.financial')}</h3>
          <p className="value">{kpis.financialImpact}</p>
          <span className="label">{t('results.kpis.financial_sub')}</span>
        </div>
        <div className="kpi-card">
          <h3>{t('results.kpis.avg_wip')}</h3>
          <p className="value">{kpis.avgWip}</p>
          <span className="label">{t('results.kpis.avg_wip_sub')}</span>
        </div>
        <div className="kpi-card highlight-blue">
          <h3>{t('results.kpis.percentage')}</h3>
          <p className="value">{kpis.completionRate}%</p>
          <span className="label">{t('results.kpis.percentage_sub')}</span>
        </div>
      </div>

      {/* NOVA SEÇÃO: EVOLUÇÃO DOS ROUNDS DA SALA */}
      {evolutionData.length > 0 && (
        <section className="ranking-section" style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '10px', marginTop: '30px' }}>
          <h2>{t('results.evolution_title', '🚀 Evolução da Sua Fábrica (Turno a Turno)')}</h2>
          <div className="charts-section comparative-charts" style={{ marginTop: '20px' }}>
            
            <div className="chart-box">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
                {t('results.evolution.lead_time', 'Evolução do Lead Time (segundos)')}
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="roundName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="leadTime" name="Lead Time (s)" fill="#3498db" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-box">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
                {t('results.evolution.avg_wip', 'Redução do WIP Médio')}
              </h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="roundName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgWip" name="WIP Médio (unidades)" fill="#e74c3c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </section>
      )}

      {/* GRÁFICOS INDIVIDUAIS DA SALA NO ROUND ATUAL */}
      <div className="charts-section">
        <div className="chart-box">
          <h2>{t('results.charts.s_curve_title')}</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" name={t('results.charts.finished_products')} stroke="#3498db" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-box">
          <h2>{t('results.charts.wip_title')}</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
             <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="wipPriceValue" name={t('results.charts.wip_value_legend')} fill="#e74c3c" />
             </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE BENCHMARKING GLOBAL (Round Atual) */}
      <section className="ranking-section">
        <h2>{t('results.ranking.title')} (Round {currentRound})</h2>
        
        <div className="charts-section comparative-charts" style={{ marginTop: '20px', marginBottom: '30px' }}>
          <div className="chart-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
              {t('results.comparative.s_curve_title')}
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={comparativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {activeRooms.map((rId, idx) => (
                    <Line 
                      key={rId} type="monotone" dataKey={`${rId}_count`} name={rId.replace('_', ' ').toUpperCase()} 
                      stroke={getRoomColor(rId, idx)} strokeWidth={rId === (currentRoom || "sala_01") ? 4 : 1.5} dot={false} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
              {t('results.comparative.wip_cost_title')}
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={comparativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeLabel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {activeRooms.map((rId, idx) => (
                    <Line 
                      key={rId} type="monotone" dataKey={`${rId}_wipVal`} name={rId.replace('_', ' ').toUpperCase()} 
                      stroke={getRoomColor(rId, idx)} strokeWidth={rId === (currentRoom || "sala_01") ? 4 : 1.5} dot={false} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <table className="ranking-table">
          <thead>
            <tr>
              <th>{t('results.ranking.th_position')}</th>
              <th>{t('results.ranking.th_room')}</th>
              <th>{t('results.ranking.goal')}</th>
              <th>{t('results.ranking.th_lead_time')}</th>
              <th>{t('results.ranking.avarage_wip')}</th>
            </tr>
          </thead>
          <tbody>
            {globalRank.map((room, index) => (
              <tr key={room.id} className={room.id === currentRoom ? 'my-room-row' : ''}>
                <td>{index + 1}º</td>
                <td>{room.id.replace('_', ' ').toUpperCase()}</td>
                <td>{room.finished} / 100</td>
                <td>{room.time}s</td>
                <td>{room.avgWip} un</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* BOTÕES DE AÇÃO: AVANÇAR OU FINALIZAR */}
      <div className="results-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center' }}>
        {currentRound < 3 ? (
          <button className="restart-btn" style={{ backgroundColor: '#2ecc71', fontSize: '1.1rem' }} onClick={handleNextRound}>
            {t('results.actions.next_round', `Iniciar Round ${currentRound + 1}`)} ➔
          </button>
        ) : (
          <button className="restart-btn" style={{ backgroundColor: '#e74c3c', fontSize: '1.1rem' }} onClick={handleNextRound}>
            {t('results.actions.finish_simulation', 'Finalizar Simulação')}
          </button>
        )}

        <button className="restart-btn" style={{ backgroundColor: '#95a5a6' }} onClick={() => navigate('/')}>
          {t('results.actions.btn_new_game', 'Sair para o Menu')}
        </button>
      </div>
            
    </div>
  );
};

export default Results;