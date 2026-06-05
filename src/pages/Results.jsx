import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import './Results.css';

// MAPA DE CORES PADRÃO PARA AS LINHAS DOS COMPETIDORES
const CONSULTING_COLORS = [
  "#3498db", // Azul Técnico (Sua Sala ativa ganha destaque automático)
  "#2ecc71", // Verde Esmeralda (Competidor 1)
  "#9b59b6", // Roxo Real (Competidor 2)
  "#e67e22", // Laranja Alerta (Competidor 3)
  "#e74c3c", // Vermelho Crítico (Competidor 4)
  "#1abc9c", // Ciano (Competidor 5)
  "#95a5a6"  // Cinza (Reserva)
];

const Results = () => {
  const { currentRoom } = useGame();
  const [data, setData] = useState([]);
  const [comparativeData, setComparativeData] = useState([]); // Dados alinhados de todas as salas para multilinhas
  const [activeRooms, setActiveRooms] = useState([]); // Array com os IDs de todas as salas ativas
  const [kpis, setKpis] = useState({ totalTime: 0, avgWip: 0, financialImpact: 0 , completionRate: 0, finalWip: 0});
  const [globalRank, setGlobalRank] = useState([]);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Função para retornar a cor da linha com base no ID da sala
  const getRoomColor = (roomId, index) => {
    if (roomId === (currentRoom || "sala_01")) return "#3498db"; // Sua sala sempre ganha destaque em azul
    return CONSULTING_COLORS[(index + 1) % CONSULTING_COLORS.length];
  };

  useEffect(() => {
    // Buscamos o nó de salas COMPLETO para comparar todas as fábricas ativas
    const roomsRef = ref(db, 'rooms');

    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const allRooms = snapshot.val();
      if (!allRooms) return;

      const roomID = currentRoom || "sala_01"; 
      const localRoom = allRooms[roomID];

      // ==========================================
      // PROCESSAMENTO DE DADOS LOCAIS 
      // ==========================================
      if (localRoom && localRoom.history) {
        const historyArray = Object.entries(localRoom.history)
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
          if (i18n.language === 'en') {
            formattedFinancial = finalFinancialValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          } else if (i18n.language === 'es') {
            formattedFinancial = finalFinancialValue.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
          }

          setKpis({
            totalTime: Number(totalTime).toFixed(1),
            avgWip: Number(avgWip).toFixed(2),
            financialImpact: formattedFinancial,
            completionRate: percentage.toFixed(0),
            finalWip: finalWip
          });
        }
      }

      // ==========================================
      // PROCESSAMENTO COMPARATIVO GLOBAL (Todas as Salas)
      // ==========================================
      const roomsListData = [];
      const processedRoomsHistories = {};

      Object.entries(allRooms).forEach(([id, roomVal]) => {
        if (roomVal.history) {
          const hist = Object.entries(roomVal.history)
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
              finished: roomVal.production?.finished_total || 0,
              avgWip: (hist.reduce((acc, h) => acc + h.wip, 0) / hist.length).toFixed(2)
            });
          }
        }
      });

      // Ordena o ranking de forma balanceada: maior progresso de meta primeiro, menor lead time depois
      roomsListData.sort((a, b) => {
        if (b.finished !== a.finished) return b.finished - a.finished;
        return Number(a.time) - Number(b.time);
      });
      setGlobalRank(roomsListData);

      // ==========================================
      // ALINHAMENTO DINÂMICO DE TIMELINE MULTISSALAS
      // ==========================================
      const roomIdsWithHistory = Object.keys(processedRoomsHistories);
      setActiveRooms(roomIdsWithHistory);

      if (roomIdsWithHistory.length > 0) {
        // Encontra o maior tempo decorrido total para criar o teto do eixo X
        const maxSecs = Math.min(1200, Math.max(...Object.values(processedRoomsHistories).map(h => h[h.length - 1].elapsed || 0)));

        // Define a amostragem dinâmica (step) para o gráfico não engasgar se a partida durou muito
        let step = 1;
        if (maxSecs > 600) step = 15;
        else if (maxSecs > 300) step = 5;
        else if (maxSecs > 100) step = 2;

        const alignedTimeline = [];

        for (let sec = 0; sec <= maxSecs; sec += step) {
          const secondNode = {
            time: sec,
            timeLabel: `${sec}s`
          };

          roomIdsWithHistory.forEach(rId => {
            const rHist = processedRoomsHistories[rId];
            
            // Busca o último evento registrado naquela sala até o segundo atual (Forward Fill)
            let lastEntry = rHist[0];
            for (let entry of rHist) {
              if (entry.elapsed <= sec) {
                lastEntry = entry;
              } else {
                break;
              }
            }
            // Guarda as métricas associadas para alimentar as retas do Recharts
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

  const resetGame = () => {
    navigate('/');
  };

  return (
    <div className="results-container">
      <header className="results-header">
        <h1>{t('results.header_title')}</h1>
        <p>{t('results.room_label')} {currentRoom?.toUpperCase()}</p>
      </header>

      {/* 1. SEÇÃO DE INDICADORES LOCAIS (Sua Sala) */}
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

      {/* 2. GRÁFICOS INDIVIDUAIS DA SALA ATUAL */}
      <div className="charts-section">
        <div className="chart-box">
          <h2>{t('results.charts.s_curve_title')}</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" label={{ value: t('results.charts.time_axis'), position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: t('results.charts.units_axis'), angle: -90, position: 'insideLeft' }} />
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

      {/* SEÇÃO DE BENCHMARKING GLOBAL (Gráficos Comparativos Multissalas e Tabela de Pódios) */}
      <section className="ranking-section">
        <h2>{t('results.ranking.title')}</h2>
        
        {/* GRÁFICOS MULTILINHAS ADICIONADOS PARA COMPARAÇÃO DIRETA */}
        <div className="charts-section comparative-charts" style={{ marginTop: '20px', marginBottom: '30px' }}>
          
          {/* Comparativo de Velocidade (Curva S) */}
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
                      key={rId} 
                      type="monotone" 
                      dataKey={`${rId}_count`} 
                      name={rId.replace('_', ' ').toUpperCase()} 
                      stroke={getRoomColor(rId, idx)} 
                      strokeWidth={rId === (currentRoom || "sala_01") ? 4 : 1.5} // Destaca a sua sala em negrito
                      dot={false} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparativo de Inchaço Financeiro no WIP */}
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
                      key={rId} 
                      type="monotone" 
                      dataKey={`${rId}_wipVal`} 
                      name={rId.replace('_', ' ').toUpperCase()} 
                      stroke={getRoomColor(rId, idx)} 
                      strokeWidth={rId === (currentRoom || "sala_01") ? 4 : 1.5} // Destaca a sua sala em negrito
                      dot={false} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Tabela Comparativa de Performance */}
        <table className="ranking-table">
          <thead>
            <tr>
              <th>{t('results.ranking.th_position')}</th>
              <th>{t('results.ranking.th_room')}</th>
              <th> {t('results.ranking.goal')}</th>
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

      <div className="results-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center' }}>
        <button className="restart-btn" style={{ backgroundColor: '#3498db' }} onClick={() => navigate('/game')}>
          {t('results.actions.btn_back_factory')}
        </button>

        <button className="restart-btn" onClick={resetGame}>
          {t('results.actions.btn_new_game')}
        </button>
      </div>
            
    </div>
  );
};

export default Results;
