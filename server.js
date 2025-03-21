const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
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
const wss = new WebSocket.Server({ server });

let isActive = false;

wss.on('connection', (ws) => {
    console.log('ESP32 connected');
    isActive = true;

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ active: true }));
        }
    });

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        
        if (data?.event === 'sensorData') {
            const { temperature, moisture, humidity } = data?.data;

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ temperature, moisture, humidity }));
                }
            });

            const currentSeconds = Math.floor(Date.now() / 1000);
            if (currentSeconds % 3600 === 0) {
                const newSoilData = new SoilData({ temperature, moisture, humidity });
                await newSoilData.save();
                console.log('Data saved successfully');
            }
        }

        if (data?.event === 'turnOnMotor') {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ event: 'turnOnMotor', data: true }));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
        isActive = false;

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ active: false }));
            }
        });
    });
});

app.post('/soil-data', async (req, res) => {
    const { temperature, humidity } = req.body;

    if (!temperature || !humidity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ temperature, humidity }));
        }
    });

    const currentSeconds = Math.floor(Date.now() / 1000);
    if (currentSeconds % 3600 === 0) {
        const newSoilData = new SoilData({ temperature, humidity });
        try {
            await newSoilData.save();
            res.status(201).json({ message: 'Data saved successfully' });
        } catch (error) {
            console.error('Error saving data:', error);
            res.status(500).json({ error: 'Error saving data' });
        }
    } else {
        res.status(201).json({ message: 'Data saved successfully' });
    }
});

app.get('/', (req, res) => {
    res.send('Soil Sensor Data Receiver Running');
});

const LOCAL_IP = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;

server.listen(PORT, LOCAL_IP, () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
    console.log(`WebSocket server running on ws://${LOCAL_IP}:${PORT}`);
});
