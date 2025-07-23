const express = require("express");
const router = express.Router();
const streamController = require("../controllers/streamController");

router.post("/create-stream", streamController.createStream);
router.get("/active-streams", streamController.getAllStreams); 
router.get("/stream/:roomName", streamController.getStreamByRoom); 
router.post("/stop-stream", streamController.stopStream);

module.exports = router;
