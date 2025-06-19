"use client";
import { useState } from "react";
import './page.css'

export default function compare() {
  const [ais, setAis] = useState(null);
  const [avr, setAvr] = useState(null);

  const [aisText, setAisText] = useState("");
  const [avrText, setAvrText] = useState("");

  const [filteredTitles, setFilteredTitles] = useState([]);
  const [filteredValues, setFilteredValues] = useState([]);
  //const [geminiText, setGeminiText] = useState("");
  //const [geminiFields, setGeminiFields] = useState([]);

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/compare`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    console.log("Backend response:", data);

    setAisText(data.ais_text);
    setAvrText(data.avr_text);

    setFilteredTitles(data.titles);
    setFilteredValues(data.values);
    //setGeminiText(data.gemini_text);
    //setGeminiFields(data.gemini_fields); // structured JSON 🎯
    //setGeminiFields(data.gemini_fields);
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
      
       {filteredTitles.map((title, idx) => {
      const value = filteredValues[idx];
      if (title != null && value != null) {
        return (
          <p key={idx}>
            {title}: {value}
          </p>
        );
      }
      return null; // Skip rendering
    })} 
      <h2>Extracted AVR Text</h2>
      <pre>{avrText}</pre>

      



    </div>
  );
}
