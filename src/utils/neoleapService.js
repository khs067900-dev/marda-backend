const crypto = require('crypto');
const { neoleapConfig: config } = require('../config/neoleap.config');
const AppError = require('./AppError');

// Merchant Integration Guide: pp. 18-32, 133-140, 191-198, 276-282.
const IV = Buffer.from('PGKEYENCDECIVSPC', 'utf8');

function parseJson(text) {
  return JSON.parse(text, (_key, value, context) => {
    // Gateway IDs exceed JavaScript's safe integer range. Node 22+ preserves source.
    if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      if (!context?.source) throw new Error('Gateway ID precision cannot be preserved');
      return context.source;
    }
    return value;
  });
}

function single(data) {
  if (Array.isArray(data)) {
    if (data.length !== 1) throw new AppError('استجابة غير صالحة من Neoleap', 502);
    data = data[0];
  }
  if (!data || typeof data !== 'object') throw new AppError('استجابة غير صالحة من Neoleap', 502);
  return data;
}

class NeoleapService {
  _key() {
    const key = Buffer.from(config.resourceKey || '', 'utf8');
    if (![16, 24, 32].includes(key.length)) {
      throw new AppError('إعداد مفتاح Neoleap غير صالح. يرجى مراجعة إعدادات بوابة الدفع.', 503);
    }
    return key;
  }

  encrypt(text) {
    const key = this._key();
    const cipher = crypto.createCipheriv('aes-' + key.length * 8 + '-cbc', key, IV);
    // Java URLEncoder format, with exactly one PKCS7 padding pass.
    const encoded = new URLSearchParams({ data: text }).toString().slice(5);
    return Buffer.concat([cipher.update(encoded, 'utf8'), cipher.final()]).toString('hex').toUpperCase();
  }

  decrypt(hex) {
    if (typeof hex !== 'string' || !/^(?:[\da-f]{32})+$/i.test(hex)) {
      throw new AppError('بيانات Neoleap المشفرة غير صالحة', 400);
    }
    try {
      const key = this._key();
      const cipher = crypto.createDecipheriv('aes-' + key.length * 8 + '-cbc', key, IV);
      const encoded = Buffer.concat([cipher.update(Buffer.from(hex, 'hex')), cipher.final()]).toString('utf8');
      return decodeURIComponent(encoded.replace(/\+/g, ' '));
    } catch {
      throw new AppError('تعذر التحقق من بيانات Neoleap المشفرة', 400);
    }
  }

  _requestData(amount, trackId, action) {
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new AppError('مبلغ الطلب غير صالح', 400);
    return {
      id: config.tranportalId, password: config.tranportalPassword,
      action, amt: Number(amount).toFixed(2), currencyCode: '682', trackId: String(trackId),
    };
  }

