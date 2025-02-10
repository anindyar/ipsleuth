const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, '../databases');

async function downloadReputationDBs() {
  try {
    // Ensure directory exists
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }

    // Download FireHOL
    console.log('Downloading FireHOL blocklist...');
    const fireholResponse = await axios.get('https://iplists.firehol.org/files/firehol_level1.netset');
    const fireholIPs = {};
    fireholResponse.data.split('\n')
      .filter(line => !line.startsWith('#') && line.trim())
      .forEach(ip => { fireholIPs[ip.trim()] = true; });
    
    fs.writeFileSync(
      path.join(DB_PATH, 'firehol.json'), 
      JSON.stringify(fireholIPs, null, 2)
    );
    console.log(`Saved ${Object.keys(fireholIPs).length} FireHOL IPs`);

    // Download Tor exits
    console.log('Downloading Tor exit nodes...');
    const torResponse = await axios.get('https://check.torproject.org/torbulkexitlist');
    const torIPs = {};
    torResponse.data.split('\n')
      .filter(ip => ip.trim())
      .forEach(ip => { torIPs[ip.trim()] = true; });
    
    fs.writeFileSync(
      path.join(DB_PATH, 'tor_exits.json'), 
      JSON.stringify(torIPs, null, 2)
    );
    console.log(`Saved ${Object.keys(torIPs).length} Tor exit nodes`);

  } catch (error) {
    console.error('Error downloading reputation databases:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadReputationDBs();
}

module.exports = downloadReputationDBs; 