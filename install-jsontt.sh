#!/bin/bash

set -e  # Exit on any error

# Log file for npm output
LOG_FILE="/tmp/jsontt-install-$(date +%F-%T).log"

echo "Starting installation of @parvineyvazov/json-translator..."

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi
echo "✅ Node.js and npm found."

# Verify npm cache
echo "Verifying npm cache..."
if ! npm cache verify >> "$LOG_FILE" 2>&1; then
    echo "⚠️ npm cache verification failed. Continuing anyway..."
fi

# Check global npm directory permissions
NPM_GLOBAL_DIR=$(npm prefix -g)/lib/node_modules
if ! [ -w "$NPM_GLOBAL_DIR" ]; then
    echo "⚠️ No write permission to $NPM_GLOBAL_DIR. You may need to run with sudo."
    echo "Try running: sudo $0"
    exit 1
fi

# Install or update @parvineyvazov/json-translator
echo "Installing @parvineyvazov/json-translator globally..."
if ! npm install -g @parvineyvazov/json-translator@latest >> "$LOG_FILE" 2>&1; then
    echo "❌ Installation failed. Check $LOG_FILE for details."
    exit 1
fi

# Verify installation
echo "Verifying installation..."
if command -v jsontt >/dev/null 2>&1; then
    echo "✅ jsontt CLI installed successfully!"
    echo "Version information:"
    jsontt --version || {
        echo "❌ jsontt --version failed. CLI may be misconfigured."
        exit 1
    }
else
    echo "❌ Installation failed - jsontt command not found."
    exit 1
fi

# Functional test
echo "Testing jsontt functionality..."
TEST_FILE="/tmp/jsontt-test.json"
TEST_OUTPUT="/tmp/jsontt-test.hi.json"
echo '"test"' > "$TEST_FILE"
if jsontt "$TEST_FILE" --module google2 -f en --to hi --name jsontt-test >> "$LOG_FILE" 2>&1; then
    if [ -f "$TEST_OUTPUT" ]; then
        echo "✅ jsontt functional test passed."
        rm -f "$TEST_FILE" "$TEST_OUTPUT"
    else
        echo "❌ Functional test failed - output file not created."
        exit 1
    fi
else
    echo "❌ Functional test failed. Check $LOG_FILE for details."
    rm -f "$TEST_FILE" "$TEST_OUTPUT" 2>/dev/null
    exit 1
fi

# Final success message
echo "🎉 Installation completed! You can now use the 'jsontt' command."
echo "Installation logs saved to $LOG_FILE."

# #!/bin/bash

# set -e  # Exit on any error

# echo "Installing @parvineyvazov/json-translator globally..."

# # Install the package globally from npm
# npm install -g @parvineyvazov/json-translator

# # Verify installation
# if command -v jsontt &> /dev/null; then
#     echo "✅ jsontt CLI installed successfully!"
#     echo "Version information:"
#     jsontt --version
# else
#     echo "❌ Installation failed - jsontt command not found"
#     exit 1
# fi

# echo "🎉 Installation completed! You can now use 'jsontt' command."