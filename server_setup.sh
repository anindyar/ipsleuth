#!/bin/bash

# Exit on error
set -e

# Default values
GIT_REPO="https://github.com/anindyar/ipsleuth.git"

# Prompt for MaxMind license key
read -p "Enter MaxMind license key: " MAXMIND_KEY
if [ -z "$MAXMIND_KEY" ]; then
  echo "Error: MaxMind license key is required"
  exit 1
fi

# Function to cleanup old installation
cleanup_old_installation() {
    echo "Cleaning up old installation..."
    
    # Stop PM2 processes
    if command -v pm2 &>/dev/null; then
        su - sleuth -c "pm2 delete all" 2>/dev/null || true
        su - sleuth -c "pm2 save" 2>/dev/null || true
    fi

    # Remove old systemd services
    systemctl stop pm2-sleuth 2>/dev/null || true
    systemctl disable pm2-sleuth 2>/dev/null || true
    rm -f /etc/systemd/system/pm2-sleuth.service
    rm -f /etc/systemd/system/ipsleuth-db-update.service
    rm -f /etc/systemd/system/ipsleuth-db-update.timer
    systemctl daemon-reload

    # Remove old user and files
    if id "sleuth" &>/dev/null; then
        pkill -u sleuth || true
        deluser --remove-home sleuth
    fi

    # Remove application directory
    rm -rf /var/www/ipsleuth

    # Remove nginx configurations
    rm -f /etc/nginx/sites-enabled/ipsleuth
    rm -f /etc/nginx/sites-available/ipsleuth

    echo "Cleanup completed!"
}

# Ask for cleanup
read -p "Do you want to clean up old installation? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cleanup_old_installation
fi

# Ask if system update is needed
read -p "Do you want to update system packages? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    apt update && apt upgrade -y
    apt install -y curl git ufw unzip
fi

# Configure firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Install Node.js v21 (only if not already installed)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_21.x | sudo -E bash -
    apt install -y nodejs
fi

# Verify Node.js installation
node --version
npm --version

# Install nginx (if not already installed)
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
fi

# Install certbot (if not already installed)
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
fi

# Create a non-root user
read -p "Enter username for new user [sleuth]: " USERNAME
USERNAME=${USERNAME:-sleuth}
if ! id "$USERNAME" &>/dev/null; then
    adduser $USERNAME
    usermod -aG sudo $USERNAME
fi

# Set up SSH for the new user
mkdir -p /home/$USERNAME/.ssh
if [ -f ~/.ssh/authorized_keys ]; then
    cp ~/.ssh/authorized_keys /home/$USERNAME/.ssh/
    chown -R $USERNAME:$USERNAME /home/$USERNAME/.ssh
    chmod 700 /home/$USERNAME/.ssh
    chmod 600 /home/$USERNAME/.ssh/authorized_keys
fi

# Install PM2 globally for process management
npm install -g pm2

# Create application directory structure
mkdir -p /var/www/ipsleuth

# Set proper ownership
chown -R $USERNAME:$USERNAME /var/www/ipsleuth

# Read email for SSL certificate
read -p "Enter email for SSL certificate: " SSL_EMAIL

# Switch to the new user and set up the application
su - $USERNAME << 'USEREOF'
cd /var/www/ipsleuth

# Clone the repository
git clone https://github.com/anindyar/ipsleuth.git .
mkdir -p databases

# Create backend .env file
mkdir -p backend
cat > backend/.env << ENVEOF
PORT=3001
NODE_ENV=production
MAXMIND_LICENSE_KEY=${MAXMIND_KEY}
ENVEOF

# Install dependencies
cd backend
npm install
mkdir -p utils
cd ..

# Create backend files
cat > backend/server.js << 'SERVERJS'
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
SERVERJS

