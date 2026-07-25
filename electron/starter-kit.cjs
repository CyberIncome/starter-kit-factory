const fs = require('node:fs/promises');
const path = require('node:path');
const { ZipArchive } = require('archiver');
const QRCode = require('qrcode');

const themes = {
  neighborhood: { name: 'Friendly Neighborhood', ink: '#16352D', paper: '#FFF9EF', accent: '#E46D50', leaf: '#88A77D', soft: '#F9DFC7' },
  modern: { name: 'Clean Modern', ink: '#182B42', paper: '#F8F7F2', accent: '#4E8F87', leaf: '#B8D4C8', soft: '#E3ECE8' },
  service: { name: 'Bold Service Pro', ink: '#15202A', paper: '#F7F8F4', accent: '#F0B43C', leaf: '#2B7886', soft: '#D9EBE8' },
  local: { name: 'Warm Local', ink: '#3C2C28', paper: '#FFF8EE', accent: '#C9694D', leaf: '#7D9B88', soft: '#F0D8C1' }
};

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const safeFolderName = (value = 'Untitled') => String(value).trim().replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, '-').slice(0, 80) || 'Untitled';
const niceDate = () => new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());

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
    qrUrl: data.qrUrl || data.website || 'https://example.com'
  };
}

function documentShell(title, body, t, options = {}) {
  const size = options.size || 'Letter';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: ${size}; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: ${t.theme.ink}; background: ${t.theme.paper}; font: 10.5pt Arial, sans-serif; }
    .page { min-height: 11in; padding: .62in; position: relative; overflow: hidden; }
    .band { position: absolute; height: .16in; background: ${t.theme.accent}; left: 0; right: 0; top: 0; }
    .eyebrow { color: ${t.theme.accent}; font-size: 8pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    h1 { font: 700 28pt Georgia, serif; line-height: 1.05; margin: .12in 0 .10in; letter-spacing: -.04em; }
    h2 { font: 700 14pt Georgia, serif; margin: .25in 0 .08in; }
    h3 { font-size: 9pt; margin: .12in 0 .04in; text-transform: uppercase; letter-spacing: .08em; }
    p { line-height: 1.55; margin: .08in 0; }
    .rule { height: 1px; background: ${t.theme.ink}; opacity: .18; margin: .18in 0; }
    .pill { display: inline-block; padding: .05in .10in; margin: .02in .03in .02in 0; border-radius: 999px; background: ${t.theme.soft}; font-size: 8pt; }
    .card { border: 1px solid rgba(0,0,0,.12); padding: .15in; background: rgba(255,255,255,.38); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: .16in; }
    .services { width: 100%; border-collapse: collapse; margin: .10in 0; }
    .services td { padding: .09in 0; border-bottom: 1px solid rgba(0,0,0,.12); }
    .services td:last-child { text-align: right; font-weight: 700; }
    .field { min-height: .30in; border-bottom: 1px solid rgba(0,0,0,.27); margin: .05in 0 .12in; }
    .footer { position: absolute; left: .62in; right: .62in; bottom: .34in; font-size: 7.5pt; color: rgba(0,0,0,.55); }
    .notice { padding: .12in; background: ${t.theme.soft}; font-size: 8.5pt; line-height: 1.4; }
  </style></head><body><main class="page"><div class="band"></div>${body}<div class="footer">${esc(t.businessName)} · ${esc(t.email)} · ${esc(t.phone)}</div></main></body></html>`;
}

function serviceRows(t) {
  return t.services.length ? t.services.map((service) => `<tr><td><strong>${esc(service.name)}</strong>${service.duration ? `<br><small>${esc(service.duration)}</small>` : ''}</td><td>${esc(service.price)}</td></tr>`).join('') : '<tr><td>Service name</td><td>$0</td></tr>';
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

async function generateStarterKit({ payload, outputRoot, renderPdf }) {
  const t = tokens(payload);
  const rootName = `${safeFolderName(t.businessName)}-Starter-Kit`;
  const folder = path.join(outputRoot, rootName);
  const qrData = await QRCode.toDataURL(t.qrUrl, { margin: 1, width: 240, color: { dark: t.theme.ink, light: '#FFFFFF' } });
  await fs.rm(folder, { recursive: true, force: true });
  const folders = ['01-Website', '02-Logo-Pack', '03-Invoice', '04-Service-Agreement', '05-Client-Intake-Form', '06-Price-Sheet', '07-Business-Card', '08-Flyer', '09-Launch-Checklist'];
  await Promise.all(folders.map((part) => fs.mkdir(path.join(folder, part), { recursive: true })));

  await fs.writeFile(path.join(folder, '01-Website', 'index.html'), website(t, qrData));
  await fs.writeFile(path.join(folder, '02-Logo-Pack', `${safeFolderName(t.businessName)}-logo.svg`), logoSvg(t, t.logoLayout || 'badge'));
  await fs.writeFile(path.join(folder, '02-Logo-Pack', `${safeFolderName(t.businessName)}-logo-light.svg`), logoSvg({ ...t, theme: { ...t.theme, paper: t.theme.ink, ink: t.theme.paper } }, t.logoLayout || 'badge'));
  await fs.writeFile(path.join(folder, 'START-HERE.txt'), `Prepared for ${t.businessName} on ${niceDate()}\n\nThis folder contains your personalized business starter kit. Open 01-Website/index.html in a browser to view the website template. Review all business, service, and agreement information before use.\n`);
  await fs.writeFile(path.join(folder, 'LICENSE.txt'), 'Licensed to one business for internal use. Do not resell, share, redistribute, or sublicense these files or design components.');

  const invoice = documentShell('Invoice', `<div class="eyebrow">Invoice</div><h1>${esc(t.businessName)}</h1><div class="two"><div><h3>Bill to</h3><div class="field"></div><h3>Invoice number</h3><div class="field"></div></div><div><h3>Invoice date</h3><div class="field"></div><h3>Due date</h3><div class="field"></div></div></div><table class="services"><tr><td><strong>Description</strong></td><td><strong>Amount</strong></td></tr><tr><td style="height:1.6in"></td><td></td></tr><tr><td><strong>Total due</strong></td><td><strong></strong></td></tr></table><p>Thank you for choosing ${esc(t.businessName)}.</p>`, t);
  const priceSheet = documentShell('Price Sheet', `<div class="eyebrow">Services & pricing</div><h1>Simple service. Clear pricing.</h1><p>${esc(t.tagline)}</p><table class="services">${serviceRows(t)}</table><div class="notice">Availability, service details, and pricing can vary by request. Contact us to confirm your booking.</div><h2>Ready to book?</h2><p><strong>${esc(t.phone)}</strong><br>${esc(t.email)}<br>${esc(t.area)}</p>`, t);
  const card = documentShell('Business Card', `<div style="display:grid;grid-template-columns:1.4fr .7fr;gap:.3in;padding-top:2.9in"><div><div class="eyebrow">${esc(t.area)}</div><h1 style="font-size:29pt">${esc(t.businessName)}</h1><p>${esc(t.tagline)}</p><p><strong>${esc(t.phone)}</strong><br>${esc(t.email)}<br>${esc(t.website)}</p></div><img src="${qrData}" style="width:1.1in;align-self:end;background:white;padding:.06in"></div>`, t);

  const tasks = [
    ['03-Invoice', 'invoice.pdf', invoice],
    ['04-Service-Agreement', 'service-agreement.pdf', agreementDocument(t)],
    ['05-Client-Intake-Form', 'client-intake-form.pdf', intakeDocument(t)],
    ['06-Price-Sheet', 'price-sheet.pdf', priceSheet],
    ['07-Business-Card', 'business-card.pdf', card],
    ['08-Flyer', 'flyer.pdf', flyerDocument(t, qrData)],
    ['09-Launch-Checklist', 'launch-checklist.pdf', checklistDocument(t)]
  ];
  for (const [directory, filename, html] of tasks) await renderPdf(html, path.join(folder, directory, filename), 'Letter');
  const zipPath = path.join(outputRoot, `${rootName}.zip`);
  await zipFolder(folder, zipPath);
  return { folder, zipPath, documents: folders.length, businessName: t.businessName };
}

module.exports = { generateStarterKit, safeFolderName, themes };
