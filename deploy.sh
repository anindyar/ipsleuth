#!/bin/bash

# Update system
apt update && apt upgrade -y

# Install Node.js v21
curl -fsSL https://deb.nodesource.com/setup_21.x | sudo -E bash -
apt install -y nodejs

# Verify Node.js version
node --version  # Should show v21.x.x

# Install dependencies
echo "Installing dependencies..."
npm install --prefix backend
npm install --prefix frontend

# Build frontend
echo "Building frontend..."
npm run build --prefix frontend

# Update databases
echo "Updating IP databases..."
npm run update-db --prefix backend

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/ip-analyzer.service << EOF
[Unit]
Description=IP Analyzer Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(which node) server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for database updates
echo "Creating database update service..."
sudo tee /etc/systemd/system/ip-analyzer-db-update.service << EOF
[Unit]
Description=IP Analyzer Database Update Service
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(which node) utils/updateDatabases.js
EOF

# Create timer for daily updates
sudo tee /etc/systemd/system/ip-analyzer-db-update.timer << EOF
[Unit]
Description=Daily IP Analyzer Database Update

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Setup nginx configuration
echo "Configuring nginx..."
sudo tee /etc/nginx/sites-available/ip-analyzer << EOF
server {
    listen 80;
    server_name ipsleuth.io;

    location / {
        root $(pwd)/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/ip-analyzer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Start the service
sudo systemctl enable ip-analyzer
sudo systemctl start ip-analyzer

# Enable and start the timer
sudo systemctl enable ip-analyzer-db-update.timer
sudo systemctl start ip-analyzer-db-update.timer

echo "Deployment complete!" 