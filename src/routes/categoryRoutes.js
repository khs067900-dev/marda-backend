const router = require('express').Router();
const protect = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { getCategories, createCategory } = require('../controllers/categoryController');

router.get('/', getCategories);
router.post('/', protect, upload.single('image'), createCategory);

module.exports = router;
