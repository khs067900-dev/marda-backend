/**
 * Neoleap Payment Gateway Configuration
 * ─────────────────────────────────────
 * يقرأ جميع الإعدادات من environment variables.
 * يُظهر خطأ واضحاً عند بدء التشغيل إذا كان متغير أساسي ناقصاً.
 */

const REQUIRED_VARS = [
  'NEOLEAP_TERMINAL_ID',
  'NEOLEAP_MERCHANT_ID',
  'NEOLEAP_TRANPORTAL_ID',
  'NEOLEAP_TRANPORTAL_PASSWORD',
  'NEOLEAP_RESOURCE_KEY',
  'NEOLEAP_HOSTED_URL',
  'NEOLEAP_TRANPORTAL_URL',
];

/**
 * يتحقق من وجود متغيرات البيئة الأساسية.
 * يُستدعى عند بدء تشغيل الخادم.
 */
function validateNeoleapConfig() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(
      `[Neoleap Config Error] المتغيرات التالية مطلوبة ولكنها غير موجودة:\n  ${missing.join('\n  ')}`
    );
    // لا نوقف الخادم لأن payment اختياري - لكن نسجل الخطأ بوضوح
  }
}

/**
 * كائن الإعدادات الرئيسي
 */
const neoleapConfig = {
  environment: process.env.NEOLEAP_ENV || 'test',

  // Terminal & Merchant Info
  terminalId: process.env.NEOLEAP_TERMINAL_ID,
  merchantId: process.env.NEOLEAP_MERCHANT_ID,
  terminalAlias: process.env.NEOLEAP_TERMINAL_ALIAS,

  // Integration Credentials (سرية - لا تُعاد للـ frontend أبداً)
  tranportalId: process.env.NEOLEAP_TRANPORTAL_ID,
  tranportalPassword: process.env.NEOLEAP_TRANPORTAL_PASSWORD,
  resourceKey: process.env.NEOLEAP_RESOURCE_KEY,

  // Gateway URLs
  hostedUrl: process.env.NEOLEAP_HOSTED_URL,
  tranportalUrl: process.env.NEOLEAP_TRANPORTAL_URL,

  // Callback URLs
  successUrl: process.env.NEOLEAP_SUCCESS_URL,
  failureUrl: process.env.NEOLEAP_FAILURE_URL,
  cancelUrl: process.env.NEOLEAP_CANCEL_URL,
  callbackUrl: process.env.NEOLEAP_CALLBACK_URL,

  // The REST request uses currencyCode "682"; local records use "SAR".
  currency: 'SAR',

  // Helpers
  isTestMode() {
    return this.environment === 'test';
  },

  isConfigured() {
    return REQUIRED_VARS.every((v) => !!process.env[v]);
  },
};

module.exports = { neoleapConfig, validateNeoleapConfig };
