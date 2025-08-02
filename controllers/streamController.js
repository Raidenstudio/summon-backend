const Stream = require("../models/Session");
const { AccessToken } = require("livekit-server-sdk");
const { v4: uuidv4 } = require("uuid");
const { RoomServiceClient } = require('livekit-server-sdk');

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL.replace('wss://', 'https://'),
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_SECRET
);

const createStream = async (req, res) => {
  try {
    const { identity, title } = req.body;
    
    if (!identity || !title) {
      return res.status(400).json({ error: "Identity and title are required" });
    }

    const room = `room-${uuidv4()}`;
    
    await roomService.createRoom({
      name: room,
      emptyTimeout: 10 * 60, 
      maxParticipants: 100,
    });

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_SECRET, {
      identity,
    });
    at.addGrant({ 
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateMetadata: true
    });
    const token = at.toJwt();

    // Save to DB
    const stream = await Stream.create({
      title,
      room,
      hostIdentity: identity,
      type: "livekit",
      isLive: true,
      startedAt: new Date()
    });

    return res.json({
      success: true,
      streamId: stream._id,
      token,
      room,
      title,
      livekitURL: process.env.LIVEKIT_URL
    });

  } catch (err) {
    console.error("Create Stream Error:", err);
    return res.status(500).json({ 
      success: false,
      error: "Failed to create stream",
      details: err.message 
    });
  }
};

const getStreamByRoom = async (req, res) => {
  try {
    const { roomName } = req.params;
    const stream = await Stream.findOne({ 
      $or: [
        { title: roomName },
        { room: roomName }
      ],
      isLive: true 
    });

    if (!stream) {
      return res.status(404).json({ 
        success: false,
        error: "Stream not found or not live" 
      });
    }

    const roomInfo = await roomService.listRooms([stream.room]);
    const participantCount = roomInfo.length > 0 ? roomInfo[0].numParticipants : 0;

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_SECRET, {
      identity: `viewer-${uuidv4()}`,
    });
    at.addGrant({ 
      roomJoin: true,
      room: stream.room,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false
    });
    const token = at.toJwt();

    return res.json({
      success: true,
      stream: {
        id: stream._id,
        title: stream.title,
        room: stream.room,
        isLive: stream.isLive,
        startedAt: stream.startedAt,
        participantCount,
        hostIdentity: stream.hostIdentity
      },
      token,
      livekitURL: process.env.LIVEKIT_URL
    });

  } catch (err) {
    console.error("Get Stream Error:", err);
    return res.status(500).json({ 
      success: false,
      error: "Failed to get stream",
      details: err.message 
    });
  }
};

const stopStream = async (req, res) => {
  try {
    const { streamId } = req.body;
    if (!streamId) {
      return res.status(400).json({ error: "Stream ID is required" });
    }

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: "Stream not found" });
    }

    await roomService.deleteRoom(stream.room);

    stream.isLive = false;
    stream.endedAt = new Date();
    await stream.save();

    return res.json({ 
      success: true,
      message: "Stream stopped successfully" 
    });

  } catch (err) {
    console.error("Stop Stream Error:", err);
    return res.status(500).json({ 
      success: false,
      error: "Failed to stop stream",
      details: err.message 
    });
  }
};

const getAllStreams = async (req, res) => {
  try {
    const streams = await Stream.find({ isLive: true });
    res.json({ success: true, streams });
  } catch (err) {
    console.error("Get All Streams Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to get streams",
      details: err.message 
    });
  }
};

module.exports = {
  createStream,
  getStreamByRoom,
  stopStream,
  getAllStreams
};