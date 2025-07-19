require("dotenv").config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const Message = require('./models/Message');
const contractRoutes = require('./routes/contractRoutes');

const app = express();

// ✅ Read SSL certificates
const options = {
  key: fs.readFileSync(path.join(__dirname, 'cert/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert/cert.pem')),
};

// ✅ Create HTTPS server
const server = https.createServer(options, app);

// const server = http.createServer(app);

// ✅ CORS setup
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://summon-ui.netlify.app',
      'http://localhost:5173',
      'https://summon.raiden.in'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.use(express.json()); // Parse JSON

// ✅ MongoDB connection
const MONGO_URI = 'mongodb+srv://summon:summon@summon.xfhyrzj.mongodb.net/summon';
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

mongoose.connection.on('error', err => {
  console.error('❌ MongoDB Runtime Error:', err);
});

// ✅ Static file handling
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ API Routes
app.use("/api", contractRoutes);

// ✅ Health check
app.get('/health', async (req, res) => {
  const count = await Message.countDocuments();
  res.json({ ok: true, count });
});

// ✅ socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      'https://summon-ui.netlify.app',
      'http://localhost:5173',
      'https://summon.raiden.in'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
});

global.io = io;

io.on('connection', async (socket) => {
  console.log('✅ User connected:', socket.id);

  const history = await Message.find().sort({ time: 1 });
  socket.emit('chat_history', history);

  socket.on('send_message', async (data) => {
    const msg = new Message({
      text: data.text,
      time: new Date(data.time),
      sender: data.sender
    });
    await msg.save();

    io.emit('receive_message', msg);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// ✅ Start HTTPS server
const PORT = 2083;
server.listen(PORT, () => {
  console.log(`🚀 HTTPS Server running on https://localhost:${PORT}`);
});
