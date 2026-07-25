import assert from 'node:assert/strict';
import test from 'node:test';
import cli from '../electron/cli.cjs';
import starterKit from '../electron/starter-kit.cjs';

test('parses production CLI commands and options', () => {
  assert.deepEqual(cli.parseArgs(['create', '--input', 'order.json', '--output=C:\\kits', '--dry-run']), {
    _: ['create'], input: 'order.json', output: 'C:\\kits', 'dry-run': true
  });
});

test('validates a complete production order payload', () => {
  const result = starterKit.validatePayload({
    businessName: 'Happy Tails Dog Walking',
    phone: '(555) 555-0142',
    email: 'hello@example.test',
    area: 'Austin, Texas',
    theme: 'neighborhood',
    logoLayout: 'badge',
    qrUrl: 'https://example.test/book',
    services: [{ name: 'Dog walk', price: '$22' }]
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('rejects a payload that cannot produce a customer kit', () => {
  const result = starterKit.validatePayload({ businessName: '', services: [] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.field === 'businessName'));
  assert.ok(result.errors.some((issue) => issue.field === 'services'));
});
