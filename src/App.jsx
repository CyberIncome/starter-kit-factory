import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, Check, ChevronRight, CircleHelp, FileText, FolderOpen, Home, LoaderCircle, PackageCheck, Plus, Sparkles } from 'lucide-react';

const initialKit = {
  orderNumber: '',
  industry: 'dog-walking',
  businessName: 'Happy Tails Dog Walking',
  ownerName: 'Jamie Smith',
  tagline: 'Every walk, handled with heart.',
  phone: '(512) 555-0142',
  email: 'hello@happytails.example',
  area: 'Austin, Texas',
  website: 'www.happytails.example',
  qrUrl: 'https://example.com',
  theme: 'neighborhood',
  logoLayout: 'badge',
  logoMark: 'paw',
  flyerOffer: 'Free meet-and-greet for new clients',
  services: [
    { name: '30-minute dog walk', duration: 'weekday walk', price: '$22' },
    { name: '60-minute dog walk', duration: 'weekday walk', price: '$35' },
    { name: 'Puppy visit', duration: '30 minutes', price: '$28' }
  ]
};

const themeMeta = {
  neighborhood: { name: 'Friendly Neighborhood', note: 'warm, familiar, cheerful', colors: ['#173B36', '#F06C50', '#87A774'] },
  modern: { name: 'Clean Modern', note: 'calm, clear, trustworthy', colors: ['#172C45', '#4B928A', '#B7D8D1'] },
  service: { name: 'Bold Service Pro', note: 'confident, direct, capable', colors: ['#172028', '#F2B843', '#2C7889'] },
  local: { name: 'Warm Local', note: 'personal, grounded, thoughtful', colors: ['#442D29', '#C9684D', '#7B9A85'] },
  adventure: { name: 'Outdoor Adventure', note: 'active, fresh, trail-ready', colors: ['#163B32', '#D36D37', '#688C49'] },
  boutique: { name: 'Premium Boutique', note: 'soft, elevated, considered', colors: ['#372C48', '#A9677D', '#B9A58A'] }
};

const logoMarks = [
  ['paw', 'Paw'], ['heart', 'Heart'], ['leash', 'Leash'], ['trail', 'Trail'], ['tag', 'Tag']
];

function App() {
  const [page, setPage] = useState('home');
  const [kit, setKit] = useState(initialKit);
  const [orders, setOrders] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');

  const loadOrders = async () => {
    const items = await window.kitFactory?.getRecentOrders?.() || [];
    setOrders(items);
  };
  useEffect(() => { loadOrders(); }, []);

  const setField = (field, value) => setKit((current) => ({ ...current, [field]: value }));
  const valid = kit.businessName.trim() && kit.phone.trim() && kit.email.trim() && kit.services.some((service) => service.name && service.price);

  async function generate() {
    if (!valid) { setMessage('Add a business name, phone, email, and at least one priced service before generating.'); return; }
    setMessage(''); setIsGenerating(true); setResult(null);
    try {
      const completed = await window.kitFactory.generateKit(kit);
      setResult(completed);
      await loadOrders();
    } catch (error) {
      setMessage(`Could not generate this kit: ${error.message}`);
    } finally { setIsGenerating(false); }
  }

  const content = useMemo(() => {
    if (page === 'new') return <NewKit kit={kit} setField={setField} setKit={setKit} onGenerate={generate} isGenerating={isGenerating} valid={valid} result={result} message={message} />;
    if (page === 'orders') return <Orders orders={orders} openFolder={(folder) => window.kitFactory.openFolder(folder)} />;
    return <HomePage orders={orders} onNew={() => setPage('new')} onOpen={(folder) => window.kitFactory.openFolder(folder)} />;
  }, [page, kit, orders, isGenerating, valid, result, message]);

  return <><div className="window-chrome" aria-hidden="true"><div className="window-drag-region"><span>STARTER KIT FACTORY</span><i>LOCAL EDITION</i></div></div><div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">✦</div><div><strong>Starter Kit</strong><span>Factory</span></div></div>
      <nav aria-label="Main navigation">
        <NavItem active={page === 'home'} icon={<Home size={18} />} label="Home" onClick={() => setPage('home')} />
        <NavItem active={page === 'new'} icon={<Plus size={18} />} label="New kit" onClick={() => setPage('new')} />
        <NavItem active={page === 'orders'} icon={<Archive size={18} />} label="Orders" onClick={() => setPage('orders')} />
      </nav>
      <div className="sidebar-bottom"><div className="offline-dot"><span />Works locally</div></div>
    </aside>
    <main className="content"><header className="topbar"><div><span className="topbar-kicker">OPERATIONS DESK</span><strong>{page === 'new' ? 'New customer kit' : page === 'orders' ? 'Order library' : 'Good morning, ready to make something useful?'}</strong></div><button className="help-button"><CircleHelp size={17} /> Help</button></header>{content}</main>
  </div></>;
}

function NavItem({ active, icon, label, onClick }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>; }

