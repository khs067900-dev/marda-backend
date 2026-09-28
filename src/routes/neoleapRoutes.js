const router = require('express').Router();
const {
  createNeoleapSession,
  verifyNeoleapPayment,
  neoleapCallback,
  getNeoleapPaymentStatus,
} = require('../controllers/neoleapController');

// ─────────────────────────────────────────────────────────
// Neoleap Payment Routes
//
// مضمّنة داخل /api/orders/:id
// الـ callback مستقل تحت /api/orders
// ─────────────────────────────────────────────────────────

// POST /api/orders/neoleap-callback - callback من Neoleap (بدون auth)
// يجب تسجيل هذا الـ URL في لوحة Neoleap
router.post('/neoleap-callback', neoleapCallback);

// POST /api/orders/:id/neoleap-session - إنشاء جلسة دفع
router.post('/:id/neoleap-session', createNeoleapSession);

// GET /api/orders/:id/verify-neoleap-payment - التحقق من الدفع بعد العودة
router.get('/:id/verify-neoleap-payment', verifyNeoleapPayment);

// GET /api/orders/:id/neoleap-status - حالة الدفع الحالية
router.get('/:id/neoleap-status', getNeoleapPaymentStatus);

module.exports = router;
