const router = require('express').Router();
const protect = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getFeatured, searchProducts, getRelated
} = require('../controllers/productController');

router.get('/search', searchProducts);
router.get('/featured', getFeatured);
router.get('/', getProducts);
router.get('/:slug', getProduct);
router.get('/:slug/related', getRelated);

router.post('/', protect, upload.array('images', 5), createProduct);
router.put('/:id', protect, upload.array('images', 5), updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;
