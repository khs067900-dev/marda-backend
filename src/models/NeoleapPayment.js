const mongoose = require('mongoose');

/**
 * نموذج بيانات معاملات Neoleap
 *
 * يحتوي على جميع الحقول اللازمة لتتبع حالة الدفع عبر بوابة Neoleap.
 * ممنوع تخزين: رقم البطاقة الكامل، CVV، OTP، أي بيانات حساسة.
 */
const neoleapPaymentSchema = new mongoose.Schema(
  {
    // ربط الدفعة بالطلب
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },

    // بيانات المتجر
    provider: {
      type: String,
      default: 'neoleap',
      immutable: true,
    },

    environment: {
      type: String,
      enum: ['test', 'production'],
      default: 'test',
      immutable: true,
    },

    // المبلغ والعملة (تُحسب من الـ backend - لا تُقبل من الـ frontend)
    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: 'SAR',
    },

    // حالة الدفع
    status: {
      type: String,
      enum: ['pending', 'initiated', 'processing', 'paid', 'failed', 'cancelled', 'expired', 'refunded'],
      default: 'pending',
      index: true,
    },

    // المراجع الفريدة
    merchantReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // بيانات Neoleap (تُملأ بعد الاستجابة)
    neoleapTransactionId: { type: String, index: true },
    neoleapPaymentId: { type: String },
    trackId: { type: String },

    // نتيجة العملية
    responseCode: { type: String },
    responseMessage: { type: String },
    result: { type: String }, // CAPTURED, NOT CAPTURED, etc.
    authCode: { type: String }, // Authorization Code
    referenceId: { type: String },
    paymentId: { type: String },

    // بيانات البطاقة المقبول تخزينها فقط
    // ممنوع: رقم البطاقة الكامل، CVV، OTP
    maskedCard: { type: String }, // مثال: **** **** **** 1112
    cardBrand: { type: String }, // Visa, Mastercard, Mada

    // سبب الرفض (في حالة الفشل)
    failureReason: { type: String },

    // الـ raw response (بعد sanitization - بدون بيانات حساسة)
    rawResponse: { type: mongoose.Schema.Types.Mixed },

    // وقت انتهاء الجلسة (إذا دعمته Neoleap)
    expiresAt: { type: Date },

    // حماية من التكرار
    processedAt: { type: Date }, // وقت أول معالجة ناجحة
    callbackReceivedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Index مركّب لمنع التكرار
neoleapPaymentSchema.index({ orderId: 1, status: 1 });

module.exports = mongoose.model('NeoleapPayment', neoleapPaymentSchema);
