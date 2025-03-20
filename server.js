const express = require('express');
const http = require('http');
const WebSocket = require('ws'); // Import ws module
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

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server using the ws library
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('ESP32 connected');

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if(data?.event === 'sensorData'){
            try {
                console.log(data?.data)
                const { temperature, moisture, humidity } = data?.data;
                const currentSeconds = Math.floor(Date.now() / 1000);
    
                // Emit data to all connected clients (optional)
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ temperature, moisture, humidity }));
                    }
                });
    
                if (currentSeconds % 3600 === 0) {
                    // Save data to the database
                    const newSoilData = new SoilData({ temperature, moisture, humidity });
                    try {
                        await newSoilData.save();
                        console.log('Data saved successfully');
                    } catch (error) {
                        console.error('Error saving data:', error);
                    }
                }
    
            } catch (err) {
                console.log('Invalid JSON:', message.toString());
            }
        }

    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
    });
});

// POST API endpoint for soil data
app.post('/soil-data', async (req, res) => {
    const { temperature, humidity } = req.body;

    if (!temperature || !humidity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Broadcast the data to all WebSocket clients
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

// Define the port and start the server
const LOCAL_IP = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;

server.listen(PORT, LOCAL_IP, () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
    console.log(`WebSocket server running on ws://${LOCAL_IP}:${PORT}`);
});
