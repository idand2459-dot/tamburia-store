import { useState, useEffect, useRef } from 'react';

/* ─── Project definitions ──────────────────────────────────────────────── */
const PROJECTS = [
  {
    id: 'bathroom',
    icon: '🚿',
    name: 'שיפוץ שירותים',
    color: '#457b9d',
    inputs: [],
    getItems: () => [
      { name: 'סיליקון ואיטום',          category: 'adhesives', subcategory: 'sealants'         },
      { name: 'וילון מקלחת',             category: 'bathroom',  subcategory: 'shower_curtains'  },
      { name: 'ווים ומתלי מגבות',        category: 'bathroom',  subcategory: 'towel_hooks'      },
      { name: 'מראה לאמבטיה',            category: 'bathroom',  subcategory: 'mirrors'          },
      { name: 'אביזרי ניקוז',            category: 'plumbing',  subcategory: 'drainage'         },
      { name: 'אביזרי אמבטיה',           category: 'bathroom',  subcategory: 'accessories_bath' },
    ],
  },
  {
    id: 'cylinder',
    icon: '🚪',
    name: 'החלפת צילינדר',
    color: '#6c757d',
    inputs: [
      {
        id: 'lockType', label: 'סוג מנעול', type: 'select', default: 'standard',
        options: [
          { value: 'standard',  label: 'רגיל' },
          { value: 'security',  label: 'אבטחה מוגברת' },
        ],
      },
    ],
    getItems: ({ lockType = 'standard' } = {}) => {
      const base = [
        { name: 'צילינדר',            category: 'locks', subcategory: 'cylinders'        },
        { name: 'פירזול דלתות',       category: 'locks', subcategory: 'door_hardware'    },
        { name: 'מפתחות ואביזרים',    category: 'locks', subcategory: 'keys_accessories' },
      ];
      return lockType === 'security'
        ? [...base,
            { name: 'שרשרת ביטחון',  category: 'locks', subcategory: 'security_chains'  },
            { name: 'מנעול קוד',     category: 'locks', subcategory: 'code_locks'        },
          ]
        : base;
    },
  },
  {
    id: 'garden',
    icon: '🌿',
    name: 'סידור גינה',
    color: '#52b788',
    inputs: [
      {
        id: 'size', label: 'גודל גינה', type: 'select', default: 'small',
        options: [
          { value: 'small',  label: 'קטנה — עד 20 מ"ר'      },
          { value: 'medium', label: 'בינונית — 20–60 מ"ר'    },
          { value: 'large',  label: 'גדולה — מעל 60 מ"ר'    },
        ],
      },
    ],
    getItems: ({ size = 'small' } = {}) => {
      const base = [
        { name: 'ציוד השקיה',    category: 'garden', subcategory: 'watering'     },
        { name: 'כלי גינון',     category: 'garden', subcategory: 'garden_tools' },
        { name: 'טיפוח צמחים',  category: 'garden', subcategory: 'plant_care'   },
      ];
      if (size === 'medium') return [...base,
        { name: 'ציוד חוץ וגינה',  category: 'garden', subcategory: 'outdoor'        },
      ];
      if (size === 'large')  return [...base,
        { name: 'ציוד חוץ וגינה',  category: 'garden', subcategory: 'outdoor'        },
        { name: 'פרגולות',         category: 'home',   subcategory: 'pergola'         },
        { name: 'כלי עבודה כלליים', category: 'tools', subcategory: 'general_tools'  },
      ];
      return base;
    },
  },
  {
    id: 'plumbing',
    icon: '🔧',
    name: 'תיקון אינסטלציה',
    color: '#0077b6',
    inputs: [],
    getItems: () => [
      { name: 'ברזי הזנה',         category: 'plumbing',  subcategory: 'feed_valves'         },
      { name: 'חיבורים פלסטיים',   category: 'plumbing',  subcategory: 'plastic_connectors'  },
      { name: 'איטום וחומרי הדחה', category: 'plumbing',  subcategory: 'waterproofing'       },
      { name: 'ניפלים ומחברים',    category: 'plumbing',  subcategory: 'nipples'             },
      { name: 'אביזרי ברז',        category: 'faucets',   subcategory: 'accessories_faucets' },
      { name: 'סיליקון ואיטום',    category: 'adhesives', subcategory: 'sealants'            },
    ],
  },
];

