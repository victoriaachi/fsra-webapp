"use client";
import { useState, useEffect } from "react";
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

export default function Ror() {
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

  const prepareChartData = () => {
    if (!backendData || !frequency || !selectedSecurities.length) return;
  
    const rawData = backendData[frequency]; // daily, quarter, annual
  
    // Convert startDate and endDate strings to Date objects for comparison
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
  
    const datasets = selectedSecurities.map((sec) => {
      let dataPoints = rawData[sec] || [];
  
      // Filter data points by date range if both start and end dates are set
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
        borderColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
        cubicInterpolationMode: 'monotone',
        tension: 0.4,
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
          {/* Frequency Selector */}
          <div>
            <label>Frequency:</label>
            <select value={frequency} onChange={handleFrequencyChange}>
              <option value="daily">Daily</option>
              <option value="quarter">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
  
          {/* Date Range Selector */}
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
  
          {/* Securities Selector */}
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
  
          {/* Debug / Summary */}
          <div style={{ marginTop: "20px", background: "#f0f0f0", padding: "10px" }}>
            <strong>Selected Frequency:</strong> {frequency}<br />
            <strong>Date Range:</strong> {startDate} to {endDate}<br />
            <strong>Securities:</strong> {selectedSecurities.join(", ") || "None selected"}
          </div>
        </div>
      )}
  
      {/* Chart section inside the same root div */}
      {chartData && (
        <div style={{ marginTop: "40px" }}>
          <Line
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: "Rate of Return",
                  font: {
                    size: 18,
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
                  },
                },
                legend: {
                  onClick: (e) => e.native.preventDefault()  // disables toggle on click
                }
              },
              scales: {
                x: {
                  type: "time",
                  time: {
                    unit: "month",
                  },
                  title: {
                    display: true,
                    text: "Date",
                  },
                },
                y: {
                  ticks: {
                    callback: (value) => `${value}%`,
                  },
                  title: {
                    display: true,
                    text: "Return (%)",
                  },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
  


  
