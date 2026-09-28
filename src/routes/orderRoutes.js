const router = require('express').Router();
const protect = require('../middlewares/auth');
const { 
  createOrder, 
  createTabbySession, 
  verifyPayment, 
  createNoonSession,
  verifyNoonPayment,
  noonWebhook,
  getOrderPublic, 
  getOrders, 
  getOrder, 
  updateOrderStatus,
  updatePaymentStatus 
} = require('../controllers/orderController');

router.post('/', createOrder);
router.post('/noon-webhook', noonWebhook);
router.post('/:id/tap-session', createTabbySession);
router.get('/:id/verify-payment', verifyPayment);
router.post('/:id/noon-session', createNoonSession);
router.get('/:id/verify-noon-payment', verifyNoonPayment);
router.patch('/:id/status', updatePaymentStatus);
router.patch('/:id', updatePaymentStatus);
router.get('/:id/public', getOrderPublic);
router.get('/', protect, getOrders);
router.get('/:id', protect, getOrder);
router.put('/:id/status', protect, updateOrderStatus);

module.exports = router;
