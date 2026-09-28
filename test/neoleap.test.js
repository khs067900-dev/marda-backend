const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Synthetic credentials only; these tests never load .env or contact the gateway.
Object.assign(process.env, {
  NEOLEAP_TERMINAL_ID: 'test', NEOLEAP_MERCHANT_ID: 'test', NEOLEAP_TRANPORTAL_ID: 'test-id',
  NEOLEAP_TRANPORTAL_PASSWORD: 'test-password', NEOLEAP_RESOURCE_KEY: '0123456789abcdef0123456789abcdef',
  NEOLEAP_HOSTED_URL: 'https://gateway.example/pg/payment/hosted.htm',
  NEOLEAP_TRANPORTAL_URL: 'https://gateway.example/pg/payment/tranportal.htm',
});
const service = require('../src/utils/neoleapService');
const { neoleapConfig: config } = require('../src/config/neoleap.config');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

const details = { trackId: '1750000000000123456', amount: 12.5,
  responseUrl: 'https://shop.example/api/orders/neoleap/return', errorUrl: 'https://shop.example/api/orders/neoleap/return' };
const paymentId = '100201935166676976';
const gatewayData = { paymentId, trackId: details.trackId, amt: '12.50', result: 'CAPTURED',
  transId: '201935166561122', actionCode: '1', authRespCode: '00' };
const payment = { merchantReference: details.trackId, amount: 12.5, neoleapPaymentId: paymentId };

test('encryption matches documented full key, IV, URL encoding and a single padding pass', () => {
  const text = JSON.stringify([{ note: 'طلب + 50% & test', amt: '12.50' }]);
  const encrypted = service.encrypt(text);
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(config.resourceKey), Buffer.from('PGKEYENCDECIVSPC'));
  const plain = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString();
  const expected = encodeURIComponent(text).replace(/%20/g, '+').replace(/[!'()~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  assert.equal(plain, expected);
  assert.equal(service.decrypt(encrypted), text);
  assert.match(encrypted, /^[0-9A-F]+$/);
});

test('hosted request uses documented JSON array and frames gateway payment page URL', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, config.hostedUrl);
    assert.equal(options.headers['Content-Type'], 'application/json');
    const [body] = JSON.parse(options.body);
    assert.equal(body.id, 'test-id');
    assert.equal(body.responseURL, details.responseUrl);
    const [plain] = JSON.parse(service.decrypt(body.trandata));
    assert.equal(plain.password, 'test-password');
    assert.equal(plain.action, '1');
    assert.equal(plain.amt, '12.50');
    assert.equal(plain.currencyCode, '682');
    assert.equal(plain.trackId, details.trackId);
    assert.equal(plain.responseURL, details.responseUrl);
    return new Response(JSON.stringify([{ status: '1', result: paymentId + ':https://gateway.example/pg/paymentpage.htm' }]));
  };
  const result = await service.createPaymentSession(details);
  assert.equal(result.paymentId, paymentId);
  assert.equal(result.redirectUrl, 'https://gateway.example/pg/paymentpage.htm?PaymentID=' + paymentId);
});

test('rejects gateway validation errors without leaking response text', async () => {
  global.fetch = async () => new Response(JSON.stringify([{ status: '2', error: 'IPAY0100124', errorText: 'secret-password' }]));
  await assert.rejects(service.createPaymentSession(details), e => e.statusCode === 502 && e.message.includes('IPAY0100124') && !e.message.includes('secret-password'));
});

test('connection failures produce a useful 503 instead of generic 500', async () => {
  global.fetch = async () => { throw new TypeError('fetch failed', { cause: { code: 'ETIMEDOUT' } }); };
  await assert.rejects(service.createPaymentSession(details), e => e.statusCode === 503);
});

test('rejects unrelated gateway redirect origins and non-JSON responses', async () => {
  global.fetch = async () => new Response(JSON.stringify([{ status: '1', result: paymentId + ':https://attacker.example/' }]));
  await assert.rejects(service.createPaymentSession(details), e => e.statusCode === 502);
  global.fetch = async () => new Response('<html>error</html>');
  await assert.rejects(service.createPaymentSession(details), e => e.statusCode === 502);
});

test('decrypts documented camelCase fields and preserves unquoted large numeric IDs', () => {
  const raw = '[{"paymentId":100201935166676976,"trackId":1750000000000123456,"amt":"12.50","result":"CAPTURED","transId":"201935166561122","authCode":"000000"}]';
  const parsed = service.parsePaymentResponse([{ trandata: service.encrypt(raw) }]);
  assert.equal(parsed.paymentId, paymentId);
  assert.equal(parsed.trackId, details.trackId);
  assert.equal(parsed.auth, '000000');
  assert.equal(service.matchesPayment(parsed, payment), true);
});

test('rejects plaintext success, malformed ciphertext and missing/mismatched amount or IDs', () => {
  assert.throws(() => service.parsePaymentResponse({ result: 'CAPTURED' }));
  assert.throws(() => service.parsePaymentResponse({ trandata: 'not-hex' }));
  for (const change of [{ amt: undefined }, { amt: 'NaN' }, { amt: '12.49' }, { paymentId: '123' }, { trackId: '123' }, { currencyCode: '840' }]) {
    const parsed = service.parsePaymentResponse({ trandata: service.encrypt(JSON.stringify([{ ...gatewayData, ...change }])) });
    assert.equal(service.matchesPayment(parsed, payment), false);
  }
  assert.equal(service.isPaymentSuccessful({ result: 'APPROVED' }), false);
  assert.equal(service.isPaymentSuccessful({ result: 'SUCCESS' }), false);
});

test('inquiry uses action 8 and PaymentID at the supporting endpoint', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, config.tranportalUrl);
    const [body] = JSON.parse(options.body);
    const [plain] = JSON.parse(service.decrypt(body.trandata));
    assert.equal(plain.action, '8');
    assert.equal(plain.udf5, 'PaymentID');
    assert.equal(plain.transId, paymentId);
    assert.equal(plain.amt, '12.50');
    return new Response(JSON.stringify([{ status: '1', trandata: service.encrypt(JSON.stringify([gatewayData])) }]));
  };
  const result = await service.queryTransaction(paymentId, details.trackId, 12.5);
  assert.equal(service.isPaymentSuccessful(result), true);
});

test('stored response excludes card numbers, ciphertext, credentials, expiry and nested sensitive fields', () => {
  const raw = { ...gatewayData, card: '4111111111111111', password: 'secret', trandata: 'ciphertext', expYear: '2030', extra: { cvv: '123' } };
  const result = service.sanitizeResponse(raw);
  assert.equal(result.card, undefined);
  assert.equal(result.password, undefined);
  assert.equal(result.extra, undefined);
  assert.equal(result.trandata, undefined);
  assert.deepEqual(service.extractSafeCardData({ rawData: raw }), {});
  assert.deepEqual(service.extractSafeCardData({ rawData: { card: '401200XXXXXX1112', cardType: 'Visa' } }), { maskedCard: '401200XXXXXX1112', cardBrand: 'Visa' });
});

test('merchant reference is numeric and unique across generated samples', () => {
  const ids = Array.from({ length: 100 }, () => service.generateMerchantReference());
  assert(ids.every(id => /^\d+$/.test(id)));
  assert.equal(new Set(ids).size, ids.length);
});
