const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const noonService = require('../utils/noonService');

// POST /api/orders - guest checkout
exports.createOrder = asyncHandler(async (req, res) => {
  const { customerName, phone, address, notes, items, paymentMethod } = req.body;

  if (!items || items.length === 0) throw new AppError('يرجى إضافة منتجات للطلب', 400);

  let totalPrice = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) throw new AppError(`المنتج غير موجود: ${item.productId}`, 404);
    if (product.stock < item.quantity) {
      throw new AppError(`المنتج "${product.name}" غير متوفر بالكمية المطلوبة. المتاح: ${product.stock}`, 400);
    }
    orderItems.push({ productId: product._id, name: product.name, price: product.price, quantity: item.quantity });
    totalPrice += product.price * item.quantity;
    product.stock -= item.quantity;
    await product.save();
  }

  const allowedPaymentMethods = ['cash_on_delivery', 'tap', 'noon_payments'];
  const finalPaymentMethod = allowedPaymentMethods.includes(paymentMethod) ? paymentMethod : 'cash_on_delivery';

  const order = await Order.create({
    customerName, phone, address, notes, items: orderItems, totalPrice,
    paymentMethod: finalPaymentMethod
  });

  res.status(201).json({ success: true, message: 'تم إنشاء الطلب بنجاح', data: order });
});

// POST /api/orders/:id/tap-session - إنشاء جلسة دفع Tap
exports.createTabbySession = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  const nameParts = order.customerName.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || firstName;

  const response = await fetch('https://api.tap.company/v2/charges', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TAP_SECRET_KEY}`
    },
    body: JSON.stringify({
      amount: order.totalPrice,
      currency: 'SAR',
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: `${order.phone}@placeholder.com`,
        phone: { country_code: '966', number: order.phone.replace(/^0/, '') }
      },
      source: { id: 'src_all' },
      redirect: { url: `${process.env.FRONTEND_URL}/order-success?id=${order._id}&verify=true` },
      post: { url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/orders/${order._id}/tap-webhook` }
    })
  });

  const data = await response.json();

  if (!response.ok) throw new AppError(data.errors?.[0]?.description || data.message || 'فشل إنشاء جلسة الدفع', 400);

  const checkoutUrl = data.transaction?.url;
  if (!checkoutUrl) throw new AppError('لم يتم الحصول على رابط الدفع', 400);

  res.json({ success: true, checkoutUrl, chargeId: data.id });
});

// GET /api/orders/:id/verify-payment?tap_id=xxx
exports.verifyPayment = asyncHandler(async (req, res) => {
  const { tap_id } = req.query;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  const response = await fetch(`https://api.tap.company/v2/charges/${tap_id}`, {
    headers: { 'Authorization': `Bearer ${process.env.TAP_SECRET_KEY}` }
  });

  const charge = await response.json();

  if (charge.status === 'CAPTURED') {
    order.paymentStatus = 'paid';
    order.tapChargeId = tap_id;
    order.status = 'confirmed';
    await order.save();
    res.json({ success: true, message: 'تم التحقق من الدفع بنجاح', data: order });
  } else {
    order.paymentStatus = 'failed';
    await order.save();
    throw new AppError('فشل التحقق من الدفع', 400);
  }
});

// POST /api/orders/:id/noon-session - إنشاء جلسة دفع noon payments
exports.createNoonSession = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const returnUrl = `${frontendUrl}/order-success?id=${order._id}&noon_order_id={order.id}&status=success`;

  const session = await noonService.initiatePayment({
    orderId: order._id,
    amount: order.totalPrice,
    name: `Order #${order._id}`,
    returnUrl,
    customerName: order.customerName,
    customerPhone: order.phone
  });

  order.noonOrderId = String(session.noonOrderId);
  await order.save();

  res.json({
    success: true,
    checkoutUrl: session.postUrl,
    jsUrl: session.jsUrl,
    noonOrderId: session.noonOrderId
  });
});

// دالة مساعدة لإرجاع المخزون في حال فشل أو إلغاء الطلب
const restoreOrderStock = async (order) => {
  if (order.stockRestored) return; // منع تكرار استرجاع المخزون
  try {
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }
    order.stockRestored = true;
  } catch (err) {
    console.error(`[Stock Restore Error] Order ${order._id}:`, err);
  }
};

