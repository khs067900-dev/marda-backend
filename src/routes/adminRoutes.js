const router = require('express').Router();
const { login } = require('../controllers/adminController');

router.post('/login', login);

module.exports = router;
