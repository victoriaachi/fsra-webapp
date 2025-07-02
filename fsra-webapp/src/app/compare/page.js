"use client";
import { useState } from "react";
import './page.css';

export default function Compare() {
  const [ais, setAis] = useState(null);
  const [avr, setAvr] = useState(null);

  const [aisText, setAisText] = useState("");
  const [avrText, setAvrText] = useState("");


  const [planInfo, setPlanInfo] = useState({});
  const[displayFields, setDisplayFields] = useState({});


  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [toggles, setToggles] = useState({
    plan: true,
    ais: true,
  });

  const aisChange = (e) => setAis(e.target.files[0]);
  const avrChange = (e) => setAvr(e.target.files[0]);

  const handleToggle = (name) => {
    setToggles((prev) => ({ ...prev, [name]: !prev[name] }));
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
        <div>
          <label htmlFor="ais">AIS:</label>
          <input
            id="ais"
            type="file"
            accept="application/pdf"
            onChange={aisChange}
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="avr">AVR:</label>
          <input
            id="avr"
            type="file"
            accept="application/pdf"
            onChange={avrChange}
            disabled={loading}
          />
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
          {Object.entries(planInfo).map(([title, value]) => (
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
               {Object.entries(displayFields).map(([title, value]) => (
                 <tr key={title}>
                   <td>{title}</td>
                   <td>{value}</td>
                 </tr>
               ))}
               </tbody>
             </table>
            )}
           

            {/* {filteredTitles.map((title, idx) => {
              const value = filteredValues[idx];
              return (
                title && value && (
                  <p key={idx}>
                    {title}: {value}
                  </p>
                )
              );
            })} */}
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
