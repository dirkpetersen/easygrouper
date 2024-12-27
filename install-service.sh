#!/bin/bash

# Exit on any error
set -e

# Get the current directory and user
CURRENT_DIR=$(pwd)
CURRENT_USER=$(whoami)

# Create the systemd user directory if it doesn't exist
mkdir -p ~/.config/systemd/user/

# Create the service file
cat > ~/.config/systemd/user/easygrouper.service << EOL
[Unit]
Description=EasyGrouper App Service
After=network.target

[Service]
Type=simple
WorkingDirectory=${CURRENT_DIR}
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=${CURRENT_DIR}/.env
ExecStart=${CURRENT_DIR}/app.py
Restart=always
RestartSec=1

[Install]
WantedBy=default.target
EOL

# Ensure Python and pip are installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 is not installed. Please install it first."
    exit 1
fi

# Reload systemd daemon
systemctl --user daemon-reload

# Enable and start the service
systemctl --user enable easygrouper.service
systemctl --user start easygrouper.service

# Check the service status
systemctl --user status easygrouper.service

echo "EasyGrouper has been installed as a user service."
echo "You can check the logs using: journalctl --user-unit easygrouper.service"
echo "To stop the service: systemctl --user stop easygrouper.service"
echo "To start the service: systemctl --user start easygrouper.service"
echo "To restart the service: systemctl --user restart easygrouper.service"
echo ""
echo "This service requires packages python3-flask, python3-ldap3 and python3-dotenv"