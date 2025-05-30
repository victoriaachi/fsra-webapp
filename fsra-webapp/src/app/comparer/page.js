"use client";
import { useState } from "react";
import './page.css'

export default function fileUploader() {
  const [ais, setAis] = useState(null);
  const [avr, setAvr] = useState(null);

  const [aisText, setAisText] = useState("");
  const [avrText, setAvrText] = useState("");
  //const [geminiText, setGeminiText] = useState("");
  const [geminiFields, setGeminiFields] = useState([]);

  // const [ollamaText, setOllamaText] = useState("");
  // const [excelPreview, setExcelPreview] = useState([]);

  const [error, setError] = useState("");

  const aisChange = (e) => {
    setAis(e.target.files[0]);
  };

  const avrChange = (e) => {
    setAvr(e.target.files[0]);
  };

  const fileSubmit = async () => {
    if (!ais || !avr) {
      setError("Please upload two files.");
      return;
    }
    else {
      setError("");
    }
    const formData = new FormData();
    formData.append("ais", ais);
    formData.append("avr", avr);

  try {
    const response = await fetch("http://127.0.0.1:8080/compare", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    console.log("Backend response:", data);

    setAisText(data.ais_text);
    setAvrText(data.avr_text);
    //setGeminiText(data.gemini_text);
    //setGeminiFields(data.gemini_fields); // structured JSON 🎯
    setGeminiFields(data.gemini_fields);
    //setOllamaText(data.ollama_text);
    //setExcelPreview(data.excel_Preview);
    //console.log("Excel preview:", data.excel_preview);

  } catch (error) {
    console.error("Error uploading PDFs:", error);
  }
}

  return (
    <div>
      <h1>AIS vs AVR Compare Tool</h1>
      <div>
        <label htmlFor="ais">AIS:</label>
        <input
          id="ais"
          type="file"
          accept="application/pdf"
          onChange={aisChange}
        />
      </div>
      <div>
        <label htmlFor="avr">AVR:</label>
        <input
          id="avr"
          type="file"
          accept="application/pdf"
          onChange={avrChange}
        />
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={fileSubmit}>Submit</button>
        <h2>Extracted AIS Fields</h2>
      <pre>{aisText}</pre>
      
      <h2>Extracted AVR Text</h2>
      <pre>{avrText}</pre>

      {/* <h2>Ollama Summary</h2>
      <pre>{ollamaText}</pre> */}
      <h2>Gemini Extracted Fields</h2>
      <h2>Gemini Field Comparison</h2>
{geminiFields.length > 1 ? (
  <table>
    <thead>
      <tr>
        {fieldsTable[0].map((header, i) => (
          <th key={i}>{header}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {geminiFields.slice(1).map((row, rowIndex) => (
        <tr key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <td key={cellIndex}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
) : (
  <p>No field data available.</p>
)}


    </div>
  );
}
