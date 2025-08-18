#!/bin/bash

# Health Watch Configuration Setup Script
# This script helps you set up a Health Watch configuration quickly

echo "🔧 Health Watch Configuration Setup"
echo "===================================="
echo

if [ -f ".healthwatch.json" ]; then
    echo "⚠️  A .healthwatch.json file already exists."
    echo "   This script will create a backup before proceeding."
    cp .healthwatch.json .healthwatch.json.backup
    echo "   Backup created: .healthwatch.json.backup"
    echo
fi

echo "Choose a configuration template:"
echo "1) Simple      - Basic monitoring (4 channels)"
echo "2) Developer   - Development setup (10 channels)" 
echo "3) Production  - Production monitoring (12 channels)"
echo "4) Template    - Full example (12 channels)"
echo "5) Exit"
echo

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        if [ -f ".healthwatch.json.simple" ]; then
            cp .healthwatch.json.simple .healthwatch.json
            echo "✅ Simple configuration copied to .healthwatch.json"
        else
            echo "❌ Template file .healthwatch.json.simple not found"
            exit 1
        fi
        ;;
    2)
        if [ -f ".healthwatch.json.developer" ]; then
            cp .healthwatch.json.developer .healthwatch.json
            echo "✅ Developer configuration copied to .healthwatch.json"
        else
            echo "❌ Template file .healthwatch.json.developer not found"
            exit 1
        fi
        ;;
    3)
        if [ -f ".healthwatch.json.production" ]; then
            cp .healthwatch.json.production .healthwatch.json
            echo "✅ Production configuration copied to .healthwatch.json"
        else
            echo "❌ Template file .healthwatch.json.production not found"
            exit 1
        fi
        ;;
    4)
        if [ -f ".healthwatch.json.template" ]; then
            cp .healthwatch.json.template .healthwatch.json
            echo "✅ Template configuration copied to .healthwatch.json"
        else
            echo "❌ Template file .healthwatch.json.template not found"
            exit 1
        fi
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo
echo "📝 Next steps:"
echo "1. Edit .healthwatch.json to match your actual services"
echo "2. Replace example.com URLs with your real endpoints"
echo "3. Open VS Code Command Palette (Ctrl+Shift+P)"
echo "4. Run 'Health Watch: Start Watch' to begin monitoring"
echo
echo "📖 See CONFIGURATION.md for detailed customization options"