/* ─── Component ────────────────────────────────────────────────────────── */
function ProjectCalculator({ addBundleToCart }) {
  const [allProducts, setAllProducts] = useState([]);
  const [selectedId, setSelectedId]   = useState(null);
  const [inputs, setInputs]           = useState({});
  const [bundleAdded, setBundleAdded] = useState(false);
  const sectionRef = useRef(null);

  /* fetch products once */
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => setAllProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  /* IntersectionObserver → stagger animation */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('proj-visible'); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const project = PROJECTS.find(p => p.id === selectedId) || null;

  function selectProject(id) {
    if (selectedId === id) { setSelectedId(null); return; }
    setBundleAdded(false);
    const proj = PROJECTS.find(p => p.id === id);
    const defaults = {};
    proj.inputs.forEach(inp => { defaults[inp.id] = inp.default; });
    setInputs(defaults);
    setSelectedId(id);
  }

  function setInput(id, value) {
    setInputs(prev => ({ ...prev, [id]: value }));
    setBundleAdded(false);
  }

  /* match each item to a real product */
  function findProduct(category, subcategory) {
    const matches = allProducts.filter(
      p => p.category === category && p.subcategory === subcategory && p.in_stock !== false
    );
    if (matches.length === 0) return null;
    return matches.reduce((a, b) => (a.price <= b.price ? a : b)); // cheapest
  }

  const rawItems     = project ? project.getItems(inputs) : [];
  const resolvedItems = rawItems.map(item => ({ ...item, found: findProduct(item.category, item.subcategory) }));
  const foundItems    = resolvedItems.filter(i => i.found);
  const totalEstimate = foundItems.reduce((s, i) => s + i.found.price, 0);
  const hasUnknown    = resolvedItems.some(i => !i.found);

  function handleAddAll() {
    if (!foundItems.length) return;
    addBundleToCart(foundItems.map(i => ({ ...i.found, quantity: 1 })));
    setBundleAdded(true);
    setTimeout(() => setBundleAdded(false), 3000);
  }

  return (
    <section className="proj-section" ref={sectionRef}>
      <div className="proj-content">

        {/* ── Header ── */}
        <div className="proj-header">
          <span className="proj-tag">✦ כלי תכנון</span>
          <h2 className="proj-title">לא יודעים מה לקנות? 🛠️</h2>
          <p className="proj-subtitle">בחרו פרויקט — נכין לכם רשימת קניות מלאה</p>
        </div>

        {/* ── Project cards ── */}
        <div className="proj-cards">
          {PROJECTS.map((proj, i) => (
            <button
              key={proj.id}
              className={`proj-card ${selectedId === proj.id ? 'selected' : ''}`}
              style={{ '--proj-color': proj.color, animationDelay: `${i * 0.09}s` }}
              onClick={() => selectProject(proj.id)}
            >
              <span className="proj-card-icon">{proj.icon}</span>
              <span className="proj-card-name">{proj.name}</span>
              {selectedId === proj.id && <span className="proj-card-check">✓</span>}
            </button>
          ))}
        </div>

        {/* ── Panel ── */}
        {project && (
          <div className="proj-panel" key={project.id}>

            {/* inputs row */}
            {project.inputs.length > 0 && (
              <div className="proj-inputs-row">
                {project.inputs.map(inp => (
                  <div key={inp.id} className="proj-input-group">
                    <label className="proj-input-label">{inp.label}</label>

                    {inp.type === 'select' && (
                      <select
                        className="proj-select"
                        value={inputs[inp.id] ?? inp.default}
                        onChange={e => setInput(inp.id, e.target.value)}
                      >
                        {inp.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}

                    {inp.type === 'number' && (
                      <div className="proj-number-wrap">
                        <input
                          type="number"
                          className="proj-number-input"
                          value={inputs[inp.id] ?? inp.default}
                          min={inp.min} max={inp.max}
                          onChange={e => setInput(inp.id, Number(e.target.value))}
                        />
                        {inp.unit && <span className="proj-unit">{inp.unit}</span>}
                      </div>
                    )}

                    {inp.type === 'stepper' && (
                      <div className="proj-stepper">
                        <button type="button"
                          onClick={() => setInput(inp.id, Math.max(inp.min, (inputs[inp.id] ?? inp.default) - 1))}>−</button>
                        <span className="proj-stepper-val">
                          {inputs[inp.id] ?? inp.default}{inp.unit ? ` ${inp.unit}` : ''}
                        </span>
                        <button type="button"
                          onClick={() => setInput(inp.id, Math.min(inp.max, (inputs[inp.id] ?? inp.default) + 1))}>+</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* items list */}
            <div className="proj-items">
              <div className="proj-items-title">רשימת קניות לפרויקט</div>
              {resolvedItems.map((item, i) => (
                <div
                  key={i}
                  className={`proj-item ${item.found ? 'found' : 'missing'}`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <span className="proj-item-dot">{item.found ? '✓' : '○'}</span>
                  <div className="proj-item-body">
                    <span className="proj-item-name">
                      {item.found ? item.found.name : item.name}
                    </span>
                    {item.found?.sku && (
                      <span className="proj-item-sku">מק"ט: {item.found.sku}</span>
                    )}
                  </div>
                  <span className="proj-item-price">
                    {item.found ? `₪${item.found.price}` : 'שאל בחנות'}
                  </span>
                </div>
              ))}
            </div>

            {/* footer */}
            <div className="proj-footer">
              <div className="proj-estimate">
                <span className="proj-estimate-label">הערכת עלות</span>
                <div className="proj-estimate-right">
                  <span className="proj-estimate-total">₪{totalEstimate.toLocaleString()}</span>
                  {hasUnknown && <span className="proj-estimate-plus">+</span>}
                  {hasUnknown && (
                    <span className="proj-estimate-note">+ פריטים לשאול בחנות</span>
                  )}
                </div>
              </div>
              <button
                className={`proj-add-btn${bundleAdded ? ' added' : ''}${foundItems.length === 0 ? ' disabled' : ''}`}
                disabled={foundItems.length === 0}
                onClick={handleAddAll}
              >
                {bundleAdded
                  ? '✓ נוסף לעגלה!'
                  : `🛒 הוסף הכל לעגלה (${foundItems.length} פריטים)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default ProjectCalculator;
