const express = require('express');
const path = require('path');
const app = express();
const PORT = 8080;

// Serve static files from current directory
app.use(express.static(__dirname));

// Serve the login page as the default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎰 Casino Frontend Server running at http://localhost:${PORT}`);
    console.log('📄 Login page: http://localhost:8080/login.html');
    console.log('🔗 Backend API: http://localhost:5000');
});