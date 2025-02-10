// Reserved IP ranges
const IP_RANGES = {
  PRIVATE: [
    ['10.0.0.0', '10.255.255.255'],
    ['172.16.0.0', '172.31.255.255'],
    ['192.168.0.0', '192.168.255.255']
  ],
  LOOPBACK: [['127.0.0.0', '127.255.255.255']],
  APIPA: [['169.254.0.0', '169.254.255.255']],
  MULTICAST: [['224.0.0.0', '239.255.255.255']],
  BROADCAST: [['255.255.255.255', '255.255.255.255']],
  RESERVED: [
    ['0.0.0.0', '0.255.255.255'],
    ['100.64.0.0', '100.127.255.255'],
    ['192.0.0.0', '192.0.0.255'],
    ['192.0.2.0', '192.0.2.255'],
    ['192.88.99.0', '192.88.99.255'],
    ['198.18.0.0', '198.19.255.255'],
    ['198.51.100.0', '198.51.100.255'],
    ['203.0.113.0', '203.0.113.255'],
    ['240.0.0.0', '255.255.255.255']
  ]
};

// Convert IP to numeric value for range comparison
function ipToLong(ip) {
  return ip.split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// Check if IP is within a range
function isInRange(ip, range) {
  const ipNum = ipToLong(ip);
  const startNum = ipToLong(range[0]);
  const endNum = ipToLong(range[1]);
  return ipNum >= startNum && ipNum <= endNum;
}

// Validate IP address format
function isValidIP(ip) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  const parts = ip.split('.').map(part => parseInt(part, 10));
  return parts.every(part => part >= 0 && part <= 255);
}

// Get IP classification tags
function getIPTags(ip) {
  const tags = [];
  
  if (!isValidIP(ip)) {
    tags.push('private_or_reserved_ip');
    return tags;
  }
  
  let isSpecialRange = false;
  
  for (const [type, ranges] of Object.entries(IP_RANGES)) {
    if (ranges.some(range => isInRange(ip, range))) {
      tags.push(type.toLowerCase() + '_ip');
      isSpecialRange = true;
    }
  }
  
  // If IP is not in any special range, it's a public IP
  if (!isSpecialRange) {
    tags.push('public_ip');
  }
  
  return tags;
}

// Clean and validate IP list
function cleanIPList(input) {
  return input
    .split(/[\n,\s]+/)
    .map(ip => ip.trim())
    .filter(ip => {
      if (!ip) return false;
      if (!isValidIP(ip)) return false;
      // Optionally, you could filter out non-public IPs here
      // const tags = getIPTags(ip);
      // return tags.includes('public_ip');
      return true;
    });
}

module.exports = {
  isValidIP,
  getIPTags,
  cleanIPList
}; 