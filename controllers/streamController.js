const Stream = require('../models/Session');
const { AccessToken } = require('livekit-server-sdk');
const { RoomServiceClient } = require('livekit-server-sdk');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL.replace('wss://', 'https://'),
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_SECRET
);

exports.createStream = async (req, res) => {
  try {
    const { identity, title, coinId } = req.body;

    if (!identity || !coinId) {
      return res.status(400).json({ 
        success: false,
        error: 'Identity and coinId are required' 
      });
    }

    const roomName = `coin-${coinId}-${Date.now()}`;

    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 10 * 60,
        maxParticipants: 100,
      });
    } catch (roomError) {
      console.error('LiveKit room creation failed:', roomError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create LiveKit room',
        details: roomError.message
      });
    }

    const token = await generateLiveKitToken(identity, roomName);

    const stream = new Stream({
      title: title || `Stream for ${coinId}`,
      room: roomName,
      hostIdentity: identity,
      coin: coinId,
      token, 
      isLive: true,
    });
    
    await stream.save();

    res.json({
      success: true,
      streamId: stream._id,
      token,
      room: roomName,
      title: stream.title,
      coinId,
      livekitURL: process.env.LIVEKIT_URL,
    });

  } catch (error) {
    console.error('Stream creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create stream',
      details: error.message
    });
  }
};

async function generateLiveKitToken(identity, roomName) {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_SECRET,
    { identity }
  );
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });
  return at.toJwt();
}
exports.getStreamByCoin = async (req, res) => {
  try {
    const { coinId } = req.params;
    
    // Basic validation
    if (!coinId) {
      return res.status(400).json({ 
        success: false,
        error: 'Coin ID is required' 
      });
    }

    // Find stream in database
    const stream = await Stream.findOne({ 
      coin: coinId, 
      isLive: true 
    }).sort({ startedAt: -1 });

    if (!stream) {
      return res.status(404).json({ 
        success: false,
        error: 'No active stream found for this coin' 
      });
    }

    // Generate viewer token
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_SECRET, {
      identity: `viewer-${uuidv4()}`,
    });
    at.addGrant({
      roomJoin: true,
      room: stream.room,
      canSubscribe: true,
      canPublish: false,
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
        hostIdentity: stream.hostIdentity,
        coin: stream.coin,
      },
      token,
      livekitURL: process.env.LIVEKIT_URL,
    });

  } catch (error) {
    console.error('Error in getStreamByCoin:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
};

exports.stopStream = async (req, res) => {
  try {
    const { streamId } = req.body;

    if (!streamId) {
      return res.status(400).json({ error: 'Stream ID is required' });
    }

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    await roomService.deleteRoom(stream.room);

    stream.isLive = false;
    stream.endedAt = new Date();
    await stream.save();

    res.json({ 
      success: true,
      message: 'Stream stopped successfully',
      stream,
    });
  } catch (error) {
    console.error('Stop stream error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to stop stream',
      details: error.message 
    });
  }
};

exports.getActiveStreams = async (req, res) => {
  try {
    const streams = await Stream.find({ isLive: true })
      .sort({ startedAt: -1 })
      .lean();

    const roomNames = streams.map(s => s.room);
    const roomInfos = await roomService.listRooms(roomNames);
    
    const streamsWithData = streams.map(stream => {
      const roomInfo = roomInfos.find(r => r.name === stream.room);
      return {
        ...stream,
        participantCount: roomInfo?.numParticipants || 0,
        hostIdentity: stream.hostIdentity || 'Anonymous',
      };
    });

    res.json({ 
      success: true,
      streams: streamsWithData 
    });
  } catch (error) {
    console.error('Error getting active streams:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get active streams',
      details: error.message 
    });
  }
};

exports.getStreamByRoom = async (req, res) => {
  try {
    const { room } = req.params;
    console.debug('[DEBUG] Incoming room param:', room);
    console.debug('[DEBUG] Mongoose DB connected:', mongoose.connection.readyState === 1);

    const stream = await Stream.findOne({ room });
    console.debug('[DEBUG] Stream found in DB:', stream);

    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Just return LiveKit URL and room name — no token
    const livekitUrl = process.env.LIVEKIT_URL;

    return res.json({
      url: livekitUrl,
      room,
      stream,
    });

  } catch (err) {
    console.error('[FATAL] getStreamByRoom error:', {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Failed to fetch stream info' });
  }
};