// GET /api/orders/:id/verify-noon-payment
exports.verifyNoonPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  const noonId = req.query.noon_order_id || order.noonOrderId;
  if (!noonId) throw new AppError('معرّف عملية الدفع غير موجود', 400);

  const noonRes = await noonService.getOrder(noonId);
  const noonOrder = noonRes.result?.order;
  const noonStatus = noonOrder?.status;
  const paidAmount = noonOrder?.totalAmount ?? noonOrder?.amount;

  if (noonStatus === 'PAID' || noonStatus === 'CAPTURED') {
    // التحقق الأمني من تطابق المبلغ
    if (paidAmount !== undefined && Math.abs(Number(paidAmount) - Number(order.totalPrice)) > 0.05) {
      console.error(`[Security Alert] Amount mismatch for order ${order._id}. Expected: ${order.totalPrice}, Paid: ${paidAmount}`);
      order.paymentStatus = 'failed';
      await restoreOrderStock(order);
      await order.save();
      throw new AppError('فشل التحقق الأمني: المبلغ المدفوع لا يطابق إجمالي الطلب', 400);
    }

    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.noonOrderId = String(noonId);
    await order.save();
    res.json({ success: true, message: 'تم التحقق من نجاح الدفع عبر نون بنجاح', data: order });
  } else {
    order.paymentStatus = 'failed';
    order.status = (noonStatus === 'CANCELLED' || noonStatus === 'EXPIRED') ? 'cancelled' : order.status;
    await restoreOrderStock(order);
    await order.save();
    throw new AppError(`حالة الدفع: ${noonStatus || 'فشل الدفع'}`, 400);
  }
});

// PATCH /api/orders/:id/status - لتحديث حالة الدفع من الـ Callback الداخلي
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentMethod, paymentStatus, orderStatus, noonOrderId } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  if (paymentMethod) order.paymentMethod = paymentMethod;
  if (noonOrderId) order.noonOrderId = String(noonOrderId);

  if (paymentStatus === 'paid') {
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
  } else if (paymentStatus === 'failed' || orderStatus === 'cancelled') {
    order.paymentStatus = 'failed';
    if (orderStatus === 'cancelled') order.status = 'cancelled';
    await restoreOrderStock(order);
  } else if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  await order.save();
  res.json({ success: true, message: 'تم تحديث حالة الطلب بنجاح', data: order });
});

// POST /api/orders/noon-webhook
exports.noonWebhook = asyncHandler(async (req, res) => {
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const isValid = noonService.verifyWebhook(rawBody, req.headers);
  if (!isValid) throw new AppError('توقيع الـ Webhook غير صالح', 401);

  const eventData = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
  const orderId = eventData.orderId || eventData.merchantOrderReference;
  const noonStatus = eventData.orderStatus || eventData.status;

  if (orderId && noonStatus) {
    const order = await Order.findById(orderId);
    if (order) {
      const mapped = noonService.mapStatus(noonStatus);
      if (mapped.paymentStatus === 'paid') {
        order.status = 'confirmed';
        order.paymentStatus = 'paid';
      } else if (mapped.paymentStatus === 'failed' || mapped.orderStatus === 'cancelled') {
        order.paymentStatus = 'failed';
        if (mapped.orderStatus === 'cancelled') order.status = 'cancelled';
        await restoreOrderStock(order);
      }
      await order.save();
    }
  }

  res.json({ success: true });
});

// GET /api/orders/:id/public - للفاتورة بدون auth
exports.getOrderPublic = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select('customerName phone address items totalPrice paymentMethod paymentStatus tapChargeId noonOrderId createdAt status').lean();
  if (!order) throw new AppError('الطلب غير موجود', 404);
  res.json({ success: true, data: order });
});

// GET /api/orders (admin)
exports.getOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Order.countDocuments(filter)
  ]);

  res.json({
    success: true, message: 'تم جلب الطلبات', data: orders,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/orders/:id (admin)
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw new AppError('الطلب غير موجود', 404);
  res.json({ success: true, message: 'تم جلب الطلب', data: order });
});

// PUT /api/orders/:id/status (admin)
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) throw new AppError('حالة غير صالحة', 400);

  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) throw new AppError('الطلب غير موجود', 404);
  res.json({ success: true, message: 'تم تحديث حالة الطلب', data: order });
});
