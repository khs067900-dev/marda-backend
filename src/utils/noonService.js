const crypto = require('crypto');

class NoonPaymentsBackendService {
  constructor() {
    this.mode = process.env.NOON_MODE || 'test';
    this.businessId = process.env.NOON_BUSINESS_ID || 'burj_storer';
    this.appId = process.env.NOON_APP_ID || 'ALASAD';
    this.appKey = process.env.NOON_APP_KEY || '3fc9da60299649b4a37d4edab196799a';
    this.webhookKey = process.env.NOON_WEBHOOK_KEY || '';
    this.baseUrl =
      process.env.NOON_BASE_URL ||
      (this.mode === 'live'
        ? 'https://api.sa.noonpayments.com'
        : 'https://api-test.sa.noonpayments.com');
  }

  getAuthHeader() {
    const rawCredentials = `${this.businessId}.${this.appId}:${this.appKey}`;
    const base64Credentials = Buffer.from(rawCredentials).toString('base64');
    const scheme = this.mode === 'live' ? 'Key_Live' : 'Key_Test';
    return `${scheme} ${base64Credentials}`;
  }

  async initiatePayment({ orderId, amount, name, returnUrl, customerName, customerPhone }) {
    const url = `${this.baseUrl}/payment/v1/order`;
    const sanitizedReference = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);

    const fullName = (customerName || 'عميل').trim();
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || 'عميل';
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const contact = { firstName };
    if (lastName) contact.lastName = lastName;
    if (customerPhone) contact.phone = customerPhone;

    const payload = {
      apiOperation: 'INITIATE',
      order: {
        amount: Number(Number(amount).toFixed(2)),
        currency: 'SAR',
        name: name || `Order ${orderId}`,
        reference: sanitizedReference,
        category: 'pay',
        channel: 'web'
      },
      configuration: {
        paymentAction: 'SALE',
        returnUrl,
        locale: 'ar'
      },
      billing: {
        contact
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader()
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.resultCode !== 0 || !data.result?.checkoutData?.postUrl) {
      throw new Error(data.message || data.classDescription || `noon payments failed (Code ${data.resultCode})`);
    }

    return {
      noonOrderId: data.result.order.id,
      postUrl: data.result.checkoutData.postUrl,
      jsUrl: data.result.checkoutData.jsUrl,
      raw: data
    };
  }

  async getOrder(noonOrderId) {
    const url = `${this.baseUrl}/payment/v1/order/${encodeURIComponent(noonOrderId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.getAuthHeader()
      }
    });
    return await response.json();
  }

  mapStatus(noonStatus) {
    switch (noonStatus) {
      case 'PAID':
      case 'CAPTURED':
        return { orderStatus: 'confirmed', paymentStatus: 'paid' };
      case 'AUTHORIZED':
      case 'AUTHENTICATED':
      case 'INITIATED':
      case 'PENDING':
        return { orderStatus: 'pending', paymentStatus: 'pending' };
      case 'FAILED':
      case 'REVERSED':
        return { orderStatus: 'pending', paymentStatus: 'failed' };
      case 'EXPIRED':
      case 'CANCELLED':
        return { orderStatus: 'cancelled', paymentStatus: 'failed' };
      default:
        return { orderStatus: 'pending', paymentStatus: 'pending' };
    }
  }

  verifyWebhook(rawBody, headers) {
    if (!this.webhookKey) return true; // allow if not set in dev
    const version = headers['np-webhook-version'];

    if (version === '2') {
      const parts = rawBody.split('.');
      if (parts.length !== 3) return false;
      const [headerB64, payloadB64, sigB64] = parts;
      const expected = crypto.createHmac('sha256', this.webhookKey).update(`${headerB64}.${payloadB64}`).digest('base64url');
      const sigBuf = Buffer.from(sigB64);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } else {
      const provided = headers['x-signature'] || headers['np-signature'];
      if (!provided) return false;
      const expected = crypto.createHmac('sha256', this.webhookKey).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(provided);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    }
  }
}

module.exports = new NoonPaymentsBackendService();
