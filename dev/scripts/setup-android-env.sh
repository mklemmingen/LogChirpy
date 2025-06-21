#!/bin/bash
# Setup Android Development Environment for Manjaro Linux
# Run with: source ./setup-android-env.sh

# Set environment variables for current session
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export ANDROID_HOME=/home/mklemmingen/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools

# Function to add environment variables to a file if not already present
add_to_file() {
    local file=$1
    local content=$2
    
    if [ -f "$file" ]; then
        if ! grep -q "ANDROID_HOME" "$file"; then
            echo "" >> "$file"
            echo "# Android Development Environment" >> "$file"
            echo "$content" >> "$file"
            echo "Added Android environment to $file"
        else
            echo "Android environment already exists in $file"
        fi
    else
        echo "$file not found, creating..."
        echo "$content" > "$file"
        echo "Created $file with Android environment"
    fi
}

# Environment variables content
ENV_CONTENT="export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export ANDROID_HOME=/home/mklemmingen/Android/Sdk
export ANDROID_SDK_ROOT=\$ANDROID_HOME
export PATH=\$PATH:\$ANDROID_HOME/emulator:\$ANDROID_HOME/tools:\$ANDROID_HOME/tools/bin:\$ANDROID_HOME/platform-tools"

echo "Setting up permanent Android environment variables for Manjaro Linux..."
echo ""

# Add to all relevant shell configuration files
add_to_file "$HOME/.bashrc" "$ENV_CONTENT"
add_to_file "$HOME/.bash_profile" "$ENV_CONTENT"
add_to_file "$HOME/.profile" "$ENV_CONTENT"
add_to_file "$HOME/.zshrc" "$ENV_CONTENT"

# Manjaro-specific locations
add_to_file "$HOME/.xprofile" "$ENV_CONTENT"
add_to_file "$HOME/.pam_environment" "JAVA_HOME=/usr/lib/jvm/java-21-openjdk
ANDROID_HOME=/home/mklemmingen/Android/Sdk
ANDROID_SDK_ROOT=\${ANDROID_HOME}
PATH=\${PATH}:\${ANDROID_HOME}/emulator:\${ANDROID_HOME}/tools:\${ANDROID_HOME}/tools/bin:\${ANDROID_HOME}/platform-tools"

echo ""
echo "- Android development environment variables set for current session:"
echo "   JAVA_HOME: $JAVA_HOME"
echo "   ANDROID_HOME: $ANDROID_HOME"
echo "   ANDROID_SDK_ROOT: $ANDROID_SDK_ROOT"
echo ""
echo "- Environment variables have been permanently added to:"
echo "   • ~/.bashrc (Bash shell)"
echo "   • ~/.bash_profile (Bash login shell)"
echo "   • ~/.profile (POSIX shell)"
echo "   • ~/.zshrc (Zsh shell)"
echo "   • ~/.xprofile (X11 session)"
echo "   • ~/.pam_environment (PAM environment)"
echo ""
echo "- To apply in new terminals/sessions:"
echo "1. Restart your terminal/desktop session, or"
echo "2. Run: source ~/.bashrc (for current terminal)"
echo "3. Log out and log back in (for GUI applications)"