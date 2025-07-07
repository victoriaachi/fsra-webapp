"use client";
import { useState, useEffect } from "react";
import './page.css';

export default function Compare() {
  const [ais, setAis] = useState(null);
  const [avr, setAvr] = useState(null);

  const [aisText, setAisText] = useState("");
  const [avrText, setAvrText] = useState("");

  const [planInfo, setPlanInfo] = useState([]);
  const [displayFields, setDisplayFields] = useState([]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [toggles, setToggles] = useState({
    plan: true,
    ais: true,
  });

  const [aisDragging, setAisDragging] = useState(false);
  const [avrDragging, setAvrDragging] = useState(false);

  const aisChange = (e) => setAis(e.target.files[0]);
  const avrChange = (e) => setAvr(e.target.files[0]);

  const handleToggle = (name) => {
    setToggles((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleDrag = (e, setter) => {
    e.preventDefault();
    e.stopPropagation();
    setter(true);
  };

  const handleDragLeave = (e, setter) => {
    e.preventDefault();
    e.stopPropagation();
    setter(false);
  };

  const handleDrop = (e, setter, fileSetter) => {
    e.preventDefault();
    e.stopPropagation();
    setter(false);
    const file = e.dataTransfer.files[0];
    if (file) fileSetter(file);
  };

  const fileSubmit = async () => {
    if (!ais || !avr) {
      setError("Please upload two files.");
      return;
    }
    setError("");
    setLoading(true);

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
      setPlanInfo(data.plan_info);
      setDisplayFields(data.display_fields);
    } catch (error) {
      console.error("Error uploading PDFs:", error);
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="container">
      <h1>AIS vs AVR Compare Tool</h1>

      <div className="file-inputs">
        {/* AIS Upload */}
        <div
          className={`drop-zone ${aisDragging ? "dragging" : ""}`}
          onDragOver={(e) => handleDrag(e, setAisDragging)}
          onDragLeave={(e) => handleDragLeave(e, setAisDragging)}
          onDrop={(e) => handleDrop(e, setAisDragging, setAis)}
        >
          <label htmlFor="ais">AIS:</label>
          <input
            id="ais"
            type="file"
            accept="application/pdf"
            onChange={aisChange}
            disabled={loading}
          />
          <p>Or drag and drop a file here</p>
          {ais && <p><strong>Selected:</strong> {ais.name}</p>}
        </div>

        {/* AVR Upload */}
        <div
          className={`drop-zone ${avrDragging ? "dragging" : ""}`}
          onDragOver={(e) => handleDrag(e, setAvrDragging)}
          onDragLeave={(e) => handleDragLeave(e, setAvrDragging)}
          onDrop={(e) => handleDrop(e, setAvrDragging, setAvr)}
        >
          <label htmlFor="avr">AVR:</label>
          <input
            id="avr"
            type="file"
            accept="application/pdf"
            onChange={avrChange}
            disabled={loading}
          />
          <p>Or drag and drop a file here</p>
          {avr && <p><strong>Selected:</strong> {avr.name}</p>}
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={fileSubmit} disabled={loading}>
        {loading ? "Processing..." : "Submit"}
      </button>

      {loading && (
        <div className="loading-screen">Comparing PDFs, please wait...</div>
      )}

      {submitted && !loading && (
        <>
          <div className="container">
            <h2>Plan Information</h2>
            <div>
              <span>Show</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={toggles.plan}
                  onChange={() => handleToggle("plan")}
                />
                <span className="slider"></span>
              </label>
            </div>

            {toggles.plan && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {planInfo.map(([title, value]) => (
                    <tr key={title}>
                      <td>{title}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="container">
            <h2>Missing / Mismatched Fields</h2>
            <div>
              <span>Show</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={toggles.ais}
                  onChange={() => handleToggle("ais")}
                />
                <span className="slider"></span>
              </label>
            </div>

            {toggles.ais && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>AIS Value</th>
                  </tr>
                </thead>
                <tbody>
                  {displayFields.map(([title, value]) => (
                    <tr key={title}>
                      <td>{title}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h2>Extracted AIS Fields</h2>
            <pre>{aisText}</pre>
          </div>

          <div>
            <h2>Extracted AVR Text</h2>
            <pre>{avrText}</pre>
          </div>
        </>
      )}
    </div>
  );
}
