require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const { validateNeoleapConfig } = require('./config/neoleap.config');

const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const neoleapRoutes = require('./routes/neoleapRoutes');

// Connect to DB
connectDB();

// Validate payment gateway configs
validateNeoleapConfig();


const app = express();

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(xss());
app.use(morgan('dev'));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { success: false, message: 'طلبات كثيرة. حاول لاحقاً' } }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Payment-specific rate limiter (أكثر تقييداً)
const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 محاولة كل 15 دقيقة
  message: { success: false, message: 'محاولات دفع كثيرة جداً. حاول بعد 15 دقيقة.' },
  skipFailedRequests: false,
});

// Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/orders', paymentRateLimiter, neoleapRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);


// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'مؤسسة مدار الأجهزة الإلكترونية - API' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'المسار غير موجود' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
