"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import './page.css'
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
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
// import DatePicker from "react-datepicker";
// import "react-datepicker/dist/react-datepicker.css";



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

function formatDateUTC(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // Gives 'YYYY-MM-DD'
}

// function formatDateUTC(dateInput) {
//   const d = new Date(dateInput);
//   return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
// }

export default function Ror() {
  const [excel, setExcel] = useState(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [error, setError] = useState("");
  const [backendData, setBackendData] = useState(null);

  const [loading, setLoading] = useState(false);

  // For single chart controls
  const [frequency, setFrequency] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSecurities, setSelectedSecurities] = useState([]);
  const [chartData, setChartData] = useState(null);
  const chartRef = useRef();
  const priceChartRef = useRef();

  const [showPriceChart, setShowPriceChart] = useState(false);
  const [priceChartData, setPriceChartData] = useState(null);
  // NEW: State for individual chart errors
  const [individualChartError, setIndividualChartError] = useState("");
  const [individualTotalReturns, setIndividualTotalReturns] = useState([]);


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

  // Load zoom plugin once on client side
  useEffect(() => {
    import('chartjs-plugin-zoom')
      .then((mod) => ChartJS.register(mod.default))
      .catch(console.error);
  }, []);

  // Rebuild chart data whenever dependencies change
  useEffect(() => {
    generateIndividualChart();
    generatePriceChart();
  }, [backendData, frequency, selectedSecurities, startDate, endDate]);

  // Rebuild weighted chart data when backendData or weightedFrequency changes
  useEffect(() => {
    generateWeightedChart();
  }, [backendData, weightedFrequency]);

  useEffect(() => {
    if (backendData && selectedSecurities.length > 0) {
        const returns = calculateIndividualReturns(backendData, selectedSecurities, startDate, endDate);
        setIndividualTotalReturns(returns);
    } else {
        setIndividualTotalReturns([]);
    }
}, [backendData, selectedSecurities, startDate, endDate]);


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
    setLoading(true);
    setBackendData(false);

    const formData = new FormData();
    formData.append("file", excel);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/ror`, {
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
    finally {
      setLoading(false);
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
    // const range = backendData?.ranges?.[newFreq] || {};
    // setStartDate(range.min || "");
    // setEndDate(range.max || "");
  };

  useEffect(() => {
    if (!backendData || !backendData[frequency]) return;
  
    const selected = selectedSecurities || [];
    const rawData = backendData[frequency];
  
    // No securities selected — use full range
    if (selected.length === 0) {
      const defaultRange = backendData.ranges?.[frequency] || {};
      setStartDate(defaultRange.min || "");
      setEndDate(defaultRange.max || "");
      return;
    }
  
    const startDates = [];
    const endDates = [];
  
    selected.forEach(sec => {
      const secData = rawData[sec];
      if (secData && secData.length > 0) {
        const dates = secData.map(d => new Date(d.Date));
        dates.sort((a, b) => a - b);
        startDates.push(dates[0]);
        endDates.push(dates[dates.length - 1]);
      }
    });
  
    if (startDates.length === 0 || endDates.length === 0) return;
  
    const min = selected.length === 1
      ? startDates[0]
      : new Date(Math.max(...startDates.map(d => d.getTime())));
  
    const max = selected.length === 1
      ? endDates[0]
      : new Date(Math.min(...endDates.map(d => d.getTime())));
  
    setStartDate(min.toISOString().split("T")[0]);
    setEndDate(max.toISOString().split("T")[0]);
  }, [frequency, selectedSecurities, backendData]);
  

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

  const allSelectedSecurities = portfolios
  .flatMap(p => p.selectedSecurities)
  .filter((v, i, a) => a.indexOf(v) === i); // remove duplicates

  useEffect(() => {
    if (!backendData || !backendData[weightedFrequency] || !portfolios || portfolios.length === 0) return;
  
    const rawData = backendData[weightedFrequency];
  
    const allSelected = portfolios
      .flatMap(p => p.selectedSecurities)
      .filter((v, i, a) => a.indexOf(v) === i); // unique securities
  
    if (allSelected.length === 0) {
      const defaultRange = backendData.ranges?.[weightedFrequency] || {};
      setWeightedStartDate(defaultRange.min || "");
      setWeightedEndDate(defaultRange.max || "");
      return;
    }
  
    const startDates = [];
    const endDates = [];
  
    allSelected.forEach(sec => {
      const secData = rawData[sec];
      if (secData && secData.length > 0) {
        const dates = secData.map(d => new Date(d.Date));
        dates.sort((a, b) => a - b);
        startDates.push(dates[0]);
        endDates.push(dates[dates.length - 1]);
      }
    });
  
    if (startDates.length === 0 || endDates.length === 0) return;
  
    const min = allSelected.length === 1
      ? startDates[0]
      : new Date(Math.max(...startDates.map(d => d.getTime())));
  
    const max = allSelected.length === 1
      ? endDates[0]
      : new Date(Math.min(...endDates.map(d => d.getTime())));
  
    setWeightedStartDate(min.toISOString().split("T")[0]);
    setWeightedEndDate(max.toISOString().split("T")[0]);
  }, [weightedFrequency, portfolios, backendData]);
  
  

  // Prepare data for single securities chart
  const generateIndividualChart = () => {
    if (!backendData) {
      setIndividualChartError("Please upload an Excel file to get data.");
      setChartData(null);
      return;
    }
    if (selectedSecurities.length === 0) {
      setIndividualChartError("Please select at least one market index to display the chart.");
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
      } else if (frequency === 'monthly') { // Added monthly condition
        returnKey = 'MonthlyReturn';
      } else {
        returnKey = `${frequency.charAt(0).toUpperCase() + frequency.slice(1)}Return`;
      }

      const data = dataPoints.map(point => {
        const yValue = point[returnKey] * 100;
        const xValue = new Date(point.Date);
        console.log(`Security: ${sec}, Date: ${xValue.toISOString().slice(0, 10)}, Return: ${yValue.toFixed(2)}%`);
        if (typeof yValue === 'number' && !isNaN(yValue)) {
          allYValues.push(yValue);
        }
        return {
          //x: new Date(point.Date),
          x: formatDateUTC(point.Date),
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
        hoverRadius: 15,
        hitRadius: 15,
      };
    });


    setChartData({ datasets });
  };

  const generatePriceChart = () => {
    if (!backendData || !backendData[frequency]) {
      setPriceChartData(null);
      return;
    }
  
    const rawData = backendData[frequency];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
  
    const datasets = selectedSecurities.map((sec, index) => {
      let dataPoints = rawData[sec] || [];
  
      if (start && end) {
        dataPoints = dataPoints.filter(({ Date: dateString }) => {
          const d = new Date(dateString);
          return d >= start && d <= end;
        });
      }
  
      const data = dataPoints.map(point => ({
        x: formatDateUTC(point.Date),
        y: point.Price,
      }));
  
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
        hoverRadius: 15,
        hitRadius: 15,
      };
    });
  
    setPriceChartData({ datasets });
  };
  

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
    
      if (portfolio.selectedSecurities.length > 0 && (totalWeight < 99.9 || totalWeight > 100.1)) {
        currentWeightErrors[portfolio.id] = `Weights should add up to 100%. Current total: ${totalWeight.toFixed(2)}%`;
        hasAnyWeightError = true;
        return;
      }
    
      if (portfolioWeightErrors[portfolio.id]) {
        delete currentWeightErrors[portfolio.id];
      }
    
      const rawData = backendData[weightedFrequency];
      let returnKey = `${weightedFrequency.charAt(0).toUpperCase() + weightedFrequency.slice(1)}Return`;
      if (weightedFrequency === 'daily') returnKey = 'DailyReturn';
      if (weightedFrequency === 'monthly') returnKey = 'MonthlyReturn';
      if (weightedFrequency === 'quarter') returnKey = 'QuarterReturn';
      if (weightedFrequency === 'annual') returnKey = 'AnnualReturn';
    
      // 🔍 Determine overlap window
      const allDatesPerSec = portfolio.selectedSecurities.map(sec => {
        const secData = rawData[sec] || [];
        const sorted = secData.sort((a, b) => new Date(a.Date) - new Date(b.Date));
        return sorted.length > 0 ? {
          start: new Date(sorted[0].Date),
          end: new Date(sorted[sorted.length - 1].Date),
        } : null;
      }).filter(Boolean);
    
      if (allDatesPerSec.length === 0) return;
    
      const overlapStart = new Date(Math.max(...allDatesPerSec.map(d => d.start.getTime())));
      const overlapEnd = new Date(Math.min(...allDatesPerSec.map(d => d.end.getTime())));
    
      // Override with user range if tighter
      const userStart = weightedStartDate ? new Date(weightedStartDate) : null;
      const userEnd = weightedEndDate ? new Date(weightedEndDate) : null;
    
      const finalStart = userStart ? new Date(Math.max(overlapStart.getTime(), userStart.getTime())) : overlapStart;
      const finalEnd = userEnd ? new Date(Math.min(overlapEnd.getTime(), userEnd.getTime())) : overlapEnd;
    
      const portfolioDataMap = new Map();
    
      portfolio.selectedSecurities.forEach(sec => {
        const weightFraction = (portfolio.weights[sec] || 0) / 100;
        let secData = rawData[sec] || [];
    
        const filtered = secData.filter(({ Date: dateStr }) => {
          const d = new Date(dateStr);
          return d >= finalStart && d <= finalEnd;
        });
    
        filtered.forEach(point => {
          const date = point.Date;
          const value = point[returnKey];
          if (typeof value === 'number' && !isNaN(value)) {
            const weightedValue = value * weightFraction * 100;
            portfolioDataMap.set(date, (portfolioDataMap.get(date) || 0) + weightedValue);
          }
        });
      });
    
      const sortedPortfolioData = Array.from(portfolioDataMap.entries())
        .map(([date, y]) => ({ x: formatDateUTC(date), y }))
        .sort((a, b) => new Date(a.x) - new Date(b.x));
    
      const portfolioYValues = sortedPortfolioData.map(p => p.y);
      allYValuesAcrossPortfolios.push(...portfolioYValues);
    
      const result = calculatePortfolioReturns(
        portfolio,
        backendData,
        weightedStartDate, // Pass original weightedStartDate
        weightedEndDate // Pass original weightedEndDate
      );
      
      //const name = result.isPartialPeriod ? `${portfolio.name} (Partial Period)` : portfolio.name;
      const name = portfolio.name
      console.log(name);
      
      tempPortfolioTotalReturns.push({
        id: portfolio.id,
        name: portfolio.name,
        totalReturn: result.value,
        isPartial: result.isPartialPeriod,
        startDateStr: finalStart.toISOString().split("T")[0],
        endDateStr: finalEnd.toISOString().split("T")[0]
      });
      
      
    
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
          hoverRadius: 15,
          hitRadius: 15,
        });
      }
    });
    
  
    setPortfolioWeightErrors(currentWeightErrors);
  
    if (hasAnyWeightError) {
      setWeightedChartData(null);
      setPortfolioTotalReturns([]);
    } else {
      let calculatedWeightedMinY, calculatedWeightedMaxY;
      if (allYValuesAcrossPortfolios.length > 0) {
        calculatedWeightedMinY = Math.min(...allYValuesAcrossPortfolios);
        calculatedWeightedMaxY = Math.max(...allYValuesAcrossPortfolios);
  
        const weightedBuffer = (calculatedWeightedMaxY - calculatedWeightedMinY) * 0.15;
        calculatedWeightedMinY -= weightedBuffer;
        calculatedWeightedMaxY += weightedBuffer;
      } else {
        calculatedWeightedMinY = undefined;
        calculatedWeightedMaxY = undefined;
      }
  
      setWeightedChartData({
        datasets: allChartDatasets});
      setPortfolioTotalReturns(tempPortfolioTotalReturns);
    }
  };
  
// Helper function to find the closest price on or before a given date
const findPriceOnOrBefore = (data, targetDateObj) => {
    if (!targetDateObj) return { price: null, date: null };

    let foundPrice = null;
    let foundDate = null;
    
    // Iterate backwards to find the last price on or before targetDate
    for (let i = data.length - 1; i >= 0; i--) {
        const dataPointDate = new Date(data[i].Date);
        if (dataPointDate <= targetDateObj) {
            foundPrice = data[i].Price;
            foundDate = data[i].Date;
            break;
        }
    }
    
    // If no date found before or on targetDate, take the very first available data point
    if (foundPrice === null && data.length > 0) {
        foundPrice = data[0].Price;
        foundDate = data[0].Date;
    }
    return { price: foundPrice, date: foundDate };
};

const calculatePortfolioReturns = (portfolio, backendData, startDateStr, endDateStr) => {
  const userStartDateObj = startDateStr ? new Date(startDateStr) : null;
  const userEndDateObj = endDateStr ? new Date(endDateStr) : null;

  let simpleWeightedPortfolioReturn = 0;
  let allSecuritiesHaveValidPrices = true;
  let isPartialPeriod = false;

  portfolio.selectedSecurities.forEach(sec => {
    const weightFraction = (portfolio.weights[sec] || 0) / 100;
    const allSecDailyData = backendData.daily[sec] || [];
    const sortedData = [...allSecDailyData].sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // Find start price
    const { price: startPrice, date: startPriceDate } = findPriceOnOrBefore(sortedData, userStartDateObj);

    // Find end price
    const { price: endPrice, date: endPriceDate } = findPriceOnOrBefore(sortedData, userEndDateObj);

    // Check if the found dates are exactly the user's requested dates (if provided)
    // If user provided a start date AND the found start price date doesn't match the user's start date
    if (startDateStr && formatDateUTC(startPriceDate) !== startDateStr) {
      isPartialPeriod = true;
    }
    // If user provided an end date AND the found end price date doesn't match the user's end date
    if (endDateStr && formatDateUTC(endPriceDate) !== endDateStr) {
      isPartialPeriod = true;
    }

    if (
      startPrice === null || endPrice === null ||
      typeof startPrice !== "number" || typeof endPrice !== "number" ||
      isNaN(startPrice) || isNaN(endPrice) || startPrice === 0
    ) {
      allSecuritiesHaveValidPrices = false;
      return;
    }

    const securityTotalReturn = (endPrice / startPrice) - 1;
    const weightedContribution = securityTotalReturn * weightFraction;
    simpleWeightedPortfolioReturn += weightedContribution;
  });

  if (allSecuritiesHaveValidPrices && portfolio.selectedSecurities.length > 0) {
    return {
      value: (simpleWeightedPortfolioReturn * 100).toFixed(2) + "%",
      isPartialPeriod,
    };
  } else if (portfolio.selectedSecurities.length === 0) {
    return {
      value: "N/A (No securities selected)",
      isPartialPeriod: false,
    };
  } else {
    return {
      value: "N/A (Missing price data or invalid range for some securities)",
      isPartialPeriod: false,
    };
  }
};
  

  // Calculate total returns for selected securities (daily data)
  const calculateIndividualReturns = (backendData, selectedSecurities, startDateStr, endDateStr) => {
    if (!backendData || selectedSecurities.length === 0) return [];
  
    const rawData = backendData["rawPrices"];
    const userStartDateObj = startDateStr ? new Date(startDateStr) : null;
    const userEndDateObj = endDateStr ? new Date(endDateStr) : null;
  
    console.log(`--- Calculating Individual Security Total Returns ---`);
    console.log(`  Individual Chart Date Range: Start = ${startDateStr}, End = ${endDateStr}`);
  
    return selectedSecurities.map(sec => {
      const allData = rawData[sec] || [];
      const sortedData = [...allData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  
      if (sortedData.length === 0) {
        console.log(`  ${sec}: No price data available`);
        return { sec, totalReturn: "N/A (No data)", disclaimer: "" }; // Initialize disclaimer to empty
      }
  
      // Find start price
      const { price: startPrice, date: startPriceDate } = findPriceOnOrBefore(sortedData, userStartDateObj);
  
      // Find end price
      const { price: endPrice, date: endPriceDate } = findPriceOnOrBefore(sortedData, userEndDateObj);
  
      // 🔍 Logging start/end date and price info
      console.log(`  ${sec}:`);
      console.log(`    Start Date Used: ${startPriceDate}, Start Price: ${startPrice}`);
      console.log(`    End Date Used:   ${endPriceDate}, End Price:   ${endPrice}`);
  
      let isPartial = false;
      // If user provided a start date AND the found start price date doesn't match the user's start date
      if (startDateStr && formatDateUTC(startPriceDate) !== startDateStr) {
        isPartial = true;
      }
      // If user provided an end date AND the found end price date doesn't match the user's end date
      if (endDateStr && formatDateUTC(endPriceDate) !== endDateStr) {
        isPartial = true;
      }
      const disclaimer = isPartial ? `    (from ${startDateStr} to ${endPriceDate})` : "";


      if (
        startPrice === null || endPrice === null ||
        typeof startPrice !== "number" || typeof endPrice !== "number" ||
        isNaN(startPrice) || isNaN(endPrice) || startPrice === 0
      ) {
        return { sec, totalReturn: "N/A (Missing price data or invalid range)", disclaimer };
      }
  
      const totalReturnDecimal = (endPrice / startPrice) - 1;
      const totalReturn = (totalReturnDecimal * 100).toFixed(2) + "%";
      
      return { sec, totalReturn, disclaimer };
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
  const exportSecurities = (data) => {
    const wb = XLSX.utils.book_new();
  
    const allFrequencies = ["daily", "monthly", "quarter", "annual"];
  
    // Assume all frequencies have the same security keys
    Object.keys(data["daily"]).forEach((security) => {
      // Collect data from all frequencies for this security
      const merged = {};
  
      allFrequencies.forEach((freq) => {
        const freqData = data[freq][security] || [];
        freqData.forEach(entry => {
          const dateStr = entry.Date;
          if (!merged[dateStr]) {
            merged[dateStr] = { Date: dateStr };
          }
          merged[dateStr].Price = entry.Price; // last one will stick (assumed same price per freq)
          const returnKey = `${freq.charAt(0).toUpperCase() + freq.slice(1)} Return`;
          merged[dateStr][returnKey] = entry[`${freq.charAt(0).toUpperCase() + freq.slice(1)}Return`];
        });
      });
  
      const rows = Object.values(merged).sort((a, b) => new Date(a.Date) - new Date(b.Date));
      const ws = XLSX.utils.json_to_sheet(rows);
  
      // Find columns that contain returns, e.g. Daily Return, Monthly Return, etc.
      const range = XLSX.utils.decode_range(ws['!ref']);
      const headerRow = 0; // headers are in the first row
      const returnCols = [];
  
      // Find the column indexes of the return headers
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: C });
        const cell = ws[cellAddress];
        if (cell && typeof cell.v === 'string' && cell.v.includes('Return')) {
          returnCols.push(C);
        }
      }
  
      // Apply percentage format to return columns, starting from row 1 (data rows)
      for (const col of returnCols) {
        for (let R = 1; R <= range.e.r; ++R) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: col });
          const cell = ws[cellAddress];
          if (cell && typeof cell.v === 'number') {
            cell.z = '0.00%'; // two decimal percent format
          }
        }
      }
  
      XLSX.utils.book_append_sheet(wb, ws, security);
    });
  
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), "individual-securities.xlsx");
  };
  
  
  // Helper function to get the correct return key from backend data
  const getReturnKey = (frequency) => {
    if (frequency === 'daily') return 'DailyReturn';
    if (frequency === 'monthly') return 'MonthlyReturn';
    if (frequency === 'quarter') return 'QuarterReturn';
    if (frequency === 'annual') return 'AnnualReturn';
    return null;
  };
  
  const exportPortfolios = (portfolios, backendData) => {
    const wb = XLSX.utils.book_new();
  
    portfolios.forEach((portfolio) => {
      const sheetData = [];
  
      // 1. Portfolio name and Asset Mix
      sheetData.push([`${portfolio.name || `Portfolio ${portfolio.id}`}`]);
      sheetData.push([]);
      sheetData.push(['Asset Mix:']);
      if (Object.keys(portfolio.weights).length > 0) {
        Object.entries(portfolio.weights).forEach(([sec, weight]) => {
          sheetData.push([sec, `${parseFloat(weight).toFixed(2)}%`]);
        });
      } else {
        sheetData.push(['No securities selected or weights defined.']);
      }
      sheetData.push([]);
  
      // 2. Collect all unique dates
      const allDatesSet = new Set();
      portfolio.selectedSecurities.forEach(sec => {
        const rawPrices = backendData.rawPrices?.[sec] || [];
        rawPrices.forEach(({ Date }) => allDatesSet.add(Date));
      });
      const allDates = Array.from(allDatesSet).sort((a, b) => new Date(a) - new Date(b));
  
      // 3. Prepare price and returns maps per asset
      const pricesByDateAndSec = {};
      const returnsByFreqAndSec = {
        daily: {},
        monthly: {},
        quarter: {},
        annual: {},
      };
  
      portfolio.selectedSecurities.forEach(sec => {
        // Prices
        const secPrices = {};
        (backendData.rawPrices?.[sec] || []).forEach(({ Date, Price }) => {
          secPrices[Date] = Price;
        });
        pricesByDateAndSec[sec] = secPrices;
  
        // Returns for each frequency
        ['daily', 'monthly', 'quarter', 'annual'].forEach(freq => {
          const secReturns = {};
          const returnKey = getReturnKey(freq);
          (backendData[freq]?.[sec] || []).forEach(entry => {
            if (entry[returnKey] != null) {
              secReturns[entry.Date] = entry[returnKey];
            }
          });
          returnsByFreqAndSec[freq][sec] = secReturns;
        });
      });
  
      // 4. Header row: Date, Assets' Prices, then returns columns
      const returnsHeaders = ['Daily Return', 'Monthly Return', 'Quarterly Return', 'Annual Return'];
      const headers = ['Date', ...portfolio.selectedSecurities, ...returnsHeaders];
      sheetData.push(headers);
  
      // 5. Build rows per date
      allDates.forEach(date => {
        const row = [date];
  
        // Asset prices for this date
        portfolio.selectedSecurities.forEach(sec => {
          const price = pricesByDateAndSec[sec]?.[date];
          row.push(price != null ? price : '');
        });
  
        // Calculate weighted portfolio returns per frequency
        ['daily', 'monthly', 'quarter', 'annual'].forEach(freq => {
          const weightSum = portfolio.selectedSecurities.reduce((sum, sec) => sum + (portfolio.weights[sec] || 0), 0);
          let weightedReturn = 0;
          let validData = true;
  
          portfolio.selectedSecurities.forEach(sec => {
            const weight = portfolio.weights[sec] || 0;
            const retVal = returnsByFreqAndSec[freq][sec]?.[date];
            if (retVal == null) {
              validData = false; // Missing return data for this freq/date
            } else {
              weightedReturn += retVal * (weight / 100);
            }
          });
  
          if (validData && weightSum > 0) {
            row.push(weightedReturn); // decimal kept, formatted later
          } else {
            row.push('');  // <-- blank cell instead of "N/A"
          }
        });
  
        sheetData.push(row);
      });
  
      // 6. Convert sheetData to worksheet
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
  
      // 7. Format the return columns as percentages with 2 decimal places visible
      const range = XLSX.utils.decode_range(ws['!ref']);
  
      // Return columns start after: Date + number of assets
      const firstReturnColIndex = 1 + portfolio.selectedSecurities.length;
      const lastRow = range.e.r;
  
      for (let c = firstReturnColIndex; c <= firstReturnColIndex + 3; c++) { // 4 return columns
        for (let r = 4 + Object.keys(portfolio.weights).length; r <= lastRow; r++) {
          const cellAddress = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellAddress];
          if (cell && typeof cell.v === 'number') {
            // Format as percentage with two decimals visible, keep decimal for formula
            cell.z = '0.00%';
          }
        }
      }
  
      // 8. Append worksheet
      const sheetName = portfolio.name ? portfolio.name.substring(0, 31) : `Portfolio ${portfolio.id}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  
    // 9. Write file and trigger download
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'portfolios.xlsx');
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
    <div className="container">
      <h1>Rate of Return Graphs</h1>
      <div className="file-inputs">
        <label htmlFor="excel" style={{ cursor: "pointer" }}>
        <div className={`drop-zone ${fileDragging ? "dragging" : ""}`}
        onDragOver={(e) => handleDrag(e, setFileDragging)}
        onDragLeave={(e) => handleDragLeave(e, setFileDragging)}
        onDrop={(e) => handleDrop(e, setFileDragging, excelChange)}
        >
        <label htmlFor="excel" className="upload-label">
        <ArrowUpTrayIcon className="w-3 h-3 text-gray-600 hover:text-blue-500" style={{height:'50px'}}/>
          <span>Upload Excel File</span>
        </label>
        <input
          id="excel"
          type="file"
          accept=".xlsx,.xls,.xlsm,.xlsb"
          onChange={excelChange}
          disabled={loading}
        />
        <p>📁 or drag and drop a file here</p>
            <p>
              <strong>Selected:</strong> {excel ? excel.name : "None"}
            </p>
      </div>

      </label>
      </div>
      {error && <p className="error">{error}</p>}
              <button 
              className="submit-button"
              onClick={fileSubmit}
              disabled={loading}>
              {loading ? "Processing..." : "Submit"}
              </button> 
              
              <div className="bottom-border"></div>

            {loading && (
              <div className="loading-screen">
              <p>Calculating data, please wait</p>
              <div className="loading-content">
                <img src="/parrot-think.png" style={{height:'200px'}}/>
                <div className="loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              </div>
            </div>
              
            )}  

      {backendData && (
        <>
          {/* First Chart Section: Individual Rate of Return Chart */}
          <div className="ror-chart-section" >
            <h2>Market Indices Rate of Return Chart</h2>
            <p>Note: Returns are calculated for full calendar months, quarters and years that fall within the selected date range</p>
            <div className="container">
              {/* <h3>Customize Chart</h3>
              <div className="gap"></div> */}
              <div>
                <label>Frequency:</label>
                <select value={frequency} onChange={handleFrequencyChange}>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>{/* Added monthly option */}
                  <option value="quarter">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              {backendData.ranges?.[frequency] && (
                <div>
                  <label>Date Range:</label>
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
                <div >
                  <label>Market Indices:</label>
                  <button onClick={handleSelectAll} className="chart-button">
                    {selectedSecurities.length === backendData.securities.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  <div className="securities">
                    {backendData.securities.map((sec) => (
                  <label
                  key={`chart1-${sec}`}
                  className="security-checkbox">
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



              <button onClick={exportChart} className="chart-button">
                  Export Chart
                </button>
                <button onClick={() => exportSecurities(backendData, frequency)} 
                className="chart-button"
                disabled={!backendData || selectedSecurities.length === 0}>
                  Download Excel File
                </button>
            </div>

            {selectedSecurities.length > 0 && (
            <div>
              <h3>Total Return by Market Index (Selected Time Period)</h3>
              <ul>
                {individualTotalReturns.map(({ sec, totalReturn, disclaimer }, idx) => (
                  <li key={idx}>
                    <strong>{sec}{disclaimer || ''}</strong>: {totalReturn}
                  </li>
                ))}
              </ul>

            </div>
          )} 

            <div>
              <div>
                <label>
                  Show Index Value Chart
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={showPriceChart}
                      onChange={() => setShowPriceChart(prev => !prev)}
                    />
                    <span className="slider"></span>
                  </label>
                </label>
              </div>
            



{showPriceChart && (
  <div className="toggle-section">
    <div>
      <button
        onClick={() => priceChartRef.current?.resetZoom()}
        className="chart-button"
      >
        Reset Zoom
      </button>
    </div>

    <Line
      ref={priceChartRef}
      data={priceChartData}
      options={{
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1.2,
        plugins: {
          title: { display: true, text: "Index Value Chart", font: { size: 18 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`,
            },
          },
          legend: {
            onClick: null,
            labels: {
              usePointStyle: true,
              boxWidth: 12,
              boxHeight: 12,
              color: "#000",
            },
          },
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
          },
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit:
                frequency === "daily"
                  ? "day"
                  : frequency === "quarter"
                  ? "quarter"
                  : frequency === "monthly"
                  ? "month"
                  : "year",
              tooltipFormat: "MMM dd, yyyy",
              displayFormats: {
                year: "yyyy",
                month: "MMM yyyy",
                day: "MMM dd, yyyy",
              },
            },
            title: { display: true, text: "Date" },
          },
          y: {
            title: { display: true, text: "Price ($)" },
            ticks: {
              callback: function(value) {
                // Format value with commas if > 1000
                if (value >= 1000 || value <= -1000) {
                  return value.toLocaleString();
                }
                return value;
              }
            },
          },
        },
      }}
    />
  </div>
)}




              <div>
                <button onClick={() => chartRef.current?.resetZoom()} className="chart-button">
                  Reset Zoom
                </button>
      

              </div>
            </div>

            {individualChartError && (
                <p className="grey-error">{individualChartError}</p>
            )}

            {chartData && chartData.datasets.length > 0 && (
              <div>
                  <Line
                    ref={chartRef}
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      aspectRatio: 1.2,
                      plugins: {
                        title: { display: true, text: "Rate of Return", font: { size: 18 } },
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
                        x: {
                            type: "time",
                            time: {
                              unit:
                                frequency === "daily"
                                  ? "day"
                                  : frequency === "quarter"
                                  ? "quarter"
                                  : frequency === "monthly"
                                  ? "month"
                                  : "year",
                              tooltipFormat: "MMM dd, yyyy",
                              displayFormats: {
                                year: "yyyy",
                                month: "MMM yyyy",
                                day: "MMM dd, yyyy",
                              },
                            },
                            title: { display: true, text: "Date" },
                        },
                        y: {
                          ticks: {
                            callback: (value) => `${value}%`,
                          },
                          title: { display: true, text: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Return (%)` },
                        },
                      },
                    }}
                  />
              </div>
            )}
          </div>
          <div className="bottom-border"></div>

          {/* Second Chart Section: Weighted Rate of Return Chart */}
          <div className="ror-chart-section">
            <h2>Portfolios Rate of Return Chart</h2> {/* Changed title for clarity */}
            <p>Note: Returns are calculated for full calendar months, quarters and years that fall within the selected date range</p>
            <div className="container">
              {/* <h3>Customize Chart</h3>
              <div className="gap"></div> */}
              <div >
                <label >Frequency:</label>
                <select value={weightedFrequency} onChange={handleWeightedFrequencyChange}>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              {backendData.ranges?.[weightedFrequency] && (
                <div>
                  <label>Date Range:</label>
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

              <div>
                {portfolios.map((portfolio, pIdx) => (
                  <div key={portfolio.id} style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "15px", borderRadius: "8px" }}>
                    <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <input
                        type="text"
                        value={portfolio.name}
                        onChange={(e) => handlePortfolioNameChange(portfolio.id, e.target.value)}
                        className="portfolio-name"
                      />
                      {portfolios.length > 1 && (
                        <button onClick={() => handleRemovePortfolio(portfolio.id)} className="portfolio-button remove-portfolio">
                          Remove
                        </button>
                      )}
                    </h4>
                    {/* NEW: Display weight error message */}
                    {portfolioWeightErrors[portfolio.id] && (
                        <p className="error">
                            {portfolioWeightErrors[portfolio.id]}
                        </p>
                    )}
                    {backendData.securities?.length > 0 && (
                      <div>
                         <button onClick={() => handlePortfolioSelectAll(portfolio.id)} className="chart-button">
                            {portfolio.selectedSecurities.length === backendData.securities.length
                                ? "Deselect All"
                                : "Select All"}
                         </button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {backendData.securities.map((sec) => (
                            <div key={`portfolio-${portfolio.id}-${sec}`} className="security-checkbox">
                              <label style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px" }}>
                                <input
                                  type="checkbox"
                                  checked={portfolio.selectedSecurities.includes(sec)}
                                  onChange={() => handlePortfolioSecurityToggle(portfolio.id, sec)}
                                />
                                <span>{sec}</span>
                              </label>
                              {portfolio.selectedSecurities.includes(sec) && (
                               <div>
                               <input
                                 type="number"
                                 placeholder="Weight"
                                 value={portfolio.weights[sec] || ''}
                                 onChange={(e) => handlePortfolioWeightChange(portfolio.id, sec, e.target.value)}
                                 className="weight-change"
                                 style={{ width: '80px' }}
                               />
                               <span>%</span>
                             </div>
                                
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {portfolio.selectedSecurities.length > 0 && (
                      <div>
                        <strong>Current Total Weight: </strong>
                        {(portfolio.selectedSecurities.reduce(
                          (sum, sec) => sum + (portfolio.weights[sec] || 0),
                          0
                        )).toFixed(2)}%
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={handleAddPortfolio} className="portfolio-button add-portfolio">
                  Add Portfolio
                </button>
              </div>

              {/* NEW: Manual trigger button for weighted chart */}
              <div>
                <button onClick={generateWeightedChart} className="generate-button">
                  Generate Weighted Chart
                </button>
                <button onClick={() => weightedChartRef.current?.resetZoom()} className="chart-button">
                  Reset Zoom
                </button>
                <button onClick={exportWeightedChart} className="chart-button">
                  Export Chart
                </button>
                <button onClick={() => exportPortfolios(portfolios, backendData)}
                 className="chart-button"
                 disabled={!weightedChartData || weightedChartData.datasets.length === 0}
                 >
                  Download Excel File
                </button>
              </div>
            </div>
            <div >
            {portfolioTotalReturns.length > 0 && (
              <div>
                  <h3>Portfolio Total Returns:</h3>
                  {portfolioTotalReturns.map((p, idx) => ( // Change here: iterate over portfolioTotalReturns
                    <p key={idx}>
                      <strong>
                        {p.name}
                        {p.isPartial
                          ? ` (from ${p.startDateStr} to ${p.endDateStr})`
                          : ""}
                        :
                      </strong>{" "}
                      {p.totalReturn}
                    </p>

                  ))}
              </div>
          )}
            </div>
            
            {weightedChartData && (
              <div>
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
                          title: { display: true, text: "Portfolios Rate of Return", font: { size: 18 } },
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
                          x: {
                            type: "time",
                            time: {
                              unit:
                                weightedFrequency === "daily"
                                  ? "day"
                                  : weightedFrequency === "quarter"
                                  ? "quarter"
                                  : weightedFrequency === "monthly"
                                  ? "month"
                                  : "year",
                              tooltipFormat: "MMM dd, yyyy",
                              displayFormats: {
                                year: "yyyy",
                                month: "MMM yyyy",
                                day: "MMM dd, yyyy",
                              },
                              round: false,
                              ticks: {
                                source: 'auto',
                                callback: function(value, index, values) {
                                  const date = new Date(value);
                                  if (this.options.time.unit === 'year') {
                                    return date.getFullYear();
                                  }
                                  return ChartJS.Ticks.formatters.datetime.call(this, value, index, values);
                                }
                              }
                            },
                            
                            title: { display: true, text: "Date" },
                          },
                          y: {
                          
                            ticks: {
                              callback: (value) => `${value}%`,
                            },
                            title: { display: true, text: `${weightedFrequency.charAt(0).toUpperCase() + weightedFrequency.slice(1)} Return (%)` },
                          },
                        },
                      }}
                    />
                   
                  </>
                ) : (
                  <p className="grey-error">Please select market indices and weights for at least one portfolio to display the weighted chart.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}