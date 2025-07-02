"use client";
import { useState } from "react";
import './page.css'

export default function feature3() {

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/feature3`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: inputValue })
      });
      
      const result = await response.json();
      console.log(result.message);
      if (result.definition == 'NULL') {
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