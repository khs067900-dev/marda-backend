const Order = require('../models/Order');
const NeoleapPayment = require('../models/NeoleapPayment');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const neoleapService = require('../utils/neoleapService');
const { neoleapConfig } = require('../config/neoleap.config');

// ─────────────────────────────────────────────────────────
// POST /api/orders/:id/neoleap-session
// إنشاء جلسة دفع Neoleap
// ─────────────────────────────────────────────────────────
exports.createNeoleapSession = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  console.log(`[Neoleap] بدء إنشاء جلسة دفع - Order: ${order._id}`);

  // ─── 1. التحقق من حالة الطلب ───
  if (order.paymentStatus === 'paid') {
    throw new AppError('هذا الطلب مدفوع بالفعل', 400);
  }

  if (order.status === 'cancelled') {
    throw new AppError('لا يمكن الدفع لطلب ملغي', 400);
  }

  // ─── 2. حساب المبلغ من الـ backend (لا نثق في الـ frontend) ───
  // المبلغ يُؤخذ من الطلب المسجل في قاعدة البيانات
  const amount = order.totalPrice;
  if (!amount || amount <= 0) {
    throw new AppError('مبلغ الطلب غير صالح', 400);
  }

  // ─── 3. التحقق من وجود Neoleap payment pending قابل للإعادة ───
  // Idempotency: إذا كان هناك payment pending لم تنتهِ صلاحيته، نعيد استخدامه
  const existingPayment = await NeoleapPayment.findOne({
    orderId: order._id,
    status: 'pending',
    createdAt: { $gte: new Date(Date.now() - 20 * 60 * 1000) }, // خلال آخر 20 دقيقة
  });

  if (existingPayment) {
    console.log(`[Neoleap] إعادة استخدام payment موجود - Ref: ${existingPayment.merchantReference}`);

    // إعادة توليد الـ redirect URL بنفس الـ trackId
    try {
      const sessionData = await neoleapService.createPaymentSession({
        trackId: existingPayment.merchantReference,
        amount: existingPayment.amount,
        responseUrl: _buildResponseUrl(order._id, 'success'),
        errorUrl: _buildResponseUrl(order._id, 'failure'),
      });

      existingPayment.neoleapPaymentId = sessionData.paymentId;
      existingPayment.status = 'initiated';
      await existingPayment.save();

      return res.json({
        success: true,
        data: {
          paymentId: sessionData.paymentId,
          redirectUrl: sessionData.redirectUrl,
          merchantReference: existingPayment.merchantReference,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
        },
      });
    } catch (err) {
      console.error('[Neoleap] فشل إعادة استخدام payment موجود:', err.message);
      // إذا فشل، ننشئ payment جديد
    }
  }

  // ─── 4. إنشاء merchantReference فريد ───
  const merchantReference = neoleapService.generateMerchantReference(order._id);

  // ─── 5. إنشاء Payment record بالحالة pending ───
  const payment = await NeoleapPayment.create({
    orderId: order._id,
    amount,
    currency: neoleapConfig.currency,
    status: 'pending',
    merchantReference,
    environment: neoleapConfig.environment,
  });

  console.log(`[Neoleap] Payment record منشأ - Ref: ${merchantReference}, Amount: ${amount}`);

  try {
    // ─── 6. بناء URLs ───
    const responseUrl = _buildResponseUrl(order._id, 'success');
    const errorUrl = _buildResponseUrl(order._id, 'failure');

    // ─── 7. الاتصال بـ Neoleap ───
    console.log(`[Neoleap] إرسال request لـ Neoleap...`);
    const sessionData = await neoleapService.createPaymentSession({
      trackId: merchantReference,
      amount,
      responseUrl,
      errorUrl,
    });

    // ─── 8. تحديث Payment record ───
    payment.neoleapPaymentId = sessionData.paymentId;
    payment.status = 'initiated';
    await payment.save();

    // ─── 9. تحديث الطلب ───
    order.paymentMethod = 'neoleap';
    await order.save();

    console.log(`[Neoleap] جلسة دفع منشأة بنجاح - PaymentID: ${sessionData.paymentId}`);

    res.json({
      success: true,
      data: {
        paymentId: sessionData.paymentId,
        redirectUrl: sessionData.redirectUrl,
        merchantReference,
        amount,
        currency: neoleapConfig.currency,
      },
    });
  } catch (error) {
    // فشل الاتصال بـ Neoleap - نحدث الـ payment بالخطأ
    payment.status = 'failed';
    payment.failureReason = error.message;
    await payment.save();

    console.error(`[Neoleap] فشل إنشاء الجلسة - Order: ${order._id}:`, error.message);
    throw new AppError(
      'فشل إنشاء جلسة الدفع. يرجى المحاولة لاحقاً أو اختيار طريقة دفع أخرى.',
      500
    );
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/orders/:id/verify-neoleap-payment
// التحقق من نجاح الدفع بعد العودة من صفحة Neoleap
// ─────────────────────────────────────────────────────────
exports.verifyNeoleapPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  console.log(`[Neoleap] بدء التحقق من الدفع - Order: ${order._id}`);

  // ─── 1. البحث عن PaymentID في الـ query params ───
  // ⚠️ PLACEHOLDER_RETURN_PARAMS: تحقق من Neoleap documentation
  // ما الـ query params التي يرسلها Neoleap عند العودة للـ responseURL؟
  const paymentId = req.query.PaymentID || req.query.paymentId || req.query.paymentid;
  const trackId = req.query.trackid || req.query.TrackID || req.query.trackId;

  if (!paymentId && !trackId) {
    console.error('[Neoleap] لا يوجد PaymentID أو TrackID في الـ query params');
    throw new AppError('معرّف الدفع مفقود', 400);
  }

  // ─── 2. جلب الـ Payment record ───
  let payment;
  if (trackId) {
    payment = await NeoleapPayment.findOne({ merchantReference: trackId, orderId: order._id });
  }
  if (!payment && paymentId) {
    payment = await NeoleapPayment.findOne({ neoleapPaymentId: paymentId, orderId: order._id });
  }
  if (!payment) {
    console.error(`[Neoleap] لم يُعثر على Payment record - Order: ${order._id}`);
    throw new AppError('سجل الدفع غير موجود', 404);
  }

  // ─── 3. Idempotency: إذا كان مدفوعاً بالفعل، لا نعالجه مرة أخرى ───
  if (payment.status === 'paid') {
    console.log(`[Neoleap] الطلب مدفوع بالفعل - Ref: ${payment.merchantReference}`);
    return res.json({
      success: true,
      message: 'تم التحقق من الدفع مسبقاً',
      data: { paymentStatus: 'paid', orderId: order._id },
    });
  }

  // ─── 4. معالجة الاستجابة من Neoleap ───
  // ⚠️ PLACEHOLDER_RESPONSE_DATA: تحقق من الـ query params التي يرسلها Neoleap
  const responseData = {
    PaymentID: paymentId,
    trackid: trackId,
    result: req.query.result || req.query.Result,
    auth: req.query.auth || req.query.Auth,
    ref: req.query.ref || req.query.Ref,
    tranid: req.query.tranid || req.query.TranID,
    responsecode: req.query.responsecode || req.query.ResponseCode,
    postdate: req.query.postdate,
    // إضافة أي query params أخرى
    ...req.query,
  };

  // ─── 5. حذف البيانات الحساسة قبل التسجيل ───
  const sanitizedResponse = neoleapService.sanitizeResponse(responseData);
  payment.rawResponse = sanitizedResponse;
  payment.callbackReceivedAt = new Date();

  const parsed = neoleapService.parsePaymentResponse(responseData);

  console.log(`[Neoleap] نتيجة الاستجابة - Result: ${parsed.result}, TrackID: ${parsed.trackId}`);

  // ─── 6. التحقق الأمني من المبلغ ───
  if (!neoleapService.verifyAmount(parsed, payment.amount)) {
    console.error(`[Neoleap] Security Alert! Amount mismatch - Expected: ${payment.amount}`);
    payment.status = 'failed';
    payment.failureReason = 'Amount mismatch - security check failed';
    await payment.save();
    throw new AppError('فشل التحقق الأمني من المبلغ', 400);
  }

  // ─── 7. تحديد نجاح أو فشل الدفع ───
  if (neoleapService.isPaymentSuccessful(parsed)) {
    // ─── نجاح ───
    const safeCardData = neoleapService.extractSafeCardData(parsed);

    payment.status = 'paid';
    payment.neoleapTransactionId = parsed.tranId;
    payment.neoleapPaymentId = parsed.paymentId || paymentId;
    payment.trackId = parsed.trackId;
    payment.responseCode = parsed.responseCode;
    payment.result = parsed.result;
    payment.authCode = parsed.auth;
    payment.referenceId = parsed.ref;
    payment.maskedCard = safeCardData.maskedCard;
    payment.cardBrand = safeCardData.cardBrand;
    payment.processedAt = new Date();

    await payment.save();

    // تحديث الطلب
    order.paymentStatus = 'paid';
    order.status = 'confirmed';
    order.paymentMethod = 'neoleap';
    await order.save();

    console.log(`[Neoleap] ✅ دفع ناجح - Order: ${order._id}, Ref: ${payment.merchantReference}`);

    res.json({
      success: true,
      message: 'تم التحقق من نجاح الدفع',
      data: {
        paymentStatus: 'paid',
        orderId: order._id,
        merchantReference: payment.merchantReference,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  } else {
    // ─── فشل ───
    const isCancelled = (parsed.result || '').toUpperCase().includes('CANCEL') ||
                        (parsed.responseCode || '') === 'CANCELLED';

    payment.status = isCancelled ? 'cancelled' : 'failed';
    payment.responseCode = parsed.responseCode;
    payment.result = parsed.result;
    payment.failureReason = parsed.result || 'Payment not captured';

    await payment.save();

    order.paymentStatus = 'failed';
    await order.save();

    console.log(`[Neoleap] ❌ دفع فاشل - Order: ${order._id}, Result: ${parsed.result}`);

    throw new AppError(
      isCancelled ? 'تم إلغاء عملية الدفع' : 'فشلت عملية الدفع. يرجى المحاولة مرة أخرى.',
      400
    );
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/orders/neoleap-callback
// Callback من Neoleap (server-to-server إن وجد)
// ─────────────────────────────────────────────────────────
exports.neoleapCallback = asyncHandler(async (req, res) => {
  console.log('[Neoleap Callback] استلام callback:', {
    method: req.method,
    query: req.query,
    // لا نسجل body لأنه قد يحتوي بيانات حساسة
    hasBody: !!req.body,
  });

  // ⚠️ PLACEHOLDER_CALLBACK:
  // Neoleap قد يرسل أو لا يرسل server-to-server callback
  // تحقق من documentation لمعرفة:
  // 1. هل يوجد webhook/callback؟
  // 2. ما هي بيانات الـ callback؟
  // 3. هل يحتاج signature verification؟

  // نرد بنجاح فوراً لمنع timeout من Neoleap
  res.json({ success: true, received: true });

  // معالجة الـ callback في الخلفية
  try {
    await _processCallback(req.body || req.query);
  } catch (err) {
    console.error('[Neoleap Callback] خطأ في معالجة الـ callback:', err.message);
  }
});

/**
 * معالجة بيانات الـ Callback
 * @param {Object} data
 */
async function _processCallback(data) {
  if (!data) return;

  // ⚠️ PLACEHOLDER_CALLBACK_PROCESSING
  const trackId = data.trackid || data.TrackID;
  const paymentId = data.PaymentID || data.paymentid;

  if (!trackId && !paymentId) {
    console.warn('[Neoleap Callback] لا يوجد trackId أو paymentId في الـ callback');
    return;
  }

  const payment = await NeoleapPayment.findOne(
    trackId
      ? { merchantReference: trackId }
      : { neoleapPaymentId: paymentId }
  );

  if (!payment) {
    console.warn(`[Neoleap Callback] لم يُعثر على payment - trackId: ${trackId}`);
    return;
  }

  // Idempotency
  if (payment.status === 'paid') {
    console.log(`[Neoleap Callback] Payment مدفوع بالفعل - Ref: ${payment.merchantReference}`);
    return;
  }

  const parsed = neoleapService.parsePaymentResponse(data);
  const sanitized = neoleapService.sanitizeResponse(data);

  payment.rawResponse = sanitized;
  payment.callbackReceivedAt = new Date();

  if (neoleapService.isPaymentSuccessful(parsed)) {
    // التحقق من المبلغ
    if (!neoleapService.verifyAmount(parsed, payment.amount)) {
      console.error(`[Neoleap Callback] Security! Amount mismatch - Expected: ${payment.amount}`);
      payment.status = 'failed';
      payment.failureReason = 'Amount mismatch via callback';
      await payment.save();
      return;
    }

    const safeCardData = neoleapService.extractSafeCardData(parsed);
    payment.status = 'paid';
    payment.result = parsed.result;
    payment.authCode = parsed.auth;
    payment.referenceId = parsed.ref;
    payment.neoleapTransactionId = parsed.tranId;
    payment.maskedCard = safeCardData.maskedCard;
    payment.cardBrand = safeCardData.cardBrand;
    payment.processedAt = new Date();
    await payment.save();

    const order = await Order.findById(payment.orderId);
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      await order.save();
      console.log(`[Neoleap Callback] ✅ تم تحديث الطلب - Order: ${order._id}`);
    }
  } else {
    payment.status = 'failed';
    payment.result = parsed.result;
    payment.failureReason = parsed.result || 'Callback: payment not captured';
    await payment.save();

    const order = await Order.findById(payment.orderId);
    if (order) {
      order.paymentStatus = 'failed';
      await order.save();
    }
    console.log(`[Neoleap Callback] ❌ دفع فاشل - Order: ${payment.orderId}`);
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/orders/:id/neoleap-payment-status
// جلب حالة الدفع (آمن للـ frontend)
// ─────────────────────────────────────────────────────────
exports.getNeoleapPaymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('الطلب غير موجود', 404);

  const payment = await NeoleapPayment.findOne({ orderId: order._id })
    .sort({ createdAt: -1 })
    .select('status amount currency merchantReference createdAt updatedAt maskedCard cardBrand result');

  if (!payment) {
    return res.json({
      success: true,
      data: { paymentStatus: order.paymentStatus, orderId: order._id },
    });
  }

  // لا نرجع: rawResponse، credentials، أي بيانات حساسة
  res.json({
    success: true,
    data: {
      paymentStatus: payment.status,
      orderId: order._id,
      amount: payment.amount,
      currency: payment.currency,
      merchantReference: payment.merchantReference,
      maskedCard: payment.maskedCard,
      cardBrand: payment.cardBrand,
      createdAt: payment.createdAt,
    },
  });
});

// ─────────────────────────────────────────────────────────
// UTILITY: بناء URLs
// ─────────────────────────────────────────────────────────
function _buildResponseUrl(orderId, type) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (type === 'success') {
    // إذا كان NEOLEAP_SUCCESS_URL موجوداً، استخدمه
    if (neoleapConfig.successUrl) return `${neoleapConfig.successUrl}?id=${orderId}&verify=neoleap`;
    return `${frontendUrl}/order-success?id=${orderId}&verify=neoleap`;
  }

  if (type === 'failure') {
    if (neoleapConfig.failureUrl) return `${neoleapConfig.failureUrl}?id=${orderId}`;
    return `${frontendUrl}/order-success?id=${orderId}&status=failed&verify=neoleap`;
  }

  return `${frontendUrl}/order-success?id=${orderId}&verify=neoleap`;
}
