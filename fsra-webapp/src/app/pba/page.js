"use client";
import { useState } from "react";
import './page.css'

export default function pba() {

  const [inputValue, setInputValue] = useState("");
  const [submittedText, setSubmitText] = useState("");
  const [error, setError] = useState("");
  const [definition, setDefinitionText] = useState("");

  const handleSubmit = async () => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput.length === 0) {
      setError("Please enter a valid keyword.");
      return;
    }
    else {
      setError("");
      setSubmitText(inputValue);
      setInputValue(""); // clear input
    }
    try {
      const response = await fetch("http://127.0.0.1:8080/pba", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: inputValue })
      });
      
      const result = await response.json();
      console.log(result.message);
      setDefinitionText(result.definition);
      
  
      setInputValue(""); // clear input
    } catch (error) {
      console.error("Error sending keyword:", error);
    }
  };

    return (
      <div> 
        <h1> Pension Benefits Act Search</h1>
        <div>
          <input type="text" placeholder="Enter keyword" value={inputValue} onChange={(e) => setInputValue(e.target.value)}></input>
          <button onClick={handleSubmit}>Submit</button>

        </div>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <div>
        
          <p>submitted text: {submittedText}</p>

        </div>
        <div>
          <h2> Definition</h2>
          <p>{definition}</p>
        </div>
      </div>
    )
    
  }