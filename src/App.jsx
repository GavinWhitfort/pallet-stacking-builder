
import React, { useState, useMemo } from 'react';
import { Package, Truck, Box as BoxIcon, Trash2, Plus, Info, Search, Settings, Check, RotateCcw } from 'lucide-react';
import Pallet3D from './components/Pallet3D';
import { calculateVisGeometry, PALLET_TYPES } from './utils/StackingEngine';

// Demo Catalog
// Products can have multiple boxes. Each box has dimensions/weight for stacking.
// When added to manifest, only the product name is shown (not individual boxes).
const CATALOG = [
  {
    id: 'wr-s4',
    group: 'WaterRower',
    name: 'WaterRower S4',
    color: '#eab308',
    boxes: [
      { width: 730, depth: 600, height: 500, weight: 30, fragileRating: 4, rigidityRating: 8 },
      { width: 2160, depth: 160, height: 90, weight: 10, fragileRating: 5, rigidityRating: 7 }
    ]
  },
  {
    id: 'wr-a1',
    group: 'WaterRower',
    name: 'WaterRower A1',
    color: '#eab308',
    boxes: [
      { width: 700, depth: 550, height: 500, weight: 28, fragileRating: 4, rigidityRating: 8 },
      { width: 1430, depth: 330, height: 260, weight: 10, fragileRating: 4, rigidityRating: 8 }
    ]
  },
  {
    id: 'nohrd-bike',
    group: 'NOHrD',
    name: 'NOHrD Bike',
    color: '#f97316',
    boxes: [
      { width: 1200, depth: 600, height: 900, weight: 45, fragileRating: 3, rigidityRating: 9 }
    ]
  },
  {
    id: 'slimbeam',
    group: 'NOHrD',
    name: 'SlimBeam',
    color: '#3b82f6',
    boxes: [
      { width: 2200, depth: 400, height: 300, weight: 70, fragileRating: 4, rigidityRating: 9 }
    ]
  },
  {
    id: 'sprintbok',
    group: 'NOHrD',
    name: 'Sprintbok',
    color: '#ef4444',
    boxes: [
      { width: 1800, depth: 850, height: 900, weight: 120, fragileRating: 5, rigidityRating: 9 }
    ]
  },
  {
    id: 'js-350',
    group: 'Jumpsport',
    name: 'Jumpsport 350',
    color: '#10b981',
    boxes: [
      { width: 1000, depth: 1000, height: 100, weight: 12, fragileRating: 2, rigidityRating: 6 }
    ]
  },
  {
    id: 'js-550',
    group: 'Jumpsport',
    name: 'Jumpsport 550',
    color: '#10b981',
    boxes: [
      { width: 1100, depth: 1100, height: 120, weight: 15, fragileRating: 2, rigidityRating: 7 }
    ]
  },
  {
    id: 'pd-rower',
    group: 'Pure Design',
    name: 'PD Rower',
    color: '#8b5cf6',
    boxes: [
      { width: 2000, depth: 500, height: 600, weight: 35, fragileRating: 4, rigidityRating: 8 }
    ]
  },
  {
    id: 'pd-bike',
    group: 'Pure Design',
    name: 'PD Bike',
    color: '#8b5cf6',
    boxes: [
      { width: 1100, depth: 600, height: 1100, weight: 40, fragileRating: 3, rigidityRating: 8 }
    ]
  },
];

const GROUPS = ['WaterRower', 'NOHrD', 'Jumpsport', 'Pure Design'];

