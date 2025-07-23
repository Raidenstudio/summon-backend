const Stream = require("../models/Session");
const { AccessToken } = require("livekit-server-sdk");
const { v4: uuidv4 } = require("uuid");

// Create a new stream
exports.createStream = async (req, res) => {
  try {
    const { room, identity, title } = req.body;

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_SECRET, {
      identity,
    });
    at.addGrant({ roomJoin: true, room });
    const token = await at.toJwt();

    // Save to DB
    const stream = await Stream.create({
      title,
      room,
      type: "livekit",
      isLive: true,
    });

    return res.json({
      _id: stream._id,
      token,
      room,
      identity,
      title,
      livekitURL: process.env.LIVEKIT_URL,
    });
  } catch (err) {
    console.error("Create Stream Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get all live streams
exports.getAllStreams = async (req, res) => {
  try {
    const activeStreams = await Stream.find({ isLive: true });

    const data = await Promise.all(
      activeStreams.map((s) => {
        const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_SECRET, {
          identity: "viewer-" + uuidv4(),
        });
        at.addGrant({ roomJoin: true, room: s.room });
        return at.toJwt().then((token) => ({
          _id: s._id,
          title: s.title,
          room: s.room,
          token,
          livekitURL: process.env.LIVEKIT_URL,
        }));
      })
    );

    return res.json(data);
  } catch (err) {
    console.error("Get Streams Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get stream by room title
exports.getStreamByRoom = async (req, res) => {
  try {
    const { roomName } = req.params;
    const stream = await Stream.findOne({ title: roomName, isLive: true });

    if (!stream) {
      return res.status(404).json({ message: "Stream not found" });
    }

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_SECRET, {
      identity: "viewer-" + uuidv4(),
    });
    at.addGrant({ roomJoin: true, room: stream.room });
    const token = await at.toJwt();

    return res.json({
      _id: stream._id,
      title: stream.title,
      room: stream.room,
      token,
      livekitURL: process.env.LIVEKIT_URL,
    });
  } catch (err) {
    console.error("Get Stream By Room Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Stop a stream by stream ID
exports.stopStream = async (req, res) => {
  const { streamId } = req.body;

  try {
    const stream = await Stream.findById(streamId);
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    stream.isLive = false;
    await stream.save();

    return res.json({ message: "Stream stopped successfully" });
  } catch (err) {
    console.error("Stop Stream Error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};