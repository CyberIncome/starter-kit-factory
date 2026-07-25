import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, Check, ChevronRight, CircleHelp, FileText, FolderOpen, Home, LayoutTemplate, LoaderCircle, PackageCheck, Palette, Plus, Settings, Sparkles } from 'lucide-react';

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
  flyerOffer: 'Free meet-and-greet for new clients',
  services: [
    { name: '30-minute dog walk', duration: 'weekday walk', price: '$22' },
    { name: '60-minute dog walk', duration: 'weekday walk', price: '$35' },
    { name: 'Puppy visit', duration: '30 minutes', price: '$28' }
  ]
};

const themeMeta = {
  neighborhood: { name: 'Friendly Neighborhood', note: 'warm, friendly, bright', colors: ['#16352D', '#E46D50', '#88A77D'] },
  modern: { name: 'Clean Modern', note: 'calm, polished, trusted', colors: ['#182B42', '#4E8F87', '#B8D4C8'] },
  service: { name: 'Bold Service Pro', note: 'confident, practical, clear', colors: ['#15202A', '#F0B43C', '#2B7886'] },
  local: { name: 'Warm Local', note: 'personal, familiar, thoughtful', colors: ['#3C2C28', '#C9694D', '#7D9B88'] }
};

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
  const displayTheme = themeMeta[kit.theme];

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
    if (page === 'templates') return <Templates onUseTheme={(theme) => { setField('theme', theme); setPage('new'); }} />;
    if (page === 'settings') return <SettingsPanel />;
    return <HomePage orders={orders} onNew={() => setPage('new')} onOpen={(folder) => window.kitFactory.openFolder(folder)} />;
  }, [page, kit, orders, isGenerating, valid, result, message]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">✦</div><div><strong>Starter Kit</strong><span>Factory</span></div></div>
      <nav aria-label="Main navigation">
        <NavItem active={page === 'home'} icon={<Home size={18} />} label="Home" onClick={() => setPage('home')} />
        <NavItem active={page === 'new'} icon={<Plus size={18} />} label="New kit" onClick={() => setPage('new')} />
        <NavItem active={page === 'orders'} icon={<Archive size={18} />} label="Orders" onClick={() => setPage('orders')} />
        <NavItem active={page === 'templates'} icon={<LayoutTemplate size={18} />} label="Template library" onClick={() => setPage('templates')} />
      </nav>
      <div className="sidebar-bottom"><NavItem active={page === 'settings'} icon={<Settings size={18} />} label="Settings & backup" onClick={() => setPage('settings')} /><div className="offline-dot"><span />Works locally</div></div>
    </aside>
    <main className="content"><header className="topbar"><div><span className="topbar-kicker">OPERATIONS DESK</span><strong>{page === 'new' ? 'New customer kit' : page === 'orders' ? 'Order library' : page === 'templates' ? 'Template library' : page === 'settings' ? 'Settings & backup' : 'Good morning, ready to make something useful?'}</strong></div><button className="help-button"><CircleHelp size={17} /> Help</button></header>{content}</main>
  </div>;
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
    <FormSection number="02" title="Brand direction"><div className="theme-grid">{Object.entries(themeMeta).map(([key, theme]) => <button key={key} className={`theme-card ${kit.theme === key ? 'selected' : ''}`} onClick={() => setField('theme', key)}><span className="swatches">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{theme.name}</strong><small>{theme.note}</small></button>)}</div><div className="choice-row"><span>Logo layout</span>{[['badge', 'Badge'], ['stacked', 'Stacked'], ['horizontal', 'Horizontal']].map(([value, label]) => <button key={value} className={`chip ${kit.logoLayout === value ? 'chosen' : ''}`} onClick={() => setField('logoLayout', value)}>{label}</button>)}</div></FormSection>
    <FormSection number="03" title="Services & offer"><div className="services-editor"><div className="service-labels"><span>Service</span><span>Details</span><span>Price</span></div>{kit.services.map((service, index) => <div className="service-inputs" key={index}><input value={service.name} onChange={(event) => updateService(index, 'name', event.target.value)} placeholder="Service name" /><input value={service.duration} onChange={(event) => updateService(index, 'duration', event.target.value)} placeholder="Duration or note" /><input value={service.price} onChange={(event) => updateService(index, 'price', event.target.value)} placeholder="$0" /><button className="remove-service" onClick={() => removeService(index)} disabled={kit.services.length === 1}>×</button></div>)}<button className="add-service" onClick={addService}>+ Add another service</button></div><Field label="Flyer launch offer" value={kit.flyerOffer} onChange={(value) => setField('flyerOffer', value)} /></FormSection>
    <div className="generate-bar"><div><strong>Ready to generate?</strong><span>{valid ? 'The factory will create all nine deliverables and one delivery ZIP.' : 'Finish the required business details first.'}</span></div><button className="primary-button" onClick={onGenerate} disabled={!valid || isGenerating}>{isGenerating ? <><LoaderCircle className="spin" size={18} /> Building kit…</> : <><Sparkles size={18} /> Generate kit</>}</button></div>{message && <div className="error-note">{message}</div>}{result && <div className="success-card"><Check size={22} /><div><strong>{result.businessName} is ready to deliver.</strong><p>The ZIP and working files were saved in the generated-kit folder.</p></div><button className="secondary-button" onClick={() => window.kitFactory.openFolder(result.folder)}>Open folder</button></div>}</div><Preview kit={kit} /></div></div>;
}

