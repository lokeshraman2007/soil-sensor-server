const express = require('express');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();




const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let isActive = false;

wss.on('connection', (ws) => {
    console.log('ESP32 connected');
    isActive = true;
    console.log(wss.clients)
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


app.get('/', (req, res) => {
    res.send('Soil Sensor Data Receiver Running');
});

const LOCAL_IP = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 4000;

server.listen(PORT, LOCAL_IP, () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
    console.log(`WebSocket server running on ws://${LOCAL_IP}:${PORT}`);
});
