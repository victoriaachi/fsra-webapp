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

  // --- State for First Chart (ROR Chart) ---
  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSecurities, setSelectedSecurities] = useState([]);
  const [chartData, setChartData] = useState(null);
  const chartRef = useRef();

  // --- State for Second Chart (Weighted ROR Chart) ---
  const [weightedFrequency, setWeightedFrequency] = useState("daily");
  const [weightedStartDate, setWeightedStartDate] = useState("");
  const [weightedEndDate, setWeightedEndDate] = useState("");
  const [weightedSecurities, setWeightedSecurities] = useState([]);
  const [weights, setWeights] = useState({}); // Weights specific to the weighted chart
  const [weightedChartData, setWeightedChartData] = useState(null);
  const weightedChartRef = useRef();


  // Effect for the first chart (Rate of Return Chart)
  useEffect(() => {
    prepareChartData();
  }, [backendData, frequency, selectedSecurities, startDate, endDate]);

  // Handle file input
  const excelChange = (e) => {
    setExcel(e.target.files[0]);
    setError("");
  };

  // Submit file to backend
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

      // Initialize states for BOTH charts after backend data is received
      const defaultDailyRange = data.ranges?.daily || {};
      setStartDate(defaultDailyRange.min || "");
      setEndDate(defaultDailyRange.max || "");
      setSelectedSecurities([]); // Reset for first chart

      // Initialize states for the second chart
      setWeightedFrequency("daily"); // Default for weighted
      setWeightedStartDate(defaultDailyRange.min || "");
      setWeightedEndDate(defaultDailyRange.max || "");
      setWeightedSecurities([]); // Reset for weighted chart
      setWeights({}); // Clear any previous weights
      setWeightedChartData(null); // Clear previous weighted chart
      
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Error uploading file");
    }
  };

  // --- Handlers for First Chart Controls ---
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

  // --- Handlers for Second Chart Controls ---
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

  // --- Export Functions ---
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

  // --- Chart Data Preparation Functions ---

  // For the first chart (Rate of Return)
  const prepareChartData = () => {
    if (!backendData || !frequency) {
      setChartData(null);
      return;
    }
    // If no securities are selected, clear the chart
    if (selectedSecurities.length === 0) {
      setChartData({ datasets: [] });
      return;
    }

    const rawData = backendData[frequency];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    let allYValues = []; // To collect all Y values for dynamic scaling

    const datasets = selectedSecurities.map((sec, index) => {
      let dataPoints = rawData[sec] || [];

      // Filter data points by date range
      if (start && end) {
        dataPoints = dataPoints.filter(({ Date: dateString }) => { // FIX: Renamed 'Date' to 'dateString'
          const d = new Date(dateString);
          return d >= start && d <= end;
        });
      }

      // Determine the correct return key (handling 'quarter' specifically)
      let returnKey;
      if (frequency === 'quarter') {
        returnKey = 'QuarterlyReturn';
      } else {
        returnKey = `${frequency.charAt(0).toUpperCase() + frequency.slice(1)}Return`;
      }
      
      const data = dataPoints.map(point => {
        const yValue = point[returnKey] * 100;
        if (typeof yValue === 'number' && !isNaN(yValue)) { // Ensure it's a valid number
          allYValues.push(yValue); // Collect Y value
        }
        return {
          x: new Date(point.Date), // Assuming point.Date is a string like "YYYY-MM-DD"
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

        // Add a buffer to the min/max values
        const buffer = (calculatedMaxY - calculatedMinY) * 0.15; // 15% buffer for better visibility
        calculatedMinY = calculatedMinY - buffer;
        calculatedMaxY = calculatedMaxY + buffer;
    } else {
        // If no data, let Chart.js auto-scale by not providing min/max
        calculatedMinY = undefined;
        calculatedMaxY = undefined;
    }

    setChartData({ datasets, calculatedMinY, calculatedMaxY }); // Store min/max with datasets
  };

  // For the second chart (Weighted Rate of Return) - triggered by button
  const generateWeightedChart = () => {
    if (!backendData || !weightedSecurities.length) {
      alert("Please select at least one security for the weighted chart.");
      setWeightedChartData(null); // Clear chart if no securities selected
      return;
    }

    // Validate total weight *only if* showing an aggregated portfolio.
    // If showing individual weighted lines, the sum to 100% is less critical
    // for rendering, but good practice for conceptual understanding.
    // I'll keep the validation as it's still about a "portfolio" even if showing components.
    const totalWeight = weightedSecurities.reduce(
      (sum, sec) => sum + (weights[sec] || 0),
      0
    );

    if (weightedSecurities.length > 0 && (totalWeight < 99.9 || totalWeight > 100.1)) { // Allow for small float inaccuracies
      alert(`For a true portfolio, weights should add to 100%. Current total: ${totalWeight.toFixed(2)}%`);
      // You can decide if you want to prevent rendering here or just show the alert
      // For now, I'll allow rendering but keep the alert.
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

    let allWeightedYValues = []; // To collect all Y values for dynamic scaling of this chart

    // Create datasets for each selected security, scaled by their weight
    const datasets = weightedSecurities.map((sec, index) => {
        const weightFraction = (weights[sec] || 0) / 100;
        let dataPoints = rawData[sec] || [];

        // Filter data points by date range
        if (start && end) {
            dataPoints = dataPoints.filter(({ Date: dateString }) => {
                const d = new Date(dateString);
                return d >= start && d <= end;
            });
        }

        const data = dataPoints.map(point => {
            const originalYValue = point[returnKey];
            const weightedYValue = originalYValue * weightFraction * 100; // Multiply by weight and 100 for percentage
            if (typeof weightedYValue === 'number' && !isNaN(weightedYValue)) {
                allWeightedYValues.push(weightedYValue);
            }
            return {
                x: new Date(point.Date),
                y: weightedYValue,
            };
        });

        return {
            label: `${sec} (Weight: ${(weightFraction * 100).toFixed(2)}%)`, // Label including the weight
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
        datasets: datasets, // Now an array of datasets, one per security
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
                      maintainAspectRatio: true, // Allows flexible height
                      aspectRatio: 1.2, // You can adjust this for wider/taller charts
                      plugins: {
                        title: { display: true, text: "Individual Rate of Return", font: { size: 18 } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`, }, },
                        legend: {
                          onClick: null, // Disables legend click to toggle visibility
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
                          min: chartData?.calculatedMinY, // Use the calculated min Y
                          max: chartData?.calculatedMaxY, // Use the calculated max Y
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
                      aspectRatio: 1.2, // You can adjust this for wider/taller charts
                      plugins: {
                        title: {
                          display: true,
                          text: "Weighted Individual Securities Return", // Updated title
                          font: { size: 18 },
                        },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`, // Tooltip for each security
                          },
                        },
                        legend: {
                          display: true, // ENABLE LEGEND
                          onClick: null, // Disables legend click to toggle visibility
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
                          min: weightedChartData?.calculatedMinY, // Use the calculated min Y
                          max: weightedChartData?.calculatedMaxY, // Use the calculated max Y
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