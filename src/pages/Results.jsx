import React, { useEffect, useState } from "react";
import { db } from "../firebase/config";
import { ref, onValue, update } from "firebase/database";
import { useGame } from "../context/GameContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
  Cell,
} from "recharts";
import "./Results.css";

const CONSULTING_COLORS = [
  "#3498db",
  "#2ecc71",
  "#9b59b6",
  "#e67e22",
  "#e74c3c",
  "#1abc9c",
  "#95a5a6",
];

const Results = () => {
  const { currentRoom } = useGame();
  const [data, setData] = useState([]);
  const [comparativeData, setComparativeData] = useState([]);
  const [comparativeRoundsData, setComparativeRoundsData] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [kpis, setKpis] = useState({
    totalTime: 0,
    avgWip: 0,
    financialImpact: 0,
    completionRate: 0,
    finalWip: 0,
  });
  const [globalRank, setGlobalRank] = useState([]);

  // NOVOS ESTADOS PARA O SISTEMA DE ROUNDS
  const [currentRound, setCurrentRound] = useState(1);
  const [evolutionData, setEvolutionData] = useState([]); // Guarda a evolução da sala nos 3 rounds
  const [isRoundOver, setIsRoundOver] = useState(false); //para round

  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const getRoomColor = (roomId, index) => {
    if (roomId === (currentRoom || "sala_01")) return "#3498db";
    return CONSULTING_COLORS[(index + 1) % CONSULTING_COLORS.length];
  };

  useEffect(() => {
    const roomsRef = ref(db, "rooms");

    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const allRooms = snapshot.val();
      if (!allRooms) return;

      const roomID = currentRoom || "sala_01";
      const localRoom = allRooms[roomID];

      if (localRoom?.metadata?.status === "PLAYING") {
        navigate('/game');
        return; 
      }
      if (localRoom?.metadata?.status === "FINISHED") {
        navigate('/');
        return;
      }

      // Captura o round ativo da sala
      const activeRound = localRoom?.metadata?.currentRound || 1;
      setCurrentRound(activeRound);

      const roundAcabou = localRoom?.rounds?.[activeRound]?.isOver === true;
      setIsRoundOver(roundAcabou);

      // ==========================================
      // PROCESSAMENTO DE EVOLUÇÃO DOS ROUNDS (Histórico da Sala Atual)
      // ==========================================
      const evData = [];
      for (let i = 1; i <= 3; i++) {
        const roundHistory = localRoom?.rounds?.[i]?.history;
        if (roundHistory) {
          const histArr = Object.entries(roundHistory)
            .map(([k, v]) => ({
              timestamp: Number(v.timestamp),
              wip: Number(v.wip_total),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

          if (histArr.length > 0) {
            const start = histArr[0].timestamp;
            const last = histArr[histArr.length - 1].timestamp;
            const leadTime = Math.max(0, (last - start) / 1000);
            const avgWip =
              histArr.reduce((acc, h) => acc + h.wip, 0) / histArr.length;

            evData.push({
              roundName: `Round ${i}`,
              leadTime: Number(leadTime.toFixed(1)),
              avgWip: Number(avgWip.toFixed(2)),
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
            wipPriceValue: Number(val.wip_value) || 0,
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        if (historyArray.length > 0) {
          const startTime = historyArray[0].timestamp;

          const formattedData = historyArray.map((item) => ({
            ...item,
            timeLabel: `${Math.max(0, Math.floor((item.timestamp - startTime) / 1000))}s`,
          }));

          setData(formattedData);

          const lastTime = historyArray[historyArray.length - 1].timestamp;
          const totalTime = Math.max(0, (lastTime - startTime) / 1000);

          const sumWip = historyArray.reduce((acc, item) => acc + item.wip, 0);
          const avgWip = sumWip / historyArray.length;

          const finalFinancialValue =
            historyArray[historyArray.length - 1].wipPriceValue;
          const lastCount = historyArray[historyArray.length - 1].count;
          const percentage = (lastCount / 100) * 100;
          const finalWip = historyArray[historyArray.length - 1].wip;

          let formattedFinancial = finalFinancialValue.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          if (i18n.language === "en")
            formattedFinancial = finalFinancialValue.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            });
          else if (i18n.language === "es")
            formattedFinancial = finalFinancialValue.toLocaleString("es-CL", {
              style: "currency",
              currency: "CLP",
              minimumFractionDigits: 0,
            });

          setKpis({
            totalTime: Number(totalTime).toFixed(1),
            avgWip: Number(avgWip).toFixed(2),
            financialImpact: formattedFinancial,
            completionRate: percentage.toFixed(0),
            finalWip: finalWip,
          });
        } else {
          setData([]); // Reseta se não houver dados no round
        }
      }

     // ==========================================
      // PROCESSAMENTO COMPARATIVO GLOBAL (Todas as Salas & Todos os Rounds)
      // ==========================================
      const roomsListData = [];
      const processedRoomsHistories = {};
      
      // Estrutura base para o gráfico unificado de 3 Rounds
      const multiRoundData = [
        { roundName: "Round 1" },
        { roundName: "Round 2" },
        { roundName: "Round 3" }
      ];

      const allRoomIds = Object.keys(allRooms);
      setActiveRooms(allRoomIds); // Garante que todas as salas entrem na legenda

      Object.entries(allRooms).forEach(([id, roomVal]) => {
        const currentGoal = roomVal?.config?.productionGoal || 100;

        // 1. Loop para alimentar o gráfico histórico dos 3 Rounds
        for (let rNum = 1; rNum <= 3; rNum++) {
          const rHistory = roomVal?.rounds?.[rNum]?.history;
          const rProduction = roomVal?.rounds?.[rNum]?.production;

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
              const lastEntry = hist[hist.length - 1];
              const finalTime = Math.max(0, (lastEntry.timestamp - start) / 1000);
              const finishedTotal = rProduction?.finished_total || 0;

              // Injeta as métricas desta sala específica dentro do nó do Round correspondente
              multiRoundData[rNum - 1][`${id}_completionRate`] = Number(((finishedTotal / currentGoal) * 100).toFixed(0));
              multiRoundData[rNum - 1][`${id}_time`] = Number(finalTime.toFixed(1));
              multiRoundData[rNum - 1][`${id}_finalWip`] = Number(lastEntry.wip);
              multiRoundData[rNum - 1][`${id}_financialImpact`] = Number(lastEntry.wipPriceValue);
            }
          }
        }

        // 2. Coleta isolada do ROUND ATUAL (Apenas para a Tabela de Pódio e a Curva S de tempo real)
        const currentRoundHistory = roomVal?.rounds?.[activeRound]?.history;
        const currentRoundProduction = roomVal?.rounds?.[activeRound]?.production;

        if (currentRoundHistory) {
          const hist = Object.entries(currentRoundHistory)
            .map(([key, val]) => ({
              timestamp: Number(val.timestamp) || Date.now(),
              count: Number(val.count) || 0,
              wip: Number(val.wip_total) || 0
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
              finished: currentRoundProduction?.finished_total || 0,
              avgWip: (hist.reduce((acc, h) => acc + h.wip, 0) / hist.length).toFixed(2)
            });
          }
        }
      });

      // Salva o estado dos rounds cruzados
      setComparativeRoundsData(multiRoundData);

      // Ordena o ranking do pódio do round atual
      roomsListData.sort((a, b) => {
        if (b.finished !== a.finished) return b.finished - a.finished;
        return Number(a.time) - Number(b.time);
      });
      setGlobalRank(roomsListData);

      // ALINHAMENTO DINÂMICO DA TIMELINE (Para a Curva S do Round Atual)
      const roomIdsWithCurrentHistory = Object.keys(processedRoomsHistories);
      if (roomIdsWithCurrentHistory.length > 0) {
        const maxSecs = Math.min(1200, Math.max(...Object.values(processedRoomsHistories).map(h => h[h.length - 1].elapsed || 0)));
        let step = maxSecs > 600 ? 15 : maxSecs > 300 ? 5 : maxSecs > 100 ? 2 : 1;

        const alignedTimeline = [];
        for (let sec = 0; sec <= maxSecs; sec += step) {
          const secondNode = { time: sec, timeLabel: `${sec}s` };
          roomIdsWithCurrentHistory.forEach(rId => {
            const rHist = processedRoomsHistories[rId];
            let lastEntry = rHist[0];
            for (let entry of rHist) {
              if (entry.elapsed <= sec) lastEntry = entry;
              else break;
            }
            secondNode[`${rId}_count`] = lastEntry.count;
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
      
      // Atualiza o número do round E reseta a contagem de tempo inicial do novo round
      update(metaRef, { 
        currentRound: currentRound + 1,
        startedAt: Date.now() // Zera o relógio global para o Round 2 ou 3
      }).then(() => {
        navigate("/game");
      });
    } else {
      navigate("/");
    }
  };

  return (
    <div className="results-container">
      <header className="results-header">
        <h1>
          {t("results.header_title")} (Round {currentRound})
        </h1>
        <p>
          {t("results.room_label")} {currentRoom?.toUpperCase()}
        </p>
      </header>

      {/* SEÇÃO DE INDICADORES LOCAIS */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>{t("results.kpis.lead_time")}</h3>
          <p className="value">{kpis.totalTime}s</p>
          <span className="label">{t("results.kpis.lead_time_sub")}</span>
        </div>
        <div className="kpi-card">
          <h3>{t("results.kpis.wip_total")}</h3>
          <p className="value">{kpis.finalWip} un</p>
          <span className="label">{t("results.kpis.wip_total_sub")}</span>
        </div>
        <div className="kpi-card highlight">
          <h3>{t("results.kpis.financial")}</h3>
          <p className="value">{kpis.financialImpact}</p>
          <span className="label">{t("results.kpis.financial_sub")}</span>
        </div>

        <div className="kpi-card highlight-blue">
          <h3>{t("results.kpis.percentage")}</h3>
          <p className="value">{kpis.completionRate}%</p>
          <span className="label">{t("results.kpis.percentage_sub")}</span>
        </div>
      </div>

      {/* NOVA SEÇÃO: EVOLUÇÃO DOS ROUNDS DA SALA */}
      {evolutionData.length > 0 && (
        <section
          className="ranking-section"
          style={{
            backgroundColor: "#f9f9f9",
            padding: "20px",
            borderRadius: "10px",
            marginTop: "30px",
          }}
        >
          <h2>
            {t(
              "results.evolution_title",
              "🚀 Evolução da Sua Fábrica (Turno a Turno)",
            )}
          </h2>
          <div
            className="charts-section comparative-charts"
            style={{ marginTop: "20px" }}
          >
            <div className="chart-box">
              <h3
                style={{
                  fontSize: "1.2rem",
                  marginBottom: "15px",
                  color: "#2c3e50",
                  fontWeight: "bold",
                }}
              >
                {t(
                  "results.evolution.lead_time",
                  "Evolução do Lead Time (segundos)",
                )}
              </h3>
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="roundName" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="leadTime"
                      name="Lead Time (s)"
                      fill="#3498db"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-box">
              <h3
                style={{
                  fontSize: "1.2rem",
                  marginBottom: "15px",
                  color: "#2c3e50",
                  fontWeight: "bold",
                }}
              >
                {t("results.evolution.avg_wip", "Redução do WIP Médio")}
              </h3>
              <div style={{ width: "100%", height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="roundName" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="avgWip"
                      name="WIP Médio (unidades)"
                      fill="#e74c3c"
                    />
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
          <h2>{t("results.charts.s_curve_title")}</h2>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name={t("results.charts.finished_products")}
                  stroke="#3498db"
                  strokeWidth={3}
                  dot={false}
                />

                {/* ==========================================================
              LINHA VERTICAL VERMELHA (Delimitador do Fim do Jogo)
             ========================================================== */}
                {data.length > 0 && (
                  <ReferenceLine
                    x={data[data.length - 1].timeLabel}
                    stroke="#e74c3c"
                    strokeWidth={2}
                    strokeDasharray="4 4" // Deixa a linha pontilhada/tracejada para estilo "Dead Line"
                    label={{
                      value: "FIM",
                      position: "top",
                      fill: "#e74c3c",
                      fontWeight: "bold",
                      fontSize: "12px",
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SEÇÃO DE BENCHMARKING GLOBAL (Round Atual) */}
      <section className="ranking-section">
        <h2>
          {t("results.ranking.title")} (Round {currentRound})
        </h2>

        {/* SEÇÃO DE BENCHMARKING GLOBAL (Gráficos Comparativos Multissalas) */}
        <div
          className="charts-section comparative-charts"
          style={{
            marginTop: "20px",
            marginBottom: "30px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
            gap: "20px",
          }}
        >
          {/* 1. CURVA S ORIGINAL */}
          <div className="chart-box">
            <h3
              style={{
                fontSize: "1.2rem",
                marginBottom: "15px",
                color: "#2c3e50",
                fontWeight: "bold",
              }}
            >
              {t("results.comparative.s_curve_title")}
            </h3>
            <div style={{ width: "100%", height: 300 }}>
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
                      name={rId.replace("_", " ").toUpperCase()}
                      stroke={getRoomColor(rId, idx)}
                      strokeWidth={rId === (currentRoom || "sala_01") ? 4 : 1.5}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. COMPARATIVO DE MATURAÇÃO DA META (% DE PRODUÇÃO) */}
          <div className="chart-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
              🎯 {t('results.comparative.production_rate', 'Porcentagem de Conclusão da Meta')}
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={comparativeRoundsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="roundName" />
                  <YAxis unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend verticalAlign="bottom" height={36} />
                  {activeRooms.map((rId, idx) => (
                    <Bar 
                      key={rId} 
                      dataKey={`${rId}_completionRate`} 
                      name={rId.replace('_', ' ').toUpperCase()} 
                      fill={getRoomColor(rId, idx)} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. COMPARATIVO DE CYCLE TIME (LEAD TIME FINAL) */}
          <div className="chart-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
              ⏱️ {t('results.comparative.cycle_time', 'Tempo de Ciclo Total / Lead Time')}
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={comparativeRoundsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="roundName" />
                  <YAxis unit="s" />
                  <Tooltip formatter={(value) => `${value}s`} />
                  <Legend verticalAlign="bottom" height={36} />
                  {activeRooms.map((rId, idx) => (
                    <Bar 
                      key={rId} 
                      dataKey={`${rId}_time`} 
                      name={rId.replace('_', ' ').toUpperCase()} 
                      fill={getRoomColor(rId, idx)} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. COMPARATIVO DE WIP ACUMULADO NO FINAL */}
          <div className="chart-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
              📦 {t('results.comparative.final_wip', 'Volume de Estoque em Processo (WIP Final)')}
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={comparativeRoundsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="roundName" />
                  <YAxis unit=" un" />
                  <Tooltip formatter={(value) => `${value} un`} />
                  <Legend verticalAlign="bottom" height={36} />
                  {activeRooms.map((rId, idx) => (
                    <Bar 
                      key={rId} 
                      dataKey={`${rId}_finalWip`} 
                      name={rId.replace('_', ' ').toUpperCase()} 
                      fill={getRoomColor(rId, idx)} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. COMPARATIVO DE INFLAÇÃO/CUSTO FINANCEIRO DO WIP */}
          <div className="chart-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#2c3e50', fontWeight: 'bold' }}>
              💰 {t('results.comparative.wip_cost_title', 'Custo Financeiro Retido no WIP')}
            </h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={comparativeRoundsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="roundName" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString(i18n.language === 'en' ? 'en-US' : 'pt-BR', { style: 'currency', currency: i18n.language === 'en' ? 'USD' : 'BRL' })} />
                  <Legend verticalAlign="bottom" height={36} />
                  {activeRooms.map((rId, idx) => (
                    <Bar 
                      key={rId} 
                      dataKey={`${rId}_financialImpact`} 
                      name={rId.replace('_', ' ').toUpperCase()} 
                      fill={getRoomColor(rId, idx)} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <table className="ranking-table">
          <thead>
            <tr>
              <th>{t("results.ranking.th_position")}</th>
              <th>{t("results.ranking.th_room")}</th>
              <th>{t("results.ranking.goal")}</th>
              <th>{t("results.ranking.th_lead_time")}</th>
              <th>{t("results.ranking.avarage_wip")}</th>
            </tr>
          </thead>
          <tbody>
            {globalRank.map((room, index) => (
              <tr
                key={room.id}
                className={room.id === currentRoom ? "my-room-row" : ""}
              >
                <td>{index + 1}º</td>
                <td>{room.id.replace("_", " ").toUpperCase()}</td>
                <td>{room.finished} / 100</td>
                <td>{room.time}s</td>
                <td>{room.avgWip} un</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* BOTÕES DE AÇÃO: AVANÇAR OU FINALIZAR */}
      <div
        className="results-actions"
        style={{
          display: "flex",
          gap: "15px",
          marginTop: "20px",
          justifyContent: "center",
        }}
      >
        {currentRound < 3 ? (
          <button
            className="restart-btn"
            style={{ 
              backgroundColor: isRoundOver ? "#2ecc71" : "#bdc3c7", 
              fontSize: "1.1rem",
              cursor: isRoundOver ? "pointer" : "not-allowed"
            }}
            onClick={handleNextRound}
            disabled={!isRoundOver}
          >
            {isRoundOver 
              ? t("results.actions.next_round", `Iniciar Round ${currentRound + 1}`) + " ➔"
              : t("results.actions.waiting", "Aguardando fim do Round...")}
          </button>
        ) : (
          <button
            className="restart-btn"
            style={{ 
              backgroundColor: isRoundOver ? "#e74c3c" : "#bdc3c7", 
              fontSize: "1.1rem",
              cursor: isRoundOver ? "pointer" : "not-allowed"
            }}
            onClick={handleNextRound}
            disabled={!isRoundOver}
          >
            {isRoundOver
              ? t("results.actions.finish_simulation", "Finalizar Simulação")
              : t("results.actions.waiting", "Aguardando fim do Round...")}
          </button>
        )}

        {/* 🛠️ BOTÃO DE ESCAPE: Se o round está acontecendo, permite ir e voltar livremente sem loops */}
        {!isRoundOver && (
          <button
            className="restart-btn"
            style={{ backgroundColor: "#3498db", fontSize: "1.1rem" }}
            onClick={() => navigate("/game")}
          >
            Voltar para a Fábrica
          </button>
        )}

        <button
          className="restart-btn"
          style={{ backgroundColor: "#95a5a6" }}
          onClick={() => navigate("/")}
        >
          {t("results.actions.btn_new_game", "Sair para o Menu")}
        </button>
      </div>
    </div>
  );
};

export default Results;