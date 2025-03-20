const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDatabase() {
    try {
        await mongoose.connect('mongodb+srv://lokesh:lokesh2007@soilsense.hecy8.mongodb.net/soilData?retryWrites=true&w=majority', {
            useNewUrlParser: true
        });
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
app.use(express.json());

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
        const { temperature, moisture, humidity } = JSON.parse(data);
        const currentSeconds = Math.floor(Date.now() / 1000);

        io.emit('updateData', { temperature, moisture, humidity });

        if (currentSeconds % 3600 === 0) {
            const newSoilData = new SoilData({ temperature, moisture, humidity });

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

// POST API endpoint for soil data
app.post('/soil-data', async (req, res) => {
    const { temperature, moisture, humidity } = req.body;

    if (!temperature || !moisture || !humidity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    io.emit('updateData', { temperature, moisture, humidity });

    const newSoilData = new SoilData({ temperature, moisture, humidity });
    try {
        await newSoilData.save();
        res.status(201).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Error saving data' });
    }
});

app.get('/', (req, res) => {
    res.send('Soil Sensor Data Receiver Running');
});

const LOCAL_IP = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;

server.listen(PORT, LOCAL_IP, () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
});
