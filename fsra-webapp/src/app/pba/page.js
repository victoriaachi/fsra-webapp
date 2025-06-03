"use client";
import { useState } from "react";
import './page.css'

export default function pba() {

  const [inputValue, setInputValue] = useState("");
  const [submittedText, setSubmitText] = useState("");
  const [error, setError] = useState("");
  const [definition, setDefinitionText] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionText, setSectionText] = useState("");

  const handleSubmit = async () => {
    event.preventDefault();
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
      setDefinitionText("searching...");
      setSectionName("");
      setSectionText("");
      const response = await fetch("http://127.0.0.1:8080/pba", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: inputValue })
      });
      
      const result = await response.json();
      console.log(result.message);
      if (result.definition === null || result.section_name === null || result.section_text === null) {
        setError("Please enter a keyword that is related to pensions.");
        setDefinitionText("");
      }
      else {
        setDefinitionText(result.definition);
        setSectionText(result.section_text);
        setSectionName(result.section_name);
      }
      
      
  
      setInputValue(""); // clear input
    } catch (error) {
      console.error("Error sending keyword:", error);
    }
  };

    return (
      <div> 
        <h1> Pension Benefits Act Search</h1>
        <div>
        </div>
        <form onSubmit={handleSubmit}>
        <input 
          type="text" 
          placeholder="Enter keyword" 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <div>
        
          <p>submitted text: {submittedText}</p>

        </div>
        <div>
          <h2> Definition</h2>
          <p>{definition}</p>
        </div>

        <div> 
          <h2> Source</h2>
          <p>{sectionName}</p>
          <p>{sectionText}</p>
          </div>
      </div>
    )
    
  }