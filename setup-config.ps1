# Health Watch Configuration Setup Script (PowerShell)
# This script helps you set up a Health Watch configuration quickly

Write-Host "🔧 Health Watch Configuration Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path ".healthwatch.json") {
    Write-Host "⚠️  A .healthwatch.json file already exists." -ForegroundColor Yellow
    Write-Host "   This script will create a backup before proceeding." -ForegroundColor Yellow
    Copy-Item ".healthwatch.json" ".healthwatch.json.backup"
    Write-Host "   Backup created: .healthwatch.json.backup" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Choose a configuration template:"
Write-Host "1) Simple      - Basic monitoring (4 channels)"
Write-Host "2) Developer   - Development setup (10 channels)" 
Write-Host "3) Production  - Production monitoring (12 channels)"
Write-Host "4) Template    - Full example (12 channels)"
Write-Host "5) Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    "1" {
        if (Test-Path ".healthwatch.json.simple") {
            Copy-Item ".healthwatch.json.simple" ".healthwatch.json"
            Write-Host "✅ Simple configuration copied to .healthwatch.json" -ForegroundColor Green
        } else {
            Write-Host "❌ Template file .healthwatch.json.simple not found" -ForegroundColor Red
            exit 1
        }
    }
    "2" {
        if (Test-Path ".healthwatch.json.developer") {
            Copy-Item ".healthwatch.json.developer" ".healthwatch.json"
            Write-Host "✅ Developer configuration copied to .healthwatch.json" -ForegroundColor Green
        } else {
            Write-Host "❌ Template file .healthwatch.json.developer not found" -ForegroundColor Red
            exit 1
        }
    }
    "3" {
        if (Test-Path ".healthwatch.json.production") {
            Copy-Item ".healthwatch.json.production" ".healthwatch.json"
            Write-Host "✅ Production configuration copied to .healthwatch.json" -ForegroundColor Green
        } else {
            Write-Host "❌ Template file .healthwatch.json.production not found" -ForegroundColor Red
            exit 1
        }
    }
    "4" {
        if (Test-Path ".healthwatch.json.template") {
            Copy-Item ".healthwatch.json.template" ".healthwatch.json"
            Write-Host "✅ Template configuration copied to .healthwatch.json" -ForegroundColor Green
        } else {
            Write-Host "❌ Template file .healthwatch.json.template not found" -ForegroundColor Red
            exit 1
        }
    }
    "5" {
        Write-Host "👋 Goodbye!" -ForegroundColor Cyan
        exit 0
    }
    default {
        Write-Host "❌ Invalid choice. Please run the script again." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .healthwatch.json to match your actual services"
Write-Host "2. Replace example.com URLs with your real endpoints" 
Write-Host "3. Open VS Code Command Palette (Ctrl+Shift+P)"
Write-Host "4. Run 'Health Watch: Start Watch' to begin monitoring"
Write-Host ""
Write-Host "📖 See CONFIGURATION.md for detailed customization options" -ForegroundColor Cyan