  async _post(url, data) {
    if (!config.isConfigured()) throw new AppError('إعدادات Neoleap غير مكتملة.', 503);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify([data]), signal: controller.signal, redirect: 'error',
      });
      if (!response.ok) throw new AppError('بوابة Neoleap أعادت خطأ HTTP ' + response.status, 502);
      let result;
      try { result = single(parseJson(await response.text())); }
      catch { throw new AppError('استجابة غير صالحة من بوابة Neoleap', 502); }
      if (result.error || String(result.status) === '2') {
        // Do not echo gateway text: it may contain credentials or card data.
        const code = String(result.error || '').match(/^IPAY\d+$/)?.[0];
        throw new AppError('رفضت Neoleap طلب الدفع' + (code ? ' (' + code + ')' : '') + '. يرجى مراجعة إعدادات الربط.', 502);
      }
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[Neoleap] Gateway connection failed:', error.cause?.code || error.code || error.name);
      throw new AppError('تعذر الاتصال ببوابة Neoleap. يرجى المحاولة لاحقاً أو اختيار طريقة دفع أخرى.', 503);
    } finally { clearTimeout(timer); }
  }

  async createPaymentSession({ trackId, amount, responseUrl, errorUrl }) {
    if (!config.isConfigured()) throw new AppError('إعدادات Neoleap غير مكتملة.', 503);
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new AppError('مبلغ الطلب غير صالح', 400);

    // ─── Tranportal Pattern ───
    // الـ Tranportal لا يقبل server-to-server calls.
    // الـ backend يُشفّر البيانات ويُرسلها للـ Frontend،
    // والـ Frontend يُنشئ form تُرسل مباشرة لـ Neoleap عبر المتصفح.
    const plainParams = [
      `id=${config.tranportalId}`,
      `password=${config.tranportalPassword}`,
      `action=1`,
      `amt=${Number(amount).toFixed(3)}`,
      `currencyCode=682`,
      `langid=ar`,
      `trackId=${trackId}`,
      `responseURL=${responseUrl}`,
      `errorURL=${errorUrl}`,
      `udf1=`,
      `udf2=`,
      `udf3=`,
      `udf4=`,
      `udf5=`,
    ].join('&');

    const trandata = this.encrypt(plainParams);

    console.log(`[Neoleap] تم تشفير بيانات الدفع - TrackID: ${trackId}`);

    // يُرجع بيانات الـ form التي سيُرسلها الـ Frontend مباشرة لـ Neoleap
    return {
      tranportalUrl: config.tranportalUrl,
      trandata,
      trackId,
    };
  }


  parsePaymentResponse(response) {
    const envelope = single(typeof response === 'string' ? parseJson(response) : response);
    if (typeof envelope.trandata !== 'string' || !envelope.trandata) {
      throw new AppError('استجابة Neoleap المشفرة مفقودة', 400);
    }
    let data;
    try { data = single(parseJson(this.decrypt(envelope.trandata))); }
    catch { throw new AppError('تعذر التحقق من استجابة Neoleap', 400); }
    return {
      trackId: data.trackId == null ? undefined : String(data.trackId),
      paymentId: data.paymentId == null ? undefined : String(data.paymentId),
      result: data.result, tranId: data.transId == null ? undefined : String(data.transId),
      ref: data.ref == null ? undefined : String(data.ref), auth: data.authCode,
      responseCode: data.authRespCode, rawData: data,
    };
  }

  async queryTransaction(paymentId, trackId, amount) {
    const plain = [{ ...this._requestData(amount, trackId, '8'),
      udf5: paymentId ? 'PaymentID' : 'TrackID', transId: String(paymentId || trackId) }];
    const response = await this._post(config.tranportalUrl, {
      id: config.tranportalId, trandata: this.encrypt(JSON.stringify(plain)),
    });
    return this.parsePaymentResponse(response);
  }

  isPaymentSuccessful(parsed) {
    // APPROVED only authorizes funds; it does not complete this purchase flow.
    return parsed.result === 'CAPTURED';
  }

  verifyAmount(parsed, expectedAmount) {
    const amount = parsed.rawData?.amt;
    return amount !== undefined && amount !== null && String(amount).trim() !== '' &&
      Number.isFinite(Number(amount)) && Number(amount) > 0 &&
      Math.abs(Number(amount) - Number(expectedAmount)) < 0.000001;
  }

  matchesPayment(parsed, payment) {
    return parsed.trackId === payment.merchantReference &&
      !!parsed.paymentId && (!payment.neoleapPaymentId || parsed.paymentId === payment.neoleapPaymentId) &&
      this.verifyAmount(parsed, payment.amount) &&
      (parsed.rawData.currencyCode == null || String(parsed.rawData.currencyCode) === '682');
  }

  sanitizeResponse(raw) {
    const allowed = ['paymentId', 'trackId', 'result', 'transId', 'ref', 'date', 'amt', 'currencyCode', 'authRespCode', 'authCode', 'actionCode'];
    return Object.fromEntries(allowed.filter(k => raw?.[k] != null && ['string', 'number'].includes(typeof raw[k])).map(k => [k, raw[k]]));
  }

  extractSafeCardData(parsed) {
    const data = {};
    const card = parsed.rawData?.card;
    if (typeof card === 'string' && /[X*]/i.test(card) && /^[\dX* -]+$/i.test(card) && card.replace(/\D/g, '').length <= 10) data.maskedCard = card;
    if (['Visa', 'MasterCard', 'Mada'].includes(parsed.rawData?.cardType)) data.cardBrand = parsed.rawData.cardType;
    return data;
  }

  generateMerchantReference() {
    // Numeric trackId, retained as a string everywhere.
    return String(Date.now()) + crypto.randomInt(100000, 1000000);
  }
}

module.exports = new NeoleapService();

