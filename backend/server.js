const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Reader } = require('@maxmind/geoip2-node');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'databases/GeoLite2-City.mmdb');

// Load reputation databases
let fireholIPs = {};
let torExitIPs = {};

try {
  fireholIPs = JSON.parse(fs.readFileSync(path.join(__dirname, 'databases/firehol.json'), 'utf8'));
  torExitIPs = JSON.parse(fs.readFileSync(path.join(__dirname, 'databases/tor_exits.json'), 'utf8'));
  console.log(`Successfully loaded reputation databases:
    - FireHOL IPs: ${Object.keys(fireholIPs).length}
    - Tor Exit Nodes: ${Object.keys(torExitIPs).length}`);
} catch (error) {
  console.error('Error loading reputation databases:', error.message);
  console.error('Reputation data will not be available');
}

async function lookupIP(ip) {
  try {
    const reader = await Reader.open(DB_PATH);
    const result = await reader.city(ip);
    
    // Add reputation data
    const reputation = {
      isInFireHOL: !!fireholIPs[ip],
      isTorExit: !!torExitIPs[ip],
      threatLevel: fireholIPs[ip] ? 'high' : (torExitIPs[ip] ? 'medium' : 'low'),
      tags: []
    };

    if (fireholIPs[ip]) reputation.tags.push('malicious');
    if (torExitIPs[ip]) reputation.tags.push('tor_exit');

    // Log reputation check
    console.log(`Reputation check for ${ip}:`, reputation);

    return {
      ip,
      city: result.city?.names?.en || 'Unknown',
      country: result.country?.names?.en || 'Unknown',
      continent: result.continent?.names?.en || 'Unknown',
      location: {
        latitude: result.location?.latitude,
        longitude: result.location?.longitude,
        accuracy_radius: result.location?.accuracyRadius
      },
      isp: result.traits?.isp || 'Unknown',
      organization: result.traits?.organization || 'Unknown',
      reputation
    };
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    return { 
      ip, 
      error: 'Failed to lookup IP',
      reputation: {
        isInFireHOL: !!fireholIPs[ip],
        isTorExit: !!torExitIPs[ip],
        threatLevel: fireholIPs[ip] ? 'high' : (torExitIPs[ip] ? 'medium' : 'low'),
        tags: []
      }
    };
  }
}

app.post('/api/analyze', async (req, res) => {
  try {
    const ip = req.body.input;
    console.log('Received request for IP:', ip);
    const result = await lookupIP(ip);
    console.log('Analysis result:', result);
    res.json([result]);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please free up the port and try again.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
}); 