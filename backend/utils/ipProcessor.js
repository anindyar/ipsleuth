const net = require('net');
const maxmind = require('maxmind');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DB_PATH = path.join(__dirname, '../databases');

const isValidPublicIP = (ip) => {
  if (!net.isIP(ip)) return false;
  
  const parts = ip.split('.');
  const firstOctet = parseInt(parts[0], 10);
  
  return !(
    firstOctet === 10 || // 10.0.0.0/8
    (firstOctet === 172 && parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31) || // 172.16.0.0/12
    (firstOctet === 192 && parseInt(parts[1], 10) === 168) || // 192.168.0.0/16
    firstOctet === 127 || // Loopback
    firstOctet === 0 || // Current network
    firstOctet === 169 && parseInt(parts[1], 10) === 254 // Link-local
  );
};

const extractIPs = (input) => {
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const matches = input.match(ipRegex) || [];
  return [...new Set(matches)]
    .filter(isValidPublicIP)
    .slice(0, 1000);
};

// Function to check IP against multiple blocklists
const checkIPReputation = async (ip) => {
  try {
    const reputationScore = {
      score: 0,
      lists: [],
      lastReport: null
    };

    // Check AbuseIPDB CSV
    const abuseData = JSON.parse(fs.readFileSync(path.join(DB_PATH, 'abuse_data.json'), 'utf8'));
    if (abuseData[ip]) {
      reputationScore.score += abuseData[ip].score;
      reputationScore.lastReport = abuseData[ip].lastReport;
      reputationScore.lists.push('AbuseIPDB');
    }

    // Check Firehol
    const fireholData = JSON.parse(fs.readFileSync(path.join(DB_PATH, 'firehol.json'), 'utf8'));
    if (fireholData[ip]) {
      reputationScore.score += 50;
      reputationScore.lists.push('Firehol');
    }

    // Check Tor Exit Nodes
    const torData = JSON.parse(fs.readFileSync(path.join(DB_PATH, 'tor_exits.json'), 'utf8'));
    if (torData[ip]) {
      reputationScore.score += 30;
      reputationScore.lists.push('Tor Exit Node');
    }

    return reputationScore;
  } catch (error) {
    console.error('Error checking IP reputation:', error);
    return { score: 0, lists: [], lastReport: null };
  }
};

const getIPInfo = async (ip) => {
  try {
    const geoData = await maxmind.open(path.join(DB_PATH, 'GeoLite2-City.mmdb'));
    const location = geoData.get(ip);
    const reputation = { score: 0, lists: [] };

    return {
      ip,
      country: location?.country?.names?.en || 'Unknown',
      city: location?.city?.names?.en || 'Unknown',
      isp: location?.traits?.isp || 'Unknown',
      reputation: reputation.score,
      lastReport: 'Never',
      detectedIn: reputation.lists.join(', ') || 'None'
    };
  } catch (error) {
    console.error(`Error processing IP ${ip}:`, error);
    return {
      ip,
      country: 'Error',
      city: 'Error',
      isp: 'Error',
      reputation: 'Error',
      lastReport: 'Error',
      detectedIn: 'Error'
    };
  }
};

module.exports = {
  extractIPs,
  getIPInfo,
}; 