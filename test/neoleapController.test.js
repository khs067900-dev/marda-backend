const { test } = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../src/models/Order');
const Payment = require('../src/models/NeoleapPayment');
const service = require('../src/utils/neoleapService');
const controller = require('../src/controllers/neoleapController');
const { neoleapConfig: config } = require('../src/config/neoleap.config');

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    let status = 200;
    const res = {
      status(code) { status = code; return this; },
      json(body) { resolve({ status, body }); },
      redirect(code, url) { resolve({ status: code, url }); },
    };
    handler(req, res, reject);
  });
}
const payment = { _id: 'p1', orderId: 'o1', merchantReference: '123', neoleapPaymentId: '456', amount: 20 };
const parsed = { trackId: '123', paymentId: '456', result: 'CAPTURED', tranId: '789', rawData: { amt: '20.00', actionCode: '1' } };

test('forged browser CAPTURED cannot confirm an order when inquiry is unavailable', async t => {
  t.mock.method(Order, 'findById', async () => ({ _id: 'o1', paymentStatus: 'pending' }));
  t.mock.method(Payment, 'findOne', () => ({ sort: async () => payment }));
  t.mock.method(service, 'queryTransaction', async () => { throw new Error('offline'); });
  const write = t.mock.method(Order, 'updateOne', async () => {});
  const result = await invoke(controller.verifyNeoleapPayment, { params: { id: 'o1' }, query: { result: 'CAPTURED', amt: '20.00', paymentId: '456' } });
  assert.equal(result.status, 202);
  assert.equal(result.body.pending, true);
  assert.equal(write.mock.callCount(), 0);
});

test('only a matching gateway inquiry confirms payment', async t => {
  t.mock.method(Order, 'findById', async () => ({ _id: 'o1', paymentStatus: 'pending' }));
  t.mock.method(Payment, 'findOne', () => ({ sort: async () => payment }));
  const inquiry = t.mock.method(service, 'queryTransaction', async () => parsed);
  const paymentWrite = t.mock.method(Payment, 'updateOne', async () => ({}));
  const orderWrite = t.mock.method(Order, 'updateOne', async () => ({}));
  const result = await invoke(controller.verifyNeoleapPayment, { params: { id: 'o1' }, query: {} });
  assert.equal(result.body.success, true);
  assert.deepEqual(inquiry.mock.calls[0].arguments, ['456', '123', 20]);
  assert.equal(paymentWrite.mock.calls[0].arguments[1].$set.status, 'paid');
  assert.equal(orderWrite.mock.calls[0].arguments[1].$set.paymentStatus, 'paid');
});

test('mismatched inquiry cannot write payment or order state', async t => {
  t.mock.method(Order, 'findById', async () => ({ _id: 'o1', paymentStatus: 'pending' }));
  t.mock.method(Payment, 'findOne', () => ({ sort: async () => payment }));
  t.mock.method(service, 'queryTransaction', async () => ({ ...parsed, paymentId: '999' }));
  const write = t.mock.method(Payment, 'updateOne', async () => ({}));
  await assert.rejects(invoke(controller.verifyNeoleapPayment, { params: { id: 'o1' }, query: {} }), e => e.statusCode === 400);
  assert.equal(write.mock.callCount(), 0);
});

test('encrypted notification receives documented acknowledgement and waits for inquiry', async t => {
  t.mock.method(service, 'parsePaymentResponse', () => parsed);
  t.mock.method(Payment, 'findOne', async () => payment);
  const write = t.mock.method(Payment, 'updateOne', async () => ({}));
  const orderWrite = t.mock.method(Order, 'updateOne', async () => ({}));
  const result = await invoke(controller.neoleapCallback, { method: 'POST', is: () => true, body: [{ trandata: 'encrypted' }] });
  assert.equal(result.body[0].status, '1');
  assert.equal(new URL(result.body[0].result).searchParams.get('verify'), 'neoleap');
  assert.equal(write.mock.calls[0].arguments[1].$set.status, 'processing');
  assert.equal(orderWrite.mock.callCount(), 0);
});

test('plaintext JSON notification is not acknowledged', async () => {
  await assert.rejects(invoke(controller.neoleapCallback, { method: 'POST', is: () => true, body: [{ paymentId: '456', result: 'CAPTURED' }] }), e => e.statusCode === 400);
});

test('valid browser return redirects to frontend without exposing ciphertext', async t => {
  t.mock.method(service, 'parsePaymentResponse', () => parsed);
  t.mock.method(Payment, 'findOne', async () => payment);
  t.mock.method(Payment, 'updateOne', async () => ({}));
  const result = await invoke(controller.neoleapCallback, { method: 'GET', query: { trandata: 'encrypted' } });
  assert.equal(result.status, 303);
  assert.equal(new URL(result.url).searchParams.get('id'), 'o1');
  assert.equal(new URL(result.url).searchParams.has('trandata'), false);
});

test('repeated session request reuses the existing redirect without contacting gateway', async t => {
  t.mock.method(config, 'isConfigured', () => true);
  t.mock.method(Order, 'findById', async () => ({ _id: 'o1', totalPrice: 20 }));
  t.mock.method(Payment, 'findOne', () => ({ sort: async () => ({ ...payment, redirectUrl: 'https://gateway.example/pay' }) }));
  const create = t.mock.method(service, 'createPaymentSession', async () => { throw new Error('should not be called'); });
  const result = await invoke(controller.createNeoleapSession, { params: { id: 'o1' } });
  assert.equal(result.body.data.redirectUrl, 'https://gateway.example/pay');
  assert.equal(create.mock.callCount(), 0);
});
