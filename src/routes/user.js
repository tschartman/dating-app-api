const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');
const authMiddleware = require('../middlewares/auth');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/verify-token', userController.verifyToken);

module.exports = router;