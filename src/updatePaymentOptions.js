require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const products = await Product.find({});
    let updated = 0;

    for (const product of products) {
      if (!product.description) continue;

      const oldPayment = /خيارات الدفع:\n(- .+\n?)*/g;
      if (oldPayment.test(product.description)) {
        product.description = product.description.replace(oldPayment, 'خيارات الدفع:\n- الدفع عند الاستلام\n');
        await product.save();
        updated++;
        console.log(`✓ Updated: ${product.name}`);
      }
    }

    console.log(`\nDone! Updated ${updated} of ${products.length} products.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

run();