function HomePage({ orders, onNew, onOpen }) {
  return <div className="page-content home-page"><section className="hero-card"><div><span className="eyebrow">ONE CUSTOMER AT A TIME</span><h1>Turn their details into a complete business kit.</h1><p>Everything is generated locally: the website, logos, print files, and delivery ZIP. No design tools. No browser tabs.</p><button className="primary-button" onClick={onNew}>Create a customer kit <ArrowRight size={18} /></button></div><div className="hero-ticket"><div className="ticket-pin" /><span>READY TO MAKE</span><strong>9</strong><small>customer-ready essentials</small><div className="ticket-rule" /><p>Website · logos · forms · print</p></div></section>
    <section className="metric-grid"><Metric label="Kits generated" value={orders.length} sub="saved on this computer" /><Metric label="Current vertical" value="Dog walking" sub="first launch pack" /><Metric label="Delivery status" value={orders.filter((order) => order.status === 'Ready to deliver').length} sub="ready to send" /></section>
    <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT WORK</span><h2>Orders in this factory</h2></div><button className="text-button" onClick={onNew}>New kit <ChevronRight size={16} /></button></div>{orders.length ? <div className="order-list">{orders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} onOpen={onOpen} />)}</div> : <div className="empty-state"><PackageCheck size={24} /><div><strong>Your first kit starts here.</strong><p>Create a sample order now so you can see the exact delivery folder your customer will receive.</p></div></div>}</section>
  </div>;
}

function Metric({ label, value, sub }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>; }
function OrderRow({ order, onOpen }) { return <div className="order-row"><div className="order-icon"><FileText size={18} /></div><div className="order-main"><strong>{order.businessName}</strong><span>{order.industry || 'Dog walking'} · {new Date(order.createdAt).toLocaleDateString()}</span></div><span className="status"><Check size={13} /> {order.status}</span><button className="icon-button" aria-label={`Open ${order.businessName} folder`} onClick={() => onOpen(order.outputFolder)}><FolderOpen size={18} /></button></div>; }

function NewKit({ kit, setField, setKit, onGenerate, isGenerating, valid, result, message }) {
  const updateService = (index, field, value) => setKit((current) => ({ ...current, services: current.services.map((service, serviceIndex) => serviceIndex === index ? { ...service, [field]: value } : service) }));
  const addService = () => setKit((current) => ({ ...current, services: [...current.services, { name: '', duration: '', price: '' }] }));
  const removeService = (index) => setKit((current) => ({ ...current, services: current.services.filter((_service, serviceIndex) => serviceIndex !== index) }));
  return <div className="page-content new-kit"><div className="new-layout"><div className="form-column"><section className="section-heading"><span className="eyebrow">DOG WALKING · V1</span><h1>Build the kit from one clean order record.</h1><p>Enter exactly what the customer approved. The same details will flow into every file.</p></section>
    <FormSection number="01" title="Order & business details"><div className="form-grid"><Field label="Etsy order number" value={kit.orderNumber} placeholder="#1042" onChange={(value) => setField('orderNumber', value)} /><Field label="Business name" value={kit.businessName} onChange={(value) => setField('businessName', value)} required /><Field label="Owner name" value={kit.ownerName} onChange={(value) => setField('ownerName', value)} /><Field label="Service area" value={kit.area} onChange={(value) => setField('area', value)} /><Field label="Phone" value={kit.phone} onChange={(value) => setField('phone', value)} required /><Field label="Email" value={kit.email} onChange={(value) => setField('email', value)} required /><Field label="Website" value={kit.website} onChange={(value) => setField('website', value)} /><Field label="Website or booking link for QR" value={kit.qrUrl} onChange={(value) => setField('qrUrl', value)} /></div><Field label="Tagline" value={kit.tagline} onChange={(value) => setField('tagline', value)} /></FormSection>
    <FormSection number="02" title="Brand direction"><div className="theme-grid">{Object.entries(themeMeta).map(([key, theme]) => <button key={key} className={'theme-card ' + (kit.theme === key ? 'selected' : '')} onClick={() => setField('theme', key)}><span className="swatches">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{theme.name}</strong><small>{theme.note}</small></button>)}</div><div className="choice-row"><span>Logo layout</span>{[['badge', 'Badge'], ['stacked', 'Stacked'], ['horizontal', 'Horizontal']].map(([value, label]) => <button key={value} className={'chip ' + (kit.logoLayout === value ? 'chosen' : '')} onClick={() => setField('logoLayout', value)}>{label}</button>)}</div><div className="choice-row"><span>Logo mark</span>{logoMarks.map(([value, label]) => <button key={value} className={'chip ' + (kit.logoMark === value ? 'chosen' : '')} onClick={() => setField('logoMark', value)}>{label}</button>)}</div></FormSection>
    <FormSection number="03" title="Services & offer"><div className="services-editor"><div className="service-labels"><span>Service</span><span>Details</span><span>Price</span></div>{kit.services.map((service, index) => <div className="service-inputs" key={index}><input value={service.name} onChange={(event) => updateService(index, 'name', event.target.value)} placeholder="Service name" /><input value={service.duration} onChange={(event) => updateService(index, 'duration', event.target.value)} placeholder="Duration or note" /><input value={service.price} onChange={(event) => updateService(index, 'price', event.target.value)} placeholder="$0" /><button className="remove-service" onClick={() => removeService(index)} disabled={kit.services.length === 1}>×</button></div>)}<button className="add-service" onClick={addService}>+ Add another service</button></div><Field label="Flyer launch offer" value={kit.flyerOffer} onChange={(value) => setField('flyerOffer', value)} /></FormSection>
    <div className="generate-bar"><div><strong>Ready to generate?</strong><span>{valid ? 'The factory will create all nine deliverables and one delivery ZIP.' : 'Finish the required business details first.'}</span></div><button className="primary-button" onClick={onGenerate} disabled={!valid || isGenerating}>{isGenerating ? <><LoaderCircle className="spin" size={18} /> Building kit…</> : <><Sparkles size={18} /> Generate kit</>}</button></div>{message && <div className="error-note">{message}</div>}{result && <div className="success-card"><Check size={22} /><div><strong>{result.businessName} is ready to deliver.</strong><p>The ZIP and working files were saved in the generated-kit folder.</p></div><button className="secondary-button" onClick={() => window.kitFactory.openFolder(result.folder)}>Open folder</button></div>}</div><Preview kit={kit} /></div></div>;
}

