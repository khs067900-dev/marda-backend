const Order = require('../models/Order');
const NeoleapPayment = require('../models/NeoleapPayment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const service = require('../utils/neoleapService');
const { neoleapConfig: config } = require('../config/neoleap.config');

function resultUrl(orderId) {
  const url = new URL('/order-success', process.env.FRONTEND_URL || 'http://localhost:3000');
  url.searchParams.set('id', String(orderId));
  url.searchParams.set('verify', 'neoleap');
  return url.toString();
}

function returnUrl() {
  // Both browser returns and JSON notifications must reach the backend.
  return config.callbackUrl || new URL('/api/orders/neoleap/return', process.env.BACKEND_URL || 'http://localhost:5000').toString();
}

function sessionResponse(payment) {
  return { success: true, data: {
    // بيانات الـ form التي سيُرسلها الـ Frontend مباشرة لـ Neoleap
    tranportalUrl: payment.tranportalUrl || process.env.NEOLEAP_TRANPORTAL_URL,
    trandata: payment.trandata,
    merchantReference: payment.merchantReference,
    amount: payment.amount,
    currency: payment.currency,
  } };
}

exports.createNeoleapSession = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);
  if (order.paymentStatus === 'paid') throw new AppError('هذا الطلب مدفوع بالفعل', 400);
  if (order.status === 'cancelled') throw new AppError('لا يمكن الدفع لطلب ملغي', 400);
  if (!Number.isFinite(order.totalPrice) || order.totalPrice <= 0) throw new AppError('مبلغ الطلب غير صالح', 400);
  if (!config.isConfigured()) throw new AppError('إعدادات Neoleap غير مكتملة.', 503);

  // Idempotency: إعادة استخدام جلسة موجودة غير منتهية
  const existing = await NeoleapPayment.findOne({
    orderId: order._id, status: 'initiated', expiresAt: { $gt: new Date() },
    trandata: { $exists: true }, amount: order.totalPrice,
  }).sort({ createdAt: -1 });
  if (existing) return res.json(sessionResponse(existing));

  const payment = await NeoleapPayment.create({
    orderId: order._id, amount: order.totalPrice, currency: config.currency,
    merchantReference: service.generateMerchantReference(), environment: config.environment, status: 'pending',
  });
  try {
    const responseUrl = resultUrl(order._id);
    const session = await service.createPaymentSession({
      trackId: payment.merchantReference, amount: payment.amount,
      responseUrl, errorUrl: responseUrl,
    });

    // حفظ بيانات الـ form في الـ payment record
    payment.trandata = session.trandata;
    payment.tranportalUrl = session.tranportalUrl;
    payment.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    payment.status = 'initiated';
    await payment.save();

    order.paymentMethod = 'neoleap';
    await order.save();

    console.log(`[Neoleap] ✅ جلسة دفع جاهزة - Ref: ${payment.merchantReference}, Amount: ${payment.amount}`);
    return res.json(sessionResponse(payment));
  } catch (error) {
    payment.status = 'failed';
    payment.failureReason = error instanceof AppError ? error.message : 'Neoleap session creation failed';
    await payment.save();
    console.error('[Neoleap] Session failed:', error.message);
    throw error instanceof AppError ? error : new AppError('فشل إنشاء جلسة الدفع. يرجى المحاولة لاحقاً.', 502);
  }
});


async function recordGatewayResult(payment, parsed) {
  if (!service.matchesPayment(parsed, payment)) throw new AppError('بيانات نتيجة الدفع لا تطابق الطلب', 400);
  const result = String(parsed.result || '').toUpperCase();
  const paid = service.isPaymentSuccessful(parsed);
  const failed = ['NOT CAPTURED', 'NOT APPROVED', 'VOIDED', 'DENIED BY RISK', 'CANCELLED', 'CANCELED'].includes(result);
  const status = paid ? 'paid' : failed ? (result.includes('CANCEL') ? 'cancelled' : 'failed') : 'processing';
  await NeoleapPayment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: {
    status, result: parsed.result, neoleapPaymentId: parsed.paymentId,
    neoleapTransactionId: parsed.tranId, trackId: parsed.trackId,
    authCode: parsed.auth, referenceId: parsed.ref, responseCode: parsed.responseCode,
    rawResponse: service.sanitizeResponse(parsed.rawData), ...service.extractSafeCardData(parsed),
    ...(paid ? { processedAt: new Date(), failureReason: null } : {}),
    ...(failed ? { failureReason: result } : {}),
  } });
  if (paid) {
    await Order.updateOne({ _id: payment.orderId }, { $set: {
      paymentStatus: 'paid', status: 'confirmed', paymentMethod: 'neoleap',
    } });
  }
  // A failed older attempt must not overwrite another successful payment.
  return status;
}

