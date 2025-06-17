"use client";
import { useState, useEffect, useRef } from "react";
import './page.css';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  CategoryScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import 'chartjs-adapter-date-fns';

const whiteBackgroundPlugin = {
  id: 'whiteBackground',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

ChartJS.register(
  whiteBackgroundPlugin,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  CategoryScale
);

const distinctColors = [
  "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4",
  "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", "#008080", "#e6beff",
  "#9A6324", "#fffac8", "#800000", "#aaffc3", "#808000", "#ffd8b1",
  "#000075", "#808080"
];

export default function Ror() {
  const [excel, setExcel] = useState(null);
  const [error, setError] = useState("");
  const [backendData, setBackendData] = useState(null);

  // For single chart controls
  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSecurities, setSelectedSecurities] = useState([]);
  const [chartData, setChartData] = useState(null);
  const chartRef = useRef();
  // NEW: State for individual chart errors
  const [individualChartError, setIndividualChartError] = useState("");


  // New: portfolios state for multiple portfolios
  const [portfolios, setPortfolios] = useState([
    { id: 1, name: "Portfolio 1", selectedSecurities: [], weights: {} }
  ]);
  const [weightedFrequency, setWeightedFrequency] = useState("daily");
  const [weightedStartDate, setWeightedStartDate] = useState("");
  const [weightedEndDate, setWeightedEndDate] = useState("");
  const [weightedChartData, setWeightedChartData] = useState(null);
  const weightedChartRef = useRef();
  // New state for portfolio total returns
  const [portfolioTotalReturns, setPortfolioTotalReturns] = useState([]);
  // State to manage weight errors per portfolio
  const [portfolioWeightErrors, setPortfolioWeightErrors] = useState({});


  // Load zoom plugin once on client side
  useEffect(() => {
    import('chartjs-plugin-zoom')
      .then((mod) => ChartJS.register(mod.default))
      .catch(console.error);
  }, []);

  // Rebuild chart data whenever dependencies change
  useEffect(() => {
    prepareChartData();
  }, [backendData, frequency, selectedSecurities, startDate, endDate]);

  // Rebuild weighted chart data when backendData or weightedFrequency changes
  useEffect(() => {
    generateWeightedChart();
  }, [backendData, weightedFrequency]);


  // Handle Excel file input change
  const excelChange = (e) => {
    setExcel(e.target.files[0]);
    setError("");
  };

  // Submit file and fetch backend data
  const fileSubmit = async () => {
    if (!excel) {
      setError("Please upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", excel);

    try {
      const response = await fetch("http://127.0.0.1:8080/ror", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setBackendData(data);

      const defaultDailyRange = data.ranges?.daily || {};
      setStartDate(defaultDailyRange.min || "");
      setEndDate(defaultDailyRange.max || "");
      setSelectedSecurities([]);

      setWeightedFrequency("daily");
      setWeightedStartDate(defaultDailyRange.min || "");
      setWeightedEndDate(defaultDailyRange.max || "");
      setPortfolios([{ id: 1, name: "Portfolio 1", selectedSecurities: [], weights: {} }]); // Reset portfolios on new data load
      setWeightedChartData(null);
      setPortfolioTotalReturns([]); // Reset total returns
      setPortfolioWeightErrors({}); // Reset portfolio weight errors
      setIndividualChartError(""); // Clear individual chart error on new data load
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Error uploading file");
    }
  };

  // Add/remove portfolios
  const handleAddPortfolio = () => {
    const newId = portfolios.length > 0 ? Math.max(...portfolios.map(p => p.id)) + 1 : 1;
    setPortfolios([...portfolios, { id: newId, name: `Portfolio ${newId}`, selectedSecurities: [], weights: {} }]);
  };

  const handleRemovePortfolio = (idToRemove) => {
    setPortfolios(prev => prev.filter(p => p.id !== idToRemove));
    // Also remove any associated weight error when a portfolio is removed
    setPortfolioWeightErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[idToRemove];
        return newErrors;
    });
  };

  // Handle portfolio name change
  const handlePortfolioNameChange = (portfolioId, newName) => {
    setPortfolios(prev =>
      prev.map(p =>
        p.id === portfolioId
          ? { ...p, name: newName }
          : p
      )
    );
  };

  // Update selected securities for a specific portfolio
  const handlePortfolioSecurityToggle = (portfolioId, sec) => {
    setPortfolios(prev =>
      prev.map(p =>
        p.id === portfolioId
          ? {
              ...p,
              selectedSecurities: p.selectedSecurities.includes(sec)
                ? p.selectedSecurities.filter(s => s !== sec)
                : [...p.selectedSecurities, sec],
            }
          : p
      )
    );
  };

  // Update weights for a specific security within a specific portfolio
  const handlePortfolioWeightChange = (portfolioId, sec, value) => {
    setPortfolios(prev =>
      prev.map(p =>
        p.id === portfolioId
          ? {
              ...p,
              weights: {
                ...p.weights,
                [sec]: parseFloat(value) || 0,
              },
            }
          : p
      )
    );
  };

  // Select/Unselect all for a specific portfolio
  const handlePortfolioSelectAll = (portfolioId) => {
    if (!backendData?.securities) return;
    setPortfolios(prev =>
        prev.map(p => {
            if (p.id === portfolioId) {
                const allSelected = p.selectedSecurities.length === backendData.securities.length;
                return {
                    ...p,
                    selectedSecurities: allSelected ? [] : [...backendData.securities]
                };
            }
            return p;
        })
    );
  };


  // Frequency and securities handlers for single chart
  const handleFrequencyChange = (e) => {
    const newFreq = e.target.value;
    setFrequency(newFreq);
    const range = backendData?.ranges?.[newFreq] || {};
    setStartDate(range.min || "");
    setEndDate(range.max || "");
  };

  const handleSecurityToggle = (sec) => {
    setSelectedSecurities(prev =>
      prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]
    );
  };

  const handleSelectAll = () => {
    if (!backendData?.securities) return;
    const allSelected = selectedSecurities.length === backendData.securities.length;
    setSelectedSecurities(allSelected ? [] : [...backendData.securities]);
  };

  // Frequency and securities handlers for weighted chart
  const handleWeightedFrequencyChange = (e) => {
    const newFreq = e.target.value;
    setWeightedFrequency(newFreq);
    const range = backendData?.ranges?.[newFreq] || {};
    setWeightedStartDate(range.min || "");
    setWeightedEndDate(range.max || "");
  };

  // Prepare data for single securities chart
  const prepareChartData = () => {
    if (!backendData) {
      setIndividualChartError("Please upload an Excel file to get data.");
      setChartData(null);
      return;
    }
    if (selectedSecurities.length === 0) {
      setIndividualChartError("Please select at least one security to display the chart.");
      setChartData({ datasets: [] }); // Set datasets to empty for the empty state
      return;
    }

    // Clear error if conditions for error are not met
    setIndividualChartError("");

    const rawData = backendData[frequency];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    let allYValues = [];

    const datasets = selectedSecurities.map((sec, index) => {
      let dataPoints = rawData[sec] || [];

      if (start && end) {
        dataPoints = dataPoints.filter(({ Date: dateString }) => {
          const d = new Date(dateString);
          return d >= start && d <= end;
        });
      }

      let returnKey;
      if (frequency === 'quarter') {
        returnKey = 'QuarterReturn';
      } else {
        returnKey = `${frequency.charAt(0).toUpperCase() + frequency.slice(1)}Return`;
      }

      const data = dataPoints.map(point => {
        const yValue = point[returnKey] * 100;
        if (typeof yValue === 'number' && !isNaN(yValue)) {
          allYValues.push(yValue);
        }
        return {
          x: new Date(point.Date),
          y: yValue,
        };
      });

      return {
        label: sec,
        data: data,
        fill: false,
        borderColor: distinctColors[index % distinctColors.length],
        borderWidth: 2,
        backgroundColor: distinctColors[index % distinctColors.length],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 6,
        hoverRadius: 10,
        hitRadius: 10,
      };
    });

    let calculatedMinY, calculatedMaxY;
    if (allYValues.length > 0) {
      calculatedMinY = Math.min(...allYValues);
      calculatedMaxY = Math.max(...allYValues);

      const buffer = (calculatedMaxY - calculatedMinY) * 0.15;
      calculatedMinY = calculatedMinY - buffer;
      calculatedMaxY = calculatedMaxY + buffer;
    } else {
      calculatedMinY = undefined;
      calculatedMaxY = undefined;
    }

    setChartData({ datasets, calculatedMinY, calculatedMaxY });
  };

  // Generate weighted portfolio chart data
  const generateWeightedChart = () => {
    if (!backendData) {
      setWeightedChartData(null);
      setPortfolioTotalReturns([]);
      setPortfolioWeightErrors({});
      return;
    }

    let allChartDatasets = [];
    let allYValuesAcrossPortfolios = [];
    let tempPortfolioTotalReturns = [];
    let currentWeightErrors = {};
    let hasAnyWeightError = false; // Flag to track if any portfolio has an error

    console.log(`--- Generating Weighted Chart for Portfolios ---`);
    console.log(`  Weighted Chart Input Date Range: Start = ${weightedStartDate}, End = ${weightedEndDate}`);


    portfolios.forEach((portfolio, portfolioIndex) => {
      const totalWeight = portfolio.selectedSecurities.reduce(
        (sum, sec) => sum + (portfolio.weights[sec] || 0),
        0
      );

      // Check for weight errors
      if (portfolio.selectedSecurities.length > 0 && (totalWeight < 99.9 || totalWeight > 100.1)) {
        currentWeightErrors[portfolio.id] = `${portfolio.name}: Weights should add to 100%. Current total: ${totalWeight.toFixed(2)}%`;
        hasAnyWeightError = true; // Set flag if error found
      } else {
        // Clear error if it was previously set and now is valid
        if (portfolioWeightErrors[portfolio.id]) {
          delete currentWeightErrors[portfolio.id];
        }
      }

      // If there are no weight errors for THIS portfolio, proceed with data processing
      if (!currentWeightErrors[portfolio.id]) {
        const rawData = backendData[weightedFrequency];
        const start = weightedStartDate ? new Date(weightedStartDate) : null;
        const end = weightedEndDate ? new Date(weightedEndDate) : null;

        let returnKey;
        if (weightedFrequency === 'quarter') {
          returnKey = 'QuarterReturn';
        } else {
          returnKey = `${weightedFrequency.charAt(0).toUpperCase() + weightedFrequency.slice(1)}Return`;
        }

        const portfolioDataMap = new Map();

        // This section calculates the chart points (time series of weighted returns)
        portfolio.selectedSecurities.forEach(sec => {
          const weightFraction = (portfolio.weights[sec] || 0) / 100;
          let secDataForChart = rawData[sec] || []; // All data for current frequency for this security

          let effectiveChartStartDate = start;

          // Find the closest start date for the chart data for this specific security
          if (start) {
              const sortedSecDataForChart = [...secDataForChart].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
              let foundChartStartDataPoint = null;
              for (let i = sortedSecDataForChart.length - 1; i >= 0; i--) {
                  const dataPointDate = new Date(sortedSecDataForChart[i].Date);
                  if (dataPointDate <= start) {
                      foundChartStartDataPoint = sortedSecDataForChart[i];
                      break;
                  }
              }
              if (foundChartStartDataPoint) {
                  effectiveChartStartDate = new Date(foundChartStartDataPoint.Date);
              } else if (sortedSecDataForChart.length > 0) {
                  // If no date before or on 'start' is found, use the very first available date
                  effectiveChartStartDate = new Date(sortedSecDataForChart[0].Date);
              } else {
                  effectiveChartStartDate = null; // No data points at all for this security
              }
          }

          // Filter data points based on the effective start date for the chart
          let filteredChartDataPoints = [];
          if (effectiveChartStartDate && end) {
              filteredChartDataPoints = secDataForChart.filter(({ Date: dateString }) => {
                  const d = new Date(dateString);
                  return d >= effectiveChartStartDate && d <= end;
              });
          } else if (secDataForChart.length > 0) {
              // If no start/end specified, use all available data
              filteredChartDataPoints = secDataForChart;
          }

          filteredChartDataPoints.forEach(point => {
            const dateString = point.Date;
            const originalYValue = point[returnKey];

            if (typeof originalYValue === 'number' && !isNaN(originalYValue)) {
              const weightedYValue = originalYValue * weightFraction * 100;
              portfolioDataMap.set(dateString, (portfolioDataMap.get(dateString) || 0) + weightedYValue);
            }
          });
        });

        const sortedPortfolioData = Array.from(portfolioDataMap.entries())
          .map(([date, value]) => ({ x: new Date(date), y: value }))
          .sort((a, b) => a.x.getTime() - b.x.getTime());

        const portfolioYValues = sortedPortfolioData.map(point => point.y);
        allYValuesAcrossPortfolios.push(...portfolioYValues);

        // --- START OF SIMPLE WEIGHTED AVERAGE (TOTAL RETURN) CALCULATION ---
        // This section uses the "closest date before start" logic for start/end price for the total return summary.
        let simpleWeightedPortfolioReturn = 0;
        let allSecuritiesHaveValidPrices = true;

        console.log(`--- Calculating Simple Weighted Average for ${portfolio.name} ---`);

        portfolio.selectedSecurities.forEach(sec => {
          const weightFraction = (portfolio.weights[sec] || 0) / 100;
          const allSecDailyData = backendData.daily[sec] || [];
          const sortedData = [...allSecDailyData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()); // Ensure sorted by time

          let startPrice = null;
          let startPriceDate = null;
          let endPrice = null;
          let endPriceDate = null;

          // Find start price
          if (sortedData.length > 0) {
              if (start) {
                  // Find the latest data point on or before the 'start' date
                  let foundStartDataPoint = null;
                  for (let i = sortedData.length - 1; i >= 0; i--) {
                      const dataPointDate = new Date(sortedData[i].Date);
                      if (dataPointDate <= start) {
                          foundStartDataPoint = sortedData[i];
                          break;
                      }
                  }
                  // If a point is found on or before 'start', use its price
                  // Otherwise, if 'start' is before the very first data point, use the very first data point's price
                  if (foundStartDataPoint) {
                      startPrice = foundStartDataPoint.Price;
                      startPriceDate = foundStartDataPoint.Date;
                  } else {
                      startPrice = sortedData[0].Price; // Use the very first existing stock date
                      startPriceDate = sortedData[0].Date;
                  }
              } else {
                  // If no 'start' date is specified, use the very first existing stock date
                  startPrice = sortedData[0].Price;
                  startPriceDate = sortedData[0].Date;
              }
          }

          // Find end price
          if (sortedData.length > 0) {
              if (end) {
                  // Find the latest data point on or before the 'end' date
                  let foundEndDataPoint = null;
                  for (let i = sortedData.length - 1; i >= 0; i--) {
                      const dataPointDate = new Date(sortedData[i].Date);
                      if (dataPointDate <= end) {
                          foundEndDataPoint = sortedData[i];
                          break;
                      }
                  }
                  if (foundEndDataPoint) {
                      endPrice = foundEndDataPoint.Price;
                      endPriceDate = foundEndDataPoint.Date;
                  } else {
                      // If no data point found on or before 'end', endPrice remains null,
                      // which will lead to "N/A" for return, which is appropriate.
                  }
              } else {
                  // If no 'end' date is specified, use the very last existing stock date
                  endPrice = sortedData[sortedData.length - 1].Price;
                  endPriceDate = sortedData[sortedData.length - 1].Date;
              }
          }

          if (
            startPrice === null || endPrice === null ||
            typeof startPrice !== "number" || typeof endPrice !== "number" ||
            isNaN(startPrice) || isNaN(endPrice) || startPrice === 0
          ) {
            allSecuritiesHaveValidPrices = false;
            console.log(`  Security: ${sec} - SKIPPED (Invalid start/end price or not enough data)`);
            console.log(`    Attempted Start Date: ${startPriceDate || 'N/A'}, Price: ${startPrice}`);
            console.log(`    Attempted End Date: ${endPriceDate || 'N/A'}, Price: ${endPrice}`);
            return;
          }

          const securityTotalReturn = ((endPrice / startPrice) - 1); // As decimal
          const weightedContribution = (securityTotalReturn * weightFraction);
          simpleWeightedPortfolioReturn += weightedContribution;

          console.log(`  Security: ${sec}`);
          console.log(`    Start Price (from ${startPriceDate}): ${startPrice}`);
          console.log(`    End Price (from ${endPriceDate}): ${endPrice}`);
          console.log(`    Weight Fraction: ${weightFraction.toFixed(4)}`);
          console.log(`    Security Total Return (decimal): ${securityTotalReturn.toFixed(4)}`);
          console.log(`    Weighted Contribution: ${weightedContribution.toFixed(4)}`);
        });


        let portfolioCalculatedReturn = "N/A";
        if (allSecuritiesHaveValidPrices && portfolio.selectedSecurities.length > 0) {
            portfolioCalculatedReturn = (simpleWeightedPortfolioReturn * 100).toFixed(2) + "%";
            console.log(`Total Simple Weighted Portfolio Return for ${portfolio.name}: ${portfolioCalculatedReturn}`);
        } else if (portfolio.selectedSecurities.length === 0) {
            portfolioCalculatedReturn = "N/A (No securities selected)";
            console.log(`Total Simple Weighted Portfolio Return for ${portfolio.name}: ${portfolioCalculatedReturn}`);
        } else {
            portfolioCalculatedReturn = "N/A (Missing price data or invalid range for some securities)";
            console.log(`Total Simple Weighted Portfolio Return for ${portfolio.name}: ${portfolioCalculatedReturn}`);
        }
        console.log(`--- End Calculation for ${portfolio.name} ---`);


        // Add to temporary array for total returns
        tempPortfolioTotalReturns.push({
            id: portfolio.id,
            name: portfolio.name,
            totalReturn: portfolioCalculatedReturn
        });
        // --- END OF SIMPLE WEIGHTED AVERAGE (TOTAL RETURN) CALCULATION ---

        if (sortedPortfolioData.length > 0) {
          allChartDatasets.push({
            label: portfolio.name,
            data: sortedPortfolioData,
            fill: false,
            borderColor: distinctColors[portfolioIndex % distinctColors.length],
            backgroundColor: distinctColors[portfolioIndex % distinctColors.length],
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0,
          });
        }
      }
    });

    setPortfolioWeightErrors(currentWeightErrors); // Update the errors state once all portfolios are processed

    // If any portfolio has a weight error, clear the chart data and total returns
    if (hasAnyWeightError) {
      setWeightedChartData(null);
      setPortfolioTotalReturns([]);
    } else { // Only set chart data if no errors across any portfolio
      let calculatedWeightedMinY, calculatedWeightedMaxY;
      if (allYValuesAcrossPortfolios.length > 0) {
        calculatedWeightedMinY = Math.min(...allYValuesAcrossPortfolios);
        calculatedWeightedMaxY = Math.max(...allYValuesAcrossPortfolios);

        const weightedBuffer = (calculatedWeightedMaxY - calculatedWeightedMinY) * 0.15;
        calculatedWeightedMinY = calculatedWeightedMinY - weightedBuffer;
        calculatedWeightedMaxY = calculatedWeightedMaxY + weightedBuffer;
      } else {
        calculatedWeightedMinY = undefined;
        calculatedWeightedMaxY = undefined;
      }

      setWeightedChartData({
        datasets: allChartDatasets,
        calculatedMinY: calculatedWeightedMinY,
        calculatedMaxY: calculatedWeightedMaxY,
      });
      setPortfolioTotalReturns(tempPortfolioTotalReturns);
    }
  };

  // Calculate total returns for selected securities (daily data)
  const calculateTotalReturns = () => {
    if (!backendData || selectedSecurities.length === 0) return [];

    const rawData = backendData["daily"];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    console.log(`--- Calculating Individual Security Total Returns ---`);
    console.log(`  Individual Chart Date Range: Start = ${startDate}, End = ${endDate}`);

    return selectedSecurities.map(sec => {
      const allData = rawData[sec] || [];
      const sortedData = [...allData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()); // Ensure sorted by time

      if (sortedData.length === 0) return { sec, totalReturn: "N/A" };

      let startPrice = null;
      let startPriceDate = null;
      let endPrice = null;
      let endPriceDate = null;

      // Find start price
      if (sortedData.length > 0) {
          if (start) {
              let foundStartDataPoint = null;
              for (let i = sortedData.length - 1; i >= 0; i--) {
                  const dataPointDate = new Date(sortedData[i].Date);
                  if (dataPointDate <= start) {
                      foundStartDataPoint = sortedData[i];
                      break;
                  }
              }
              if (foundStartDataPoint) {
                  startPrice = foundStartDataPoint.Price;
                  startPriceDate = foundStartDataPoint.Date;
              } else {
                  startPrice = sortedData[0].Price; // Use the very first existing stock date
                  startPriceDate = sortedData[0].Date;
              }
          } else {
              startPrice = sortedData[0].Price;
              startPriceDate = sortedData[0].Date;
          }
      }

      // Find end price
      if (sortedData.length > 0) {
          if (end) {
              let foundEndDataPoint = null;
              for (let i = sortedData.length - 1; i >= 0; i--) {
                  const dataPointDate = new Date(sortedData[i].Date);
                  if (dataPointDate <= end) {
                      foundEndDataPoint = sortedData[i];
                      break;
                  }
              }
              if (foundEndDataPoint) {
                  endPrice = foundEndDataPoint.Price;
                  endPriceDate = foundEndDataPoint.Date;
              }
          } else {
              endPrice = sortedData[sortedData.length - 1].Price;
              endPriceDate = sortedData[sortedData.length - 1].Date;
          }
      }

      if (
        typeof startPrice !== "number" ||
        typeof endPrice !== "number" ||
        isNaN(startPrice) || isNaN(endPrice) || startPrice === 0
      ) {
        console.log(`  Security: ${sec} - SKIPPED (Invalid start/end price or not enough data)`);
        console.log(`    Attempted Start Date: ${startPriceDate || 'N/A'}, Price: ${startPrice}`);
        console.log(`    Attempted End Date: ${endPriceDate || 'N/A'}, Price: ${endPrice}`);
        return { sec, totalReturn: "N/A" };
      }

      const totalReturn = ((endPrice / startPrice) - 1) * 100;
      return { sec, totalReturn: totalReturn.toFixed(2) + "%" };
    });
  };



  // Export chart functionality
  const exportChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'individual-ror-chart.png';
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  // Export weighted chart functionality
  const exportWeightedChart = () => {
    if (weightedChartRef.current) {
      const link = document.createElement('a');
      link.download = 'weighted-ror-chart.png';
      link.href = weightedChartRef.current.toBase64Image();
      link.click();
    }
  };


  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Rate of Return Graphs</h1>

      {/* File Upload Section */}
      <div style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "20px" }}>
        <label htmlFor="excel">Excel File:</label>
        <input
          id="excel"
          type="file"
          accept=".xls,.xlsx,.xlsm,.xlsb"
          onChange={excelChange}
        />
        <button onClick={fileSubmit} style={{ marginLeft: "10px" }}>
          Submit
        </button>
        {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
      </div>

      {backendData && (
        <>
          {/* First Chart Section: Individual Rate of Return Chart */}
          <div className="ror-chart-section" style={{ marginBottom: "50px", borderBottom: "1px solid #eee", paddingBottom: "30px" , paddingLeft: "50px", paddingRight: "50px"}}>
            <h2>Individual Securities Rate of Return Chart</h2>
            <div className="customize-section" style={{ marginTop: "20px", background: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
              <h3>Customize Chart</h3>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ marginRight: "10px" }}>Frequency:</label>
                <select value={frequency} onChange={handleFrequencyChange}>
                  <option value="daily">Daily</option>
                  <option value="quarter">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              {backendData.ranges?.[frequency] && (
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ marginRight: "10px" }}>Date Range:</label>
                  <input
                    type="date"
                    value={startDate}
                    min={backendData.ranges[frequency].min}
                    max={endDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span style={{ margin: "0 10px" }}>to</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={backendData.ranges[frequency].max}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}

              {backendData.securities?.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ marginRight: "10px", verticalAlign: "top" }}>Securities:</label>
                  <button onClick={handleSelectAll} style={{ marginLeft: "10px" }}>
                    {selectedSecurities.length === backendData.securities.length
                      ? "Unselect All"
                      : "Select All"}
                  </button>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
                    {backendData.securities.map((sec) => (
                      <label key={`chart1-${sec}`} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <input
                          type="checkbox"
                          checked={selectedSecurities.includes(sec)}
                          onChange={() => handleSecurityToggle(sec)}
                        />
                        <span>{sec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {selectedSecurities.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>Total Return by Security (Selected Time Period)</h3>
              <ul>
                {calculateTotalReturns().map(({ sec, totalReturn }, idx) => (
                  <li key={idx}>
                    <strong>{sec}</strong>: {totalReturn}
                  </li>
                ))}
              </ul>
            </div>
          )}


              <div style={{ marginTop: "20px" }}>
                <button onClick={() => chartRef.current?.resetZoom()} style={{ marginRight: "10px" }}>
                  Reset Zoom
                </button>
                <button onClick={exportChart}>
                  Export Chart
                </button>
              </div>
            </div>

            {/* NEW: Display individual chart error */}
            {individualChartError && (
                <p style={{ color: "red", textAlign: "center", marginTop: "10px" }}>{individualChartError}</p>
            )}

            {chartData && chartData.datasets.length > 0 && (
              <div style={{ marginTop: "30px" }}>
                  <Line
                    ref={chartRef}
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      aspectRatio: 1.2,
                      plugins: {
                        title: { display: true, text: "Individual Rate of Return", font: { size: 18 } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`, }, },
                        legend: {
                          onClick: null,
                          labels: { usePointStyle: true, boxWidth: 12, boxHeight: 12, color: "#000" }
                        },
                        zoom: {
                          pan: { enabled: true, mode: 'x',  },
                          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', },
                          limits: {
                            x: {
                              min: startDate ? new Date(startDate).getTime() : undefined,
                              max: endDate ? new Date(endDate).getTime() : undefined,
                            }
                          }
                        },


                      },
                      scales: {
                        x: { type: "time", time: { unit: frequency === 'daily' ? 'day' : (frequency === 'quarter' ? 'quarter' : 'year') }, title: { display: true, text: "Date" }, },
                        y: {
                          min: Math.floor(chartData?.calculatedMinY * 100) / 100,
                          max: Math.ceil(chartData?.calculatedMaxY * 100) / 100,
                          ticks: {
                            callback: (value) => `${value}%`,
                          },
                          title: { display: true, text: "Return (%)" },
                        },
                      },
                    }}
                  />
              </div>
            )}
          </div>

          {/* Second Chart Section: Weighted Rate of Return Chart */}
          <div className="weighted-ror-chart-section" style={{ marginTop: "50px" , paddingLeft: "50px" , paddingRight: "50px"}}>
            <h2>Weighted Portfolios Rate of Return Chart</h2> {/* Changed title for clarity */}
            <div className="customize-section" style={{ marginTop: "20px", background: "#f9f9f9", padding: "20px", borderRadius: "8px" }}>
              <h3>Customize Weighted Chart</h3>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ marginRight: "10px" }}>Frequency:</label>
                <select value={weightedFrequency} onChange={handleWeightedFrequencyChange}>
                  <option value="daily">Daily</option>
                  <option value="quarter">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              {backendData.ranges?.[weightedFrequency] && (
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ marginRight: "10px" }}>Date Range:</label>
                  <input
                    type="date"
                    value={weightedStartDate}
                    min={backendData.ranges[weightedFrequency].min}
                    max={weightedEndDate}
                    onChange={(e) => setWeightedStartDate(e.target.value)}
                  />
                  <span style={{ margin: "0 10px" }}>to</span>
                  <input
                    type="date"
                    value={weightedEndDate}
                    min={weightedStartDate}
                    max={backendData.ranges[weightedFrequency].max}
                    onChange={(e) => setWeightedEndDate(e.target.value)}
                  />
                </div>
              )}

              <div style={{ marginBottom: "20px" }}>
                {portfolios.map((portfolio, pIdx) => (
                  <div key={portfolio.id} style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "15px", borderRadius: "8px" }}>
                    <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      {/* NEW: Input field for portfolio name */}
                      <input
                        type="text"
                        value={portfolio.name}
                        onChange={(e) => handlePortfolioNameChange(portfolio.id, e.target.value)}
                        style={{ fontSize: "1em", padding: "5px", borderRadius: "4px", border: "1px solid #ddd", flexGrow: 1, marginRight: "10px" }}
                      />
                      {portfolios.length > 1 && (
                        <button onClick={() => handleRemovePortfolio(portfolio.id)} style={{ background: "#dc3545", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 10px", cursor: "pointer" }}>
                          Remove
                        </button>
                      )}
                    </h4>
                    {/* NEW: Display weight error message */}
                    {portfolioWeightErrors[portfolio.id] && (
                        <p style={{ color: "red", fontSize: "0.9em", marginBottom: "10px" }}>
                            {portfolioWeightErrors[portfolio.id]}
                        </p>
                    )}
                    {backendData.securities?.length > 0 && (
                      <div style={{ marginBottom: "10px" }}>
                         <button onClick={() => handlePortfolioSelectAll(portfolio.id)} style={{ marginBottom: "10px" }}>
                            {portfolio.selectedSecurities.length === backendData.securities.length
                                ? "Unselect All"
                                : "Select All"}
                         </button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {backendData.securities.map((sec) => (
                            <div key={`portfolio-${portfolio.id}-${sec}`} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", border: "1px solid #eee", padding: "8px", borderRadius: "5px", background: "#fff" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
                                <input
                                  type="checkbox"
                                  checked={portfolio.selectedSecurities.includes(sec)}
                                  onChange={() => handlePortfolioSecurityToggle(portfolio.id, sec)}
                                />
                                <span>{sec}</span>
                              </label>
                              {portfolio.selectedSecurities.includes(sec) && (
                                <input
                                  type="number"
                                  placeholder="Weight %"
                                  value={portfolio.weights[sec] || ''}
                                  onChange={(e) => handlePortfolioWeightChange(portfolio.id, sec, e.target.value)}
                                  style={{ width: "80px", padding: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {portfolio.selectedSecurities.length > 0 && (
                      <div style={{ marginTop: "10px" }}>
                        <strong>Current Total Weight: </strong>
                        {(portfolio.selectedSecurities.reduce(
                          (sum, sec) => sum + (portfolio.weights[sec] || 0),
                          0
                        )).toFixed(2)}%
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={handleAddPortfolio} style={{ background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", padding: "8px 15px", cursor: "pointer", marginTop: "10px" }}>
                  Add Portfolio
                </button>
              </div>

              {/* NEW: Manual trigger button for weighted chart */}
              <div style={{ marginTop: "20px" }}>
                <button onClick={generateWeightedChart} style={{ marginRight: "10px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", padding: "8px 15px", cursor: "pointer" }}>
                  Generate Weighted Chart
                </button>
                <button onClick={() => weightedChartRef.current?.resetZoom()} style={{ marginRight: "10px" }}>
                  Reset Zoom
                </button>
                <button onClick={exportWeightedChart}>
                  Export Chart
                </button>
              </div>
            </div>

            {weightedChartData && (
              <div style={{ marginTop: "30px" }}>
                {weightedChartData.datasets.length > 0 ? (
                  <>
                    <Line
                      ref={weightedChartRef}
                      data={weightedChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 1.2,
                        plugins: {
                          title: { display: true, text: "Weighted Portfolios Rate of Return", font: { size: 18 } },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
                            },
                          },
                          legend: {
                            onClick: null,
                            labels: { usePointStyle: true, boxWidth: 12, boxHeight: 12, color: "#000" }
                          },
                          zoom: {
                            pan: { enabled: true, mode: 'x', },
                            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', },
                            limits: {
                                x: {
                                    min: weightedStartDate ? new Date(weightedStartDate).getTime() : undefined,
                                    max: weightedEndDate ? new Date(weightedEndDate).getTime() : undefined,
                                }
                            }
                          },
                        },
                        scales: {
                          x: { type: "time", time: { unit: weightedFrequency === 'daily' ? 'day' : (weightedFrequency === 'quarter' ? 'quarter' : 'year') }, title: { display: true, text: "Date" }, },
                          y: {
                            min: Math.floor(weightedChartData?.calculatedMinY * 100) / 100,
                            max: Math.ceil(weightedChartData?.calculatedMaxY * 100) / 100,
                            ticks: {
                              callback: (value) => `${value}%`,
                            },
                            title: { display: true, text: "Return (%)" },
                          },
                        },
                      }}
                    />
                    <div style={{ marginTop: '20px' }}>
                      <h3>Portfolio Total Returns (Selected Time Period)</h3>
                      <ul>
                        {portfolioTotalReturns.map((p, idx) => (
                          <li key={idx}>
                            <strong>{p.name}</strong>: {p.totalReturn}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', color: '#555' }}>Please select securities and weights for at least one portfolio to display the weighted chart.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}