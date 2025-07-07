// Add event listener to the "Run Analysis" button
document.getElementById('runButton').addEventListener('click', handleAnalysis);

/**
 * Main function to orchestrate the t-test analysis.
 */
function handleAnalysis() {
    // 1. Get user inputs from the HTML
    const fileInput = document.getElementById('excelFile');
    const ivName = document.getElementById('ivName').value || "Independent Variable";
    const dvName = document.getElementById('dvName').value || "Dependent Variable";
    const resultsDiv = document.getElementById('results');

    // Clear previous results
    resultsDiv.innerHTML = '';

    // Check if a file was selected
    if (!fileInput.files.length) {
        resultsDiv.innerHTML = '<p style="color: red;">⚠️ Please upload an Excel file first.</p>';
        return;
    }

    // 2. Read the file using SheetJS
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // 3. Perform the full, step-by-step analysis
            runFullAnalysis(jsonData, ivName, dvName, resultsDiv);
        } catch (error) {
            resultsDiv.innerHTML = `<p style="color: red;">⚠️ Error reading or processing the file: ${error.message}</p>`;
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

/**
 * Runs all calculations and displays them step-by-step.
 * @param {Array<Object>} data - The data parsed from the Excel file.
 * @param {string} iv - Independent Variable name.
 * @param {string} dv - Dependent Variable name.
 * @param {HTMLElement} resultsDiv - The div to display results in.
 */
function runFullAnalysis(data, iv, dv, resultsDiv) {
    // --- Step 1: Define Hypotheses ---
    const { nullHypothesis, alternativeHypothesis } = generateHypotheses(iv, dv);
    resultsDiv.innerHTML += `
        <h2>📌 Step 1: Define Your Hypotheses</h2>
        <p><strong>Null Hypothesis (H₀):</strong> ${nullHypothesis}</p>
        <p><strong>Alternative Hypothesis (H₁):</strong> ${alternativeHypothesis}</p>
    `;

    // Identify the first two numerical columns
    const numericColumns = Object.keys(data[0]).filter(key => typeof data[0][key] === 'number');
    if (numericColumns.length < 2) {
        resultsDiv.innerHTML += '<p style="color: red;">⚠️ Error: The dataset must have at least two numerical columns.</p>';
        return;
    }
    const [col1, col2] = numericColumns;

    // --- Step 2: Compute Differences ---
    const differences = data.map(row => row[col1] - row[col2]);
    resultsDiv.innerHTML += `
        <h2>📌 Step 2: Compute the Differences Between Conditions</h2>
        <p>The difference is calculated as: <strong>${col1} - ${col2}</strong>.</p>
        ${createHtmlTable(data, col1, col2, differences, 5)}
    `;

    // --- Step 3: Calculate Mean of Differences ---
    const meanDiff = getMean(differences);
    resultsDiv.innerHTML += `
        <h2>📌 Step 3: Calculate the Mean of the Differences</h2>
        <div class="formula">Mean (M) = (Σ Differences) / N
        M = (${differences.slice(0, 5).map(d => d.toFixed(2)).join(' + ')} + ...) / ${differences.length}
        <strong class="final-result">Final Mean (M) = ${meanDiff.toFixed(2)}</strong></div>
    `;

    // --- Step 4: Calculate Standard Deviation (SD) of Differences ---
    const { stdDev, variance, sumSqDev } = getStandardDeviationDetails(differences, meanDiff);
    resultsDiv.innerHTML += `
        <h2>📌 Step 4: Compute the Standard Deviation (SD)</h2>
        <p><strong>Step 4.1: Calculate Deviations (X - M)</strong></p>
        <div class="formula">${differences.slice(0, 5).map(d => `(${d.toFixed(2)} - ${meanDiff.toFixed(2)}) = ${(d - meanDiff).toFixed(2)}`).join('<br>')}</div>
        <p><strong>Step 4.2: Calculate Squared Deviations (X - M)²</strong></p>
        <div class="formula">${differences.slice(0, 5).map(d => `(${(d - meanDiff).toFixed(2)})² = ${Math.pow(d - meanDiff, 2).toFixed(2)}`).join('<br>')}</div>
        <p><strong>Step 4.3: Sum of Squared Deviations:</strong> Σ(X - M)² = ${sumSqDev.toFixed(2)}</p>
        <p><strong>Step 4.4: Calculate Variance:</strong> s² = Σ(X - M)² / (N-1) = ${sumSqDev.toFixed(2)} / ${differences.length - 1} = ${variance.toFixed(2)}</p>
        <p><strong>Step 4.5: Take the Square Root for SD:</strong> s = √${variance.toFixed(2)}</p>
        <div class="formula"><strong class="final-result">Final Standard Deviation (SD) = ${stdDev.toFixed(2)}</strong></div>
    `;

    // --- Step 5: Compute Degrees of Freedom (df) ---
    const n = differences.length;
    const df = n - 1;
    resultsDiv.innerHTML += `
        <h2>📌 Step 5: Compute Degrees of Freedom (df)</h2>
        <div class="formula">df = N - 1
        df = ${n} - 1 = <strong class="final-result">${df}</strong></div>
    `;
    
    // --- Step 6: Compute t-value ---
    const stdError = stdDev / Math.sqrt(n);
    const tValue = meanDiff / stdError;
    resultsDiv.innerHTML += `
        <h2>📌 Step 6: Compute the t-value</h2>
        <p>First, find the Standard Error (SE): SE = SD / √N = ${stdDev.toFixed(2)} / √${n} = ${stdError.toFixed(2)}</p>
        <div class="formula">t = M / SE
        t = ${meanDiff.toFixed(2)} / ${stdError.toFixed(2)} = <strong class="final-result">${tValue.toFixed(2)}</strong></div>
    `;
    
    // --- Step 7: Determine Critical t-value ---
    const alpha = 0.05;
    const criticalT = jStat.studentt.inv(1 - alpha / 2, df);
    resultsDiv.innerHTML += `
        <h2>📌 Step 7: Find the Critical t-value</h2>
        <div class="formula">For a two-tailed test with α = ${alpha} and df = ${df}, the critical t-value is <strong class="final-result">±${criticalT.toFixed(2)}</strong>.</div>
    `;
    
    // --- Step 8: Statistical Decision ---
    const isSignificant = Math.abs(tValue) > criticalT;
    const decision = isSignificant ? "reject" : "fail to reject";
    const comparisonSymbol = isSignificant ? ">" : "<";
    resultsDiv.innerHTML += `
        <h2>📌 Step 8: Make a Statistical Decision</h2>
        <p>We compare our obtained t-value to the critical t-value:</p>
        <div class="formula">|t_obtained| ${comparisonSymbol} t_critical
        |${tValue.toFixed(2)}| ${comparisonSymbol} ${criticalT.toFixed(2)}
        <strong class="final-result">Decision: We ${decision} the null hypothesis.</strong></div>
    `;

    // --- Step 9: Calculate Effect Size (Cohen's d) ---
    const mean1 = getMean(data.map(row => row[col1]));
    const sd1 = getStandardDeviationDetails(data.map(row => row[col1])).stdDev;
    const effectSize = (mean1 - getMean(data.map(row => row[col2]))) / sd1;
    resultsDiv.innerHTML += `
        <h2>📌 Step 9: Calculate Effect Size (Cohen's d)</h2>
        <div class="formula">d = (Mean₁ - Mean₂) / SD₁
        d = (${mean1.toFixed(2)} - ${getMean(data.map(row => row[col2])).toFixed(2)}) / ${sd1.toFixed(2)}
        <strong class="final-result">Cohen's d = ${effectSize.toFixed(2)}</strong></div>
    `;

    // --- Step 10: APA-Formatted Write-Up ---
    const pValueText = isSignificant ? "< .05" : "> .05";
    const apaWriteup = generateApaWriteup(tValue, df, pValueText, effectSize, isSignificant, dv, [col1, col2]);
    resultsDiv.innerHTML += `
        <h2>📌 Step 10: APA-Formatted Write-Up</h2>
        <div class="formula">${apaWriteup}</div>
    `;
}


// --- Helper and Calculation Functions ---

function generateHypotheses(iv, dv) {
    const nullTemplates = [
        `There is no significant effect of ${iv} on ${dv}.`,
        `${iv} does not have a statistically significant impact on ${dv}.`,
        `There is no meaningful relationship between ${iv} and ${dv}.`
    ];
    const altTemplates = [
        `There is a significant effect of ${iv} on ${dv}.`,
        `${iv} has a statistically significant impact on ${dv}.`,
        `There is a meaningful relationship between ${iv} and ${dv}.`
    ];
    return {
        nullHypothesis: nullTemplates[Math.floor(Math.random() * nullTemplates.length)],
        alternativeHypothesis: altTemplates[Math.floor(Math.random() * altTemplates.length)]
    };
}

function generateApaWriteup(t_value, df, p_value_text, effect_size, isSignificant, dv_name, condition_names) {
    const significance_text = isSignificant ? "a significant" : "no significant";
    return `A paired-samples t-test was conducted to evaluate if there was ${significance_text} difference in ${dv_name} between the ${condition_names[0]} and ${condition_names[1]} conditions. The results indicated that the mean difference was ${isSignificant ? "statistically significant" : "not statistically significant"}, t(${df}) = ${t_value.toFixed(2)}, p ${p_value_text}. The effect size, as measured by Cohen's d, was ${effect_size.toFixed(2)}.`;
}

const getMean = (arr) => arr.reduce((acc, val) => acc + val, 0) / arr.length;

function getStandardDeviationDetails(arr, mean = null) {
    const m = mean === null ? getMean(arr) : mean;
    const squaredDeviations = arr.map(val => Math.pow(val - m, 2));
    const sumSqDev = squaredDeviations.reduce((acc, val) => acc + val, 0);
    const variance = sumSqDev / (arr.length - 1);
    const stdDev = Math.sqrt(variance);
    return { stdDev, variance, sumSqDev };
}

function createHtmlTable(data, col1, col2, differences, maxRows) {
    let table = '<table>';
    table += `<thead><tr><th>${col1}</th><th>${col2}</th><th>Difference</th></tr></thead>`;
    table += '<tbody>';
    for (let i = 0; i < Math.min(data.length, maxRows); i++) {
        table += `<tr>
            <td>${data[i][col1].toFixed(2)}</td>
            <td>${data[i][col2].toFixed(2)}</td>
            <td>${differences[i].toFixed(2)}</td>
        </tr>`;
    }
    if (data.length > maxRows) {
        table += '<tr><td colspan="3">... and so on</td></tr>';
    }
    table += '</tbody></table>';
    return table;
}