function FormSection({ number, title, children }) { return <section className="form-section"><div className="form-section-title"><span>{number}</span><h2>{title}</h2></div>{children}</section>; }
function Field({ label, value, onChange, placeholder, required }) { return <label className="field-label"><span>{label}{required && <b> *</b>}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }

function Preview({ kit }) {
  const theme = themeMeta[kit.theme];
  const layoutNames = { badge: 'Badge logo', stacked: 'Stacked logo', horizontal: 'Horizontal logo' };
  const markLabels = { paw: 'Paw', heart: 'Heart', leash: 'Leash', trail: 'Trail', tag: 'Tag' };
  const markGlyphs = { paw: '●', heart: '♥', leash: '⌁', trail: '▲', tag: '◇' };
  const services = kit.services.filter((service) => service.name || service.price).slice(0, 4);
  return <aside className="preview-column">
    <div className="preview-sticky">
      <div className="preview-heading"><span className="eyebrow">LIVE PREVIEW</span><strong>Everything updates as you type</strong></div>
      <div className={'preview-card layout-' + kit.logoLayout} style={{ '--preview-ink': theme.colors[0], '--preview-accent': theme.colors[1], '--preview-leaf': theme.colors[2] }}>
        <div className={'preview-mark mark-' + kit.logoMark}>{markGlyphs[kit.logoMark]}</div>
        <div className="preview-brand-copy"><span>{kit.area || 'Service area'}</span><h3>{kit.businessName || 'Business name'}</h3><p>{kit.tagline || 'A clear, customer-friendly tagline.'}</p></div>
        <div className="preview-rule" />
        <div className="preview-contact"><strong>{kit.ownerName || 'Business owner'}</strong>{kit.phone || 'Phone number'}<br />{kit.email || 'Email address'}</div>
      </div>
      <div className="preview-list">
        <div><span>Theme</span><strong>{theme.name}</strong></div>
        <div><span>Logo system</span><strong>{layoutNames[kit.logoLayout]} · {markLabels[kit.logoMark]}</strong></div>
        <div><span>Booking link</span><strong>{kit.qrUrl || 'Not added yet'}</strong></div>
      </div>
      <section className="preview-section">
        <div className="preview-section-heading"><span>PRICE SHEET</span><i>{services.length} services</i></div>
        {services.length ? <div className="preview-services">{services.map((service, index) => <div key={index}><span><strong>{service.name || 'Service name'}</strong><small>{service.duration || 'Service detail'}</small></span><b>{service.price || '$0'}</b></div>)}</div> : <p className="preview-empty">Add a service to preview the price sheet.</p>}
      </section>
      <section className="preview-offer">
        <span>FLYER LAUNCH OFFER</span><strong>{kit.flyerOffer || 'Add an offer for new clients.'}</strong><div><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      </section>
      <p className="preview-footnote">This preview stays visible while you work. The final ZIP includes the website, logo assets, print pieces, forms, and checklist in the selected theme.</p>
    </div>
  </aside>;
}

function Orders({ orders, openFolder }) { return <div className="page-content"><section className="section-heading compact"><span className="eyebrow">LOCAL ORDER HISTORY</span><h1>Every generated kit, in one place.</h1><p>Order records stay on this computer. Open a generated folder any time to review or resend an order.</p></section><section className="panel full-panel">{orders.length ? <div className="order-list">{orders.map((order) => <OrderRow key={order.id} order={order} onOpen={openFolder} />)}</div> : <div className="empty-state"><Archive size={24} /><div><strong>No kits generated yet.</strong><p>Your completed orders will appear here automatically.</p></div></div>}</section></div>; }

export default App;
