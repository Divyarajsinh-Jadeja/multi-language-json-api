#!/bin/bash

set -e

echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm not found"; exit 1; }

echo "Verifying npm cache..."
npm cache verify

echo "Installing @parvineyvazov/json-translator globally..."
npm install -g @parvineyvazov/json-translator@latest > install.log 2>&1 || { echo "❌ npm install failed, check install.log"; exit 1; }

echo "Verifying installation..."
if command -v jsontt >/dev/null 2>&1; then
    echo "✅ jsontt CLI installed successfully!"
    echo "Version information:"
    jsontt --version
    echo "Testing jsontt..."
    echo '"test"' > /tmp/test.json
    jsontt /tmp/test.json --module google2 -f en --to hi --name test && echo "✅ jsontt functional"
else
    echo "❌ Installation failed - jsontt command not found"
    exit 1
fi

echo "🎉 Installation completed! You can now use 'jsontt' command."