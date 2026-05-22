import React, { useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import './Results.css';

const Results = () => {
  const { currentRoom } = useGame();
  const [data, setData] = useState([]);
  const [kpis, setKpis] = useState({ totalTime: 0, avgWip: 0, financialImpact: 0 , completionRate: 0});
  const [globalRank, setGlobalRank] = useState([]);
  const navigate = useNavigate();

  
    useEffect(() => {
    if (!currentRoom) {
      // Se quiser testar sem ser expulso, comente o navigate abaixo temporariamente
      // navigate('/'); 
      // return;
    }

    const roomID = currentRoom || "sala_01"; // Para testes manuais
    const roomRef = ref(db, `rooms/${roomID}`);

    const unsubscribe = onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (roomData && roomData.history) {
        // Transforma o objeto de histórico em Array para o Recharts
        // Transforma o objeto de histórico em Array com TRAVAS DE SEGURANÇA
        const historyArray = Object.entries(roomData.history)
          .map(([key, val]) => ({
            // Tenta pegar o timestamp, se falhar ou for texto, usa o número da chave ou data atual
            timestamp: Number(val.timestamp) || parseInt(key) || Date.now(),
            count: Number(val.count) || 0,
            wip: Number(val.wip_total) || 0 // Se vier vazio, vira 0, evitando o NaN
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        if (historyArray.length > 0) {
          const startTime = historyArray[0].timestamp;
          
          const formattedData = historyArray.map(item => ({
            ...item,
            // Garante que o tempo nunca seja negativo ou dê erro matemático
            timeLabel: `${Math.max(0, Math.floor((item.timestamp - startTime) / 1000))}s`
          }));

          setData(formattedData);

          // Cálculos de KPI protegidos contra NaN
          const lastTime = historyArray[historyArray.length - 1].timestamp;
          // Se lastTime for igual a startTime (só 1 registro), o tempo é 0
          const totalTime = Math.max(0, (lastTime - startTime) / 1000); 
          
          const sumWip = historyArray.reduce((acc, item) => acc + item.wip, 0);
          const avgWip = sumWip / historyArray.length;
          const financialImpact = sumWip * 10;

          const lastCount = historyArray[historyArray.length - 1].count; // Pega o último produto feito
          const percentage = (lastCount / 100) * 100; // Calcula a porcentagem em relação à meta de 100

          // setKpis com formatação garantida
          setKpis({
            totalTime: Number(totalTime).toFixed(1),
            avgWip: Number(avgWip).toFixed(2),
            financialImpact: financialImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            completionRate: percentage.toFixed(0)
          });
        }
      }
    });

    return () => unsubscribe();
  }, [currentRoom]);

  const resetGame = () => {
    // Lógica para voltar ao início (ou limpar a sala se for líder)
    navigate('/');
  };

  return (
    <div className="results-container">
      <header className="results-header">
        <h1>Relatório de Performance Industrial</h1>
        <p>Sala: {currentRoom?.toUpperCase()}</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>Lead Time Total</h3>
          <p className="value">{kpis.totalTime}s</p>
          <span className="label">Tempo de ciclo</span>
        </div>
        
        <div className="kpi-card highlight">
          <h3>Impacto Financeiro WIP</h3>
          <p className="value">{kpis.financialImpact}</p>
          <span className="label">Custo de Inventário Parado</span>
        </div>
        <div className="kpi-card">
          <h3>Média de WIP</h3>
          <p className="value">{kpis.avgWip}</p>
          <span className="label">Itens em espera</span>
        </div>
        <div className="kpi-card highlight-blue">
          <h3>Porcentagem</h3>
          <p className="value">{kpis.completionRate}%</p>
          <span className="label">Da Demanda Entregue</span>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-box">
          <h2>Curva S de Produção (Acumulado)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" label={{ value: 'Tempo', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Unidades', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" name="Produtos Acabados" stroke="#00b894" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-box">
          <h2>Acúmulo de Estoque (WIP)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="wip" name="Itens no WIP" stroke="#f39c12" fill="#f39c12" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section className="ranking-section">
        <h2>Benchmarking Global (Top Salas)</h2>
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Posição</th>
              <th>ID da Sala</th>
              <th>Lead Time Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {globalRank.map((room, index) => (
              <tr key={room.id} className={room.id === currentRoom ? 'my-room-row' : ''}>
                <td>{index + 1}º</td>
                <td>{room.id}</td>
                <td>{room.time}s</td>
                <td>{room.id === currentRoom ? 'Sua Performance' : 'Finalizado'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="results-actions" style={{ display: 'flex', gap: '15px', marginTop: '20px', justifyContent: 'center' }}>
        
        {/* BOTÃO NOVO: Voltar para o jogo */}
        <button 
          className="restart-btn" 
          onClick={() => navigate('/game')}
                >
         Voltar para a Fábrica
        </button>

        {/* Seu botão antigo de Nova Partida */}
        <button className="restart-btn" onClick={resetGame}>
          Nova Partida
        </button>
      </div>
            
    </div>
  );
};

export default Results;