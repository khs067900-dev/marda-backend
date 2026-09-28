require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const result = await Product.updateMany({}, { $set: { stock: 9999 } });
    console.log(`✅ تم تحديث الستوك لـ ${result.modifiedCount} منتج إلى 9999`);

    process.exit(0);
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
};

run();
