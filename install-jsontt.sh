#!/bin/bash

set -e  # Exit on any error

echo "Installing @parvineyvazov/json-translator globally..."

# Install the package globally from npm
npm install -g @parvineyvazov/json-translator

# Verify installation
if command -v jsontt &> /dev/null; then
    echo "✅ jsontt CLI installed successfully!"
    echo "Version information:"
    jsontt --version
else
    echo "❌ Installation failed - jsontt command not found"
    exit 1
fi

echo "🎉 Installation completed! You can now use 'jsontt' command."