function App() {
  const [items, setItems] = useState([]);
  const [palletType, setPalletType] = useState('AU_CHEP');
  const [postcode, setPostcode] = useState('');
  const [shippingResult, setShippingResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPalletIndex, setCurrentPalletIndex] = useState(0);
  const [productSettings, setProductSettings] = useState({}); // { 'productId-boxIndex': { width, depth, height, weight, allowEdge, forceRotation } }
  const [openSettingsId, setOpenSettingsId] = useState(null);
  const [hoveredItemId, setHoveredItemId] = useState(null);

  const allPallets = useMemo(() => {
    const flattenedItems = [];
    let maxBoxes = 0;

    // Calculate max boxes needed (custom items count as having 1 box)
    items.forEach(item => {
      const product = CATALOG.find(p => p.id === item.id);
      if (product) {
        maxBoxes = Math.max(maxBoxes, product.boxes.length);
      } else {
        // Assume custom item has 1 box
        maxBoxes = Math.max(maxBoxes, 1);
      }
    });

    for (let boxIndex = 0; boxIndex < maxBoxes; boxIndex++) {
      items.forEach(item => {
        const product = CATALOG.find(p => p.id === item.id);
        let baseBox = null;
        let pName = item.name;
        let pColor = item.color;

        if (product) {
          if (product.boxes[boxIndex]) {
            baseBox = product.boxes[boxIndex];
            pName = product.name;
            pColor = product.color;
          }
        } else if (boxIndex === 0) {
          // Custom item - only has box index 0
          // Item itself has dimensions for custom items
          if (item.width && item.depth && item.height) {
            baseBox = {
              width: item.width,
              depth: item.depth,
              height: item.height,
              weight: item.weight || 0,
              fragileRating: 0,
              rigidityRating: 10
            };
          }
        }

        if (baseBox) {
          const boxKey = `${item.id}-${boxIndex}`;
          const settings = productSettings[boxKey] || {};

          let w = settings.width !== undefined ? Number(settings.width) : baseBox.width;
          let d = settings.depth !== undefined ? Number(settings.depth) : baseBox.depth;

          if (settings.forceRotation) {
            [w, d] = [d, w];
          }

          const box = {
            ...baseBox,
            width: w,
            depth: d,
            height: settings.height !== undefined ? Number(settings.height) : baseBox.height,
            weight: settings.weight !== undefined ? Number(settings.weight) : baseBox.weight,
            allowEdge: settings.allowEdge || false,
            forceRotation: settings.forceRotation || false
          };

          for (let q = 0; q < item.quantity; q++) {
            flattenedItems.push({
              ...box,
              id: `${item.id}-q${q}-box${boxIndex}`,
              productId: item.id,
              boxIndex: boxIndex,
              name: pName,
              color: pColor,
              quantity: 1
            });
          }
        }
      });
    }

    const calculated = calculateVisGeometry(flattenedItems, palletType);
    return calculated;
  }, [items, palletType, productSettings]);

  const visData = useMemo(() => {
    if (allPallets.length === 0) {
      const p = PALLET_TYPES[palletType];
      return {
        items: [],
        totalHeight: p.height,
        loadWidth: p.width,
        loadDepth: p.depth,
        totalWeight: p.weight,
        pallet: p,
        efficiency: 0
      };
    }
    const safeIndex = Math.min(currentPalletIndex, allPallets.length - 1);
    return allPallets[safeIndex] || allPallets[0];
  }, [allPallets, currentPalletIndex, palletType]);

  // Total summary across all pallets
  const summary = useMemo(() => {
    if (allPallets.length === 0) {
      const p = PALLET_TYPES[palletType];
      return {
        totalWeight: p.weight,
        palletCount: 1,
        palletsDetail: [{
          index: 1,
          weight: p.weight,
          dims: `W:${(p.width / 10).toFixed(1)} D:${(p.depth / 10).toFixed(1)} H:${(p.height / 10).toFixed(1)} cm`
        }]
      };
    }
    return {
      totalWeight: allPallets.reduce((sum, p) => sum + p.totalWeight, 0),
      palletCount: allPallets.length,
      palletsDetail: allPallets.map((p, idx) => ({
        index: idx + 1,
        weight: p.totalWeight,
        dims: `W:${(p.loadWidth / 10).toFixed(1)} D:${(p.loadDepth / 10).toFixed(1)} H:${(p.totalHeight / 10).toFixed(1)} cm`
      }))
    };
  }, [allPallets, palletType]);

  // Reset pallet index when items change if it goes out of bounds
  React.useEffect(() => {
    if (currentPalletIndex >= allPallets.length && allPallets.length > 0) {
      setCurrentPalletIndex(allPallets.length - 1);
    }
  }, [allPallets.length]);

  const addCatalogItem = (product) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, quantity: 1, color: product.color }];
    });
  };

  const updateQuantity = (id, delta) => {
    setItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQ = Math.max(0, i.quantity + delta);
        return { ...i, quantity: newQ };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const updateProductSetting = (productId, boxIndex, key, value) => {
    const boxKey = `${productId}-${boxIndex}`;
    setProductSettings(prev => ({
      ...prev,
      [boxKey]: {
        ...(prev[boxKey] || {}),
        [key]: value
      }
    }));
  };

  const calculateShipping = () => {
    if (!postcode) return;

    // Zone calculation based on postcode
    const zone = postcode.startsWith('2') ? 'metro' :
      postcode.startsWith('3') ? 'regional' : 'remote';

    const zoneMultipliers = {
      metro: 1,
      regional: 1.4,
      remote: 2.2
    };

    const zoneMult = zoneMultipliers[zone];
    const totalWeight = summary.totalWeight;
    const palletCount = summary.palletCount;

    // Different pricing models for each carrier
    const carriers = [
      {
        name: 'Direct Freight',
        baseRate: 85,
        perKg: 0.45,
        perPallet: 65,
        eta: zone === 'metro' ? '1-2 Days' : zone === 'regional' ? '3-4 Days' : '5-7 Days'
      },
      {
        name: 'TFM',
        baseRate: 95,
        perKg: 0.38,
        perPallet: 55,
        eta: zone === 'metro' ? '1-3 Days' : zone === 'regional' ? '4-5 Days' : '6-8 Days'
      },
      {
        name: 'Northline',
        baseRate: 78,
        perKg: 0.52,
        perPallet: 70,
        eta: zone === 'metro' ? '2-3 Days' : zone === 'regional' ? '4-6 Days' : '7-10 Days'
      }
    ];

    const quotes = carriers.map(carrier => {
      const cost = (carrier.baseRate + (totalWeight * carrier.perKg) + (palletCount * carrier.perPallet)) * zoneMult;
      return {
        provider: carrier.name,
        cost: cost.toFixed(2),
        eta: carrier.eta
      };
    });

    // Sort by price (cheapest first)
    quotes.sort((a, b) => parseFloat(a.cost) - parseFloat(b.cost));

    setShippingResult(quotes);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <img src="/logo.png" alt="WaterRower | NOHrD" style={{ height: '40px', filter: 'brightness(0) invert(1)' }} />
          <span style={{ marginLeft: '12px', fontSize: '0.6rem', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '2px 6px' }}>v1.1 LASER_LOGIC</span>
        </div>
      </header>

      <main className="main-grid">
        {/* Right 3D View */}
        <div className="visualizer">
          <Pallet3D data={visData} hoveredItemId={hoveredItemId} onSelectItem={setHoveredItemId} />

          <div className="vis-overlay">
            <span className="badge">Pallet: <strong>{(PALLET_TYPES[palletType].width / 10).toFixed(1)}x{(PALLET_TYPES[palletType].depth / 10).toFixed(1)} cm</strong></span>

            <span className="badge" style={{
              background: visData.efficiency > 0.8 ? '#10b981' : visData.efficiency > 0.6 ? '#eab308' : '#ef4444',
              marginLeft: '8px'
            }}>
              Efficiency: {(visData.efficiency * 100).toFixed(0)}%
            </span>

            {visData.items && visData.items.length > 0 && (
              <span className="badge" style={{
                background: visData.items.some(i => i.crushRisk > 0.7) ? '#ef4444' : '#10b981',
                marginLeft: '8px'
              }}>
                Safety: {visData.items.some(i => i.crushRisk > 0.7) ? 'CRUSH RISK' : 'SECURE'}
              </span>
            )}
          </div>

          {allPallets.length > 1 && (
            <div className="pallet-nav">
              <button
                disabled={currentPalletIndex === 0}
                onClick={() => setCurrentPalletIndex(prev => prev - 1)}
                className="nav-btn"
              >
                ←
              </button>
              <div className="nav-info">Pallet {currentPalletIndex + 1} of {allPallets.length}</div>
              <button
                disabled={currentPalletIndex === allPallets.length - 1}
                onClick={() => setCurrentPalletIndex(prev => prev + 1)}
                className="nav-btn"
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Left Control Panel */}
        <div className="controls">
          <section className="card pallet-type-card">
            <h3><BoxIcon size={18} /> Pallet Type</h3>
            <select className="pallet-type-select" value={palletType} onChange={e => setPalletType(e.target.value)}>
              {Object.keys(PALLET_TYPES).map(k => (
                <option key={k} value={k}>{PALLET_TYPES[k].name}</option>
              ))}
            </select>

          </section>

          <section className="card inventory-card">
            <h3><Package size={18} /> Manifest ({items.reduce((a, b) => a + b.quantity, 0)} items)</h3>
            <div className="inventory-list">
              {items.length === 0 && <div className="empty-state">No items on pallet</div>}
              {items.map(item => {
                const settings = productSettings[item.id] || {};
                const isSettingsOpen = openSettingsId === item.id;

                return (
                  <div key={item.id} className="inv-item-container">
                    <div
                      className="inv-row"
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      <span className="inv-name">{item.name}</span>
                      <div className="qty-ctrl">
                        <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                      </div>
                      <div className="inv-actions">
                        <button
                          className={`settings-btn ${isSettingsOpen ? 'active' : ''}`}
                          onClick={() => setOpenSettingsId(isSettingsOpen ? null : item.id)}
                        >
                          <Settings size={14} />
                        </button>
                        <button className="del-btn" onClick={() => updateQuantity(item.id, -1000)}><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {isSettingsOpen && (
                      <div className="product-settings">
                        {CATALOG.find(p => p.id === item.id)?.boxes.map((baseBox, bIdx) => {
                          const boxKey = `${item.id}-${bIdx}`;
                          const settings = productSettings[boxKey] || {};
                          return (
                            <div key={boxKey} className="box-settings-group" style={{ marginBottom: bIdx < (CATALOG.find(p => p.id === item.id)?.boxes.length || 0) - 1 ? '16px' : '0', borderBottom: bIdx < (CATALOG.find(p => p.id === item.id)?.boxes.length || 0) - 1 ? '1px solid #2c2e33' : 'none', paddingBottom: bIdx < (CATALOG.find(p => p.id === item.id)?.boxes.length || 0) - 1 ? '16px' : '0' }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>Box {bIdx + 1} {(baseBox.width / 10).toFixed(1)}x{(baseBox.depth / 10).toFixed(1)}x{(baseBox.height / 10).toFixed(1)} cm</div>
                              <div className="settings-grid">
                                <div className="setting-field">
                                  <label>Width</label>
                                  <input
                                    type="number"
                                    value={settings.width ?? baseBox.width}
                                    onChange={(e) => updateProductSetting(item.id, bIdx, 'width', e.target.value)}
                                  />
                                </div>
                                <div className="setting-field">
                                  <label>Depth</label>
                                  <input
                                    type="number"
                                    value={settings.depth ?? baseBox.depth}
                                    onChange={(e) => updateProductSetting(item.id, bIdx, 'depth', e.target.value)}
                                  />
                                </div>
                                <div className="setting-field">
                                  <label>Height</label>
                                  <input
                                    type="number"
                                    value={settings.height ?? baseBox.height}
                                    onChange={(e) => updateProductSetting(item.id, bIdx, 'height', e.target.value)}
                                  />
                                </div>
                                <div className="setting-field">
                                  <label>Weight</label>
                                  <input
                                    type="number"
                                    value={settings.weight ?? baseBox.weight}
                                    onChange={(e) => updateProductSetting(item.id, bIdx, 'weight', e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="settings-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                <div className="setting-checkbox" style={{ marginBottom: 0 }}>
                                  <input
                                    type="checkbox"
                                    id={`edge-${boxKey}`}
                                    checked={settings.allowEdge || false}
                                    onChange={(e) => updateProductSetting(item.id, bIdx, 'allowEdge', e.target.checked)}
                                  />
                                  <label htmlFor={`edge-${boxKey}`}>Allow on edge</label>
                                </div>
                                <button
                                  className={`rotate-btn ${settings.forceRotation ? 'active' : ''}`}
                                  onClick={() => updateProductSetting(item.id, bIdx, 'forceRotation', !settings.forceRotation)}
                                  style={{
                                    background: settings.forceRotation ? 'var(--accent)' : '#1a1b1e',
                                    color: '#fff',
                                    border: '1px solid var(--border)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <RotateCcw size={12} /> Rotate 90°
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <button className="save-settings-btn" style={{ marginTop: '16px' }} onClick={() => setOpenSettingsId(null)}>
                          <Check size={14} /> Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="stats">
              <div className="stat"><span>Total Weight:</span> <strong>{summary.totalWeight.toFixed(1)} kg</strong></div>
              <div className="stat"><span>Total Pallets:</span> <strong>{summary.palletCount}</strong></div>
              <div className="stat full-width"><span>Load Dims:</span> <strong>W:{(visData.loadWidth / 10).toFixed(1)} D:{(visData.loadDepth / 10).toFixed(1)} H:{(visData.totalHeight / 10).toFixed(1)} cm</strong></div>
              {visData.items && visData.items.length > 0 && (
                <>
                  <div className="stat"><span>Fill Rate:</span> <strong>{(visData.efficiency * 100).toFixed(1)}%</strong></div>
                  <div className="stat">
                    <span>Load Safety:</span>
                    <strong style={{ color: visData.items.some(i => i.crushRisk > 0.8) ? '#ef4444' : '#10b981' }}>
                      {visData.items.some(i => i.crushRisk > 0.8) ? '✗ CRUSH WARNING' : '✓ SPEC SECURE'}
                    </strong>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card catalog-card">
            <h3><Plus size={18} /> Add Product</h3>

            <div className="search-container" style={{ marginBottom: '12px', position: 'relative' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#000',
                  border: '1px solid #2c2e33',
                  color: '#fff',
                  padding: '8px 8px 8px 34px',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div className="catalog-grid">
              {GROUPS.map(group => {
                const groupItems = CATALOG.filter(p =>
                  p.group === group &&
                  p.name.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (groupItems.length === 0) return null;

                return (
                  <div key={group} className="catalog-group">
                    <h4 className="group-title">{group}</h4>
                    <div className="group-items">
                      {groupItems.map(p => {
                        const firstBox = p.boxes[0];
                        const boxCount = p.boxes.length;
                        return (
                          <button key={p.id} onClick={() => addCatalogItem(p)} className="catalog-btn" style={{ borderLeft: `4px solid ${p.color}` }}>
                            <div className="p-header" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                              <div className="p-name">{p.name}</div>
                              {boxCount > 1 && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>({boxCount} boxes)</div>}
                            </div>
                            <div className="p-dims">{(firstBox.width / 10).toFixed(1)}x{(firstBox.depth / 10).toFixed(1)}x{(firstBox.height / 10).toFixed(1)} cm{boxCount > 1 ? ' +' : ''}</div>
                            <div className="p-ratings">
                              <span title="Fragility (1-10)">🛡️ {firstBox.fragileRating}</span>
                              <span title="Rigidity (1-10)">🧱 {firstBox.rigidityRating}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {CATALOG.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                  No products found
                </div>
              )}
            </div>

            <div className="custom-add" onClick={() => addCatalogItem({ id: `custom-${Date.now()}`, name: 'Custom Box', width: 500, depth: 500, height: 500, weight: 10, color: '#64748b' })}>
              {/* Could add manual sizing inputs here later */}
              <small>+ Manual Custom Size (50.0cm Cube)</small>
            </div>
          </section>

          <section className="card shipping-card">
            <h3><Truck size={18} /> Shipping Calculator</h3>
            <div className="ship-row">
              <input
                type="text"
                placeholder="Postcode (e.g. 2000)"
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
              />
              <button onClick={calculateShipping} className="calc-btn">Get Quote</button>
            </div>
            {shippingResult && (
              <div className="quotes-container">
                <div className="load-details" style={{ fontSize: '0.75rem', marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                  <div style={{ color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', fontWeight: 'bold' }}>Load Summary</div>
                  {summary.palletsDetail.map(p => (
                    <div key={p.index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                      <span style={{ color: '#9ca3af' }}>Pallet {p.index}:</span>
                      <strong style={{ color: '#fff' }}>{p.dims} • {p.weight.toFixed(1)}kg</strong>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>
                    <span style={{ color: '#9ca3af' }}>Total:</span>
                    <strong style={{ color: 'var(--accent)' }}>{summary.totalWeight.toFixed(1)}kg • {summary.palletCount} pallet{summary.palletCount > 1 ? 's' : ''}</strong>
                  </div>
                </div>

                <div style={{ color: '#9ca3af', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', fontWeight: 'bold' }}>Carrier Quotes</div>
                {shippingResult.map((quote, idx) => (
                  <div key={idx} className="quote-card" style={{
                    background: idx === 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: idx === 0 ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '10px',
                    position: 'relative'
                  }}>
                    {idx === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '12px',
                        background: 'var(--accent)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Best Price
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff' }}>{quote.provider}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: idx === 0 ? 'var(--accent)' : '#fff' }}>
                        ${quote.cost}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      Estimated delivery: <strong style={{ color: '#fff' }}>{quote.eta}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
