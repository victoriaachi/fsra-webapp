"use client";
import { useState, useEffect } from "react";
import './page.css';

export default function Compare() {
  const [ais, setAis] = useState(null);
  const [avr, setAvr] = useState(null);
  const [excel, setExcel] = useState(null);

  const [aisText, setAisText] = useState("");
  const [avrText, setAvrText] = useState("");
  const [excelData, setExcelData] = useState([]);

  //const [notFound setNotFound] = useState("");

  const [planInfo, setPlanInfo] = useState([]);
  const [mismatchedFields, setMismatchedFields] = useState([]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [toggles, setToggles] = useState({
    info: true,
    fields: true,
    ais: false,
    avr: false,

  });

  const [aisDragging, setAisDragging] = useState(false);
  const [avrDragging, setAvrDragging] = useState(false);
  const [excelDragging, setExcelDragging] = useState(false);

  const aisChange = (e) => setAis(e.target.files[0]);
  const avrChange = (e) => setAvr(e.target.files[0]);
  const excelChange = (e) => setExcel(e.target.files[0]);

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
    if (!ais || !avr || !excel) {
      setError("Please upload 3 files.");
      return;
    }
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("ais", ais);
    formData.append("avr", avr);
    formData.append("excel", excel);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/compare`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("Backend response:", data);

      setAisText(data.ais_text);
      setAvrText(data.avr_text);
      setExcelData(data.excel_data || []);
      setPlanInfo(data.plan_info);
      setMismatchedFields(data.mismatched_fields);
      //setNotFound(data.not_found);
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

           {/* Excel File Upload */}
        <div
          className={`drop-zone ${excelDragging ? "dragging" : ""}`}
          onDragOver={(e) => handleDrag(e, setExcelDragging)}
          onDragLeave={(e) => handleDragLeave(e, setExcelDragging)}
          onDrop={(e) => handleDrop(e, setExcelDragging, setExcel)}
        >
          <label htmlFor="avr">Excel File:</label>
          <input
            id="excel"
            type="file"
            accept=".xlsx,.xls,.xlsm, .xlsb"
            onChange={excelChange}
            disabled={loading}
          />
          <p>Or drag and drop a file here</p>
          {excel && <p><strong>Selected:</strong> {excel.name}</p>}
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={fileSubmit} disabled={loading}>
        {loading ? "Processing..." : "Submit"}
      </button>

      {loading && (
        <div className="loading-screen">
        <div>Comparing PDFs, please wait</div>
        <div className="loading-content">
          <img src="/parrot-think.png" style={{width:'200px', height:'200px'}}/>
          <div className="loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </div>
        </div>
      </div>
        
      )}

      {submitted && !loading && (
        <>
          <div className="container">
            <h2>Plan Information</h2>
            <div>
             <span>{toggles.info ? "Hide" : "Show"}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={toggles.info}
                  onChange={() => handleToggle("info")}
                />
                <span className="slider"></span>
              </label>
            </div>

            {toggles.info && (
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
            <p>Disclaimer: DC normal cost, membership data and sensitivity information excluded in comparison</p>
            <div>
              <span>{toggles.fields ? "Hide" : "Show"}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={toggles.fields}
                  onChange={() => handleToggle("fields")}
                />
                <span className="slider"></span>
              </label>
              <h3>Number of Fields not Found: {mismatchedFields.length}</h3>
            </div>

            {toggles.fields && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>AIS Value</th>
                    <th>AVR Value</th>
                    <th>Page Number</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatchedFields.map(([title, aisValue, avrValue, pageNumber]) => (
                    <tr key={title}>
                      <td>{title}</td>
                      <td>{aisValue}</td>
                      <td>{avrValue}</td>
                      <td>{pageNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* {excelData.length > 0 && (
           <div className="container">
           <h2>Excel Data</h2>
           <table className="table">
             <thead>
               <tr>
                 <th>Value</th>
                 <th>Col Label</th>
                 <th>Row Label</th>
                 <th>Sheet Name</th>
               </tr>
             </thead>
             <tbody>
               {excelData.map((row, idx) => (
                 <tr key={idx}>
                   <td>{row.value}</td>
                   <td>{row["col label"]}</td>
                   <td>{row["row label"]}</td>
                   <td>{row["sheet name"]}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
         
          )} */}
          <div>
            <h2>AIS Text</h2>
            <span>{toggles.ais ? "Hide" : "Show"}</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={toggles.ais}
                onChange={() => handleToggle("ais")}
              />
              <span className="slider"></span>
            </label>
            {toggles.ais && <pre>{aisText}</pre>}
          </div>

          <div>
            <h2>AVR Text</h2>
            <span>{toggles.avr ? "Hide" : "Show"}</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={toggles.avr}
                onChange={() => handleToggle("avr")}
              />
              <span className="slider"></span>
            </label>
            {toggles.avr && <pre>{avrText}</pre>}
          </div>

        
        </>
      )}
    </div>
  );
}
