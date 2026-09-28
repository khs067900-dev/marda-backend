const { test } = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const { createOrder } = require('../src/controllers/orderController');

function request(quantity) {
  return new Promise((resolve, reject) => {
    const res = { status(code) { this.code = code; return this; }, json(body) { resolve({ code: this.code, body }); } };
    createOrder({ body: { items: [{ productId: 'p1', quantity }] } }, res, reject);
  });
}

test('checkout updates stock without saving or revalidating a legacy product category', async t => {
  t.mock.method(Product, 'findById', async () => ({ _id: 'p1', name: 'Product', category: 'living_room', stock: 4, price: 10,
    save() { throw new Error('Whole-product validation must not run during checkout'); } }));
  const update = t.mock.method(Product, 'updateOne', async () => ({ modifiedCount: 1 }));
  t.mock.method(Order, 'create', async data => data);
  const result = await request(2);
  assert.equal(result.code, 201);
  assert.equal(result.body.data.totalPrice, 20);
  assert.deepEqual(update.mock.calls[0].arguments, [
    { _id: 'p1', stock: { $gte: 2 } }, { $inc: { stock: -2 } }, { runValidators: true },
  ]);
});

test('invalid quantities cannot modify inventory', async t => {
  const update = t.mock.method(Product, 'updateOne', async () => ({ modifiedCount: 1 }));
  for (const quantity of [0, -1, 1.5, '2']) {
    await assert.rejects(request(quantity), error => error.statusCode === 400);
  }
  assert.equal(update.mock.callCount(), 0);
});

test('concurrent stock depletion prevents order creation', async t => {
  t.mock.method(Product, 'findById', async () => ({ _id: 'p1', name: 'Product', stock: 4, price: 10 }));
  t.mock.method(Product, 'updateOne', async () => ({ modifiedCount: 0 }));
  const create = t.mock.method(Order, 'create', async () => ({}));
  await assert.rejects(request(2), error => error.statusCode === 400);
  assert.equal(create.mock.callCount(), 0);
});
