const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // or set specifically to 'https://summon-ui.netlify.app'
    methods: ['GET', 'POST'],
  }
});



const messagesFilePath = path.join(__dirname, 'messages.json');

// Load messages from file or initialize empty array
let messages = [];
if (fs.existsSync(messagesFilePath)) {
  try {
    messages = JSON.parse(fs.readFileSync(messagesFilePath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read messages.json:', err);
    messages = [];
  }
}

// Save messages to file
function saveMessagesToFile() {
  fs.writeFileSync(messagesFilePath, JSON.stringify(messages, null, 2));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send chat history
  socket.emit('chat_history', messages);

  // Handle new messages
  socket.on('send_message', (data) => {
    messages.push(data);
    saveMessagesToFile();
    io.emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
