const fs = require('fs');
const path = require('path');
const axios = require('axios');
const extract = require('extract-zip');
const tar = require('tar');
const downloadReputationDBs = require('./downloadReputationDBs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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
    // Verify MaxMind license key exists
    if (!process.env.MAXMIND_LICENSE_KEY) {
      throw new Error('MAXMIND_LICENSE_KEY is not set in environment variables');
    }

    if (!fs.existsSync(DB_PATH)) {
      fs.mkdirSync(DB_PATH, { recursive: true });
    }

    console.log('Updating IP databases...');
    
    // Download and process MaxMind GeoLite2
    const tarFile = path.join(DB_PATH, 'GeoLite2-City.tar.gz');
    const maxmindUrl = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz`;
    console.log('Downloading MaxMind database...');
    await downloadFile(
      maxmindUrl,
      tarFile
    );

    await tar.x({
      file: tarFile,
      cwd: DB_PATH
    });

    // Find the extracted directory
    const extractedDir = fs.readdirSync(DB_PATH)
      .find(file => file.startsWith('GeoLite2-City_'));
    
    if (extractedDir) {
      console.log('Found extracted directory:', extractedDir);
      const extractedPath = path.join(DB_PATH, extractedDir);

      // Recursively find .mmdb file
      function findMmdbFile(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const found = findMmdbFile(fullPath);
            if (found) return found;
          } else if (file.endsWith('.mmdb')) {
            return fullPath;
          }
        }
        return null;
      }

      const mmdbPath = findMmdbFile(extractedPath);
      console.log('Search result for .mmdb file:', mmdbPath);

      if (mmdbPath) {
        console.log('Found MaxMind database at:', mmdbPath);

        const destPath = path.join(DB_PATH, 'GeoLite2-City.mmdb');
        console.log('Moving to:', destPath);

        fs.renameSync(
          mmdbPath,
          destPath
        );
        fs.rmSync(extractedPath, { recursive: true, force: true });
        console.log('Successfully moved and cleaned up MaxMind database');

        // Verify the file exists and has content
        const stats = fs.statSync(destPath);
        console.log('Database file stats:', {
          size: stats.size,
          modified: stats.mtime
        });
      } else {
        throw new Error('Could not find .mmdb file in extracted directory');
      }
    } else {
      throw new Error('Could not find extracted MaxMind directory');
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