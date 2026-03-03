import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertOctagon, 
  TrendingUp, 
  Package, 
  Search, 
  Filter, 
  DollarSign,
  Activity,
  BarChart3,
  XCircle,
  ShoppingCart,
  Tags,
  Snowflake,
  Sun,
  History,
  Archive
} from 'lucide-react';

// Función robusta para parsear CSV
function parseCSV(str, delimiter = ';') {
  const arr = [];
  let quote = false;
  let row = 0, col = 0;
  for (let c = 0; c < str.length; c++) {
    let cc = str[c], nc = str[c+1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    
    if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
    if (cc === '"') { quote = !quote; continue; }
    if (cc === delimiter && !quote) { ++col; continue; }
    if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc === '\n' && !quote) { ++row; col = 0; continue; }
    if (cc === '\r' && !quote) { ++row; col = 0; continue; }
    
    arr[row][col] += cc;
  }
  return arr;
}

// Utilidades de formato
const formatCurrency = (value) => {
  if (isNaN(value) || value === null) return '$ 0.00';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
};

// Parser de números a prueba de balas (Soporta formato 1.234,56 o 1,234.56)
const parseNum = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  let str = String(val).trim();
  let lastComma = str.lastIndexOf(',');
  let lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  return parseFloat(str) || 0;
};

const checkItem = (item, activeFilters, excludeField = null) => {
  if (excludeField !== 'search' && activeFilters.search) {
    const term = activeFilters.search.toLowerCase();
    const cod = (item['Código Artículo'] || '').toLowerCase();
    const desc = (item['Descripción Artículo'] || '').toLowerCase();
    if (!cod.includes(term) && !desc.includes(term)) return false;
  }
  if (excludeField !== 'proveedor' && activeFilters.proveedor && item['Proveedor'] !== activeFilters.proveedor) return false;
  if (excludeField !== 'categoria' && activeFilters.categoria && item['Categoría'] !== activeFilters.categoria) return false;
  if (excludeField !== 'abc' && activeFilters.abc && item.ClaseABC !== activeFilters.abc) return false;
  if (excludeField !== 'rotacion' && activeFilters.rotacion && item['Clasificación Rotación'] !== activeFilters.rotacion) return false;
  if (excludeField !== 'temporada' && activeFilters.temporada && item.Temporada !== activeFilters.temporada) return false;

  if (excludeField !== 'estado' && activeFilters.estado) {
    const estadoStr = (item['Estado Abastecimiento'] || '').toUpperCase();
    if (activeFilters.estado === 'RIESGO' && !estadoStr.includes('RIESGO')) return false;
    if (activeFilters.estado === 'SOBRESTOCK' && !estadoStr.includes('SOBRESTOCK')) return false;
    if (activeFilters.estado === 'OK' && (!estadoStr.includes('OK') && !estadoStr.includes('NORMAL'))) return false;
  }
  if (activeFilters.kpi === 'RIESGO_ALTO') {
    const est = (item['Estado Abastecimiento'] || '').toUpperCase();
    if (!est.includes('RIESGO ALTO') && item.PrioridadNum !== 1) return false;
  }
  if (activeFilters.kpi === 'SOBRESTOCK') {
    const est = (item['Estado Abastecimiento'] || '').toUpperCase();
    if (item.ValorSobrestock <= 0 && !est.includes('SOBRESTOCK')) return false;
  }
  if (activeFilters.kpi === 'CLASE_A_RIESGO') {
    if (item.ClaseABC !== 'A') return false;
    if (!(item['Estado Abastecimiento'] || '').toUpperCase().includes('RIESGO')) return false;
  }
  return true;
};

