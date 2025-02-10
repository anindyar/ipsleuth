const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Reader = require('@maxmind/geoip2-node').Reader;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'databases/GeoLite2-City.mmdb');

async function lookupIP(ip) {
  try {
    const reader = await Reader.open(DB_PATH);
    const result = await reader.city(ip);
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
      organization: result.traits?.organization || 'Unknown'
    };
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    return { ip, error: 'Failed to lookup IP' };
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { input, type } = req.body;
    const ips = input.split(/[\n,\s]+/).filter(ip => ip.trim());
    
    const results = await Promise.all(
      ips.map(ip => lookupIP(ip.trim()))
    );
    
    res.json(results);
  } catch (error) {
    console.error('Error analyzing IPs:', error);
    res.status(500).json({ error: 'Failed to analyze IPs' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 