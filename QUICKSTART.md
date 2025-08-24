![User Quickstart Banner](data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIAogICAgPHBhdHRlcm4gaWQ9InBhdHRlcm4iIHg9IjAiIHk9IjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgICAgIDxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2RjMjYyNiIvPgogICAgICA8cGF0aCBkPSJNMCwxMCBRMTUsNSAzMCwxMCBUNjAsMTAiIHN0cm9rZT0iI2ZiYmYyNCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjMiLz4KICAgIDwvcGF0dGVybj4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InVybCgjcGF0dGVybikiLz4KICA8dGV4dCB4PSI0MDAiIHk9IjM1IiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2siIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Vc2VyIFF1aWNrc3RhcnQ8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjZmJiZjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5IZWFsdGggV2F0Y2ggU2V0dXAgJiBHZXR0aW5nIFN0YXJ0ZWQ8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSI3NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNykiIHRleHQtYW5jaG9yPSJtaWRkbGUiPvCfk4og8J+agCBRdWljayBTZXR1cCDigKIgNSBNaW51dGVzIOKAoiBQcm9kdWN0aW9uIFJlYWR5PC90ZXh0Pgo8L3N2Zz4=)

# Health Watch - User Quickstart Guide 🚀

**Get up and running with Health Watch in under 5 minutes!**

Health Watch is a VS Code extension that monitors your services, websites, and infrastructure in real-time. No external dependencies, no cloud services - everything runs locally in VS Code.

## ⚡ Quick Setup (2 minutes)

### Step 1: Install the Extension
- Open VS Code Extensions panel (`Ctrl+Shift+X`)
- Search for "Health Watch" 
- Click Install

### Step 2: Choose Your Setup Style

#### 🛠️ **Option A: Manual Template Copy**
```bash
# For developers (APIs, databases, local services)
cp .healthwatch.json.developer .healthwatch.json

# For simple website monitoring
cp .healthwatch.json.simple .healthwatch.json

# For production environments
cp .healthwatch.json.production .healthwatch.json
```

### Step 3: Start Monitoring
1. Open VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type: `Health Watch: Start Watch`
3. Choose duration: `1 hour`, `12 hours`, or `forever`

**Done!** 🎉 You'll see the status in your VS Code status bar.

---

## 📊 Quick Feature Tour

### Real-Time Dashboard
- **Command:** `Health Watch: Open Dashboard`
- **What you get:** Live charts, timelines, and heatmaps of your service health

### Status Bar Monitoring
- **Green dots** 🟢 = Everything's healthy
- **Red dots** 🔴 = Something's down
- **Click** any status to see details

### Incident Management
- **Add incidents:** `Health Watch: Add Incident`
- **View tree:** Check the Health Watch panel in VS Code sidebar
- **Track resolution:** Built-in incident lifecycle

### Smart Reports
- **Auto-generated** after each watch session
- **Markdown format** with Mermaid charts
- **Command:** `Health Watch: Open Last Report`

---

## 🔧 Basic Configuration

Your monitoring is controlled by `.healthwatch.json` in your workspace:

```json
{
  "channels": [
    {
      "id": "my-website",
      "name": "My Website",
      "type": "https",
      "url": "https://mysite.com",
      "intervalSec": 30
    },
    {
      "id": "local-api",
      "name": "Local API",
      "type": "https", 
      "url": "http://localhost:3000/health",
      "intervalSec": 15
    }
  ]
}
```

### Channel Types You Can Monitor

| Type | What It Monitors | Example |
|------|------------------|---------|
| `https` | Websites, APIs, health endpoints | `https://api.myservice.com/health` |
| `tcp` | Database connections, servers | `db.mycompany.com:5432` |
| `dns` | DNS resolution | `mysite.com` |
| `script` | Custom checks (requires enabling) | Custom PowerShell/bash scripts |

---

## 🚨 Common First-Time Issues

### "No channels configured"
- **Fix:** Make sure `.healthwatch.json` exists in your workspace root
- **Quick fix:** Run the setup script or copy a template

### "All channels offline" 
- **Check:** Your internet connection
- **Check:** URLs in your config are accessible
- **Try:** `Health Watch: Run All Probes Now` to test manually

### Extension not starting
- **Fix:** Reload VS Code window (`Ctrl+R` / `Cmd+R`)
- **Check:** VS Code output panel for error messages

---

## 🎯 Common Use Cases

### 📱 **Website Monitoring**
```json
{
  "channels": [
    {
      "id": "main-site",
      "name": "Main Website", 
      "type": "https",
      "url": "https://mywebsite.com",
      "expect": { "status": [200, 301] }
    }
  ]
}
```

### 🔌 **Development Environment**
```json
{
  "channels": [
    {
      "id": "frontend",
      "name": "Frontend Dev Server",
      "type": "https", 
      "url": "http://localhost:3000"
    },
    {
      "id": "api",
      "name": "Backend API",
      "type": "https",
      "url": "http://localhost:8080/health"
    },
    {
      "id": "database", 
      "name": "PostgreSQL",
      "type": "tcp",
      "target": "localhost:5432"
    }
  ]
}
```

### 🏢 **Production Infrastructure**
```json
{
  "channels": [
    {
      "id": "prod-api",
      "name": "Production API",
      "type": "https",
      "url": "https://api.mycompany.com/health",
      "expect": { "bodyRegex": "healthy|ok" }
    },
    {
      "id": "cdn",
      "name": "CDN Health",
      "type": "https", 
      "url": "https://cdn.mycompany.com/ping"
    }
  ]
}
```

---

## ⚙️ Essential Settings

Open VS Code Settings (`Ctrl+,`) and search for "Health Watch":

### Key Settings to Customize
- **`healthWatch.defaults.intervalSec`**: How often to check (default: 60s)
- **`healthWatch.statusBar.mode`**: Status bar display style
- **`healthWatch.watch.defaultDuration`**: Default monitoring duration
- **`healthWatch.report.autoOpen`**: Auto-open reports after sessions

### Status Bar Modes
- **`minimal`**: Shows overall health indicator
- **`mini-multi-channel`**: Shows individual channel status
- **`none`**: Hides status bar completely

---

## 🚀 Advanced Features (When You're Ready)

### Guards (Prevent False Positives)
```json
{
  "guards": [
    {
      "id": "internet",
      "type": "internet",
      "targets": ["8.8.8.8", "1.1.1.1"]
    }
  ],
  "channels": [
    {
      "id": "internal-service",
      "name": "Internal Service", 
      "type": "https",
      "url": "https://internal.company.com",
      "guards": ["internet"]
    }
  ]
}
```

### SLO Monitoring
- Set availability targets (default: 99%)
- Track performance against SLOs
- Get recommendations for improvement

### Live Activity Monitoring
- **Command:** `Health Watch: Open Dashboard` → Live Monitor tab
- Real-time probe results as they happen
- Perfect for troubleshooting

---

## 📚 What's Next?

1. **Customize your config** - Add your actual services to `.healthwatch.json`
2. **Set up notifications** - Configure VS Code notifications for outages  
3. **Explore the dashboard** - Try all the different views and charts
4. **Review reports** - Check the generated reports after watch sessions
5. **Advanced features** - Explore guards, SLO tracking, and incident management

## 🆘 Need Help?

- **Documentation:** Check the `docs/` folder for detailed guides
- **Configuration Help:** See `CONFIGURATION.md`
- **Issues:** Check existing GitHub issues or create a new one
- **Templates:** Look at the `.healthwatch.json.*` template files

---

**Happy Monitoring!** 🎯

*Health Watch v1.0.6 - Local-first monitoring for VS Code*