function FormSection({ number, title, children }) { return <section className="form-section"><div className="form-section-title"><span>{number}</span><h2>{title}</h2></div>{children}</section>; }
function Field({ label, value, onChange, placeholder, required }) { return <label className="field-label"><span>{label}{required && <b> *</b>}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }

function Preview({ kit }) { const theme = themeMeta[kit.theme]; return <aside className="preview-column"><div className="preview-sticky"><div className="preview-heading"><span className="eyebrow">LIVE PREVIEW</span><strong>Brand system</strong></div><div className="preview-card" style={{ '--preview-ink': theme.colors[0], '--preview-accent': theme.colors[1], '--preview-leaf': theme.colors[2] }}><div className="preview-dog">♥</div><span>{kit.area}</span><h3>{kit.businessName}</h3><p>{kit.tagline}</p><div className="preview-rule" /><div className="preview-contact">{kit.phone}<br />{kit.email}</div></div><div className="preview-list"><div><span>Kit style</span><strong>{theme.name}</strong></div><div><span>Logo</span><strong>{kit.logoLayout}</strong></div><div><span>Includes</span><strong>9 essentials</strong></div></div><p className="preview-footnote">This preview is for the operator. Final customer files use the selected theme across every deliverable.</p></div></aside>; }

function Orders({ orders, openFolder }) { return <div className="page-content"><section className="section-heading compact"><span className="eyebrow">LOCAL ORDER HISTORY</span><h1>Every generated kit, in one place.</h1><p>Order records stay on this computer. Open a generated folder any time to review or resend an order.</p></section><section className="panel full-panel">{orders.length ? <div className="order-list">{orders.map((order) => <OrderRow key={order.id} order={order} onOpen={openFolder} />)}</div> : <div className="empty-state"><Archive size={24} /><div><strong>No kits generated yet.</strong><p>Your completed orders will appear here automatically.</p></div></div>}</section></div>; }

function Templates({ onUseTheme }) { return <div className="page-content"><section className="section-heading compact"><span className="eyebrow">DOG WALKING · FIRST PACK</span><h1>Choose a cohesive style, not a blank canvas.</h1><p>Every theme includes coordinated website, logo, print, and form treatments.</p></section><div className="template-board">{Object.entries(themeMeta).map(([key, theme]) => <article className="template-showcase" key={key}><div className="template-art" style={{ '--art-ink': theme.colors[0], '--art-accent': theme.colors[1], '--art-leaf': theme.colors[2] }}><span>LOCAL<br />SERVICE</span><i /></div><div><h2>{theme.name}</h2><p>{theme.note}. Built to feel like one intentional business, not a collection of files.</p><button className="secondary-button" onClick={() => onUseTheme(key)}>Use this theme <ArrowRight size={16} /></button></div></article>)}</div></div>; }

function SettingsPanel() { return <div className="page-content"><section className="section-heading compact"><span className="eyebrow">CONTROL ROOM</span><h1>Keep the factory simple and safe.</h1><p>Generated kits live in your Documents folder. Back up that folder regularly to a drive or cloud folder you trust.</p></section><section className="settings-stack"><div className="settings-card"><div><strong>Generated kit location</strong><p>Documents → Starter Kit Factory → Generated Kits</p></div><button className="secondary-button" onClick={() => window.kitFactory.openFolder('')}>Open folder</button></div><div className="settings-card"><div><strong>Updates</strong><p>Installed builds check GitHub Releases automatically after the first public release is published.</p></div><span className="status neutral">Configured</span></div><div className="settings-card"><div><strong>Legal-template review</strong><p>Keep service agreement copy attorney-reviewed and versioned before commercial use.</p></div><span className="status attention">Action needed before launch</span></div></section></div>; }

export default App;
