const fs = require('fs');
const path = require('path');
const axios = require('axios');
const extract = require('extract-zip');
const tar = require('tar');
const downloadReputationDBs = require('./downloadReputationDBs');
require('dotenv').config();

const DB_PATH = path.join(__dirname, '../databases');

async function downloadFile(url, filename) {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  const writer = fs.createWriteStream(filename);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function updateDatabases() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }

    console.log('Updating IP databases...');
    
    // Download and process MaxMind GeoLite2
    const tarFile = path.join(DB_PATH, 'GeoLite2-City.tar.gz');
    await downloadFile(
      `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz`,
      tarFile
    );

    await tar.x({
      file: tarFile,
      cwd: DB_PATH
    });

    const mmdbFile = fs.readdirSync(DB_PATH)
      .find(file => file.startsWith('GeoLite2-City_') && file.endsWith('.mmdb'));
    if (mmdbFile) {
      fs.renameSync(
        path.join(DB_PATH, mmdbFile),
        path.join(DB_PATH, 'GeoLite2-City.mmdb')
      );
    }

    // Download reputation databases
    await downloadReputationDBs();

    // Cleanup
    fs.unlinkSync(tarFile);

    console.log('All databases updated successfully!');
  } catch (error) {
    console.error('Error updating databases:', error);
    process.exit(1);
  }
}

// Add a cron job to update databases daily
if (require.main === module) {
  updateDatabases();
}

module.exports = updateDatabases; 