import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // <--- IMPORTANTE: Importando o hook de tradução
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import './Results.css';

const Results = () => {
  const { currentRoom } = useGame();
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState({ totalTime: 0, avgWip: 0, financialImpact: 0 , completionRate: 0, finalWip: 0});
  const [globalRank, setGlobalRank] = useState([]);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(); // <--- Habilitando a função t() e a instância i18n

  useEffect(() => {
    const roomID = currentRoom || "sala_01"; 
    const roomRef = ref(db, `rooms/${roomID}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (roomData && roomData.history) {
        const historyArray = Object.entries(roomData.history)
          .map(([key, val]) => ({
            timestamp: Number(val.timestamp) || parseInt(key) || Date.now(),
            count: Number(val.count) || 0,
            wip: Number(val.wip_total) || 0 
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
          const financialImpact = sumWip * 10;

          const lastCount = historyArray[historyArray.length - 1].count; 
          const percentage = (lastCount / 100) * 100; 

          const finalWip = historyArray[historyArray.length - 1].wip;

          // FORMATAÇÃO FINANCEIRA LOCALIZADA DINÂMICA
          let formattedFinancial = financialImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          if (i18n.language === 'en') {
            formattedFinancial = financialImpact.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
          } else if (i18n.language === 'es') {
            formattedFinancial = financialImpact.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });
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
    });

    return () => unsubscribe();
  }, [currentRoom, i18n.language]); // Adicionado i18n.language para recalcular a moeda na hora se mudar o idioma

  const resetGame = () => {
    navigate('/');
  };

  return (
    <div className="results-container">
      <header className="results-header">
        <h1>{t('results.header_title')}</h1>
        <p>{t('results.room_label')} {currentRoom?.toUpperCase()}</p>
      </header>

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
                <Line type="monotone" dataKey="count" name={t('results.charts.finished_products')} stroke="#00b894" strokeWidth={3} dot={false} />
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
                <Bar dataKey="wip" name={t('results.charts.wip_items')} fill="#f39c12" />
             </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="ranking-section">
        <h2>{t('results.ranking.title')}</h2>
        <table className="ranking-table">
          <thead>
            <tr>
              <th>{t('results.ranking.th_position')}</th>
              <th>{t('results.ranking.th_room')}</th>
              <th>{t('results.ranking.th_lead_time')}</th>
              <th>{t('results.ranking.th_status')}</th>
            </tr>
          </thead>
          <tbody>
            {globalRank.map((room, index) => (
              <tr key={room.id} className={room.id === currentRoom ? 'my-room-row' : ''}>
                <td>{index + 1}º</td>
                <td>{room.id}</td>
                <td>{room.time}s</td>
                <td>{room.id === currentRoom ? t('results.ranking.your_perf') : t('results.ranking.finished')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="results-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center' }}>
        <button className="restart-btn" onClick={() => navigate('/game')}>
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