exports.verifyNeoleapPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);
  if (order.paymentStatus === 'paid') return res.json({ success: true, data: { paymentStatus: 'paid', orderId: order._id } });

  const filter = { orderId: order._id };
  const paymentId = req.query.paymentId || req.query.PaymentID || req.query.paymentid;
  if (paymentId) {
    if (typeof paymentId !== 'string' || !/^\d+$/.test(paymentId)) throw new AppError('معرف الدفع غير صالح', 400);
    filter.neoleapPaymentId = paymentId;
  }
  const payment = await NeoleapPayment.findOne(filter).sort({ createdAt: -1 });
  if (!payment) throw new AppError('سجل الدفع غير موجود', 404);

  let parsed;
  try {
    // Browser query parameters never establish payment success.
    parsed = await service.queryTransaction(payment.neoleapPaymentId, payment.merchantReference, payment.amount);
  } catch (error) {
    console.error('[Neoleap] Verification unavailable:', error.statusCode || error.name);
    return res.status(202).json({ success: false, pending: true, message: 'جاري التحقق من الدفع. لا تعِد الدفع قبل تأكيد النتيجة.' });
  }
  const status = await recordGatewayResult(payment, parsed);
  if (status === 'paid') return res.json({ success: true, data: { paymentStatus: status, orderId: order._id } });
  if (status === 'processing') return res.status(202).json({ success: false, pending: true, data: { paymentStatus: status } });
  return res.status(400).json({ success: false, message: 'لم تكتمل عملية الدفع.', data: { paymentStatus: status } });
});

async function receiveReturn(data) {
  const envelope = Array.isArray(data) ? data[0] : data;
  if (envelope?.trandata) {
    const parsed = service.parsePaymentResponse(data);
    const payment = await NeoleapPayment.findOne({ merchantReference: parsed.trackId, neoleapPaymentId: parsed.paymentId });
    if (!payment || !service.matchesPayment(parsed, payment)) throw new AppError('بيانات نتيجة الدفع لا تطابق الطلب', 400);
    // A notification precedes settlement. Persist it, acknowledge, then inquire on return.
    await NeoleapPayment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: {
      status: 'processing', callbackReceivedAt: new Date(), rawResponse: service.sanitizeResponse(parsed.rawData),
    } });
    return payment;
  }
  // Gateway validation errors may arrive unencrypted. Only use the ID to locate
  // the order; never trust unencrypted result/error fields to change its status.
  const id = envelope?.paymentId || envelope?.paymentid || envelope?.PaymentID;
  if (typeof id !== 'string' || !/^\d+$/.test(id)) throw new AppError('معرف الدفع مفقود', 400);
  const payment = await NeoleapPayment.findOne({ neoleapPaymentId: id });
  if (!payment) throw new AppError('سجل الدفع غير موجود', 404);
  return payment;
}

exports.neoleapCallback = asyncHandler(async (req, res) => {
  const data = req.method === 'GET' ? req.query : req.body;
  const notification = req.method === 'POST' && req.is('application/json');
  // Acknowledge actual notifications only after validating encrypted data.
  if (notification && !(Array.isArray(data) ? data[0] : data)?.trandata) throw new AppError('بيانات إشعار الدفع مفقودة', 400);
  const payment = await receiveReturn(data);
  const url = resultUrl(payment.orderId);
  if (notification) return res.json([{ status: '1', result: url }]);
  return res.redirect(303, url);
});

exports.getNeoleapPaymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);
  const payment = await NeoleapPayment.findOne({ orderId: order._id }).sort({ createdAt: -1 });
  return res.json({ success: true, data: {
    paymentStatus: order.paymentStatus === 'paid' ? 'paid' : payment?.status || order.paymentStatus,
    orderId: order._id, amount: payment?.amount, currency: payment?.currency,
    merchantReference: payment?.merchantReference, maskedCard: payment?.maskedCard, cardBrand: payment?.cardBrand,
  } });
});

