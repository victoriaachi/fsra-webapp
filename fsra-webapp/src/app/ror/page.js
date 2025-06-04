"use client";
import { useState } from "react";
import './page.css';

export default function Ror() {
  const [excel, setExcel] = useState(null);
  const [error, setError] = useState("");
  //const [graphData, setGraphData] = useState(null);

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
    </div>
  );
}
