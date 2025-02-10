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
let reader = null;

// Verify database exists at startup
if (!fs.existsSync(DB_PATH)) {
  console.error('GeoIP database not found at:', DB_PATH);
  process.exit(1);
}
console.log('GeoIP database found at:', DB_PATH);

// Initialize the reader once
Reader.open(DB_PATH).then(r => {
  reader = r;
  console.log('MaxMind database reader initialized');
}).catch(err => {
  console.error('Failed to initialize MaxMind reader:', err);
  process.exit(1);
});

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

function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.').map(part => parseInt(part, 10));
  return parts.every(part => part >= 0 && part <= 255);
}

async function lookupIP(ip) {
  try {
    // Validate IP before processing
    if (!isValidIP(ip)) {
      return {
        ip,
        error: 'Invalid IP address format',
        reputation: {
          isInFireHOL: false,
          isTorExit: false,
          threatLevel: 'unknown',
          tags: []
        }
      };
    }

    // Verify reader is initialized
    if (!reader) {
      throw new Error('MaxMind database reader not initialized');
    }

    const result = await reader.city(ip);
    console.log('Raw GeoIP lookup result:', JSON.stringify(result, null, 2));
    
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

    const response = {
      ip,
      city: result?.city?.names?.en || 'Unknown',
      country: result?.country?.names?.en || 'Unknown',
      continent: result?.continent?.names?.en || 'Unknown',
      location: {
        latitude: result?.location?.latitude || null,
        longitude: result?.location?.longitude || null,
        accuracy_radius: result?.location?.accuracyRadius || null
      },
      isp: result?.traits?.isp || 'Unknown',
      organization: result?.traits?.organization || 'Unknown',
      reputation: {
        isInFireHOL: !!fireholIPs[ip],
        isTorExit: !!torExitIPs[ip],
        threatLevel: fireholIPs[ip] ? 'high' : (torExitIPs[ip] ? 'medium' : 'low'),
        tags: [
          ...(fireholIPs[ip] ? ['malicious'] : []),
          ...(torExitIPs[ip] ? ['tor_exit'] : [])
        ]
      }
    };

    console.log('Final response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error.message);
    console.error('Stack trace:', error.stack);
    return { 
      ip, 
      error: `Failed to lookup IP: ${error.message}`,
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
    console.log('Received request with input:', ip);
    
    // Split input into IPs using multiple delimiters (newlines, commas, spaces)
    const ips = ip.split(/[\n,\s]+/).filter(ip => ip.trim());
    console.log(`Processing ${ips.length} IPs`);
    
    // Process IPs in batches of 50
    const BATCH_SIZE = 50;
    const results = [];
    
    for (let i = 0; i < ips.length; i += BATCH_SIZE) {
      const batch = ips.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(ips.length/BATCH_SIZE)}`);
      const batchResults = await Promise.all(
        batch.map(ip => lookupIP(ip.trim()))
      );
      results.push(...batchResults);
    }
    
    console.log(`Analyzed ${results.length} IPs`);
    res.json(results);
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