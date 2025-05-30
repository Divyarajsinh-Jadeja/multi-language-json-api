#!/bin/bash

# Method 1: Install directly from npm (easiest solution)
echo "Installing json-translator-cli from npm..."
npm install -g json-translator-cli

# If the above doesn't work, try Method 2: Clone without authentication
# echo "Cloning json-translator-cli repository..."
# git clone https://github.com/parvineyvazov/json-translator-cli.git /tmp/jsontt
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