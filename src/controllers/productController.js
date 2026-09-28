const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const slugify = require('slugify');

// GET /api/products - with filters, pagination, sort
exports.getProducts = asyncHandler(async (req, res) => {
  const { category, minPrice, maxPrice, sort, page = 1, limit = 100 } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  let sortOption = { createdAt: -1 };
  if (sort === 'price_asc') sortOption = { price: 1 };
  if (sort === 'price_desc') sortOption = { price: -1 };
  if (sort === 'newest') sortOption = { createdAt: -1 };
  if (sort === 'best_seller') sortOption = { isBestSeller: -1 };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sortOption).skip(skip).limit(Number(limit)).lean(),
    Product.countDocuments(filter)
  ]);

  res.json({
    success: true,
    message: 'تم جلب المنتجات',
    data: products,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/products/featured
exports.getFeatured = asyncHandler(async (req, res) => {
  const products = await Product.find({ isFeatured: true }).limit(10).lean();
  res.json({ success: true, message: 'المنتجات المميزة', data: products });
});

// GET /api/products/search?q=
exports.searchProducts = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) throw new AppError('يرجى إدخال كلمة البحث', 400);

  const products = await Product.find({ $text: { $search: q } }).limit(20).lean();
  res.json({ success: true, message: 'نتائج البحث', data: products });
});

// GET /api/products/:slug
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).lean();
  if (!product) throw new AppError('المنتج غير موجود', 404);
  res.json({ success: true, message: 'تم جلب المنتج', data: product });
});

// GET /api/products/:slug/related
exports.getRelated = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug }).lean();
  if (!product) throw new AppError('المنتج غير موجود', 404);

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id }
  }).limit(6).lean();

  res.json({ success: true, message: 'منتجات مشابهة', data: related });
});

// POST /api/products (admin)
exports.createProduct = asyncHandler(async (req, res) => {
  if (req.files && req.files.length > 0) {
    req.body.images = req.files.map(f => `/uploads/${f.filename}`);
  }
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, message: 'تم إضافة المنتج', data: product });
});

// PUT /api/products/:id (admin)
exports.updateProduct = asyncHandler(async (req, res) => {
  if (req.files && req.files.length > 0) {
    req.body.images = req.files.map(f => `/uploads/${f.filename}`);
  }
  if (req.body.name) {
    req.body.slug = slugify(req.body.name, { lower: true, strict: true });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) throw new AppError('المنتج غير موجود', 404);
  res.json({ success: true, message: 'تم تحديث المنتج', data: product });
});

// DELETE /api/products/:id (admin)
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('المنتج غير موجود', 404);
  res.json({ success: true, message: 'تم حذف المنتج', data: null });
});
