import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import starterKit from '../electron/starter-kit.cjs';

test('generates the complete dog-walking starter-kit folder and delivery ZIP', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'starter-kit-factory-'));
  const result = await starterKit.generateStarterKit({
    outputRoot,
    payload: {
      businessName: 'Happy Tails Dog Walking',
      ownerName: 'Jamie Smith',
      email: 'hello@example.test',
      phone: '(555) 555-0142',
      area: 'Austin, Texas',
      website: 'www.happytails.test',
      qrUrl: 'https://example.test',
      theme: 'neighborhood',
      logoLayout: 'badge',
      tagline: 'Every walk, handled with heart.',
      services: [{ name: '30-minute dog walk', duration: 'weekday walk', price: '$22' }]
    },
    renderPdf: async (html, filename) => writeFile(filename, html)
  });

  assert.equal(result.documents, 9);
  await access(join(result.folder, '01-Website', 'index.html'));
  await access(join(result.folder, '02-Logo-Pack', 'Happy-Tails-Dog-Walking-logo.svg'));
  await access(join(result.folder, '03-Invoice', 'invoice.pdf'));
  await access(join(result.folder, '09-Launch-Checklist', 'launch-checklist.pdf'));
  await access(result.zipPath);
  assert.match(await readFile(join(result.folder, '06-Price-Sheet', 'price-sheet.pdf'), 'utf8'), /30-minute dog walk/);
});
