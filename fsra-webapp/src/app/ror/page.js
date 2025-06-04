"use client";
import { useState } from "react";
import './page.css';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer
} from 'recharts';

export default function Ror() {
  const [excel, setExcel] = useState(null);
  const [error, setError] = useState("");
  const [graphData, setGraphData] = useState(null);

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

      if (response.ok) {
        setGraphData(data); // ✅ save data for chart
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Error uploading file");
    }
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
      {graphData && Object.entries(graphData).map(([sheetName, data]) => (
  <div key={sheetName} style={{ width: '100%', height: 400, marginTop: 100 }}>
    <h2>{sheetName}</h2>  {/* Title per chart */}
    <ResponsiveContainer>
      <LineChart data={data}>
        <XAxis dataKey="Date" tickFormatter={(date) => date.slice(0, 10)} />
        <YAxis tickFormatter={(val) => `${(val * 100).toFixed(2)}%`} />
        <Tooltip />
        <Legend />
        <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
        <Line type="monotone" dataKey="DailyReturn" stroke="#8884d8" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
))}
    </div>
  );
}
