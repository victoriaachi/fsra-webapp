"use client";
import { useState, useEffect, useRef } from "react";
import './page.css';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  CategoryScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

const whiteBackgroundPlugin = {
  id: 'whiteBackground',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

ChartJS.register(
  zoomPlugin,
  whiteBackgroundPlugin,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  CategoryScale
);

const distinctColors = [
  "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4",
  "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff",
  "#9A6324", "#fffac8", "#800000", "#aaffc3", "#808000", "#ffd8b1",
  "#000075", "#808080"
];

export default function Ror() {
  const [excel, setExcel] = useState(null);
  const [error, setError] = useState("");
  const [backendData, setBackendData] = useState(null);

  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSecurities, setSelectedSecurities] = useState([]);
  const [chartData, setChartData] = useState(null);
  const chartRef = useRef();

  const [weightedFrequency, setWeightedFrequency] = useState("daily");
  const [weightedStartDate, setWeightedStartDate] = useState("");
  const [weightedEndDate, setWeightedEndDate] = useState("");
  const [weightedSecurities, setWeightedSecurities] = useState([]);
  const [weights, setWeights] = useState({});
  const [weightedChartData, setWeightedChartData] = useState(null);
  const weightedChartRef = useRef();

  useEffect(() => {
    prepareChartData();
  }, [backendData, frequency, selectedSecurities, startDate, endDate]);

  const excelChange = (e) => {
    setExcel(e.target.files[0]);
    setError("");
  };

  const fileSubmit = async () => {
    if (!excel) {
      setError("Please upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", excel);

    try {
      const response = await fetch("http://127.0.0.1:8080/ror", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setBackendData(data);

      const defaultDailyRange = data.ranges?.daily || {};
      setStartDate(defaultDailyRange.min || "");
      setEndDate(defaultDailyRange.max || "");
      setSelectedSecurities([]); 

      setWeightedFrequency("daily"); 
      setWeightedStartDate(defaultDailyRange.min || "");
      setWeightedEndDate(defaultDailyRange.max || "");
      setWeightedSecurities([]); 
      setWeights({}); 
      setWeightedChartData(null); 
      
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Error uploading file");
    }
  };

  const handleFrequencyChange = (e) => {
    const newFreq = e.target.value;
    setFrequency(newFreq);
    const range = backendData?.ranges?.[newFreq] || {};
    setStartDate(range.min || "");
    setEndDate(range.max || "");
  };

  const handleSecurityToggle = (sec) => {
    setSelectedSecurities((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const handleSelectAll = () => {
    if (!backendData?.securities) return;
    const allSelected = selectedSecurities.length === backendData.securities.length;
    setSelectedSecurities(allSelected ? [] : [...backendData.securities]);
  };

  const handleWeightedFrequencyChange = (e) => {
    const newFreq = e.target.value;
    setWeightedFrequency(newFreq);
    const range = backendData?.ranges?.[newFreq] || {};
    setWeightedStartDate(range.min || "");
    setWeightedEndDate(range.max || "");
  };

  const handleWeightedSecurityToggle = (sec) => {
    setWeightedSecurities((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  const handleWeightedSelectAll = () => {
    if (!backendData?.securities) return;
    const allSelected = weightedSecurities.length === backendData.securities.length;
    setWeightedSecurities(allSelected ? [] : [...backendData.securities]);
  };

  const handleWeightChange = (sec, value) => {
    setWeights((prev) => ({
      ...prev,
      [sec]: parseFloat(value) || 0,
    }));
  };

  const exportChart = () => {
    if (chartRef.current) {
      const base64Image = chartRef.current.toBase64Image();
      const link = document.createElement("a");
      link.href = base64Image;
      link.download = "rate_of_return_chart.png";
      link.click();
    }
  };

  const exportWeightedChart = () => {
    if (weightedChartRef.current) {
      const base64Image = weightedChartRef.current.toBase64Image();
      const link = document.createElement("a");
      link.href = base64Image;
      link.download = "weighted_rate_of_return_chart.png";
      link.click();
    }
  };

  const prepareChartData = () => {
    if (!backendData || !frequency) {
      setChartData(null);
      return;
    }
    if (selectedSecurities.length === 0) {
      setChartData({ datasets: [] });
      return;
    }

    const rawData = backendData[frequency];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    let allYValues = []; 

    const datasets = selectedSecurities.map((sec, index) => {
      let dataPoints = rawData[sec] || [];

      // Filter data points by date range
      if (start && end) {
        dataPoints = dataPoints.filter(({ Date: dateString }) => { 
          const d = new Date(dateString);
          return d >= start && d <= end;
        });
      }

      let returnKey;
      if (frequency === 'quarter') {
        returnKey = 'QuarterlyReturn';
      } else {
        returnKey = `${frequency.charAt(0).toUpperCase() + frequency.slice(1)}Return`;
      }
      
      const data = dataPoints.map(point => {
        const yValue = point[returnKey] * 100;
        if (typeof yValue === 'number' && !isNaN(yValue)) { 
          allYValues.push(yValue); 
        }
        return {
          x: new Date(point.Date), 
          y: yValue,
        };
      });

      return {
        label: sec,
        data: data,
        fill: false,
        borderColor: distinctColors[index % distinctColors.length],
        borderWidth: 2,
        backgroundColor: distinctColors[index % distinctColors.length],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
      };
    });

    let calculatedMinY, calculatedMaxY;
    if (allYValues.length > 0) {
        calculatedMinY = Math.min(...allYValues);
        calculatedMaxY = Math.max(...allYValues);

        const buffer = (calculatedMaxY - calculatedMinY) * 0.15; 
        calculatedMinY = calculatedMinY - buffer;
        calculatedMaxY = calculatedMaxY + buffer;
    } else {
        calculatedMinY = undefined;
        calculatedMaxY = undefined;
    }

    setChartData({ datasets, calculatedMinY, calculatedMaxY }); 
  };

  const generateWeightedChart = () => {
    if (!backendData || !weightedSecurities.length) {
      alert("Please select at least one security for the weighted chart.");
      setWeightedChartData(null); // Clear chart if no securities selected
      return;
    }

    const totalWeight = weightedSecurities.reduce(
      (sum, sec) => sum + (weights[sec] || 0),
      0
    );

    if (weightedSecurities.length > 0 && (totalWeight < 99.9 || totalWeight > 100.1)) { // Allow for small float inaccuracies
      alert(`For a true portfolio, weights should add to 100%. Current total: ${totalWeight.toFixed(2)}%`);
    }


    const rawData = backendData[weightedFrequency];
    const start = weightedStartDate ? new Date(weightedStartDate) : null;
    const end = weightedEndDate ? new Date(weightedEndDate) : null;

    let returnKey;
    if (weightedFrequency === 'quarter') {
      returnKey = 'QuarterlyReturn';
    } else {
      returnKey = `${weightedFrequency.charAt(0).toUpperCase() + weightedFrequency.slice(1)}Return`;
    }

    let allWeightedYValues = []; 

    const datasets = weightedSecurities.map((sec, index) => {
        const weightFraction = (weights[sec] || 0) / 100;
        let dataPoints = rawData[sec] || [];

        if (start && end) {
            dataPoints = dataPoints.filter(({ Date: dateString }) => {
                const d = new Date(dateString);
                return d >= start && d <= end;
            });
        }

        const data = dataPoints.map(point => {
            const originalYValue = point[returnKey];
            const weightedYValue = originalYValue * weightFraction * 100; 
            if (typeof weightedYValue === 'number' && !isNaN(weightedYValue)) {
                allWeightedYValues.push(weightedYValue);
            }
            return {
                x: new Date(point.Date),
                y: weightedYValue,
            };
        });

        return {
            label: `${sec} (Weight: ${(weightFraction * 100).toFixed(2)}%)`,
            data: data,
            fill: false,
            borderColor: distinctColors[index % distinctColors.length],
            backgroundColor: distinctColors[index % distinctColors.length],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
        };
    });

    let calculatedWeightedMinY, calculatedWeightedMaxY;
    if (allWeightedYValues.length > 0) {
        calculatedWeightedMinY = Math.min(...allWeightedYValues);
        calculatedWeightedMaxY = Math.max(...allWeightedYValues);

        const weightedBuffer = (calculatedWeightedMaxY - calculatedWeightedMinY) * 0.15;
        calculatedWeightedMinY = calculatedWeightedMinY - weightedBuffer;
        calculatedWeightedMaxY = calculatedWeightedMaxY + weightedBuffer;
    } else {
        calculatedWeightedMinY = undefined;
        calculatedWeightedMaxY = undefined;
    }

    setWeightedChartData({
        datasets: datasets, 
        calculatedMinY: calculatedWeightedMinY,
        calculatedMaxY: calculatedWeightedMaxY,
    });
  };


  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Rate of Return Graphs</h1>
  
      {/* File Upload Section */}
      <div style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "20px" }}>
        <label htmlFor="excel">Excel File:</label>
        <input
          id="excel"
          type="file"
          accept=".xls,.xlsx,.xlsm,.xlsb"
          onChange={excelChange}
        />
        <button onClick={fileSubmit} style={{ marginLeft: "10px" }}>
          Submit
        </button>
        {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
      </div>
  
      {backendData && (
        <>
          {/* First Chart Section: Individual Rate of Return Chart */}
          <div className="ror-chart-section" style={{ marginBottom: "50px", borderBottom: "1px solid #eee", paddingBottom: "30px" }}>
            <h2>Individual Securities Rate of Return Chart</h2>
            <div className="customize-section" style={{ marginTop: "20px", background: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
              <h3>Customize Chart</h3>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ marginRight: "10px" }}>Frequency:</label>
                <select value={frequency} onChange={handleFrequencyChange}>
                  <option value="daily">Daily</option>
                  <option value="quarter">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
    
              {backendData.ranges?.[frequency] && (
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ marginRight: "10px" }}>Date Range:</label>
                  <input
                    type="date"
                    value={startDate}
                    min={backendData.ranges[frequency].min}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span style={{ margin: "0 10px" }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={backendData.ranges[frequency].max}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}
    
              {backendData.securities?.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ marginRight: "10px", verticalAlign: "top" }}>Securities:</label>
                  <button onClick={handleSelectAll} style={{ marginLeft: "10px" }}>
                    {selectedSecurities.length === backendData.securities.length
                      ? "Unselect All"
                      : "Select All"}
                  </button>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
                    {backendData.securities.map((sec) => (
                      <label key={`chart1-${sec}`} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <input
                          type="checkbox"
                          checked={selectedSecurities.includes(sec)}
                          onChange={() => handleSecurityToggle(sec)}
                        />
                        <span>{sec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
    
              <div style={{ marginTop: "20px" }}>
                <button onClick={() => chartRef.current?.resetZoom()} style={{ marginRight: "10px" }}>
                  Reset Zoom
                </button>
                <button onClick={exportChart}>
                  Export Chart
                </button>
              </div>
            </div>
    
            {chartData && (
              <div style={{ marginTop: "30px" }}>
                {chartData.datasets.length > 0 ? (
                  <Line
                    ref={chartRef}
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      aspectRatio: 1.2, 
                      plugins: {
                        title: { display: true, text: "Individual Rate of Return", font: { size: 18 } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`, }, },
                        legend: {
                          onClick: null, 
                          labels: { usePointStyle: true, boxWidth: 12, boxHeight: 12, color: "#000" }
                        },
                        zoom: {
                          pan: { enabled: true, mode: 'xy' },
                          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', },
                        },
                      },
                      scales: {
                        x: { type: "time", time: { unit: frequency === 'daily' ? 'day' : (frequency === 'quarter' ? 'quarter' : 'year') }, title: { display: true, text: "Date" }, },
                        y: {
                          min: chartData?.calculatedMinY,
                          max: chartData?.calculatedMaxY,
                          ticks: {
                            callback: (value) => `${value}%`,
                          },
                          title: { display: true, text: "Return (%)" },
                        },
                      },
                    }}
                  />
                ) : (
                  <p style={{ textAlign: 'center', color: '#555' }}>Please select securities to display the chart.</p>
                )}
              </div>
            )}
          </div>
  
          {/* Second Chart Section: Weighted Rate of Return Chart */}
          <div className="weighted-ror-chart-section" style={{ marginTop: "50px" }}>
            <h2>Weighted Portfolio Rate of Return Chart</h2> {/* Changed title for clarity */}
            <div className="customize-section" style={{ marginTop: "20px", background: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
              <h3>Customize Weighted Chart</h3>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ marginRight: "10px" }}>Frequency:</label>
                <select value={weightedFrequency} onChange={handleWeightedFrequencyChange}>
                  <option value="daily">Daily</option>
                  <option value="quarter">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
    
              {backendData.ranges?.[weightedFrequency] && (
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ marginRight: "10px" }}>Date Range:</label>
                  <input
                    type="date"
                    value={weightedStartDate}
                    min={backendData.ranges[weightedFrequency].min}
                    max={weightedEndDate}
                    onChange={(e) => setWeightedStartDate(e.target.value)}
                  />
                  <span style={{ margin: "0 10px" }}>to</span>
                  <input
                    type="date"
                    value={weightedEndDate}
                    min={weightedStartDate}
                    max={backendData.ranges[weightedFrequency].max}
                    onChange={(e) => setWeightedEndDate(e.target.value)}
                  />
                </div>
              )}
    
              {backendData.securities?.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ marginRight: "10px", verticalAlign: "top" }}>Securities and Weights:</label>
                  <button onClick={handleWeightedSelectAll} style={{ marginLeft: "10px" }}>
                    {weightedSecurities.length === backendData.securities.length
                      ? "Unselect All"
                      : "Select All"}
                  </button>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
                    {backendData.securities.map((sec) => (
                      <div key={`chart2-${sec}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          type="checkbox"
                          checked={weightedSecurities.includes(sec)}
                          onChange={() => handleWeightedSecurityToggle(sec)}
                        />
                        <span>{sec}</span>
                        {weightedSecurities.includes(sec) && (
                          <input
                            type="number"
                            value={weights[sec] || ""}
                            placeholder="%"
                            onChange={(e) => handleWeightChange(sec, e.target.value)}
                            style={{ width: "60px" }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px', fontWeight: 'bold' }}>
                    Total Weight: {weightedSecurities.reduce((sum, sec) => sum + (weights[sec] || 0), 0).toFixed(2)}%
                  </div>
                </div>
              )}
              <div style={{ marginTop: "20px" }}>
                <button onClick={() => weightedChartRef.current?.resetZoom()} style={{ marginRight: "10px" }}>
                  Reset Zoom
                </button>
                <button onClick={exportWeightedChart} style={{ marginRight: "10px" }}>
                  Export Chart
                </button>
                <button onClick={generateWeightedChart}>
                  Generate Weighted Portfolio Graph
                </button>
              </div>
            </div>
    
            {weightedChartData && (
              <div style={{ marginTop: "30px" }}>
                {weightedChartData.datasets.length > 0 ? ( 
                  <Line
                    ref={weightedChartRef}
                    data={weightedChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      aspectRatio: 1.2, 
                      plugins: {
                        title: {
                          display: true,
                          text: "Weighted Individual Securities Return", 
                          font: { size: 18 },
                        },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`, 
                          },
                        },
                        legend: {
                          display: true,
                          onClick: null, 
                          labels: {
                            usePointStyle: true,
                            boxWidth: 12,
                            boxHeight: 12,
                            color: "#000"
                          }
                        },
                        zoom: {
                          pan: { enabled: true, mode: 'xy' },
                          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', },
                        },
                      },
                      scales: {
                        x: { type: "time", time: { unit: weightedFrequency === 'daily' ? 'day' : (weightedFrequency === 'quarter' ? 'quarter' : 'year') }, title: { display: true, text: "Date" }, },
                        y: {
                          min: weightedChartData?.calculatedMinY, 
                          max: weightedChartData?.calculatedMaxY, 
                          ticks: {
                            callback: (value) => `${value}%`,
                          },
                          title: { display: true, text: "Return (%)" },
                        },
                      },
                    }}
                  />
                ) : (
                  <p style={{ textAlign: 'center', color: '#555' }}>No data to display for the weighted portfolio. Please select securities and click 'Generate Weighted Portfolio Graph'.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}