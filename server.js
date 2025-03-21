let isActive = false; // Track ESP32 connection status

wss.on('connection', (ws) => {
    console.log('ESP32 connected');
    isActive = true;

    // Broadcast active status
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ active: true }));
        }
    });

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data?.event === 'sensorData') {
            try {
                console.log(data?.data);
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
            } catch (err) {
                console.log('Invalid JSON:', message.toString());
            }
        }
    });

    ws.on('close', () => {
        console.log('ESP32 disconnected');
        isActive = false;

        // Broadcast inactive status
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ active: false }));
            }
        });
    });
});

// Endpoint to check ESP32 status
app.get('/status', (req, res) => {
    res.json({ active: isActive });
});
