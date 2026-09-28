const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: [true, 'اسم العميل مطلوب'], trim: true },
  phone: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    validate: {
      validator: (v) => /^(05|5)\d{8}$/.test(v),
      message: 'رقم الهاتف غير صحيح. يجب أن يبدأ بـ 05 ويتكون من 10 أرقام'
    }
  },
  address: { type: String, required: [true, 'العنوان مطلوب'], trim: true },
  notes: { type: String, trim: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],
  totalPrice: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'tap', 'noon_payments', 'neoleap'], default: 'cash_on_delivery' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled'], default: 'pending' },
  tapChargeId: { type: String },
  noonOrderId: { type: String },
  noonReference: { type: String },
  stockRestored: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
