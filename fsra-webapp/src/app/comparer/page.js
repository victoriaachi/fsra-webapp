"use client";
import { useState } from "react";
import './page.css'

export default function PdfUploader() {
  const [ais, setAis] = useState(null);
  const [avr, setAvr] = useState(null);

  const [aisText, setAisText] = useState("");
  const [avrText, setAvrText] = useState("");

  const aisChange = (e) => {
    setAis(e.target.files[0]);
  };

  const avrChange = (e) => {
    setAvr(e.target.files[0]);
  };

  const pdfSubmit = async () => {
    if (!ais || !avr) {
      alert("Please upload both PDF files.");
      return;
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

      <button onClick={pdfSubmit}>Submit</button>
        <h2>Extracted AIS Fields</h2>
      <pre>{aisText}</pre>
      
  <h2>Extracted AVR Text</h2>
  <pre>{avrText}</pre>

    </div>
  );
}
