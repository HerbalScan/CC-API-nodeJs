// routes.js
const express = require('express');
const router = express.Router();
const { registerHandler, loginHandler, logoutHandler,getPlantById} = require('./handler');
const { verifyToken, verifyTokenExpiry } = require('./handler');

// Register route
router.post('/register', registerHandler);

// Login route
router.post('/login', loginHandler);

// Logout route
router.post('/logout', logoutHandler);

router.get('/Tanaman/:id', verifyToken, verifyTokenExpiry,getPlantById,(req, res) => {
  res.json({ message: 'Access granted to protected route' });
});


module.exports = router;
