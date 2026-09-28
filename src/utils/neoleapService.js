/**
 * Neoleap Payment Gateway Service
 * ════════════════════════════════
 *
 * يتعامل مع جميع عمليات التشفير والتواصل مع بوابة Neoleap.
 *
 * ⚠️ ENCRYPTION NOTE:
 * Neoleap يستخدم نظام Tranportal (المشابه لـ KNET)
 * Algorithm: AES-128-CBC
 * Key:       أول 16 byte من NEOLEAP_RESOURCE_KEY
 * IV:        أول 16 byte من NEOLEAP_RESOURCE_KEY (نفس الـ key)
 * Padding:   PKCS5/PKCS7
 * Output:    Hex string
 *
 * المصدر: نمط KNET Tranportal المعروف في منطقة الخليج
 *
 * ⚠️ IMPORTANT: إذا أعطاك Neoleap documentation رسمي يخالف هذا،
 * عدّل دالة aesEncrypt/aesDecrypt فقط دون تغيير باقي الـ architecture.
 *
 * ⚠️ CURRENCY:
 * SAR ISO 4217 numeric = 682
 * تحقق مع Neoleap documentation ما إذا كانوا يريدون:
 * - النص: "SAR"
 * - أو الرقم: "682"
 * حالياً: نستخدم "SAR" - PLACEHOLDER_CURRENCY_FORMAT
 *
 * ⚠️ RESPONSE FIELDS:
 * أسماء الحقول في الـ response (مثل PaymentID, Auth, Ref, TrackID)
 * تحتاج تأكيداً من Neoleap documentation الرسمي.
 */

const crypto = require('crypto');
const { neoleapConfig } = require('../config/neoleap.config');

class NeoleapService {
  // ─────────────────────────────────────────────────────
  // ENCRYPTION / DECRYPTION
  // ─────────────────────────────────────────────────────

  /**
   * PKCS5 padding للتأكد أن البيانات مضاعف 16 byte
   * @param {string} text
   * @returns {string}
   */
  _pkcs5Pad(text) {
    const blocksize = 16;
    const pad = blocksize - (text.length % blocksize);
    return text + Buffer.alloc(pad, pad).toString();
  }

