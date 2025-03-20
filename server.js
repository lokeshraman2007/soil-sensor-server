const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDatabase() {
    try {
        await mongoose.connect('mongodb+srv://lokesh:lokesh2007@soilsense.hecy8.mongodb.net/soilData?retryWrites=true&w=majority', {
            useNewUrlParser: true        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
}
connectToDatabase();

const SoilData = mongoose.model('SoilData', new mongoose.Schema({
    temperature: Number,
    moisture: Number,
    humidity: Number,
    timestamp: { type: Date, default: Date.now }
}));

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('ESP32 connected:', socket.id);

    socket.on('sensorData', async (data) => {
        console.log('Received data:', data);

        const { temperature, moisture, humidity } = data;
        const currentSeconds = Math.floor(Date.now() / 1000);

        io.emit('updateData', { temperature, moisture, humidity }); // Send data to frontend in real-time

        if (currentSeconds % 3600 === 0) { // Every 1 hour
            const newSoilData = new SoilData({
                temperature,
                moisture,
                humidity
            });

            try {
                await newSoilData.save();
                console.log('Data saved successfully');
            } catch (error) {
                console.error('Error saving data:', error);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('ESP32 disconnected:', socket.id);
    });
});

app.get('/', (req, res) => {
    res.send('Soil Sensor Data Receiver Running');
});

const LOCAL_IP = process.env.HOST || '0.0.0.0'; 
const PORT = process.env.PORT || 4000;

server.listen(PORT, LOCAL_IP, () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
});
