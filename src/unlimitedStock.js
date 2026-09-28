require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await mongoose.connection.collection('products').updateMany(
    {},
    { $set: { stock: 10000, quantity: 10000 } }
  );
  console.log(`✅ تم تحديث ${result.modifiedCount} منتج`);
  await mongoose.disconnect();
}

run().catch(console.error);
