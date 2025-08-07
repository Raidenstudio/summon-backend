const express = require('express');
const router = express.Router();
const streamController = require('../controllers/streamController');

// Create a new stream
router.post('/create', streamController.createStream);

// Get stream by coin ID
router.get('/coin/:coinId', streamController.getStreamByCoin);
// Stop a stream
router.post('/stop', streamController.stopStream);

// Get all active streams
router.get('/active', streamController.getActiveStreams);

router.get('/:room', streamController.getStreamByRoom);

module.exports = router;