# Create updateDatabases.js
cat > backend/utils/updateDatabases.js << UPDATEDB
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const extract = require('extract-zip');
const tar = require('tar');
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
    const tarFile = path.join(DB_PATH, 'GeoLite2-City.tar.gz');
    await downloadFile(
      \`https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=\${process.env.MAXMIND_LICENSE_KEY}&suffix=tar.gz\`,
      tarFile
    );

    // Extract the tar.gz file
    await tar.x({
      file: tarFile,
      cwd: DB_PATH
    });

    // Find and move the .mmdb file
    const mmdbFile = fs.readdirSync(DB_PATH)
      .find(file => file.startsWith('GeoLite2-City_') && file.endsWith('.mmdb'));
    if (mmdbFile) {
      fs.renameSync(
        path.join(DB_PATH, mmdbFile),
        path.join(DB_PATH, 'GeoLite2-City.mmdb')
      );
    }

    // Cleanup
    fs.unlinkSync(tarFile);

    console.log('All databases updated successfully!');
  } catch (error) {
    console.error('Error updating databases:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  updateDatabases();
}

module.exports = updateDatabases;
UPDATEDB

# Create package.json
cat > backend/package.json << 'PACKAGEJSON'
{
  "scripts": {
    "start": "node server.js",
    "update-db": "node utils/updateDatabases.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "axios": "^1.4.0",
    "extract-zip": "^2.0.1",
    "tar": "^6.1.13",
    "@maxmind/geoip2-node": "^4.2.0"
  }
}
PACKAGEJSON

# Setup frontend
mkdir -p frontend
cd frontend

# Set up NVM and Node 18 first
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] || {
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
}
nvm install 18
nvm use 18

# Create frontend package.json
cat > package.json << 'FRONTENDPKG'
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "@mui/icons-material": "^5.11.16",
    "@mui/material": "^5.13.0",
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^13.5.0",
    "axios": "^1.4.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "react-table": "^7.8.0",
    "web-vitals": "^2.1.4",
    "ajv": "^8.12.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": ["react-app"]
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
FRONTENDPKG

# Create React files
mkdir -p src public
mkdir -p src/components

# Create index.html
cat > public/index.html << 'INDEXHTML'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="IPSleuth - Privacy-First IP Analysis Tool" />
    <title>IPSleuth</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
INDEXHTML

# Create index.js
cat > src/index.js << 'INDEXJS'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
INDEXJS

# Create App.js
cat > src/App.js << 'APPJS'
import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00bcd4' },
    secondary: { main: '#ff4081' },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

function App() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, type: 'text' }),
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            IPSleuth
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter IP addresses (one per line)"
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" color="primary">
                  Analyze
                </Button>
              </Grid>
            </Grid>
          </form>
          {results.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </Box>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
APPJS

npm install --legacy-peer-deps
NODE_ENV=production npm run build
cd ..
USEREOF

# Now handle system files as root
# Configure nginx
cat > /etc/nginx/sites-available/ipsleuth << 'NGINXCONF'
server {
    server_name ipsleuth.io www.ipsleuth.io;

    root /var/www/ipsleuth/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html =404;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip compression for better performance
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_vary on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:;" always;

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/ipsleuth.io/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/ipsleuth.io/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    listen 80;
    server_name ipsleuth.io www.ipsleuth.io;

    location / {
        return 301 https://ipsleuth.io$request_uri;
    }
}
NGINXCONF

# Enable the site
rm -f /etc/nginx/sites-enabled/ipsleuth
ln -s /etc/nginx/sites-available/ipsleuth /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t && systemctl restart nginx

# Set up SSL
if [ ! -z "$SSL_EMAIL" ]; then
    certbot --nginx -d ipsleuth.io -d www.ipsleuth.io --non-interactive --agree-tos --email "$SSL_EMAIL"
fi

# Set up systemd services
cat > /etc/systemd/system/ipsleuth-db-update.service << 'SERVICEEOF'
[Unit]
Description=IPSleuth Database Update Service
After=network.target

[Service]
Type=oneshot
User=$USERNAME
WorkingDirectory=/var/www/ipsleuth/backend
ExecStart=$(which node) utils/updateDatabases.js
SERVICEEOF

cat > /etc/systemd/system/ipsleuth-db-update.timer << 'TIMEREOF'
[Unit]
Description=Daily IPSleuth Database Update

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
TIMEREOF

# Enable and start the timer
systemctl enable ipsleuth-db-update.timer
systemctl start ipsleuth-db-update.timer

# Start PM2 as the user
su - $USERNAME << 'PM2EOF'
cd /var/www/ipsleuth/backend
pm2 delete ipsleuth 2>/dev/null || true
pm2 start server.js --name "ipsleuth"
pm2 save
pm2 startup | tail -n 1 > ~/pm2_startup_command
PM2EOF

# Execute PM2 startup command
if [ -f /home/$USERNAME/pm2_startup_command ]; then
    $(cat /home/$USERNAME/pm2_startup_command)
    rm /home/$USERNAME/pm2_startup_command
fi

# Initialize database after setup
su - $USERNAME << INITDB
cd /var/www/ipsleuth/backend
node utils/updateDatabases.js
INITDB

echo "Initial server setup complete!"
echo "Please verify:"
echo "1. DNS records for ipsleuth.io point to this server"
echo "2. Frontend is accessible at https://ipsleuth.io"
echo "3. Backend health check at https://ipsleuth.io/api/health"
echo "4. PM2 process is running: pm2 list"
echo "5. Database update timer is active: systemctl list-timers"
EOF 
