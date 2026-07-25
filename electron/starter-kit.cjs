const fs = require('node:fs/promises');
const path = require('node:path');
const { ZipArchive } = require('archiver');
const QRCode = require('qrcode');

const { Resvg } = require('@resvg/resvg-js');

const themes = {
  neighborhood: { name: 'Friendly Neighborhood', note: 'warm, familiar, cheerful', ink: '#173B36', paper: '#FFF7EA', accent: '#F06C50', leaf: '#87A774', soft: '#F7DFC3', display: 'Georgia, serif', body: 'Arial, sans-serif', label: 'The neighborhood favorite', shape: 'circle' },
  modern: { name: 'Clean Modern', note: 'calm, clear, trustworthy', ink: '#172C45', paper: '#F4F7F8', accent: '#4B928A', leaf: '#B7D8D1', soft: '#DCECE8', display: '"Trebuchet MS", Arial, sans-serif', body: 'Arial, sans-serif', label: 'Care that keeps moving', shape: 'square' },
  service: { name: 'Bold Service Pro', note: 'confident, direct, capable', ink: '#172028', paper: '#F7F7F2', accent: '#F2B843', leaf: '#2C7889', soft: '#DBEAEC', display: '"Arial Narrow", Arial, sans-serif', body: 'Arial, sans-serif', label: 'Reliable walks. Real updates.', shape: 'stripe' },
  local: { name: 'Warm Local', note: 'personal, grounded, thoughtful', ink: '#442D29', paper: '#FFF7ED', accent: '#C9684D', leaf: '#7B9A85', soft: '#F0D9C4', display: '"Palatino Linotype", Georgia, serif', body: 'Verdana, Arial, sans-serif', label: 'Good care, close to home', shape: 'arch' },
  adventure: { name: 'Outdoor Adventure', note: 'active, fresh, trail-ready', ink: '#163B32', paper: '#F3F5EB', accent: '#D36D37', leaf: '#688C49', soft: '#DDE6C8', display: '"Trebuchet MS", Arial, sans-serif', body: 'Verdana, Arial, sans-serif', label: 'More trail. More tail.', shape: 'peak' },
  boutique: { name: 'Premium Boutique', note: 'soft, elevated, considered', ink: '#372C48', paper: '#FBF7F2', accent: '#A9677D', leaf: '#B9A58A', soft: '#EDE0DC', display: 'Georgia, serif', body: '"Trebuchet MS", Arial, sans-serif', label: 'Thoughtful care, beautifully done', shape: 'frame' }
};

const marks = {
  paw: { name: 'Paw print', svg: '<circle cx="87" cy="54" r="12"/><circle cx="123" cy="54" r="12"/><circle cx="65" cy="80" r="11"/><circle cx="145" cy="80" r="11"/><path d="M105 87c-28 0-47 25-36 46 8 16 56 16 64 0 11-21-8-46-28-46z"/>' },
  heart: { name: 'Heart', svg: '<path d="M105 154 54 107C20 76 35 31 69 31c18 0 30 10 36 22 6-12 18-22 36-22 34 0 49 45 15 76z"/>' },
  leash: { name: 'Leash loop', svg: '<path d="M56 46c36-34 90-20 95 22 5 42-47 62-76 36-21-19-2-50 23-39 17 8 6 29-8 25"/><path d="M64 121c20 8 43 9 61 1"/><circle cx="137" cy="121" r="10"/>' },
  trail: { name: 'Trail & hill', svg: '<path d="M36 147 83 70l31 42 22-32 39 67z"/><path d="M80 147c2-24 16-42 38-52 15-7 26-19 31-35"/>' },
  tag: { name: 'Collar tag', svg: '<path d="M56 48h75l28 28v75l-61 36-62-36V76z"/><circle cx="113" cy="83" r="11"/><path d="M79 130h68"/>' }
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const safeFolderName = (value = 'Untitled') => String(value).trim().replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, '-').slice(0, 80) || 'Untitled';
const niceDate = () => new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());

