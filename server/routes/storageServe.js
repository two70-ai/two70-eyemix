const express = require('express');
const path = require('path');

const router = express.Router();
const storageDir = path.resolve(__dirname, '../../data/storage');

// Serve files from ./data/storage/ at /api/storage/
router.use('/', express.static(storageDir));

module.exports = router;