  /**
   * تشفير البيانات باستخدام AES-128-CBC
   *
   * Key:  أول 16 byte من resourceKey
   * IV:   أول 16 byte من resourceKey (نفس الـ key - نمط Tranportal)
   *
   * @param {string} text - النص المراد تشفيره
   * @returns {string} - Hex encoded encrypted string
   */
  encrypt(text) {
    const resourceKey = neoleapConfig.resourceKey;
    if (!resourceKey) {
      throw new Error('[Neoleap] NEOLEAP_RESOURCE_KEY غير موجود في الـ environment');
    }

    // استخدام أول 16 byte فقط (AES-128)
    const key = Buffer.from(resourceKey).slice(0, 16);
    const iv = Buffer.from(resourceKey).slice(0, 16);

    const padded = this._pkcs5Pad(text);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encrypted = cipher.update(padded, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * فك تشفير الاستجابة من Neoleap
   *
   * @param {string} encryptedHex - Hex encoded encrypted response
   * @returns {string} - النص المفكوك
   */
  decrypt(encryptedHex) {
    const resourceKey = neoleapConfig.resourceKey;
    if (!resourceKey) {
      throw new Error('[Neoleap] NEOLEAP_RESOURCE_KEY غير موجود في الـ environment');
    }

    const key = Buffer.from(resourceKey).slice(0, 16);
    const iv = Buffer.from(resourceKey).slice(0, 16);

    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted.trim();
  }

  // ─────────────────────────────────────────────────────
  // PAYMENT REQUEST BUILDING
  // ─────────────────────────────────────────────────────

  /**
   * يبني request string للإرسال إلى Neoleap
   *
   * تنسيق: id=xxx&password=xxx&action=1&amt=xxx&currencycode=xxx&langid=AR&trackid=xxx&responseURL=xxx&errorURL=xxx
   *
   * ⚠️ PLACEHOLDER_REQUEST_FIELDS: تحقق من Neoleap documentation الرسمي للتأكد من:
   * - action code (1 = Purchase?)
   * - currencycode format (SAR or 682?)
   * - langid values
   * - أي حقول إضافية مطلوبة (udf1, udf2, etc.)
   *
   * @param {Object} params
   * @param {string} params.trackId - معرف الطلب الفريد
   * @param {number} params.amount - المبلغ بالـ SAR
   * @param {string} params.responseUrl - رابط النجاح
   * @param {string} params.errorUrl - رابط الفشل
   * @returns {string} - Query string غير مشفر
   */
  buildRequestString({ trackId, amount, responseUrl, errorUrl }) {
    const formattedAmount = Number(amount).toFixed(3); // SAR يستخدم 3 منازل عشرية

    const params = [
      `id=${neoleapConfig.tranportalId}`,
      `password=${neoleapConfig.tranportalPassword}`,
      `action=1`,                            // 1 = Purchase - تحقق من documentation
      `amt=${formattedAmount}`,
      `currencycode=682`,                    // SAR ISO 4217 numeric - تحقق من documentation
      `langid=AR`,                           // اللغة - تحقق من القيم المتاحة
      `trackid=${trackId}`,
      `responseURL=${responseUrl}`,
      `errorURL=${errorUrl}`,
      `udf1=`,                               // حقول إضافية - optional
      `udf2=`,
      `udf3=`,
      `udf4=`,
      `udf5=`,
    ];

    return params.join('&');
  }

  /**
   * إنشاء جلسة دفع مع Neoleap
   *
   * Flow:
   * 1. بناء request string بالبيانات
   * 2. تشفيرها بالـ resourceKey
   * 3. إرسال للـ tranportal endpoint
   * 4. استقبال payment ID / redirect data
   *
   * ⚠️ PLACEHOLDER_TRANPORTAL_REQUEST: البيانات التي يرجعها Neoleap tranportal
   * (مثل PaymentID) تحتاج تأكيداً من documentation رسمي.
   *
   * @param {Object} params
   * @param {string} params.trackId - معرف الطلب الفريد
   * @param {number} params.amount - المبلغ المحسوب من الـ backend
   * @param {string} params.responseUrl - URL للنجاح
   * @param {string} params.errorUrl - URL للفشل
   * @returns {Promise<{paymentId: string, redirectUrl: string}>}
   */
  async createPaymentSession({ trackId, amount, responseUrl, errorUrl }) {
    console.log(`[Neoleap] إنشاء جلسة دفع - TrackID: ${trackId}, Amount: ${amount}`);

    if (!neoleapConfig.isConfigured()) {
      throw new Error('[Neoleap] الإعدادات غير مكتملة. تحقق من متغيرات البيئة.');
    }

    // بناء وتشفير الـ request
    const requestString = this.buildRequestString({ trackId, amount, responseUrl, errorUrl });
    const encryptedData = this.encrypt(requestString);

    console.log(`[Neoleap] إرسال request إلى: ${neoleapConfig.tranportalUrl}`);

    // ⚠️ PLACEHOLDER_TRANPORTAL_CALL:
    // تحقق من documentation Neoleap الرسمي للـ:
    // - طريقة الإرسال (POST form vs. JSON API)
    // - اسم الحقل المشفر (trandata vs encrypted_data)
    // - format الاستجابة
    const response = await this._callTranportal(encryptedData);

    console.log(`[Neoleap] استجابة tranportal: PaymentID=${response.paymentId}`);

    return response;
  }

  /**
   * استدعاء Neoleap Tranportal endpoint
   *
   * ⚠️ PLACEHOLDER_TRANPORTAL_API:
   * هذه الدالة تحتاج تأكيداً من documentation Neoleap الرسمي:
   * 1. هل الإرسال POST JSON أم POST form-urlencoded؟
   * 2. ما اسم الحقل المشفر؟ (trandata)
   * 3. ما هي الاستجابة المتوقعة؟
   *    - هل يرجع payment ID؟
   *    - هل يرجع redirect URL مباشرة؟
   *    - هل الاستجابة مشفرة أيضاً؟
   *
   * @param {string} encryptedData
   * @returns {Promise<{paymentId: string, redirectUrl: string}>}
   */
  async _callTranportal(encryptedData) {
    const tranportalUrl = neoleapConfig.tranportalUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    try {
      const response = await fetch(tranportalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `trandata=${encodeURIComponent(encryptedData)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`[Neoleap] Tranportal HTTP Error ${response.status}: ${responseText}`);
      }

      // ⚠️ PLACEHOLDER_RESPONSE_PARSING:
      // Neoleap قد يرجع:
      // 1. مشفراً: نفك التشفير ثم نحلل
      // 2. PaymentID فقط كنص
      // 3. JSON
      // تحقق من documentation لمعرفة الصيغة الصحيحة

      return this._parseTranportalResponse(responseText);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('[Neoleap] Timeout: انتهت مهلة الاتصال بـ Neoleap (30 ثانية)');
      }
      throw error;
    }
  }

  /**
   * تحليل استجابة Tranportal
   *
   * ⚠️ PLACEHOLDER_PARSE_RESPONSE:
   * يحتاج تأكيداً من documentation Neoleap الرسمي.
   * قد تكون الاستجابة:
   * - PaymentID=xxx فقط (الأكثر شيوعاً في KNET/Tranportal)
   * - JSON
   * - مشفرة
   *
   * @param {string} responseText
   * @returns {{paymentId: string, redirectUrl: string}}
   */
  _parseTranportalResponse(responseText) {
    // ⚠️ PLACEHOLDER: نموذج تحليل PaymentID
    // استجابة KNET النموذجية: "PaymentID=xxx"
    const paymentIdMatch = responseText.match(/PaymentID=([^&\s]+)/i);
    if (!paymentIdMatch) {
      // محاولة تحليل كـ query string
      try {
        const params = new URLSearchParams(responseText);
        const paymentId = params.get('PaymentID') || params.get('paymentid');
        if (paymentId) {
          return {
            paymentId,
            redirectUrl: `${neoleapConfig.hostedUrl}?PaymentID=${paymentId}`,
          };
        }
      } catch (e) {
        // ignore
      }

      console.error('[Neoleap] استجابة غير متوقعة من tranportal:', responseText.substring(0, 200));
      throw new Error('[Neoleap] استجابة غير صالحة من بوابة الدفع. تحقق من documentation.');
    }

    const paymentId = paymentIdMatch[1];
    return {
      paymentId,
      redirectUrl: `${neoleapConfig.hostedUrl}?PaymentID=${paymentId}`,
    };
  }

  // ─────────────────────────────────────────────────────
  // PAYMENT RESPONSE HANDLING
  // ─────────────────────────────────────────────────────

  /**
   * معالجة استجابة Neoleap بعد العودة من صفحة الدفع
   *
   * ⚠️ PLACEHOLDER_CALLBACK_FIELDS:
   * الحقول التي يرسلها Neoleap تحتاج تأكيداً:
   * - هل الاستجابة مشفرة؟
   * - ما أسماء الحقول؟ (result, auth, ref, trackid, paymentid, tranid)
   * - ما قيم result للنجاح والفشل؟ (CAPTURED vs. NOT CAPTURED)
   *
   * @param {Object|string} responseData - بيانات الاستجابة من Neoleap
   * @returns {Object} - بيانات العملية المُحللة
   */
  parsePaymentResponse(responseData) {
    let data = responseData;

    // إذا كانت الاستجابة مشفرة، نفك التشفير أولاً
    if (typeof responseData === 'string' && /^[0-9a-fA-F]+$/.test(responseData)) {
      try {
        const decrypted = this.decrypt(responseData);
        data = Object.fromEntries(new URLSearchParams(decrypted));
      } catch (e) {
        // ربما ليست مشفرة
        data = Object.fromEntries(new URLSearchParams(responseData));
      }
    }

    // ⚠️ PLACEHOLDER_FIELD_NAMES: تحقق من أسماء الحقول الصحيحة
    return {
      trackId: data.trackid || data.TrackID || data.TRACKID,
      paymentId: data.PaymentID || data.paymentid || data.PAYMENTID,
      result: data.result || data.Result || data.RESULT,
      auth: data.auth || data.Auth || data.AUTH,
      ref: data.ref || data.Ref || data.REF,
      tranId: data.tranid || data.TranID || data.TRANID,
      responseCode: data.responsecode || data.ResponseCode || data.RESPONSECODE,
      postDate: data.postdate || data.PostDate,
      udf1: data.udf1,
      udf2: data.udf2,
      rawData: data,
    };
  }

  /**
   * تحديد ما إذا كانت العملية ناجحة
   *
   * ⚠️ PLACEHOLDER_SUCCESS_CHECK:
   * تحقق من documentation Neoleap لمعرفة:
   * - ما قيمة result عند النجاح؟ (CAPTURED? SUCCESS? APPROVED?)
   * - هل هناك response code للنجاح؟
   *
   * @param {Object} parsedResponse - نتيجة parsePaymentResponse
   * @returns {boolean}
   */
  isPaymentSuccessful(parsedResponse) {
    const result = (parsedResponse.result || '').toUpperCase();
    // ⚠️ PLACEHOLDER: تحقق من القيم الصحيحة مع Neoleap documentation
    return result === 'CAPTURED' || result === 'SUCCESS' || result === 'APPROVED';
  }

  /**
   * التحقق الأمني من تطابق المبلغ
   *
   * @param {Object} parsedResponse
   * @param {number} expectedAmount
   * @returns {boolean}
   */
  verifyAmount(parsedResponse, expectedAmount) {
    // ⚠️ PLACEHOLDER: تحقق من اسم حقل المبلغ في الاستجابة
    const responseAmount = parsedResponse.rawData?.amt ||
                           parsedResponse.rawData?.amount ||
                           parsedResponse.rawData?.Amount;

    if (responseAmount === undefined || responseAmount === null) {
      // إذا لم يرجع مبلغ في الاستجابة، نقبل (لكن نسجل تحذير)
      console.warn(`[Neoleap Security] لم يُرجع مبلغ في الاستجابة للـ TrackID: ${parsedResponse.trackId}`);
      return true;
    }

    const diff = Math.abs(Number(responseAmount) - Number(expectedAmount));
    return diff < 0.01; // هامش ± 0.01 للفروق العشرية
  }

  /**
   * sanitize الاستجابة قبل تخزينها في قاعدة البيانات
   * إزالة أي بيانات حساسة محتملة
   *
   * @param {Object} rawData
   * @returns {Object}
   */
  sanitizeResponse(rawData) {
    if (!rawData || typeof rawData !== 'object') return {};

    const sanitized = { ...rawData };

    // حذف أي حقول حساسة محتملة
    const sensitiveFields = [
      'password', 'Password', 'PASSWORD',
      'cvv', 'CVV', 'cvc', 'CVC',
      'pin', 'PIN',
      'otp', 'OTP',
      'cardnumber', 'CardNumber', 'CARDNUMBER',
      'pan', 'PAN',
    ];

    for (const field of sensitiveFields) {
      delete sanitized[field];
    }

    // Mask بيانات البطاقة إذا وجدت
    if (sanitized.cardnumber || sanitized.pan) {
      sanitized['_card_masked'] = 'REDACTED';
    }

    return sanitized;
  }

  /**
   * استخراج معلومات البطاقة المقبول تخزينها
   *
   * @param {Object} parsedResponse
   * @returns {{maskedCard?: string, cardBrand?: string}}
   */
  extractSafeCardData(parsedResponse) {
    const raw = parsedResponse.rawData || {};

    // ⚠️ PLACEHOLDER: تحقق من أسماء حقول البطاقة في Neoleap response
    const maskedPan = raw.maskedcard || raw.MaskedCard || raw.cardnumber;
    const brand = raw.cardbrand || raw.CardBrand || raw.paymenttype;

    const result = {};

    if (maskedPan && typeof maskedPan === 'string') {
      // تأكد أنه masked فعلاً - يجب ألا يكون رقم بطاقة كامل
      const digits = maskedPan.replace(/\D/g, '');
      if (digits.length <= 6) {
        // آمن - قليل الأرقام (مثل آخر 4 أو 6 أرقام)
        result.maskedCard = maskedPan;
      } else if (digits.length <= 12 && maskedPan.includes('*')) {
        // آمن - يحتوي على نجوم
        result.maskedCard = maskedPan;
      }
      // إذا كان 16 رقم بدون نجوم - لا نخزنه
    }

    if (brand) {
      result.cardBrand = brand;
    }

    return result;
  }

  // ─────────────────────────────────────────────────────
  // TRANSACTION INQUIRY
  // ─────────────────────────────────────────────────────

  /**
   * استعلام عن حالة معاملة
   *
   * ⚠️ PLACEHOLDER_INQUIRY_API:
   * تحقق من documentation Neoleap لمعرفة:
   * - هل يوجد Inquiry API؟
   * - ما هو endpoint الاستعلام؟
   * - ما parameters الطلب؟
   *
   * @param {string} paymentId - معرف الدفع من Neoleap
   * @param {string} trackId - معرف الطلب الخاص بنا
   * @returns {Promise<Object>}
   */
  async queryTransaction(paymentId, trackId) {
    // ⚠️ PLACEHOLDER_INQUIRY:
    // هذه الدالة تحتاج Neoleap documentation الرسمي لتنفيذها
    console.warn('[Neoleap] queryTransaction: يحتاج Neoleap Inquiry API documentation لتنفيذه');
    return null;
  }

  // ─────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────

  /**
   * إنشاء merchant reference فريد
   *
   * @param {string} orderId
   * @returns {string}
   */
  generateMerchantReference(orderId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    // نستخدم آخر 8 chars من orderId لاختصاره
    const shortOrderId = String(orderId).slice(-8);
    return `NL-${shortOrderId}-${timestamp}-${random}`;
  }
}

module.exports = new NeoleapService();
