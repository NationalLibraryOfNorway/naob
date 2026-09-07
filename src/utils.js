import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const loadMetadata = async () => {
  const response = await fetch(`${import.meta.env.BASE_URL}naob_metadata.csv`);
  const csvText = await response.text();
  
  return new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Create a map of URN to metadata object for fast lookup O(1)
        const metaMap = {};
        for (const row of results.data) {
          metaMap[row.urn] = row;
        }
        resolve(metaMap);
      }
    });
  });
};

export const fetchConcordances = async (urns, query, limit = 150) => {
  const response = await fetch("https://api.nb.no/dhlab/conc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      urns: urns,
      query: query,
      window: 25,
      limit: limit
    })
  });
  const data = await response.json();
  
  // DHlab API returns an object of dictionaries orient="columns"
  // e.g. { docid: { 0: ..., 1: ... }, urn: { 0: ..., 1: ... }, conc: { 0: ..., 1: ... } }
  
  if (!data.urn) return [];
  
  const results = [];
  const keys = Object.keys(data.urn);
  
  for (const i of keys) {
    results.push({
      urn: data.urn[i],
      concordance: data.conc[i]
    });
  }
  return results;
};

export const formatConcordance = (concText) => {
  // DHlab returns concordance with <b>target</b>
  const cleanConc = concText.replace(/<b>/g, '**').replace(/<\/b>/g, '**');
  const parts = cleanConc.split('**');
  if (parts.length >= 3) {
    return {
      left_context: parts[0].trim(),
      target: parts[1].trim(),
      right_context: parts.slice(2).join('').trim(), // Join remaining in case of multiple matches
      raw: cleanConc.replace(/\*\*/g, '')
    };
  }
  return { left_context: '', target: '', right_context: '', raw: concText };
};

export const formatUrl = (urn, searchterm) => {
  const url = `https://www.nb.no/items/${urn}`;
  return searchterm ? `${url}?searchText=${encodeURIComponent(searchterm)}` : url;
};

export const exportToExcel = (data, filename = 'konkordanser.xlsx') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename);
};
