const dns = require('dns').promises;
const rateLimit = require('express-rate-limit');

// Http:BL configuration
const HTTPBL_DOMAIN = 'dnsbl.httpbl.org';
const ACCESS_KEY = process.env.HTTPBL_ACCESS_KEY; // You'll need to get this from Project Honey Pot

// Rate limiting
let queryCount = 0;
let lastReset = Date.now();
const DAILY_LIMIT = 9500;  // Set below 10k to be safe
const QUERIES_PER_SECOND = 8;  // Set below 10 to be safe
let lastQueryTime = 0;

function reverseIp(ip) {
  return ip.split('.').reverse().join('.');
}

function parseHttpBlResponse(response) {
  if (!response || !response[0]) return null;

  const [a, b, c, d] = response[0].split('.');
  
  if (a !== '127') return null;

  const days = parseInt(b);
  const threatScore = parseInt(c);
  const type = parseInt(d);

  // Decode visitor type bitset
  const types = [];
  if (type === 0) types.push('search_engine');
  if (type & 1) types.push('suspicious');
  if (type & 2) types.push('harvester');
  if (type & 4) types.push('comment_spammer');

  return {
    lastSeen: days,
    threatScore,
    types,
    isSearchEngine: type === 0
  };
}

async function checkHttpBl(ip) {
  try {
    // Check daily limit
    if (Date.now() - lastReset > 86400000) {  // 24 hours
      queryCount = 0;
      lastReset = Date.now();
    }
    if (queryCount >= DAILY_LIMIT) {
      console.warn('Daily Http:BL query limit reached');
      return null;
    }

    // Check rate limit
    const now = Date.now();
    const timeSinceLastQuery = now - lastQueryTime;
    if (timeSinceLastQuery < (1000 / QUERIES_PER_SECOND)) {
      await new Promise(resolve => setTimeout(resolve, 
        (1000 / QUERIES_PER_SECOND) - timeSinceLastQuery));
    }

    if (!ACCESS_KEY) {
      console.warn('HTTPBL_ACCESS_KEY not configured');
      return null;
    }

    const query = `${ACCESS_KEY}.${reverseIp(ip)}.${HTTPBL_DOMAIN}`;
    const records = await dns.resolve4(query);
    
    queryCount++;
    lastQueryTime = Date.now();
    
    return parseHttpBlResponse(records);
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      // IP not listed in Http:BL
      return null;
    }
    console.error(`Http:BL lookup failed for ${ip}:`, error);
    return null;
  }
}

module.exports = { checkHttpBl }; 