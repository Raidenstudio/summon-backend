const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Message = require('./models/Message');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'https://summon-backend-tf0z.onrender.com',
      'https://summon-ui.netlify.app',     // if frontend is on Netlify
      'http://localhost:5173'
    ],
    methods: ['GET','POST'],
    credentials: true
  }
});


const MONGO_URI = 'mongodb+srv://summon:summon@summon.xfhyrzj.mongodb.net/summon?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

io.on('connection', async (socket) => {
  console.log('✅ User connected:', socket.id);

  try {
    const history = await Message.find().sort({ time: 1 });
    socket.emit('chat_history', history);
  } catch (err) {
    console.error("Error fetching chat history:", err);
  }

  socket.on('send_message', async (data) => {
    const msg = new Message({
      text: data.text,
      time: new Date(data.time),
      sender: data.sender,
    });

    try {
      await msg.save();
      io.emit('receive_message', msg);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('🚀 Server running on http://localhost:3001');
});
