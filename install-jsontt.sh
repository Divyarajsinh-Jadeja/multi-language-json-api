#!/bin/bash

set -e  # Exit on any error

echo "Installing prerequisites..."
# Install yarn if not present
if ! command -v yarn &> /dev/null; then
    echo "Installing yarn..."
    npm install -g yarn
fi

# Method 1: Clone the correct repository
echo "Cloning json-translator repository..."
git clone https://github.com/mololab/json-translator.git /tmp/jsontt

if [ $? -eq 0 ]; then
    echo "Successfully cloned repository"
    cd /tmp/jsontt
    
    # Install dependencies with yarn as recommended
    echo "Installing dependencies with yarn..."
    yarn install
    
    # Install globally
    echo "Installing globally..."
    npm install -g .
    
    echo "Installation completed successfully"
    
    # Cleanup
    cd /
    rm -rf /tmp/jsontt
    exit 0
fi

echo "Git clone failed. Trying alternative download method..."
mkdir -p /tmp/jsontt
cd /tmp/jsontt

# Try downloading with curl
curl -L https://github.com/mololab/json-translator/archive/refs/heads/master.zip -o master.zip

if [ -f master.zip ]; then
    echo "Downloaded repository archive"
    unzip master.zip
    cd json-translator-master
    
    # Install dependencies with yarn
    echo "Installing dependencies with yarn..."
    yarn install
    
    # Install globally
    echo "Installing globally..."
    npm install -g .
    
    echo "Installation completed via download"
    
    # Cleanup
    cd /
    rm -rf /tmp/jsontt
else
    echo "Failed to download repository"
    exit 1
fi
# 
# if [ $? -eq 0 ]; then
#     echo "Successfully cloned repository"
#     cd /tmp/jsontt
#     npm install -g
#     echo "Installation completed"
# else
#     echo "Failed to clone repository. Trying alternative method..."
#     # Method 3: Use curl to download and extract
#     mkdir -p /tmp/jsontt
#     cd /tmp/jsontt
#     curl -L https://github.com/parvineyvazov/json-translator-cli/archive/refs/heads/main.zip -o main.zip
#     unzip main.zip
#     cd json-translator-cli-main
#     npm install -g
#     echo "Installation completed via download"
# fi