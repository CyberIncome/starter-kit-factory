const fs = require('node:fs/promises');
const path = require('node:path');
const { generateStarterKit, inspectStarterKit, validatePayload, expectedKitFiles } = require('./starter-kit.cjs');
const { readOrders, saveOrder } = require('./orders.cjs');
const { createPdfRenderer } = require('./pdf-renderer.cjs');

const help = {
  usage: 'Starter Kit Factory.exe --cli <command> [options]',
  commands: {
    create: 'Generate a complete customer kit and ZIP. Requires --input <order.json>. Optional --output <folder>.',
    preview: 'Generate working files and PDFs without a delivery ZIP. Requires --input <order.json>. Optional --output <folder>.',
    validate: 'Validate a customer order without writing any files. Requires --input <order.json>.',
    inspect: 'Verify the required files in a generated kit. Requires --kit <folder>. Optional --business-name <name>.',
    'list-orders': 'Return locally saved order records.',
    backup: 'Copy local order records and generated kits. Requires --destination <folder>.',
    version: 'Return the installed application version.',
    help: 'Return this command reference.'
  },
  safety: ['All commands are local by default.', 'No command sends Etsy messages, emails, uploads files, or publishes websites.', 'Use validate before create when an automation agent is supplying input.']
};

function parseArgs(args) {
  const options = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) { options._.push(token); continue; }
    const [key, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) { options[key] = inlineValue; continue; }
    if (args[index + 1] && !args[index + 1].startsWith('--')) { options[key] = args[index + 1]; index += 1; }
    else options[key] = true;
  }
  return options;
}

async function readInput(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') throw new Error('Missing required option: --input <order.json>.');
  const raw = await fs.readFile(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(raw); }
  catch { throw new Error('Input file must contain valid JSON.'); }
}

function json(result, isError = false) {
  const write = isError ? console.error : console.log;
  write(JSON.stringify(result, null, 2));
}

function outputRoot(app, command, requested) {
  if (requested && typeof requested === 'string') return path.resolve(requested);
  const type = command === 'preview' ? 'Previews' : 'Generated Kits';
  return path.join(app.getPath('documents'), 'Starter Kit Factory', type);
}

function orderRecord(payload, result) {
  return {
    id: payload.orderNumber || `${Date.now()}`,
    businessName: payload.businessName,
    industry: payload.industry || 'dog-walking',
    theme: payload.theme,
    createdAt: new Date().toISOString(),
    outputFolder: result.folder,
    zipPath: result.zipPath,
    status: result.zipPath ? 'Ready to deliver' : 'Preview generated'
  };
}

async function runCli({ app, BrowserWindow, args }) {
  const parsed = parseArgs(args);
  const command = parsed._[0] || 'help';
  try {
    if (command === 'help' || parsed.help) { json({ status: 'ok', ...help }); return 0; }
    if (command === 'version') { json({ status: 'ok', version: app.getVersion(), platform: process.platform }); return 0; }
    if (command === 'list-orders') { json({ status: 'ok', orders: await readOrders(app.getPath('userData')) }); return 0; }
    if (command === 'validate') {
      const payload = await readInput(parsed.input);
      const validation = validatePayload(payload);
      json({ status: validation.valid ? 'ready' : 'invalid', validation, plannedFiles: validation.valid ? expectedKitFiles(payload.businessName) : [] });
      return validation.valid ? 0 : 2;
    }
    if (command === 'inspect') {
      if (!parsed.kit || typeof parsed.kit !== 'string') throw new Error('Missing required option: --kit <generated-kit-folder>.');
      const folder = path.resolve(parsed.kit);
      const businessName = parsed['business-name'] || path.basename(folder).replace(/-Starter-Kit$/i, '');
      const inspection = await inspectStarterKit(folder, businessName);
      json({ status: inspection.valid ? 'ready' : 'incomplete', inspection });
      return inspection.valid ? 0 : 3;
    }
    if (command === 'backup') {
      if (!parsed.destination || typeof parsed.destination !== 'string') throw new Error('Missing required option: --destination <folder>.');
      const source = path.join(app.getPath('documents'), 'Starter Kit Factory');
      const destination = path.join(path.resolve(parsed.destination), `Starter-Kit-Factory-Backup-${new Date().toISOString().slice(0, 10)}`);
      await fs.mkdir(source, { recursive: true });
      await fs.cp(source, destination, { recursive: true, errorOnExist: false });
      json({ status: 'ready', source, destination });
      return 0;
    }
    if (command === 'create' || command === 'preview') {
      const payload = await readInput(parsed.input);
      const validation = validatePayload(payload);
      if (parsed['dry-run']) { json({ status: validation.valid ? 'ready' : 'invalid', validation, dryRun: true }); return validation.valid ? 0 : 2; }
      if (!validation.valid) { json({ status: 'invalid', validation }, true); return 2; }
      const result = await generateStarterKit({
        payload,
        outputRoot: outputRoot(app, command, parsed.output),
        renderPdf: createPdfRenderer(BrowserWindow),
        createZip: command === 'create'
      });
      if (command === 'create') await saveOrder(app.getPath('userData'), orderRecord(payload, result));
      const inspection = await inspectStarterKit(result.folder, payload.businessName);
      json({ status: inspection.valid ? 'ready' : 'incomplete', command, result, inspection });
      return inspection.valid ? 0 : 3;
    }
    json({ status: 'invalid-command', command, ...help }, true);
    return 64;
  } catch (error) {
    json({ status: 'error', message: error.message, validation: error.validation || null }, true);
    return 1;
  }
}

module.exports = { runCli, parseArgs, help };
