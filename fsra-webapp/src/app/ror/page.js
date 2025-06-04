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
    ctx.fillStyle = 'white';  // Set background color here
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

ChartJS.register(zoomPlugin);
ChartJS.register(whiteBackgroundPlugin);


ChartJS.register(
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
  "#e6194B", // red
  "#3cb44b", // green
  "#ffe119", // yellow
  "#4363d8", // blue
  "#f58231", // orange
  "#911eb4", // purple
  "#46f0f0", // cyan
  "#f032e6", // magenta
  "#bcf60c", // lime
  "#fabebe", // pink
  "#008080", // teal
  "#e6beff", // lavender
  "#9A6324", // brown
  "#fffac8", // cream
  "#800000", // maroon
  "#aaffc3", // mint
  "#808000", // olive
  "#ffd8b1", // peach
  "#000075", // navy
  "#808080"  // grey
];


export default function Ror() {
  const chartRef = useRef();
  const [excel, setExcel] = useState(null);
  const [error, setError] = useState("");

  const [backendData, setBackendData] = useState(null);
  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSecurities, setSelectedSecurities] = useState([]);

  const [chartData, setChartData] = useState(null);

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
    } else {
      setError("");
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

      const defaultRange = data.ranges?.[frequency] || {};
      setStartDate(defaultRange.min || "");
      setEndDate(defaultRange.max || "");
      setSelectedSecurities([]);

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

  const exportChart = () => {
    if (chartRef.current) {
      const chartInstance = chartRef.current;
      // Get base64 image of chart
      const base64Image = chartInstance.toBase64Image();
      
      // Create a link and trigger download
      const link = document.createElement('a');
      link.href = base64Image;
      link.download = 'rate_of_return_chart.png';
      link.click();
    }
  };

 

  const prepareChartData = () => {
    if (!backendData || !frequency) {
      setChartData(null);
      return;
    }
  
    if (!selectedSecurities.length) {
      setChartData({ datasets: [] });  // <-- set empty datasets instead of null
      return;
    }
  
    const rawData = backendData[frequency];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
  
    const datasets = selectedSecurities.map((sec, index) => {
      let dataPoints = rawData[sec] || [];
      const color = distinctColors[index % distinctColors.length];
  
      if (start && end) {
        dataPoints = dataPoints.filter(point => {
          const date = new Date(point.Date);
          return date >= start && date <= end;
        });
      }
  
      const data = dataPoints.map((point) => ({
        x: new Date(point.Date),
        y: point[`${frequency.charAt(0).toUpperCase() + frequency.slice(1)}Return`] * 100,
      }));
  
      return {
        label: sec,
        data,
        fill: false,
        borderColor: color,
        borderWidth: 2,
        backgroundColor: color,
        cubicInterpolationMode: 'monotone',
        tension: 0.8,
      };
    });
  
    setChartData({ datasets });
  };  
  
  

  return (
    <div>
      <h1>Rate of Return Graphs</h1>
      <div>
        <label htmlFor="excel">Excel:</label>
        <input
          id="excel"
          type="file"
          accept=".xls,.xlsx,.xlsm,.xlsb"
          onChange={excelChange}
        />
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={fileSubmit}>Submit</button>

      {backendData && (
        <div className="selector" style={{ marginTop: "20px" }}>
          <div>
            <label>Frequency:</label>
            <select value={frequency} onChange={handleFrequencyChange}>
              <option value="daily">Daily</option>
              <option value="quarter">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          {backendData.ranges?.[frequency] && (
            <div style={{ marginTop: "10px" }}>
              <label>Date Range:</label>
              <input
                type="date"
                value={startDate}
                min={backendData.ranges[frequency].min}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
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
            <div style={{ marginTop: "10px" }}>
              <label>Securities:</label>
              <button onClick={handleSelectAll}>
                {selectedSecurities.length === backendData.securities.length
                  ? "Unselect All"
                  : "Select All"}
              </button>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {backendData.securities.map((sec) => (
                  <label key={sec}>
                    <input
                      type="checkbox"
                      checked={selectedSecurities.includes(sec)}
                      onChange={() => handleSecurityToggle(sec)}
                    />
                    {sec}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "20px", background: "#f0f0f0", padding: "10px" }}>
            <strong>Selected Frequency:</strong> {frequency}<br />
            <strong>Date Range:</strong> {startDate} to {endDate}<br />
            <strong>Securities:</strong> {selectedSecurities.join(", ") || "None selected"}
          </div>
          <button onClick={() => chartRef.current?.resetZoom()}>
        Reset Zoom
      </button>
      <button onClick={exportChart}>Export Chart</button>

        </div>
      )}

      {chartData && (
        <Line
          ref={chartRef}
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: "Rate of Return",
                font: { size: 18 },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
                },
              },
              legend: {
                onClick: (e) => e.native.preventDefault(),
                labels: {
                  usePointStyle: true,
                  boxWidth: 12,
                  boxHeight: 12,
                  color: "#000"
                }
              },
              zoom: {
                pan: { enabled: true, mode: 'xy' },
                zoom: {
                  wheel: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'xy',
                },
              },
            },
            scales: {
              x: {
                type: "time",
                time: { unit: "month" },
                title: { display: true, text: "Date" },
              },
              y: {
                ticks: {
                  callback: (value) => `${value}%`,
                },
                title: { display: true, text: "Return (%)" },
              },
            },
          }}
        />
      )}

      
    </div>
  );
}