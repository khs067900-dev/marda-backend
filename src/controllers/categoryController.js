const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/categories
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().lean();
  res.json({ success: true, message: 'تم جلب التصنيفات', data: categories });
});

// POST /api/categories (admin)
exports.createCategory = asyncHandler(async (req, res) => {
  if (req.file) req.body.image = `/uploads/${req.file.filename}`;
  const category = await Category.create(req.body);
  res.status(201).json({ success: true, message: 'تم إضافة التصنيف', data: category });
});
