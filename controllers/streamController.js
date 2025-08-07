const Stream = require('../models/Session');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { v4: uuidv4 } = require('uuid');

// Configuration - in production, use environment variables
const LIVEKIT_API_KEY = "APIhbATzs8YTjKX";
const LIVEKIT_SECRET = "SAZYvn5l77y2ZYLwnqaex89ghvzqPTpWR8lN9az1yQB";
const LIVEKIT_URL = "wss://summon-le0pwq9w.livekit.cloud";

const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_SECRET);

// Verify LiveKit connection on startup
(async () => {
  try {
    const rooms = await roomService.listRooms();
    console.log('✅ LiveKit connected. Active rooms:', rooms.length);
  } catch (err) {
    console.error('❌ LiveKit connection failed:', err.message);
    process.exit(1);
  }
})();

// Generate JWT token with proper permissions
const generateLiveKitToken = (identity, roomName, isPublisher = false) => {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_SECRET, {
    identity,
    ttl: 21600, // 6 hours in seconds
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: isPublisher,
    canSubscribe: true,
    canPublishData: isPublisher,
    canPublishSources: isPublisher ? ['camera', 'microphone', 'screen_share'] : [],
    hidden: false,
    recorder: false,
  });

  return at.toJwt();
};


// Create a new stream
exports.createStream = async (req, res) => {
  try {
    const { title, coinId, hostAddress } = req.body;

    if (!coinId || !hostAddress) {
      return res.status(400).json({
        success: false,
        error: 'Coin ID and wallet address are required'
      });
    }

    const existingStream = await Stream.findOne({
      coin: coinId,
      isLive: true,
      hostAddress
    });

    if (existingStream) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active stream for this coin'
      });
    }

    const roomName = `coin-${coinId}-${Date.now()}`;
    const identity = `host-${hostAddress}`;

    try {
      await roomService.createRoom({
        name: roomName,
        emptyTimeout: 600,
        maxParticipants: 100,
        turnTimeout: 30,
        enableDynacast: true,
        enableRemoteUnmute: true,
        clientTimeout: 30000,
      });
    } catch (roomError) {
      console.error('Room creation failed:', roomError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create streaming room',
        details: roomError.message
      });
    }

    const token = generateLiveKitToken(identity, roomName, true);

    const stream = await Stream.create({
      title: title || `Stream for ${coinId}`,
      room: roomName,
      hostIdentity: identity,
      hostAddress,
      coin: coinId,
      token,
      isLive: true,
      startedAt: new Date(),
    });

    return res.json({
      success: true,
      streamId: stream._id,
      token,
      room: roomName,
      title: stream.title,
      coinId,
      livekitURL: LIVEKIT_URL,
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

// Get stream by coin ID
exports.getStreamByCoin = async (req, res) => {
  try {
    const { coinId } = req.params;

    if (!coinId) {
      return res.status(400).json({
        success: false,
        error: 'Coin ID is required'
      });
    }

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

    // Generate viewer token (no publishing permissions)
    const identity = `viewer-${uuidv4()}`;
    const token = generateLiveKitToken(identity, stream.room, true);

    return res.json({
      success: true,
      stream: {
        id: stream._id,
        title: stream.title,
        room: stream.room,
        isLive: stream.isLive,
        startedAt: stream.startedAt,
        hostIdentity: stream.hostIdentity,
        hostAddress: stream.hostAddress,
        coin: stream.coin,
      },
      token,
      livekitURL: LIVEKIT_URL,
    });

  } catch (error) {
    console.error('getStreamByCoin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stream',
      details: error.message
    });
  }
};

// Stop a stream
exports.stopStream = async (req, res) => {
  try {
    const { streamId, hostAddress } = req.body;

    if (!streamId || !hostAddress) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID and host address are required'
      });
    }

    const stream = await Stream.findById(streamId);
    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Verify stream ownership
    if (stream.hostAddress !== hostAddress) {
      return res.status(403).json({
        success: false,
        error: 'Only the stream owner can stop it'
      });
    }

    // Delete LiveKit room
    try {
      await roomService.deleteRoom(stream.room);
    } catch (deleteError) {
      console.warn('Room deletion warning:', deleteError.message);
    }

    // Update stream status
    stream.isLive = false;
    stream.endedAt = new Date();
    await stream.save();

    return res.json({
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

// Get all active streams
exports.getActiveStreams = async (req, res) => {
  try {
    const streams = await Stream.find({ isLive: true })
      .sort({ startedAt: -1 })
      .lean();

    const roomInfos = await roomService.listRooms();

    // Enrich stream data with participant counts
    const enrichedStreams = streams.map(stream => {
      const roomInfo = roomInfos.find(r => r.name === stream.room);
      return {
        ...stream,
        participantCount: roomInfo?.numParticipants || 0,
      };
    });

    return res.json({
      success: true,
      streams: enrichedStreams
    });

  } catch (error) {
    console.error('Get active streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active streams',
      details: error.message
    });
  }
};

// Get stream by room name
exports.getStreamByRoom = async (req, res) => {
  try {
    const { room } = req.params;

    const stream = await Stream.findOne({ room });
    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Generate viewer token
    const identity = `viewer-${uuidv4()}`;
    const token = generateLiveKitToken(identity, room, true);

    return res.json({
      success: true,
      stream,
      token,
      livekitURL: LIVEKIT_URL,
    });

  } catch (err) {
    console.error('getStreamByRoom error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stream',
      details: err.message
    });
  }
};