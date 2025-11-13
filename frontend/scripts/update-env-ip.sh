#!/bin/bash

# Get the local IP address (excluding localhost)
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

if [ -z "$LOCAL_IP" ]; then
  echo "Failed to detect local IP address"
  exit 1
fi

echo "Detected local IP: $LOCAL_IP"

# Update .env file
ENV_FILE="$(dirname "$0")/../.env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo ".env file not found at $ENV_FILE"
  exit 1
fi

# Update the API URL in .env file
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://${LOCAL_IP}:5001|g" "$ENV_FILE"
else
  # Linux
  sed -i "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://${LOCAL_IP}:5001|g" "$ENV_FILE"
fi

echo "Updated .env file with IP: $LOCAL_IP"
echo "EXPO_PUBLIC_API_URL=http://${LOCAL_IP}:5001"
