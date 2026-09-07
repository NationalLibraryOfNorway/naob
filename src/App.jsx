import { useState, useEffect, useMemo } from 'react';
import { Search, Download, ExternalLink, Settings2, Loader2, BookOpen, ArrowUpDown } from 'lucide-react';
import { loadMetadata, fetchConcordances, formatConcordance, formatUrl, exportToExcel } from './utils';
import './index.css';

export default function App() {
  const [metadata, setMetadata] = useState({});
  const [urnList, setUrnList] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  
  const [search, setSearch] = useState('leksikografi');
  const [startYear, setStartYear] = useState(1800);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [corpusMinYear, setCorpusMinYear] = useState(1800);
  const [corpusMaxYear, setCorpusMaxYear] = useState(new Date().getFullYear());
  const [sampleSize, setSampleSize] = useState(150);
  const [splitContext, setSplitContext] = useState(false);
  const [filename, setFilename] = useState('konkordanser.xlsx');
  
  const [sortConfig, setSortConfig] = useState({ key: 'year', direction: 'ascending' });
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMetadata().then(meta => {
      setMetadata(meta);
      const urns = Object.keys(meta);
      setUrnList(urns);
      
      // Finn min og max år i korpuset
      let min = 9999;
      let max = 0;
      for (const urn of urns) {
        const year = parseInt(meta[urn].year);
        if (!isNaN(year)) {
          if (year < min) min = year;
          if (year > max) max = year;
        }
      }
      if (min !== 9999) {
        setCorpusMinYear(min);
        setStartYear(Math.max(1814, min)); // Standard fra app.py
      }
      if (max !== 0) {
        setCorpusMaxYear(max);
        setEndYear(max);
      }
      
      setLoadingMeta(false);
    });
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!search.trim() || search.match(/^[.,\/#!$%\^&\*;:{}=\-_`~()]+$/g)) {
      setError("Ugyldig søk. Skriv inn et ord eller en frase i søkefeltet.");
      return;
    }
    setError('');
    setLoadingSearch(true);

    try {
      // 1. Filter URNs by year
      const filteredUrns = urnList.filter(urn => {
        const meta = metadata[urn];
        if (!meta || !meta.year) return false;
        const year = parseInt(meta.year);
        return year >= startYear && year <= endYear;
      });

      // 2. Fetch from DHlab API
      const rawConc = await fetchConcordances(filteredUrns, search, sampleSize);
      
      // 3. Format and merge with metadata
      const formatted = rawConc.map(item => {
        const meta = metadata[item.urn] || {};
        const { left_context, target, right_context, raw } = formatConcordance(item.concordance);
        
        let formattedYear = '';
        if (meta.year) {
          const yearInt = parseInt(meta.year);
          formattedYear = isNaN(yearInt) ? meta.year : yearInt.toString();
        }

        return {
          concordance: raw,
          left_context,
          target,
          right_context,
          year: formattedYear,
          url: formatUrl(item.urn, search),
          authors: meta.authors || '',
          title: meta.title || '',
          urn: item.urn
        };
      });
      
      setResults(formatted);
    } catch (err) {
      console.error(err);
      setError('Kunne ikke laste konkordanser for dette søket. Prøv igjen.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedResults = useMemo(() => {
    let sortableItems = [...results];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key] || '';
        let valB = b[sortConfig.key] || '';
        
        if (sortConfig.key === 'year') {
          valA = parseInt(valA) || 0;
          valB = parseInt(valB) || 0;
        } else {
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [results, sortConfig]);

  const handleExport = () => {
    const exportData = sortedResults.map(r => {
      if (splitContext) {
        return {
          "Venstre kontekst": r.left_context,
          "Søkeord": r.target,
          "Høyre kontekst": r.right_context,
          "Årstall": r.year,
          "Forfatter": r.authors,
          "Tittel": r.title,
          "URL": r.url
        };
      } else {
        return {
          "Konkordans": r.concordance,
          "Årstall": r.year,
          "Forfatter": r.authors,
          "Tittel": r.title,
          "URL": r.url
        };
      }
    });
    exportToExcel(exportData, filename);
  };

  if (loadingMeta) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-warm)]">
        <div className="flex flex-col items-center gap-4 text-[var(--primary)]">
          <Loader2 className="h-10 w-10 animate-spin" />
          <h2 className="text-xl font-medium">Laster NAOB-korpus...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 text-[var(--primary)]">
          <BookOpen size={32} />
          <h1 className="text-3xl font-bold">NAOB Konkordanser</h1>
        </div>
        <div className="text-sm text-gray-500 font-medium">
          {urnList.length} titler i korpuset
        </div>
      </header>

      <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-[var(--panel-warm)] p-6 rounded-xl shadow-sm mb-8">
        
        {/* Søkefelt */}
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">Ord og fraser</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            title="Skriv inn ord for å finne match i avsnitt."
          />
        </div>

        {/* Periode */}
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">Velg en periode</label>
          <div className="flex items-center gap-2">
            <input 
              type="number" min={corpusMinYear} max={corpusMaxYear} 
              value={startYear} onChange={e => setStartYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <span>-</span>
            <input 
              type="number" min={corpusMinYear} max={corpusMaxYear}
              value={endYear} onChange={e => setEndYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        {/* Max results */}
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-sm">Maks antall treff</label>
          <input
            type="number"
            value={sampleSize}
            onChange={(e) => setSampleSize(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Action knapper */}
        <div className="flex items-end gap-3 lg:justify-end">
          <button 
            type="submit" 
            disabled={loadingSearch}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-[var(--primary)] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {loadingSearch ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            Søk
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
          {error}
        </div>
      )}

      {/* Resultater */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="font-medium text-gray-700">
            Antall konkordanser totalt: <span className="font-bold text-black">{results.length}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={splitContext}
                onChange={(e) => setSplitContext(e.target.checked)}
                className="w-4 h-4 text-[var(--primary)] rounded border-gray-300 focus:ring-[var(--primary)]"
              />
              <span className="text-sm font-medium">Del opp i flere kolonner</span>
            </label>

            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={filename}
                onChange={e => setFilename(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none"
              />
              <button
                onClick={handleExport}
                disabled={results.length === 0}
                className="flex items-center gap-2 text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Download size={16} /> Last ned
              </button>
            </div>
          </div>
        </div>

        {/* Tabell */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          {sortedResults.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                <tr>
                  {splitContext ? (
                    <>
                      <th className="px-4 py-3 text-right">Venstre kontekst</th>
                      <th className="px-4 py-3 text-center">Søkeord</th>
                      <th className="px-4 py-3">Høyre kontekst</th>
                    </>
                  ) : (
                    <th className="px-4 py-3">Konkordans</th>
                  )}
                  <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('year')}>
                    <div className="flex items-center gap-1">Årstall <ArrowUpDown size={14} className="text-gray-400" /></div>
                  </th>
                  <th className="px-4 py-3 max-w-[150px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('authors')}>
                    <div className="flex items-center gap-1">Forfatter <ArrowUpDown size={14} className="text-gray-400" /></div>
                  </th>
                  <th className="px-4 py-3 max-w-[200px] cursor-pointer hover:bg-gray-100" onClick={() => requestSort('title')}>
                    <div className="flex items-center gap-1">Tittel <ArrowUpDown size={14} className="text-gray-400" /></div>
                  </th>
                  <th className="px-4 py-3 text-center">nb.no</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedResults.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    {splitContext ? (
                      <>
                        <td className="px-4 py-3 text-right text-gray-600">{r.left_context}</td>
                        <td className="px-4 py-3 text-center font-bold text-[var(--primary)]">{r.target}</td>
                        <td className="px-4 py-3 text-gray-600">{r.right_context}</td>
                      </>
                    ) : (
                      <td className="px-4 py-3 text-gray-800">
                        {r.left_context} <span className="font-bold text-[var(--primary)]">{r.target}</span> {r.right_context}
                      </td>
                    )}
                    <td className="px-4 py-3">{r.year}</td>
                    <td className="px-4 py-3 truncate max-w-[150px]" title={r.authors}>{r.authors}</td>
                    <td className="px-4 py-3 truncate max-w-[200px]" title={r.title}>{r.title}</td>
                    <td className="px-4 py-3 text-center">
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex text-[var(--primary)] hover:text-blue-800">
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !loadingSearch ? (
            <div className="p-8 text-center text-gray-500">
              Ingen resultater å vise. Prøv et nytt søk.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
