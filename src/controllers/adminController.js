const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/admin/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('يرجى إدخال البريد وكلمة المرور', 400);

  const admin = await Admin.findOne({ email });
  if (!admin || !(await admin.comparePassword(password))) {
    throw new AppError('بيانات الدخول غير صحيحة', 401);
  }

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

  res.json({ success: true, message: 'تم تسجيل الدخول', data: { token } });
});