export default function App() {
  const [data, setData] = useState([]);
  
  const [filters, setFilters] = useState({
    search: '',
    proveedor: '',
    categoria: '',
    abc: '',
    rotacion: '',
    estado: '',
    temporada: '',
    kpi: ''
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsedData = parseCSV(text, ';');
      
      if (parsedData.length > 1) {
        const headers = parsedData[0].map(h => h.trim().replace(/^"|"$/g, ''));
        const stockValueKey = headers.find(h => h.toLowerCase().includes('valor sobrestock')) || 'Valor Sobrestock Estimado (>6 meses)';
        const abcKey = headers.find(h => h.toLowerCase().includes('abc')) || 'Clasificación ABC';

        const formattedData = parsedData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            let val = row[index] ? row[index].trim() : '';
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            obj[header] = val;
          });
          
          let abcRaw = String(obj[abcKey] || '').trim().toUpperCase();
          if (abcRaw === '1' || abcRaw === 'A') obj.ClaseABC = 'A';
          else if (abcRaw === '2' || abcRaw === 'B') obj.ClaseABC = 'B';
          else if (abcRaw === '3' || abcRaw === 'C') obj.ClaseABC = 'C';
          else obj.ClaseABC = abcRaw;

          obj.ValorSobrestock = parseNum(obj[stockValueKey]);
          obj.PrioridadNum = parseNum(obj['Prioridad Estado'] || 999);
          
          // Data Fina de Stock
          obj.StockFisico = parseNum(obj['Stock Actual']);
          obj.Comprometido = parseNum(obj['Comprometido']);
          obj.StockDisp = parseNum(obj['Stock Disponible']);
          
          // Data Fina de Ventas e Historial
          obj.Ventas12M = parseNum(obj['Total Vendido Últimos 12 Meses']);
          obj.Ventas3A = parseNum(obj['Total Vendido 3 Años']);
          obj.MesesVenta3A = parseNum(obj['Meses con Venta en 3 Años']);
          obj.Demanda3M = parseNum(obj['Consumo Proyectado 3 Meses']);

          // Estacionalidad
          const rInv = parseNum(obj['Ratio Invierno']);
          const rVer = parseNum(obj['Ratio Verano']);
          if (rInv > rVer && rInv >= 0.5) obj.Temporada = 'INVIERNO';
          else if (rVer > rInv && rVer >= 0.5) obj.Temporada = 'VERANO';
          else obj.Temporada = 'REGULAR';

          return obj;
        }).filter(row => row['Código Artículo']);
        
        setData(formattedData);
      }
    };
    reader.readAsText(file);
  };

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const toggleKpi = (kpiName) => setFilters(prev => ({ ...prev, kpi: prev.kpi === kpiName ? '' : kpiName }));
  const clearFilters = () => setFilters({ search: '', proveedor: '', categoria: '', abc: '', rotacion: '', estado: '', temporada: '', kpi: '' });

  const filteredData = useMemo(() => {
    let result = data.filter(item => checkItem(item, filters, null));
    result.sort((a, b) => a.PrioridadNum - b.PrioridadNum);
    return result;
  }, [data, filters]);

  const { proveedores, categorias } = useMemo(() => {
    const provs = new Set();
    const cats = new Set();
    
    data.forEach(item => {
      if (item['Proveedor'] && checkItem(item, filters, 'proveedor')) provs.add(item['Proveedor']);
      if (item['Categoría'] && checkItem(item, filters, 'categoria')) cats.add(item['Categoría']);
    });

    return { proveedores: Array.from(provs).sort(), categorias: Array.from(cats).sort() };
  }, [data, filters]);

  useEffect(() => {
    setFilters(prev => {
      let updated = { ...prev };
      let changed = false;
      if (prev.proveedor && proveedores.length > 0 && !proveedores.includes(prev.proveedor)) { updated.proveedor = ''; changed = true; }
      if (prev.categoria && categorias.length > 0 && !categorias.includes(prev.categoria)) { updated.categoria = ''; changed = true; }
      return changed ? updated : prev;
    });
  }, [proveedores, categorias]);

  const kpis = useMemo(() => {
    let capitalInmovilizado = 0;
    let itemsRiesgoAlto = 0;
    let itemsClaseA = 0;
    let itemsClaseARiesgo = 0;

    filteredData.forEach(item => {
      capitalInmovilizado += item.ValorSobrestock;
      const estado = (item['Estado Abastecimiento'] || '').toUpperCase();
      
      if (estado.includes('RIESGO ALTO') || item.PrioridadNum === 1) itemsRiesgoAlto++;
      if (item.ClaseABC === 'A') {
        itemsClaseA++;
        if (estado.includes('RIESGO')) itemsClaseARiesgo++;
      }
    });

    return { total: filteredData.length, capitalInmovilizado, itemsRiesgoAlto, itemsClaseA, itemsClaseARiesgo };
  }, [filteredData]);

  const getAbcBadge = (abc) => {
    switch (abc) {
      case 'A': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">A</span>;
      case 'B': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">B</span>;
      case 'C': return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">C</span>;
      default: return <span className="px-2 py-0.5 text-xs text-gray-400">-</span>;
    }
  };

  const getStatusStyle = (estado) => {
    const est = (estado || '').toUpperCase();
    if (est.includes('RIESGO ALTO')) return "bg-red-50 text-red-700 font-bold border-red-200 shadow-sm";
    if (est.includes('RIESGO')) return "bg-orange-50 text-orange-700 font-medium border-orange-200";
    if (est.includes('SOBRESTOCK')) return "bg-blue-50 text-blue-700 font-medium border-blue-200";
    if (est.includes('NUEVO')) return "bg-purple-50 text-purple-700 border-purple-200";
    return "bg-green-50 text-green-700 border-green-200";
  };

  const getActionRecommendation = (item) => {
    const estado = (item['Estado Abastecimiento'] || '').toUpperCase();
    if (estado.includes('RIESGO') || (item.Demanda3M > item.StockDisp)) {
      const comprar = Math.max(0, Math.ceil(item.Demanda3M - item.StockDisp));
      return (
        <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs bg-red-50 px-2 py-1.5 rounded border border-red-100">
          <ShoppingCart size={14} /> Pedir {comprar || 'Urgn.'}
        </div>
      );
    }
    if (item.ValorSobrestock > 0 || estado.includes('SOBRESTOCK')) {
      return (
        <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1.5 rounded border border-blue-100">
          <DollarSign size={14} /> Liquidar
        </div>
      );
    }
    return <span className="text-slate-400 text-xs flex items-center gap-1"><Activity size={14}/> Ok</span>;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      {/* HEADER CORPORATIVO */}
      <div className="bg-slate-900 text-white p-4 md:px-6 md:py-5 shadow-md sticky top-0 z-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="text-blue-400" /> Supply Chain Command Center
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide uppercase">
              Módulo Táctico de Reposición & Stock Físico
            </p>
          </div>
          
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md shadow transition-colors text-sm font-semibold flex items-center gap-2 border border-blue-400">
            <Package size={16} />
            {data.length > 0 ? 'Actualizar Dataset' : 'Cargar Dataset (CSV)'}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="max-w-[1600px] mx-auto p-4 md:p-6">
          
          {/* KPI DASHBOARD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div onClick={() => toggleKpi('')} className={`bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-t-4 border-t-slate-800 cursor-pointer transition-all hover:shadow-md ${!filters.kpi ? 'ring-2 ring-slate-400 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Unidades en Análisis</div>
              <div className="text-3xl font-black text-slate-800">{kpis.total.toLocaleString()}</div>
            </div>

            <div onClick={() => toggleKpi('RIESGO_ALTO')} className={`bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-t-4 border-t-red-600 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${filters.kpi === 'RIESGO_ALTO' ? 'ring-2 ring-red-500 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}>
              <AlertOctagon className="absolute right-[-10px] bottom-[-10px] text-red-50 w-24 h-24" />
              <div className="relative z-10">
                <div className="text-red-600 text-xs font-bold uppercase tracking-wider mb-1">Riesgos Críticos (Prio 1)</div>
                <div className="text-3xl font-black text-slate-800">{kpis.itemsRiesgoAlto}</div>
              </div>
            </div>

            <div onClick={() => toggleKpi('SOBRESTOCK')} className={`bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-t-4 border-t-blue-500 relative overflow-hidden cursor-pointer transition-all hover:shadow-md ${filters.kpi === 'SOBRESTOCK' ? 'ring-2 ring-blue-500 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}>
               <DollarSign className="absolute right-[-10px] bottom-[-10px] text-blue-50 w-24 h-24" />
               <div className="relative z-10">
                <div className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Cap. Inmovilizado (&gt;6m)</div>
                <div className="text-3xl font-black text-slate-800">{formatCurrency(kpis.capitalInmovilizado)}</div>
              </div>
            </div>

            <div onClick={() => toggleKpi('CLASE_A_RIESGO')} className={`bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-t-4 border-t-purple-500 cursor-pointer transition-all hover:shadow-md ${filters.kpi === 'CLASE_A_RIESGO' ? 'ring-2 ring-purple-500 scale-[1.02]' : 'opacity-80 hover:opacity-100'}`}>
              <div className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Salud Clase 'A'</div>
              <div className="text-3xl font-black text-slate-800">{kpis.itemsClaseARiesgo} <span className="text-lg text-slate-400 font-medium">/ {kpis.itemsClaseA}</span></div>
            </div>
          </div>

          {/* PANEL DE CONTROL DE FILTROS */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-lg">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2"><Filter size={14}/> Segmentación</h3>
              {(filters.search || filters.proveedor || filters.categoria || filters.abc || filters.rotacion || filters.estado || filters.temporada || filters.kpi) && (
                <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                  <XCircle size={14} /> Limpiar Todo
                </button>
              )}
            </div>
            
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2 relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar SKU o Desc</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Ej. BOMBA..." value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} />
                </div>
              </div>

              <div className="lg:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proveedor</label>
                <select className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded outline-none bg-white" value={filters.proveedor} onChange={(e) => updateFilter('proveedor', e.target.value)}>
                  <option value="">Todos ({proveedores.length})</option>
                  {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</label>
                <select className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded outline-none bg-white" value={filters.estado} onChange={(e) => updateFilter('estado', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="RIESGO">Solo Riesgos</option>
                  <option value="SOBRESTOCK">Solo Sobrestock</option>
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clase ABC</label>
                <select className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded outline-none bg-white" value={filters.abc} onChange={(e) => updateFilter('abc', e.target.value)}>
                  <option value="">Todas</option>
                  <option value="A">Clase A (Top 80%)</option>
                  <option value="B">Clase B (15%)</option>
                  <option value="C">Clase C (5%)</option>
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Temporada</label>
                <select className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded outline-none bg-white" value={filters.temporada} onChange={(e) => updateFilter('temporada', e.target.value)}>
                  <option value="">Todas</option>
                  <option value="INVIERNO">Invierno ❄️</option>
                  <option value="VERANO">Verano ☀️</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLA DE DATOS MAESTRA - ALTA DENSIDAD */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 text-[10px] uppercase tracking-wider">
                    <th className="p-3 font-semibold whitespace-nowrap border-r border-slate-700">SKU / Clasificación</th>
                    <th className="p-3 font-semibold min-w-[250px] border-r border-slate-700">Descripción & Proveedor</th>
                    <th className="p-3 font-semibold min-w-[150px] border-r border-slate-700" title="Historial real de ventas"><History size={12} className="inline mr-1"/> Historial Ventas</th>
                    <th className="p-3 font-semibold min-w-[140px] border-r border-slate-700" title="Stock físico menos comprometido"><Archive size={12} className="inline mr-1"/> Análisis Stock</th>
                    <th className="p-3 font-semibold min-w-[140px] border-r border-slate-700" title="Proyección de consumo a 3 meses y días de cobertura"><TrendingUp size={12} className="inline mr-1"/> Proyección & Cob.</th>
                    <th className="p-3 font-semibold min-w-[200px] border-r border-slate-700">Diagnóstico Sistema</th>
                    <th className="p-3 font-semibold text-right bg-blue-900/50">Acción Táctica</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-200">
                  {filteredData.slice(0, 150).map((item, idx) => {
                    const estado = item['Estado Abastecimiento'] || '';
                    const estadoStyle = getStatusStyle(estado);
                    const rotacion = item['Clasificación Rotación'] || 'Sin Clasificar';

                    return (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                        
                        {/* COL 1: SKU & Badges */}
                        <td className="p-3 align-top border-r border-slate-100">
                          <div className="font-mono text-xs text-slate-800 font-bold mb-2">{item['Código Artículo']}</div>
                          <div className="flex gap-1.5 items-center">
                            {getAbcBadge(item.ClaseABC)}
                            {item.Temporada === 'INVIERNO' && <span title="Pico Invierno" className="text-blue-500 bg-blue-50 p-0.5 rounded border border-blue-100"><Snowflake size={14}/></span>}
                            {item.Temporada === 'VERANO' && <span title="Pico Verano" className="text-orange-500 bg-orange-50 p-0.5 rounded border border-orange-100"><Sun size={14}/></span>}
                          </div>
                        </td>

                        {/* COL 2: Descripción */}
                        <td className="p-3 align-top border-r border-slate-100">
                          <div className="font-bold text-slate-800 text-[13px] leading-tight mb-1" title={item['Descripción Artículo']}>
                            {item['Descripción Artículo']}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium" title={item['Proveedor']}><Tags size={10} className="text-blue-400"/> {item['Proveedor']}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={item['Categoría']}>{item['Categoría']} | {rotacion.split('(')[0]}</span>
                          </div>
                        </td>

                        {/* COL 3: Historial Ventas (NUEVO) */}
                        <td className="p-3 align-top border-r border-slate-100 bg-slate-50/50">
                          <div className="flex justify-between items-center mb-1 border-b border-slate-200 pb-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">12 Meses:</span>
                            <span className="text-xs font-bold text-slate-800">{item.Ventas12M} <span className="text-[9px] font-normal text-slate-500">und</span></span>
                          </div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[10px] text-slate-500">3 Años (Total):</span>
                            <span className="text-[11px] font-medium text-slate-700">{item.Ventas3A}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500" title="Meses con ventas registradas en los últimos 36 meses">Frecuencia (3A):</span>
                            <span className={`text-[10px] font-bold px-1.5 rounded ${item.MesesVenta3A > 12 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{item.MesesVenta3A}/36 m.</span>
                          </div>
                        </td>

                        {/* COL 4: Análisis Stock Físico vs Comprometido (NUEVO) */}
                        <td className="p-3 align-top border-r border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-500">Físico en Base:</span>
                            <span className="text-xs font-semibold text-slate-700">{item.StockFisico}</span>
                          </div>
                          <div className="flex justify-between items-center mb-1 text-red-600">
                            <span className="text-[10px] font-medium">- Reservado:</span>
                            <span className="text-[11px] font-bold">{item.Comprometido}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-1">
                            <span className="text-[10px] text-slate-700 font-bold uppercase">= Disponible:</span>
                            <span className={`text-[13px] font-black ${item.StockDisp <= 0 ? 'text-red-600' : 'text-green-600'}`}>{item.StockDisp}</span>
                          </div>
                        </td>

                        {/* COL 5: Proyección & Cobertura (MEJORADO) */}
                        <td className="p-3 align-top border-r border-slate-100 bg-slate-50/50">
                          <div className="flex justify-between items-center mb-1 border-b border-slate-200 pb-1">
                            <span className="text-[10px] text-slate-500 font-bold">Demanda 3M:</span>
                            <span className="text-xs font-bold text-blue-700">{item.Demanda3M} <span className="text-[9px] font-normal text-blue-500">und</span></span>
                          </div>
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[10px] text-slate-500">Cobertura:</span>
                            <span className="text-[11px] font-medium text-slate-700">{item['Índice de Cobertura (Meses)']} mes</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-500" title="Días exactos de cobertura estimados">Días Vida:</span>
                            <span className={`text-[11px] font-bold ${parseNum(item['Días de Cobertura Estimados']) < 30 ? 'text-red-600' : 'text-slate-700'}`}>{item['Días de Cobertura Estimados']} d.</span>
                          </div>
                        </td>

                        {/* COL 6: Diagnóstico & Capital */}
                        <td className="p-3 align-top border-r border-slate-100">
                          <span className={`px-2 py-1 rounded text-[10px] border leading-tight block w-full mb-2 ${estadoStyle}`} title={estado}>
                            {estado}
                          </span>
                          {item.ValorSobrestock > 0 && (
                            <div className="flex justify-between items-center bg-blue-50 px-2 py-1 rounded border border-blue-100">
                              <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wide">Inmovilizado</span>
                              <span className="text-[11px] text-blue-800 font-black">{formatCurrency(item.ValorSobrestock)}</span>
                            </div>
                          )}
                        </td>

                        {/* COL 7: Acción */}
                        <td className="p-3 align-middle bg-blue-50/30 group-hover:bg-blue-100/50 transition-colors">
                          <div className="flex justify-end">
                            {getActionRecommendation(item)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredData.length > 150 && (
                <div className="p-4 text-center text-xs font-medium text-slate-500 bg-slate-50 border-t border-slate-200">
                  Visualizando 150 de {filteredData.length.toLocaleString()} SKUs.
                </div>
              )}
              {filteredData.length === 0 && (
                <div className="p-12 text-center">
                  <BarChart3 className="mx-auto text-slate-300 mb-3" size={48} />
                  <h3 className="text-lg font-medium text-slate-700">Sin resultados</h3>
                  <p className="text-slate-500 text-sm mt-1">Modifica los filtros de arriba para ver más datos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto mt-20 p-8 text-center border border-dashed border-slate-300 rounded-2xl bg-white shadow-sm mx-4">
          <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-6">
            <TrendingUp size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Motor de Análisis en Reposo</h2>
          <p className="text-slate-500 mb-8 max-w-lg mx-auto">
            Por favor, carga tu archivo CSV. La nueva matriz de datos financieros e historial de ventas se armará automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