function validatePayload(payload = {}) {
  const errors = [];
  const warnings = [];
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const services = Array.isArray(payload.services) ? payload.services : [];
  if (!text(payload.businessName)) errors.push({ field: 'businessName', message: 'Business name is required.' });
  if (!text(payload.phone)) errors.push({ field: 'phone', message: 'Phone is required.' });
  if (!text(payload.email) || !/^\S+@\S+\.\S+$/.test(payload.email.trim())) errors.push({ field: 'email', message: 'A valid email address is required.' });
  if (!text(payload.area)) errors.push({ field: 'area', message: 'Service area is required.' });
  if (!themes[payload.theme || 'neighborhood']) errors.push({ field: 'theme', message: 'Choose a supported theme.' });
  if (!['badge', 'stacked', 'horizontal'].includes(payload.logoLayout || 'badge')) errors.push({ field: 'logoLayout', message: 'Choose a supported logo layout.' });
  if (!marks[payload.logoMark || 'paw']) errors.push({ field: 'logoMark', message: 'Choose a supported logo mark.' });
  if (!services.some((service) => text(service.name) && text(service.price))) errors.push({ field: 'services', message: 'At least one service with a price is required.' });
  if (payload.qrUrl && !/^https?:\/\//i.test(payload.qrUrl.trim())) errors.push({ field: 'qrUrl', message: 'QR destination must start with http:// or https://.' });
  if (!text(payload.orderNumber)) warnings.push({ field: 'orderNumber', message: 'No order number was provided; the factory will create one locally.' });
  if (!text(payload.website)) warnings.push({ field: 'website', message: 'No website was provided; a placeholder URL will appear in the website template.' });
  return { valid: errors.length === 0, errors, warnings };
}

function expectedKitFiles(businessName) {
  const root = safeFolderName(businessName);
  const logo = '02-Logo-Pack/' + root;
  return [
    '01-Website/index.html',
    logo + '-primary.svg',
    logo + '-primary.png',
    logo + '-horizontal.svg',
    logo + '-horizontal.png',
    logo + '-badge.svg',
    logo + '-badge.png',
    logo + '-icon.svg',
    logo + '-icon.png',
    logo + '-primary-light.svg',
    logo + '-primary-light.png',
    '03-Invoice/invoice.pdf',
    '04-Service-Agreement/service-agreement.pdf',
    '05-Client-Intake-Form/client-intake-form.pdf',
    '06-Price-Sheet/price-sheet.pdf',
    '07-Business-Card/business-card.pdf',
    '08-Flyer/flyer.pdf',
    '09-Launch-Checklist/launch-checklist.pdf',
    'START-HERE.txt',
    'LICENSE.txt'
  ];
}

function tokens(data) {
  const theme = themes[data.theme] || themes.neighborhood;
  return {
    ...data,
    theme,
    services: (data.services || []).filter((service) => service.name && service.price),
    businessName: data.businessName || 'Your Business Name',
    ownerName: data.ownerName || 'Business Owner',
    email: data.email || 'hello@example.com',
    phone: data.phone || '(555) 555-5555',
    area: data.area || 'Your Service Area',
    tagline: data.tagline || 'Thoughtful local service, made simple.',
    website: data.website || 'www.yourbusiness.com',
    qrUrl: data.qrUrl || data.website || 'https://example.com',
    logoMark: data.logoMark || 'paw',
    themeKey: data.theme || 'neighborhood'
  };
}

function documentShell(title, body, t, options = {}) {
  const size = options.size || 'Letter';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${size}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: ${t.theme.ink}; background: ${t.theme.paper}; font: 10.5pt ${t.theme.body}; }
    .page { min-height: 11in; padding: .62in; position: relative; overflow: hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .band { position: absolute; height: .16in; background: ${t.theme.accent}; left: 0; right: 0; top: 0; }
    .eyebrow { color: ${t.theme.accent}; font-size: 8pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    h1 { font: 700 28pt ${t.theme.display}; line-height: 1.05; margin: .12in 0 .10in; letter-spacing: -.04em; }
    h2 { font: 700 14pt ${t.theme.display}; margin: .25in 0 .08in; }
    h3 { font-size: 9pt; margin: .12in 0 .04in; text-transform: uppercase; letter-spacing: .08em; }
    p { line-height: 1.55; margin: .08in 0; }
    .rule { height: 1px; background: ${t.theme.ink}; opacity: .18; margin: .18in 0; }
    .pill { display: inline-block; padding: .05in .10in; margin: .02in .03in .02in 0; border-radius: 999px; background: ${t.theme.soft}; font-size: 8pt; }
    .card { border: 1px solid rgba(0,0,0,.12); padding: .15in; background: rgba(255,255,255,.38); border-radius: .04in; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: .16in; }
    .services { width: 100%; border-collapse: collapse; margin: .10in 0; }
    .services td { padding: .09in 0; border-bottom: 1px solid rgba(0,0,0,.12); }
    .services td:last-child { text-align: right; font-weight: 700; }
    .field { min-height: .30in; border-bottom: 1px solid rgba(0,0,0,.27); margin: .05in 0 .12in; }
    .footer { position: absolute; left: .62in; right: .62in; bottom: .34in; font-size: 7.5pt; color: rgba(0,0,0,.55); }
    .notice { padding: .12in; background: ${t.theme.soft}; font-size: 8.5pt; line-height: 1.4; }
    .check { display:inline-block; width:.14in; height:.14in; border:1px solid rgba(0,0,0,.46); margin-right:.08in; vertical-align:-.02in; }
    .tight p { margin:.05in 0; }
  </style></head><body><main class="page"><div class="band"></div>${body}<div class="footer">${esc(t.businessName)} · ${esc(t.email)} · ${esc(t.phone)}</div></main></body></html>`;
}

function serviceRows(t) {
  return t.services.length ? t.services.map((service) => `<tr><td><strong>${esc(service.name)}</strong>${service.duration ? `<br><small>${esc(service.duration)}</small>` : ''}</td><td>${esc(service.price)}</td></tr>`).join('') : '<tr><td>Service name</td><td>$0</td></tr>';
}

function logoSvgV2(t, variant, light = false) {
  const palette = light
    ? { ink: t.theme.paper, accent: t.theme.soft, paper: t.theme.ink }
    : t.theme;
  const layout = variant === 'primary' ? (t.logoLayout || 'badge') : variant;
  const horizontal = layout === 'horizontal';
  const iconOnly = layout === 'icon';
  const badge = layout === 'badge';
  const width = iconOnly ? 512 : 1400;
  const height = iconOnly ? 512 : (horizontal ? 460 : 780);
  const center = horizontal ? 165 : width / 2;
  const mark = marks[t.logoMark] || marks.paw;
  const titleX = horizontal ? 350 : width / 2;
  const titleY = horizontal ? 205 : 390;
  const titleAnchor = horizontal ? 'start' : 'middle';
  const fontSize = horizontal ? 84 : 98;
  const plates = {
    circle: '<circle cx="' + center + '" cy="142" r="108" fill="' + palette.soft + '"/><circle cx="' + center + '" cy="142" r="98" fill="none" stroke="' + palette.accent + '" stroke-width="6"/>',
    square: '<rect x="' + (center - 105) + '" y="37" width="210" height="210" rx="22" fill="' + palette.soft + '"/><rect x="' + (center - 96) + '" y="46" width="192" height="192" rx="15" fill="none" stroke="' + palette.accent + '" stroke-width="6"/>',
    stripe: '<path d="M' + (center - 120) + ' 50h240v184h-240z" fill="' + palette.soft + '"/><path d="M' + (center - 120) + ' 73h240M' + (center - 120) + ' 211h240" stroke="' + palette.accent + '" stroke-width="7"/>',
    arch: '<path d="M' + (center - 105) + ' 248V132a105 105 0 0 1 210 0v116z" fill="' + palette.soft + '"/><path d="M' + (center - 96) + ' 248V132a96 96 0 0 1 192 0v116" fill="none" stroke="' + palette.accent + '" stroke-width="6"/>',
    peak: '<path d="M' + (center - 116) + ' 247  ' + center + ' 36 ' + (center + 116) + ' 247z" fill="' + palette.soft + '"/><path d="M' + (center - 104) + ' 239 ' + center + ' 55 ' + (center + 104) + ' 239z" fill="none" stroke="' + palette.accent + '" stroke-width="6"/>',
    frame: '<rect x="' + (center - 111) + '" y="31" width="222" height="222" fill="' + palette.soft + '"/><rect x="' + (center - 98) + '" y="44" width="196" height="196" fill="none" stroke="' + palette.accent + '" stroke-width="10"/>'
  };
  const badgePlate = badge ? plates[t.theme.shape] : '';
  const markScale = iconOnly ? 1.75 : (horizontal ? .84 : 1.04);
  const markX = iconOnly ? 72 : center - 105 * markScale;
  const markY = iconOnly ? 72 : (horizontal ? 80 : 58);
  const background = iconOnly ? 'transparent' : palette.paper;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
    background === 'transparent' ? '' : '<rect width="100%" height="100%" fill="' + background + '"/>',
    badgePlate,
    '<g transform="translate(' + markX + ' ' + markY + ') scale(' + markScale + ')" fill="' + palette.accent + '" stroke="' + palette.accent + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">',
    mark.svg,
    '</g>',
    iconOnly ? '' : '<text x="' + titleX + '" y="' + titleY + '" text-anchor="' + titleAnchor + '" fill="' + palette.ink + '" font-family="' + t.theme.display + '" font-size="' + fontSize + '" font-weight="700" letter-spacing="-3">' + esc(t.businessName) + '</text>',
    iconOnly ? '' : '<text x="' + titleX + '" y="' + (titleY + 58) + '" text-anchor="' + titleAnchor + '" fill="' + palette.accent + '" font-family="' + t.theme.body + '" font-size="22" font-weight="700" letter-spacing="5">' + esc(t.tagline).toUpperCase() + '</text>',
    '</svg>'
  ];
  return svg.join('');
}

async function writeLogoPack(folder, t) {
  const root = safeFolderName(t.businessName);
  const variants = [
    ['primary', 'primary', false, 1400],
    ['primary-light', 'primary', true, 1400],
    ['horizontal', 'horizontal', false, 1400],
    ['badge', 'badge', false, 1200],
    ['icon', 'icon', false, 512]
  ];
  for (const [name, layout, light, width] of variants) {
    const svg = logoSvgV2(t, layout, light);
    const base = path.join(folder, root + '-' + name);
    await fs.writeFile(base + '.svg', svg, 'utf8');
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: light ? t.theme.ink : undefined }).render().asPng();
    await fs.writeFile(base + '.png', png);
  }
}

function logoSvg(t, variant) {
  const title = esc(t.businessName);
  const mark = variant === 'badge'
    ? `<circle cx="92" cy="92" r="70" fill="${t.theme.accent}"/><path d="M75 110c-18-12-24-40-7-52 11-7 23 5 24 15 2-10 14-22 25-15 17 12 11 40-7 52l-18 13z" fill="${t.theme.paper}"/>`
    : `<path d="M36 82c0-28 42-44 56-10 14-34 56-18 56 10 0 31-56 65-56 65S36 113 36 82z" fill="${t.theme.accent}"/><circle cx="92" cy="83" r="8" fill="${t.theme.paper}"/>`;
  const isHorizontal = variant === 'horizontal';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${isHorizontal ? 360 : 720}" viewBox="0 0 1200 ${isHorizontal ? 360 : 720}">
    <rect width="100%" height="100%" fill="${t.theme.paper}"/>
    <g transform="translate(${isHorizontal ? 45 : 500} ${isHorizontal ? 78 : 45})">${mark}</g>
    <text x="${isHorizontal ? 230 : 600}" y="${isHorizontal ? 155 : 285}" text-anchor="${isHorizontal ? 'start' : 'middle'}" fill="${t.theme.ink}" font-family="Georgia, serif" font-size="${isHorizontal ? 75 : 84}" font-weight="700">${title}</text>
    <text x="${isHorizontal ? 235 : 600}" y="${isHorizontal ? 215 : 350}" text-anchor="${isHorizontal ? 'start' : 'middle'}" fill="${t.theme.accent}" font-family="Arial, sans-serif" font-size="22" letter-spacing="6">${esc(t.tagline).toUpperCase()}</text>
  </svg>`;
}

function websiteV2(t, qrData) {
  const serviceCards = t.services.map((service, index) => '<article class="service-card"><span>0' + (index + 1) + '</span><h3>' + esc(service.name) + '</h3><p>' + esc(service.duration || 'A dependable visit built around your dog.') + '</p><strong>' + esc(service.price) + '</strong></article>').join('');
  const mark = marks[t.logoMark] || marks.paw;
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Dog walking and pet care in ' + esc(t.area) + '"><title>' + esc(t.businessName) + '</title><style>',
    ':root{--ink:' + t.theme.ink + ';--paper:' + t.theme.paper + ';--accent:' + t.theme.accent + ';--leaf:' + t.theme.leaf + ';--soft:' + t.theme.soft + ';--display:' + t.theme.display + ';--body:' + t.theme.body + ';}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--body)}a{color:inherit}.wrap{width:min(1160px,calc(100% - 42px));margin:auto}.topline{background:var(--ink);color:var(--paper);font-size:12px}.topline .wrap{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:18px}.dot{display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;background:var(--accent)}nav{min-height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:grid;line-height:1}.brand strong{font:700 24px var(--display);letter-spacing:-1px}.brand small{margin-top:7px;color:var(--accent);font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase}nav a{text-decoration:none;font-size:13px;font-weight:800}.nav-link{border-bottom:2px solid var(--accent);padding-bottom:3px}.hero{position:relative;min-height:575px;overflow:hidden;padding:84px 0 94px;background:var(--soft)}.hero:before{content:"";position:absolute;width:680px;height:680px;right:-130px;top:-250px;border:2px solid var(--accent);border-radius:50%;opacity:.72}.hero:after{content:"";position:absolute;width:460px;height:460px;right:3%;top:120px;border:64px solid color-mix(in srgb,var(--paper) 72%,transparent);border-radius:50%}.hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.15fr .85fr;gap:54px;align-items:center}.kicker{color:var(--accent);font-size:11px;font-weight:900;letter-spacing:2.4px;text-transform:uppercase}.hero h1{max-width:780px;margin:17px 0 20px;font:700 clamp(54px,7.2vw,94px)/.91 var(--display);letter-spacing:-.065em}.hero-copy{max-width:560px;margin:0;font-size:19px}.button{display:inline-flex;align-items:center;gap:9px;margin-top:29px;padding:14px 19px;background:var(--ink);color:var(--paper);text-decoration:none;font-size:13px;font-weight:800;box-shadow:7px 7px 0 var(--accent)}.seal{position:relative;z-index:2;justify-self:end;width:min(340px,100%);aspect-ratio:1;background:var(--paper);border:2px solid var(--ink);border-radius:50%;display:grid;place-items:center;transform:rotate(5deg);box-shadow:14px 15px 0 var(--accent)}.seal svg{width:135px;height:135px;fill:var(--accent);stroke:var(--accent);stroke-width:8}.seal p{position:absolute;bottom:48px;margin:0;color:var(--ink);font:700 17px/1 var(--display);text-align:center}.trust{background:var(--ink);color:var(--paper)}.trust .wrap{display:grid;grid-template-columns:repeat(3,1fr)}.trust-item{padding:24px 28px;border-left:1px solid rgba(255,255,255,.16);font-size:13px;font-weight:700}.trust-item:first-child{border-left:0}.section{padding:104px 0}.section-head{display:grid;grid-template-columns:.7fr 1.3fr;gap:42px;align-items:end;margin-bottom:38px}.section h2{margin:0;font:700 clamp(38px,5vw,62px)/.94 var(--display);letter-spacing:-.055em}.section-head p{max-width:470px;margin:0;font-size:17px}.service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.service-card{min-height:260px;padding:24px;background:var(--paper);border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);display:flex;flex-direction:column}.service-card:nth-child(2){background:var(--ink);color:var(--paper);transform:translateY(22px)}.service-card span{color:var(--accent);font-size:11px;font-weight:900;letter-spacing:2px}.service-card h3{margin:32px 0 8px;font:700 27px/1 var(--display);letter-spacing:-.04em}.service-card p{margin:0;font-size:14px}.service-card strong{margin-top:auto;padding-top:18px;color:var(--accent);font-size:18px}.process{background:var(--ink);color:var(--paper)}.process .kicker{color:var(--accent)}.process-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:46px}.step{padding:26px 30px 30px;border-left:1px solid rgba(255,255,255,.2)}.step:first-child{border-left:0}.step b{display:block;color:var(--accent);font:700 48px/1 var(--display)}.step h3{margin:19px 0 8px;font:700 24px/1 var(--display)}.step p{margin:0;color:rgba(255,255,255,.74);font-size:14px}.about{display:grid;grid-template-columns:.9fr 1.1fr;gap:60px;align-items:center}.about-card{min-height:360px;padding:42px;position:relative;overflow:hidden;background:var(--leaf);color:var(--ink)}.about-card:before{content:"";position:absolute;width:320px;height:320px;right:-70px;bottom:-120px;border:2px solid var(--ink);border-radius:50%;opacity:.35}.about-card .quote{position:relative;max-width:330px;margin:0;font:700 34px/1 var(--display);letter-spacing:-.05em}.about-card small{position:absolute;bottom:37px;left:42px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase}.about-copy p{max-width:520px;font-size:17px}.cta{padding:74px 0;background:var(--accent);color:var(--ink)}.cta .wrap{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center}.cta h2{max-width:700px;margin:9px 0 0;font:700 clamp(38px,5vw,68px)/.92 var(--display);letter-spacing:-.06em}.contact-card{min-width:245px;padding:18px;background:var(--paper);display:flex;align-items:center;gap:13px}.contact-card img{width:78px;height:78px;background:#fff;padding:5px}.contact-card strong{display:block;font-size:13px}.contact-card span{display:block;margin-top:3px;font-size:12px}footer{padding:32px 0;background:var(--paper);font-size:12px}.footer-grid{display:flex;justify-content:space-between;gap:20px}.footer-grid strong{font-family:var(--display);font-size:17px}@media(max-width:760px){.topline .wrap,nav,.footer-grid{align-items:flex-start;flex-direction:column;padding:14px 0}.topline .wrap{min-height:0}.hero{padding:64px 0}.hero-grid,.section-head,.about,.cta .wrap{grid-template-columns:1fr}.seal{justify-self:start;margin-top:26px;width:220px}.trust .wrap,.service-grid,.process-grid{grid-template-columns:1fr}.trust-item,.step{border-left:0;border-top:1px solid rgba(255,255,255,.16)}.trust-item:first-child,.step:first-child{border-top:0}.service-card:nth-child(2){transform:none}.section{padding:72px 0}.about{gap:28px}.cta{padding:56px 0}}',
    '</style></head><body><div class="topline"><div class="wrap"><span><i class="dot"></i>' + esc(t.theme.label) + '</span><span>' + esc(t.area) + '</span></div></div><nav class="wrap"><div class="brand"><strong>' + esc(t.businessName) + '</strong><small>' + esc(t.tagline) + '</small></div><a class="nav-link" href="#contact">Get in touch</a></nav><main><section class="hero"><div class="wrap hero-grid"><div><div class="kicker">Dog walking in ' + esc(t.area) + '</div><h1>' + esc(t.tagline) + '</h1><p class="hero-copy">Reliable walks, clear updates, and care that fits your dog’s routine. Book a simple meet-and-greet to get started.</p><a class="button" href="' + esc(t.qrUrl) + '">Book a meet-and-greet <span>→</span></a></div><div class="seal"><svg viewBox="0 0 210 210" aria-hidden="true">' + mark.svg + '</svg><p>Serving<br>' + esc(t.area) + '</p></div></div></section><section class="trust"><div class="wrap"><div class="trust-item">Thoughtful, one-on-one care</div><div class="trust-item">Clear communication every visit</div><div class="trust-item">Built around your dog’s routine</div></div></section><section class="section"><div class="wrap"><div class="section-head"><div><div class="kicker">Services & pricing</div><h2>Walks that work around real life.</h2></div><p>Choose the service that fits your routine. Every visit starts with a clear plan, dependable care, and a simple way to stay in touch.</p></div><div class="service-grid">' + serviceCards + '</div></div></section><section class="section process"><div class="wrap"><div class="kicker">How it works</div><h2>Simple from the first hello.</h2><div class="process-grid"><article class="step"><b>01</b><h3>Meet</h3><p>Tell us about your dog, your routine, and the kind of support you need.</p></article><article class="step"><b>02</b><h3>Walk</h3><p>We follow the plan, care for the details, and treat your dog like an individual.</p></article><article class="step"><b>03</b><h3>Update</h3><p>Stay in the loop with clear communication after every visit.</p></article></div></div></section><section class="section"><div class="wrap about"><div class="about-card"><p class="quote">“The best walks feel easy for you—and great for your dog.”</p><small>' + esc(t.businessName) + '</small></div><div class="about-copy"><div class="kicker">Local care, made personal</div><h2>Built for happy dogs and calmer days.</h2><p>We keep things simple: dependable service, thoughtful communication, and care tailored to the dog in front of us.</p><p>Questions about availability or the right service? Reach out and let’s find a routine that feels good.</p></div></div></section><section class="cta" id="contact"><div class="wrap"><div><div class="kicker">Ready when you are</div><h2>Let’s make your dog’s day a little better.</h2></div><div class="contact-card"><img src="' + qrData + '" alt="QR code to contact ' + esc(t.businessName) + '"><div><strong>' + esc(t.phone) + '</strong><span>' + esc(t.email) + '</span><span>' + esc(t.area) + '</span></div></div></div></section></main><footer><div class="wrap footer-grid"><strong>' + esc(t.businessName) + '</strong><span>' + esc(t.website) + ' · ' + esc(t.area) + '</span></div></footer></body></html>'
  ].join('');
}

function website(t, qrData) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.businessName)}</title><style>
  :root { --ink:${t.theme.ink}; --paper:${t.theme.paper}; --accent:${t.theme.accent}; --soft:${t.theme.soft}; } *{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 Arial,sans-serif} .wrap{max-width:1100px;margin:auto;padding:0 30px} nav{display:flex;justify-content:space-between;padding:26px 0;font-size:14px;font-weight:bold}.brand{font:700 22px Georgia,serif} .hero{padding:105px 0 80px;display:grid;grid-template-columns:1.2fr .8fr;gap:60px;align-items:end}.kicker{letter-spacing:.18em;text-transform:uppercase;font-size:12px;color:var(--accent);font-weight:bold}h1{font:700 clamp(48px,7vw,88px)/.96 Georgia,serif;letter-spacing:-.055em;margin:14px 0 24px}.lede{max-width:560px;font-size:19px}.button{display:inline-block;margin-top:18px;background:var(--ink);color:var(--paper);padding:14px 20px;text-decoration:none;font-weight:bold}.stamp{border:2px solid var(--accent);border-radius:50%;aspect-ratio:1;display:grid;place-content:center;text-align:center;padding:25px;transform:rotate(7deg);font:700 28px/1.1 Georgia,serif}.section{padding:76px 0;border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}h2{font:700 38px/1 Georgia,serif;letter-spacing:-.04em}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.service{padding:22px;background:var(--soft)}.service strong{font:700 20px Georgia,serif}.price{display:block;margin-top:14px;font-weight:bold;color:var(--accent)}.contact{display:grid;grid-template-columns:1fr auto;gap:32px;align-items:center}.qr{width:110px;background:white;padding:8px}@media(max-width:700px){.hero,.contact{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.stamp{max-width:250px}}
  </style></head><body><div class="wrap"><nav><div class="brand">${esc(t.businessName)}</div><div>${esc(t.area)}</div></nav><section class="hero"><div><div class="kicker">Local service, thoughtfully done</div><h1>${esc(t.tagline)}</h1><p class="lede">Dependable service for the people and places that matter to you. Clear communication, simple booking, and work you can feel good about.</p><a class="button" href="${esc(t.qrUrl)}">Get in touch</a></div><div class="stamp">Serving<br>${esc(t.area)}</div></section><section class="section"><div class="kicker">Services & pricing</div><h2>Made for your everyday.</h2><div class="grid">${t.services.map((service) => `<div class="service"><strong>${esc(service.name)}</strong><p>${esc(service.duration || 'Service details available on request')}</p><span class="price">${esc(service.price)}</span></div>`).join('')}</div></section><section class="section contact"><div><div class="kicker">Let’s work together</div><h2>Ready when you are.</h2><p>${esc(t.phone)}<br>${esc(t.email)}<br>${esc(t.area)}</p></div><img class="qr" src="${qrData}" alt="Contact QR code"></section></div></body></html>`;
}

function intakeDocument(t) {
  return documentShell('Client Intake Form', `<div class="eyebrow">New client information</div><h1>Let’s get acquainted.</h1><div class="two"><div><h3>Client name</h3><div class="field"></div><h3>Phone</h3><div class="field"></div><h3>Email</h3><div class="field"></div></div><div><h3>Service address</h3><div class="field"></div><h3>Preferred service</h3><div class="field"></div><h3>Preferred schedule</h3><div class="field"></div></div></div><div class="rule"></div><h2>Service notes</h2><p>Please share any access instructions, preferences, or information that will help us provide great service.</p><div class="card" style="min-height:2.2in"></div><div class="two"><div><h3>Emergency contact</h3><div class="field"></div></div><div><h3>Preferred contact method</h3><div class="field"></div></div></div>`, t);
}

function agreementDocument(t) {
  return documentShell('Service Agreement', `<div class="eyebrow">Customer service agreement</div><h1>Clear terms. Better service.</h1><p>This agreement is between <strong>${esc(t.businessName)}</strong> (“Service Provider”) and the client signing below (“Client”).</p><h2>Services</h2><p>The Service Provider will provide the services selected by the Client at the agreed schedule and price. Any changes should be confirmed in writing before service begins.</p><h2>Payment & cancellations</h2><p>Payment is due according to the invoice terms. Clients should provide notice for cancellations or rescheduling in accordance with the Service Provider’s stated policy.</p><h2>Client responsibilities</h2><p>The Client will provide accurate information, safe access to the service location, and timely notice of any relevant changes or concerns.</p><div class="notice"><strong>Important template notice:</strong> This is a starting template, not legal advice. It must be reviewed and customized for the Client’s location, services, insurance, and legal requirements before use.</div><div class="two"><div><h3>Client signature</h3><div class="field"></div><h3>Date</h3><div class="field"></div></div><div><h3>${esc(t.businessName)} representative</h3><div class="field"></div><h3>Date</h3><div class="field"></div></div></div>`, t);
}

function checklistDocument(t) {
  const steps = ['Choose your final service menu and pricing', 'Review your service agreement with a qualified local professional', 'Set up your booking and payment process', 'Publish your one-page website', 'Print business cards and flyer', 'Share your launch offer locally', 'Create a simple client follow-up routine'];
  return documentShell('Launch Checklist', `<div class="eyebrow">A practical first-week guide</div><h1>Open the doors with confidence.</h1><p>Use this short list to turn your new brand kit into a real, ready-to-book business.</p><div class="rule"></div>${steps.map((step, index) => `<div style="display:grid;grid-template-columns:.34in 1fr;gap:.12in;margin:.13in 0"><div style="width:.25in;height:.25in;border:1px solid ${t.theme.ink};display:grid;place-items:center;font-size:8pt">${index + 1}</div><div><strong>${esc(step)}</strong><div class="field"></div></div></div>`).join('')}`, t);
}

function flyerDocument(t, qrData) {
  return documentShell('Flyer', `<div style="padding-top:.55in;text-align:center"><div class="eyebrow">${esc(t.area)}</div><h1 style="font-size:42pt">${esc(t.businessName)}</h1><p style="font:18pt Georgia,serif;margin:.16in auto;max-width:5.8in">${esc(t.tagline)}</p><div class="rule"></div><table class="services" style="max-width:5.2in;margin:.2in auto">${serviceRows(t)}</table><div class="card" style="margin:.28in auto;max-width:4.5in"><strong style="font-size:18pt">${esc(t.flyerOffer || 'Book your first service today')}</strong><p>Simple, dependable service in ${esc(t.area)}.</p></div><img src="${qrData}" style="width:1.15in;background:white;padding:.06in"><p><strong>${esc(t.phone)}</strong> · ${esc(t.email)}</p></div>`, t);
}

function line(label) {
  return '<h3>' + esc(label) + '</h3><div class="field"></div>';
}

function invoiceDocumentV2(t) {
  return documentShell('Invoice', [
    '<div class="eyebrow">Service invoice</div><h1>' + esc(t.businessName) + '</h1><p>' + esc(t.tagline) + '</p><div class="rule"></div>',
    '<div class="two"><div>' + line('Bill to') + line('Service address') + '</div><div>' + line('Invoice number') + line('Invoice date') + line('Due date') + '</div></div>',
    '<table class="services"><tr><td><strong>Service / date</strong></td><td><strong>Amount</strong></td></tr><tr><td style="height:.48in"></td><td></td></tr><tr><td style="height:.48in"></td><td></td></tr><tr><td style="height:.48in"></td><td></td></tr><tr><td><strong>Subtotal</strong></td><td></td></tr><tr><td><strong>Discount / tax</strong></td><td></td></tr><tr><td><strong>Total due</strong></td><td><strong></strong></td></tr></table>',
    '<div class="notice"><strong>Payment details</strong><br>Payment method: ____________________________ &nbsp;&nbsp; Notes: ______________________________________________</div><p style="margin-top:.22in">Thank you for choosing ' + esc(t.businessName) + '.</p>'
  ].join(''), t);
}

function agreementDocumentV2(t) {
  return documentShell('Service Agreement', [
    '<div class="eyebrow">Dog walking service agreement</div><h1>Simple terms. Steady care.</h1><p>This agreement is between <strong>' + esc(t.businessName) + '</strong> ("Service Provider") and the client signing below ("Client"). It covers the dog-walking services selected by the Client.</p>',
    '<div class="two tight"><div><h2>1. Services & schedule</h2><p>The Client and Service Provider will agree on the service, walking schedule, access instructions, and price before service begins. Changes should be confirmed in writing.</p><h2>2. Payment</h2><p>Invoices are due by the date shown. The Client is responsible for providing accurate billing information and prompt payment for completed services.</p><h2>3. Cancellations</h2><p>Please give the Service Provider as much notice as possible when cancelling or changing a visit. Any cancellation policy selected by the Client and Service Provider applies to the booking.</p></div><div><h2>4. Access & safety</h2><p>The Client will provide safe access to the home, correct key/code information, and notice of hazards, behavior concerns, or changes that may affect a visit.</p><h2>5. Dog information</h2><p>The Client will share accurate health, medication, veterinary, behavior, and handling information. The Service Provider may pause or adjust a visit when conditions are unsafe.</p><h2>6. Communication</h2><p>The Service Provider will use the Client’s preferred contact details for updates or questions connected to a scheduled visit.</p></div></div>',
    '<div class="notice"><strong>Before signing:</strong> confirm the service, schedule, payment method, cancellation expectations, emergency contact, and access instructions for this client.</div>',
    '<div class="two"><div>' + line('Client name and signature') + line('Date') + '</div><div>' + line(t.businessName + ' representative') + line('Date') + '</div></div>'
  ].join(''), t);
}

function intakeDocumentV2(t) {
  return documentShell('Client Intake Form', [
    '<div class="eyebrow">New client & dog profile</div><h1>Tell us what makes your dog feel at home.</h1>',
    '<div class="two"><div>' + line('Client name') + line('Phone') + line('Email') + line('Home address') + '</div><div>' + line('Dog name / breed / age') + line('Veterinary clinic and phone') + line('Emergency contact') + line('Preferred service and schedule') + '</div></div>',
    '<div class="rule"></div><div class="two"><div><h2>Care & behavior</h2>' + line('Leash / harness instructions') + line('Triggers, fears, or handling notes') + line('Medication or health notes') + '</div><div><h2>Home & visit details</h2>' + line('Access / key / entry instructions') + line('Feeding, water, or treat notes') + line('Preferred update method') + '</div></div>',
    '<div class="notice"><strong>Quick check</strong><br><span class="check"></span>Vaccinations current &nbsp;&nbsp; <span class="check"></span>Emergency contact confirmed &nbsp;&nbsp; <span class="check"></span>Access instructions provided</div>'
  ].join(''), t);
}

function priceSheetDocumentV2(t, qrData) {
  return documentShell('Price Sheet', [
    '<div style="display:grid;grid-template-columns:1fr auto;gap:.28in;align-items:start"><div><div class="eyebrow">Dog walking in ' + esc(t.area) + '</div><h1>Care that fits the day.</h1><p>' + esc(t.tagline) + '</p></div><img src="' + qrData + '" style="width:1.02in;background:#fff;padding:.06in"></div>',
    '<table class="services">' + serviceRows(t) + '</table>',
    '<div class="two"><div class="card"><h3>Included in every visit</h3><p>Thoughtful care, clear communication, and service tailored to your dog’s routine.</p></div><div class="card"><h3>Ready to book?</h3><p><strong>' + esc(t.phone) + '</strong><br>' + esc(t.email) + '<br>' + esc(t.area) + '</p></div></div>',
    '<div class="notice" style="margin-top:.2in">Availability, travel area, and service details are confirmed before booking.</div>'
  ].join(''), t);
}

function businessCardDocumentV2(t, qrData) {
  const theme = t.theme;
  return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:3.5in 2in;margin:0}*{box-sizing:border-box}body{margin:0;font-family:' + theme.body + ';color:' + theme.ink + '}.card{width:3.5in;height:2in;position:relative;overflow:hidden;padding:.23in;background:' + theme.paper + ';page-break-after:always}.card:last-child{page-break-after:auto}.front:after{content:"";position:absolute;width:1.7in;height:1.7in;right:-.55in;bottom:-.72in;border:.14in solid ' + theme.soft + ';border-radius:50%}.eyebrow{position:relative;z-index:1;color:' + theme.accent + ';font-size:7pt;font-weight:bold;letter-spacing:.13em;text-transform:uppercase}.front h1{position:relative;z-index:1;margin:.08in 0;font:700 22pt/1 ' + theme.display + ';letter-spacing:-.06em}.front p{position:relative;z-index:1;margin:0;max-width:2.35in;font-size:8.2pt;line-height:1.35}.back{display:grid;grid-template-columns:1fr .76in;gap:.11in;align-items:end;background:' + theme.ink + ';color:' + theme.paper + '}.back strong{font:700 12pt/1 ' + theme.display + '}.back p{margin:.09in 0 0;font-size:7.4pt;line-height:1.45}.back img{width:.72in;background:#fff;padding:.035in}</style></head><body><section class="card front"><div class="eyebrow">' + esc(t.area) + '</div><h1>' + esc(t.businessName) + '</h1><p>' + esc(t.tagline) + '</p></section><section class="card back"><div><strong>' + esc(t.businessName) + '</strong><p>' + esc(t.phone) + '<br>' + esc(t.email) + '<br>' + esc(t.website) + '</p></div><img src="' + qrData + '" alt="QR code"></section></body></html>';
}

function flyerDocumentV2(t, qrData) {
  return documentShell('Flyer', [
    '<div style="padding-top:.38in;text-align:center"><div class="eyebrow">Dog walking · ' + esc(t.area) + '</div><h1 style="font-size:42pt">' + esc(t.businessName) + '</h1><p style="font:18pt ' + t.theme.display + ';margin:.16in auto;max-width:5.8in">' + esc(t.tagline) + '</p><div class="rule"></div>',
    '<table class="services" style="max-width:5.2in;margin:.24in auto">' + serviceRows(t) + '</table>',
    '<div class="card" style="margin:.28in auto;max-width:4.8in"><strong style="font-size:18pt">' + esc(t.flyerOffer || 'Book a meet-and-greet today') + '</strong><p>Thoughtful walks, dependable updates, and care built around your dog.</p></div>',
    '<img src="' + qrData + '" style="width:1.15in;background:#fff;padding:.06in"><p><strong>' + esc(t.phone) + '</strong> · ' + esc(t.email) + '</p></div>'
  ].join(''), t);
}

function checklistDocumentV2(t) {
  const steps = ['Confirm your services, prices, and travel area', 'Set up your booking and payment process', 'Complete a meet-and-greet and intake form for each new client', 'Use your service agreement before the first walk', 'Publish your one-page website and update the QR code', 'Print your business card and flyer', 'Create a simple after-walk update routine'];
  return documentShell('Launch Checklist', '<div class="eyebrow">First-week launch list</div><h1>Start small. Look established.</h1><p>Use this list to turn your new brand kit into a ready-to-book dog walking business.</p><div class="rule"></div>' + steps.map((step, index) => '<div style="display:grid;grid-template-columns:.33in 1fr;gap:.12in;margin:.14in 0"><div style="width:.25in;height:.25in;border:1px solid ' + t.theme.ink + ';display:grid;place-items:center;font-size:8pt">' + (index + 1) + '</div><div><strong>' + esc(step) + '</strong><div class="field"></div></div></div>').join(''), t);
}

async function zipFolder(folder, zipPath) {
  await new Promise((resolve, reject) => {
    const stream = require('node:fs').createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    stream.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(stream);
    archive.directory(folder, false);
    archive.finalize();
  });
}

async function generateStarterKit({ payload, outputRoot, renderPdf, createZip = true }) {
  const validation = validatePayload(payload);
  if (!validation.valid) {
    const error = new Error('Kit input is not valid.');
    error.validation = validation;
    throw error;
  }
  const t = tokens(payload);
  const rootName = `${safeFolderName(t.businessName)}-Starter-Kit`;
  const folder = path.join(outputRoot, rootName);
  const qrData = await QRCode.toDataURL(t.qrUrl, { margin: 1, width: 240, color: { dark: t.theme.ink, light: '#FFFFFF' } });
  await fs.rm(folder, { recursive: true, force: true });
  const folders = ['01-Website', '02-Logo-Pack', '03-Invoice', '04-Service-Agreement', '05-Client-Intake-Form', '06-Price-Sheet', '07-Business-Card', '08-Flyer', '09-Launch-Checklist'];
  await Promise.all(folders.map((part) => fs.mkdir(path.join(folder, part), { recursive: true })));

  await fs.writeFile(path.join(folder, '01-Website', 'index.html'), websiteV2(t, qrData));
  await fs.writeFile(path.join(folder, '02-Logo-Pack', `${safeFolderName(t.businessName)}-logo.svg`), logoSvg(t, t.logoLayout || 'badge'));
  await fs.writeFile(path.join(folder, '02-Logo-Pack', `${safeFolderName(t.businessName)}-logo-light.svg`), logoSvg({ ...t, theme: { ...t.theme, paper: t.theme.ink, ink: t.theme.paper } }, t.logoLayout || 'badge'));
  await fs.writeFile(path.join(folder, 'START-HERE.txt'), `Prepared for ${t.businessName} on ${niceDate()}\n\nThis folder contains your personalized business starter kit. Open 01-Website/index.html in a browser to view the website template. Review all business, service, and agreement information before use.\n`);
  await fs.writeFile(path.join(folder, 'LICENSE.txt'), 'Licensed to one business for internal use. Do not resell, share, redistribute, or sublicense these files or design components.');
  await writeLogoPack(path.join(folder, '02-Logo-Pack'), t);
  const legacyLogo = safeFolderName(t.businessName);
  await fs.rm(path.join(folder, '02-Logo-Pack', legacyLogo + '-logo.svg'), { force: true });
  await fs.rm(path.join(folder, '02-Logo-Pack', legacyLogo + '-logo-light.svg'), { force: true });

  const invoice = documentShell('Invoice', `<div class="eyebrow">Invoice</div><h1>${esc(t.businessName)}</h1><div class="two"><div><h3>Bill to</h3><div class="field"></div><h3>Invoice number</h3><div class="field"></div></div><div><h3>Invoice date</h3><div class="field"></div><h3>Due date</h3><div class="field"></div></div></div><table class="services"><tr><td><strong>Description</strong></td><td><strong>Amount</strong></td></tr><tr><td style="height:1.6in"></td><td></td></tr><tr><td><strong>Total due</strong></td><td><strong></strong></td></tr></table><p>Thank you for choosing ${esc(t.businessName)}.</p>`, t);
  const priceSheet = documentShell('Price Sheet', `<div class="eyebrow">Services & pricing</div><h1>Simple service. Clear pricing.</h1><p>${esc(t.tagline)}</p><table class="services">${serviceRows(t)}</table><div class="notice">Availability, service details, and pricing can vary by request. Contact us to confirm your booking.</div><h2>Ready to book?</h2><p><strong>${esc(t.phone)}</strong><br>${esc(t.email)}<br>${esc(t.area)}</p>`, t);
  const card = documentShell('Business Card', `<div style="display:grid;grid-template-columns:1.4fr .7fr;gap:.3in;padding-top:2.9in"><div><div class="eyebrow">${esc(t.area)}</div><h1 style="font-size:29pt">${esc(t.businessName)}</h1><p>${esc(t.tagline)}</p><p><strong>${esc(t.phone)}</strong><br>${esc(t.email)}<br>${esc(t.website)}</p></div><img src="${qrData}" style="width:1.1in;align-self:end;background:white;padding:.06in"></div>`, t);

  const tasks = [
    ['03-Invoice', 'invoice.pdf', invoiceDocumentV2(t), 'Letter'],
    ['04-Service-Agreement', 'service-agreement.pdf', agreementDocumentV2(t), 'Letter'],
    ['05-Client-Intake-Form', 'client-intake-form.pdf', intakeDocumentV2(t), 'Letter'],
    ['06-Price-Sheet', 'price-sheet.pdf', priceSheetDocumentV2(t, qrData), 'Letter'],
    ['07-Business-Card', 'business-card.pdf', businessCardDocumentV2(t, qrData), { width: 88900, height: 50800 }],
    ['08-Flyer', 'flyer.pdf', flyerDocumentV2(t, qrData), 'Letter'],
    ['09-Launch-Checklist', 'launch-checklist.pdf', checklistDocumentV2(t), 'Letter'],
    ['03-Invoice', 'invoice-a4.pdf', invoiceDocumentV2(t).replace('size: Letter', 'size: A4'), 'A4'],
    ['04-Service-Agreement', 'service-agreement-a4.pdf', agreementDocumentV2(t).replace('size: Letter', 'size: A4'), 'A4'],
    ['05-Client-Intake-Form', 'client-intake-form-a4.pdf', intakeDocumentV2(t).replace('size: Letter', 'size: A4'), 'A4'],
    ['06-Price-Sheet', 'price-sheet-a4.pdf', priceSheetDocumentV2(t, qrData).replace('size: Letter', 'size: A4'), 'A4'],
    ['08-Flyer', 'flyer-a4.pdf', flyerDocumentV2(t, qrData).replace('size: Letter', 'size: A4'), 'A4']
  ];
  for (const [directory, filename, html, pageSize] of tasks) await renderPdf(html, path.join(folder, directory, filename), pageSize);
  const zipPath = createZip ? path.join(outputRoot, `${rootName}.zip`) : null;
  if (zipPath) await zipFolder(folder, zipPath);
  return { folder, zipPath, documents: folders.length, businessName: t.businessName, validation };
}

async function inspectStarterKit(folder, businessName) {
  const expected = expectedKitFiles(businessName);
  const missing = [];
  const files = [];
  for (const relativeFile of expected) {
    const absoluteFile = path.join(folder, relativeFile);
    try {
      const info = await fs.stat(absoluteFile);
      files.push({ file: relativeFile, bytes: info.size });
    } catch { missing.push(relativeFile); }
  }
  return { valid: missing.length === 0, folder, expected: expected.length, files, missing };
}

module.exports = { generateStarterKit, inspectStarterKit, safeFolderName, themes, validatePayload, expectedKitFiles };
