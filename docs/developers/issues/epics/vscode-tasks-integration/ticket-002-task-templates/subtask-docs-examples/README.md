# 📚 Subtask: Documentation & Examples

![Story Points](https://img.shields.io/badge/Story_Points-1_SP-green?style=flat-square)
![Type](https://img.shields.io/badge/Type-Documentation-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Not_Started-red?style=flat-square)

## 📋 Subtask Overview

**Create comprehensive documentation and real-world examples that enable users to successfully implement task-based monitoring with minimal learning curve. Focus on practical guides, troubleshooting, and best practices.**

## 🎯 Success Criteria

- [ ] **Quick Start Guide** - Users can set up monitoring in under 5 minutes
- [ ] **Template Customization Guide** - Clear instructions for adapting templates
- [ ] **Best Practices Documentation** - Security, performance, and reliability guidelines
- [ ] **Troubleshooting Guide** - Solutions for 20+ common issues
- [ ] **Real-world Examples** - 10+ production-ready scenarios

## 📖 Documentation Structure

### 1. Quick Start Guide

#### 🚀 5-Minute Setup Walkthrough
```markdown
# Health Watch Task Templates - Quick Start

Get monitoring running in 5 minutes with zero configuration!

## Step 1: Install Template Package
```bash
# Option A: NPM package (recommended)
npm install @healthwatch/task-templates

# Option B: Manual download
curl -L https://github.com/healthwatch/templates/archive/main.zip -o templates.zip
unzip templates.zip
```

## Step 2: Copy Base Templates
```bash
# Create VS Code configuration
mkdir -p .vscode scripts

# Copy task templates
cp node_modules/@healthwatch/task-templates/templates/basic-http.json .vscode/tasks.json

# Copy wrapper scripts
cp node_modules/@healthwatch/task-templates/scripts/* scripts/
chmod +x scripts/*.sh  # Unix/macOS only
```

## Step 3: Configure Your Service
```json
// .vscode/settings.json
{
  "healthwatch.targets.primary": "https://your-api.com/health",
  "healthwatch.api.baseUrl": "https://your-api.com",
  "healthwatch.api.token": "your-auth-token-here"
}
```

## Step 4: Add Health Watch Channel
```json
// .healthwatch.json (create this file)
{
  "channels": [
    {
      "id": "api-health",
      "name": "Primary API Health",
      "type": "task",
      "runTask": {
        "enabled": true,
        "label": "healthwatch:http-basic",
        "consent": "explicit"
      },
      "interval": 60,
      "threshold": 3
    }
  ]
}
```

## Step 5: Grant Consent & Monitor! 🎉
1. Health Watch will prompt for consent when first running the task
2. Click "Allow" to grant permission for task execution
3. Watch your service health in real-time!

## ✅ Verification
- Status bar shows "●" (online) or "⚠" (offline)
- Tree view displays your channels
- Dashboard shows recent samples and trends

**🎊 You're monitoring! That was easy, right?**
```

#### 🔧 Template Selection Guide
```markdown
# Choosing the Right Template

## HTTP/API Services
- **basic-http.json** - Simple GET requests, perfect for health endpoints
- **authenticated-api.json** - APIs requiring authentication headers
- **rest-validation.json** - Complex APIs with response validation
- **graphql-health.json** - GraphQL endpoint monitoring

## Databases
- **postgresql.json** - PostgreSQL connection and query testing
- **mysql.json** - MySQL with replication lag checking
- **redis.json** - Redis with memory usage monitoring
- **mongodb.json** - MongoDB replica set health

## Services & Containers
- **docker-container.json** - Single container health checks
- **docker-compose.json** - Multi-service stack monitoring
- **systemd.json** - Linux service monitoring
- **windows-service.json** - Windows service health

## Custom Logic
- **business-validation.json** - Python/Node.js business rule validation
- **integration-test.json** - Test suite as health check

## 🤔 Not Sure Which Template?
Start with **basic-http.json** - it works for 80% of monitoring scenarios!
```

### 2. Template Customization Guide

#### 🎨 Customization Patterns
```markdown
# Customizing Health Watch Templates

## Common Customizations

### Adding Authentication
```json
{
  "args": [
    "--header", "Authorization: Bearer ${config:myapp.apiToken}",
    "--header", "X-API-Key: ${config:myapp.apiKey}",
    "--header", "Content-Type: application/json"
  ]
}
```

### Custom Timeouts & Intervals
```json
{
  "args": [
    "--timeout", "45",  // 45 second timeout
    "--connect-timeout", "10"  // 10 second connection timeout
  ]
}
```

### Environment-Specific Configuration
```json
{
  "options": {
    "env": {
      "NODE_ENV": "${config:healthwatch.environment}",
      "LOG_LEVEL": "${config:healthwatch.logLevel}",
      "CUSTOM_CONFIG": "${workspaceFolder}/config/${config:healthwatch.environment}.json"
    }
  }
}
```

### Multi-Environment Tasks
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:api-staging",
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "https://staging-api.example.com/health",
        "--expected-status", "200",
        "--timeout", "30",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:api-production", 
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "https://api.example.com/health",
        "--expected-status", "200",
        "--timeout", "15",
        "--output-json"
      ]
    }
  ]
}
```

## Advanced Customizations

### Custom Validation Logic
```bash
# In your wrapper script (check-http.sh)
if [[ "$HTTP_STATUS" == "200" ]]; then
  # Parse response body for additional validation
  if echo "$RESPONSE_BODY" | jq -e '.status == "healthy" and .database.connected == true' >/dev/null; then
    SUCCESS=true
  else
    SUCCESS=false
    ERROR_MESSAGE="API returned 200 but health checks failed"
  fi
fi
```

### Conditional Execution
```json
{
  "label": "healthwatch:conditional-check",
  "type": "shell",
  "command": "sh",
  "args": [
    "-c",
    "if [ \"${config:healthwatch.environment}\" = \"production\" ]; then ${workspaceFolder}/scripts/check-production.sh; else ${workspaceFolder}/scripts/check-staging.sh; fi"
  ]
}
```

### Parameterized Scripts
```json
{
  "label": "healthwatch:parameterized",
  "command": "${workspaceFolder}/scripts/check-service.sh",
  "args": [
    "--service-name", "${config:healthwatch.serviceName}",
    "--environment", "${config:healthwatch.environment}",
    "--region", "${config:healthwatch.region}",
    "--timeout", "${config:healthwatch.timeout:30}",
    "--output-json"
  ]
}
```

## 🔧 VS Code Variable Reference

### Built-in Variables
- `${workspaceFolder}` - Path to the workspace root
- `${workspaceFolderBasename}` - Workspace folder name
- `${file}` - Currently open file path
- `${relativeFile}` - Relative path of current file
- `${env:VAR_NAME}` - Environment variable

### Configuration Variables
- `${config:section.setting}` - VS Code setting value
- `${config:section.setting:default}` - Setting with default fallback

### Custom Variables
```json
// .vscode/settings.json
{
  "healthwatch.baseUrl": "https://api.example.com",
  "healthwatch.environment": "production",
  "healthwatch.timeout": 30,
  "healthwatch.retries": 3
}
```
```

#### 🛡️ Security Best Practices
```markdown
# Security Best Practices for Task Templates

## Secrets Management

### ❌ DON'T: Store secrets in templates
```json
{
  "args": ["--token", "sk-1234567890abcdef"]  // NEVER DO THIS!
}
```

### ✅ DO: Use configuration references
```json
{
  "args": ["--token", "${config:myapp.apiToken}"]
}
```

### ✅ DO: Use environment variables
```json
{
  "options": {
    "env": {
      "API_TOKEN": "${env:MYAPP_API_TOKEN}"
    }
  }
}
```

## Input Validation

### Script Parameter Validation
```bash
# In wrapper scripts, always validate inputs
validate_url() {
  if [[ ! "$1" =~ ^https?:// ]]; then
    echo "Error: URL must start with http:// or https://" >&2
    exit 1
  fi
}

validate_timeout() {
  if ! [[ "$1" =~ ^[0-9]+$ ]] || [[ "$1" -lt 1 ]]; then
    echo "Error: Timeout must be a positive integer" >&2
    exit 1
  fi
}
```

### Command Injection Prevention
```bash
# Use array assignment to prevent injection
CURL_ARGS=(
  --url "$URL"
  --header "$HEADER"
  --timeout "$TIMEOUT"
)

# Execute safely
curl "${CURL_ARGS[@]}"
```

## Network Security

### SSL/TLS Verification
```json
{
  "args": [
    "--verify-ssl",  // Always verify certificates in production
    "--timeout", "30"
  ]
}
```

### Restrict Network Access
```json
{
  "options": {
    "env": {
      "HTTP_PROXY": "${config:network.proxy}",
      "NO_PROXY": "localhost,127.0.0.1"
    }
  }
}
```

## File System Security

### Temporary File Handling
```bash
# Create secure temporary files
OUTPUT_FILE=$(mktemp -t healthwatch.XXXXXX.json)
trap 'rm -f "$OUTPUT_FILE"' EXIT

# Set restrictive permissions
chmod 600 "$OUTPUT_FILE"
```

### Path Traversal Prevention
```bash
# Validate file paths
validate_path() {
  local path="$1"
  if [[ "$path" =~ \.\. ]]; then
    echo "Error: Path traversal not allowed" >&2
    exit 1
  fi
}
```

## Execution Security

### Timeout Enforcement
```bash
# Always use timeout to prevent hanging
timeout "${TIMEOUT}" command_that_might_hang
```

### Resource Limits
```json
{
  "options": {
    "env": {
      "MALLOC_ARENA_MAX": "2",  // Limit memory allocation
      "OMP_NUM_THREADS": "1"    // Limit CPU usage
    }
  }
}
```

### Sandboxing Recommendations
```bash
# Run with restricted privileges where possible
if command -v runuser >/dev/null; then
  runuser -u healthwatch-user -- "$COMMAND"
else
  "$COMMAND"
fi
```
```

### 3. Real-World Examples

#### 🌍 Production Scenarios
```markdown
# Real-World Health Watch Examples

## Example 1: E-Commerce API Stack
```json
// .healthwatch.json
{
  "channels": [
    {
      "id": "user-api", 
      "name": "User Service API",
      "type": "task",
      "runTask": {
        "label": "healthwatch:user-api",
        "consent": "explicit"
      },
      "interval": 30,
      "threshold": 2
    },
    {
      "id": "payment-api",
      "name": "Payment Service API", 
      "type": "task",
      "runTask": {
        "label": "healthwatch:payment-api",
        "consent": "explicit"
      },
      "interval": 15,
      "threshold": 1
    },
    {
      "id": "order-db",
      "name": "Order Database",
      "type": "task", 
      "runTask": {
        "label": "healthwatch:postgres-orders",
        "consent": "explicit"
      },
      "interval": 60,
      "threshold": 3
    }
  ]
}
```

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:user-api",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "${config:ecommerce.userApi.url}/health",
        "--header", "Authorization: Bearer ${config:ecommerce.userApi.token}",
        "--expected-status", "200",
        "--timeout", "20",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:payment-api",
      "type": "shell", 
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "${config:ecommerce.paymentApi.url}/health",
        "--header", "X-API-Key: ${config:ecommerce.paymentApi.key}",
        "--expected-status", "200", 
        "--timeout", "10",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:postgres-orders",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-database.sh",
      "args": [
        "--type", "postgres",
        "--host", "${config:ecommerce.db.host}",
        "--database", "orders",
        "--query", "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour'",
        "--timeout", "15",
        "--output-json"
      ],
      "options": {
        "env": {
          "PGUSER": "${config:ecommerce.db.user}",
          "PGPASSWORD": "${config:ecommerce.db.password}"
        }
      }
    }
  ]
}
```

## Example 2: Microservices with Docker
```json
{
  "channels": [
    {
      "id": "user-service",
      "name": "User Service Container",
      "type": "task",
      "runTask": {
        "label": "healthwatch:docker-user-service",
        "consent": "explicit"
      },
      "interval": 45
    },
    {
      "id": "nginx-gateway", 
      "name": "API Gateway",
      "type": "task",
      "runTask": {
        "label": "healthwatch:nginx-gateway",
        "consent": "explicit"
      },
      "interval": 30
    },
    {
      "id": "redis-cache",
      "name": "Redis Cache",
      "type": "task",
      "runTask": {
        "label": "healthwatch:redis-cache",
        "consent": "explicit"
      },
      "interval": 60
    }
  ]
}
```

```json
{
  "tasks": [
    {
      "label": "healthwatch:docker-user-service",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-docker.sh",
      "args": [
        "--container", "user-service",
        "--check-running",
        "--check-healthy", 
        "--check-logs",
        "--timeout", "20",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:nginx-gateway",
      "type": "shell", 
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "http://localhost:8080/health",
        "--expected-status", "200",
        "--timeout", "15",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:redis-cache", 
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-redis.sh",
      "args": [
        "--host", "localhost",
        "--port", "6379",
        "--test-key", "healthcheck:ping",
        "--check-memory-usage",
        "--timeout", "10",
        "--output-json"
      ]
    }
  ]
}
```

## Example 3: Business Logic Validation
```python
# scripts/business-health-check.py
#!/usr/bin/env python3
"""Business logic health check for Health Watch"""

import json
import sys
import time
import requests
from datetime import datetime, timedelta

def check_order_pipeline():
    """Validate the entire order processing pipeline"""
    start_time = time.time() * 1000
    
    try:
        # Check recent order volume
        recent_orders = check_recent_orders()
        
        # Check payment processing
        payment_health = check_payment_processor()
        
        # Check inventory sync
        inventory_health = check_inventory_sync()
        
        # Determine overall health
        all_healthy = all([
            recent_orders['healthy'],
            payment_health['healthy'], 
            inventory_health['healthy']
        ])
        
        duration = int(time.time() * 1000 - start_time)
        
        result = {
            'success': all_healthy,
            'latencyMs': duration,
            'timestamp': int(time.time() * 1000),
            'details': {
                'recentOrders': recent_orders,
                'paymentProcessor': payment_health,
                'inventorySync': inventory_health
            }
        }
        
        if not all_healthy:
            result['error'] = 'One or more business health checks failed'
        
        return result
        
    except Exception as e:
        duration = int(time.time() * 1000 - start_time)
        return {
            'success': False,
            'latencyMs': duration,
            'timestamp': int(time.time() * 1000),
            'error': str(e)
        }

def check_recent_orders():
    """Check if orders are being processed normally"""
    cutoff = datetime.now() - timedelta(minutes=10)
    
    response = requests.get(
        f"{API_BASE}/analytics/orders",
        params={'since': cutoff.isoformat()},
        headers={'Authorization': f'Bearer {API_TOKEN}'},
        timeout=10
    )
    
    if response.status_code != 200:
        return {'healthy': False, 'reason': f'API returned {response.status_code}'}
    
    data = response.json()
    order_count = data.get('count', 0)
    
    # Expect at least 1 order per 10 minutes during business hours
    expected_minimum = 1 if is_business_hours() else 0
    
    return {
        'healthy': order_count >= expected_minimum,
        'orderCount': order_count,
        'expectedMinimum': expected_minimum
    }

if __name__ == '__main__':
    result = check_order_pipeline()
    
    # Output JSON to temporary file for Health Watch
    output_file = f"/tmp/healthwatch-business-{int(time.time())}.json"
    with open(output_file, 'w') as f:
        json.dump(result, f)
    
    print(output_file)
    sys.exit(0 if result['success'] else 1)
```

```json
{
  "label": "healthwatch:business-logic",
  "type": "shell",
  "command": "python3",
  "args": [
    "${workspaceFolder}/scripts/business-health-check.py"
  ],
  "options": {
    "env": {
      "API_BASE": "${config:business.api.baseUrl}",
      "API_TOKEN": "${config:business.api.token}",
      "PYTHONPATH": "${workspaceFolder}/src"
    }
  }
}
```

## Example 4: Multi-Region Monitoring
```json
{
  "channels": [
    {
      "id": "api-us-east",
      "name": "API - US East",
      "type": "task",
      "runTask": {
        "label": "healthwatch:api-us-east",
        "consent": "explicit"
      },
      "interval": 30
    },
    {
      "id": "api-eu-west", 
      "name": "API - EU West",
      "type": "task",
      "runTask": {
        "label": "healthwatch:api-eu-west",
        "consent": "explicit"
      },
      "interval": 30
    },
    {
      "id": "cdn-global",
      "name": "CDN Global Edge",
      "type": "task", 
      "runTask": {
        "label": "healthwatch:cdn-global",
        "consent": "explicit"
      },
      "interval": 60
    }
  ]
}
```

```json
{
  "tasks": [
    {
      "label": "healthwatch:api-us-east",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "https://api-us-east.example.com/health",
        "--header", "X-Region: us-east-1",
        "--expected-status", "200",
        "--timeout", "20",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:api-eu-west",
      "type": "shell", 
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "https://api-eu-west.example.com/health",
        "--header", "X-Region: eu-west-1", 
        "--expected-status", "200",
        "--timeout", "25",
        "--output-json"
      ]
    },
    {
      "label": "healthwatch:cdn-global",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-cdn.sh",
      "args": [
        "--endpoints", "https://cdn.example.com/health,https://cdn-asia.example.com/health",
        "--timeout", "30",
        "--check-cache-headers",
        "--output-json"
      ]
    }
  ]
}
```
```

### 4. Troubleshooting Guide

#### 🔧 Common Issues & Solutions
```markdown
# Health Watch Task Troubleshooting Guide

## Task Execution Issues

### Problem: Task not found
```
Error: Could not find task "healthwatch:api-check"
```

**Solution:**
1. Check `.vscode/tasks.json` exists and contains the task
2. Verify task label matches exactly (case-sensitive)
3. Restart VS Code to reload task definitions

```bash
# Verify task exists
code --list-tasks
```

### Problem: Script permission denied
```
Error: Permission denied: ./scripts/check-http.sh
```

**Solution (Unix/macOS):**
```bash
chmod +x scripts/*.sh
```

**Solution (Windows):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Problem: Script not found
```
Error: No such file or directory: ./scripts/check-http.sh
```

**Solution:**
1. Verify script file exists in the correct location
2. Check file path in task definition
3. Use absolute paths if relative paths fail

```json
{
  "command": "${workspaceFolder}/scripts/check-http.sh"
}
```

## Network & Connectivity Issues

### Problem: Connection timeout
```
Error: HTTP request timed out
```

**Solutions:**
1. Increase timeout value
```json
{
  "args": ["--timeout", "60"]
}
```

2. Check network connectivity
```bash
# Test connectivity directly
curl -I https://your-api.com/health
```

3. Configure proxy if needed
```json
{
  "options": {
    "env": {
      "HTTP_PROXY": "http://proxy.company.com:8080",
      "HTTPS_PROXY": "http://proxy.company.com:8080"
    }
  }
}
```

### Problem: SSL certificate verification failed
```
Error: SSL certificate problem: self signed certificate
```

**Solutions:**
1. For development/testing only:
```json
{
  "args": ["--no-verify-ssl"]
}
```

2. For production, add certificate:
```bash
# Add custom CA certificate
sudo cp custom-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

### Problem: DNS resolution failed
```
Error: Could not resolve host: api.internal.com
```

**Solutions:**
1. Add host to `/etc/hosts` (Unix) or `C:\Windows\System32\drivers\etc\hosts` (Windows)
```
192.168.1.100 api.internal.com
```

2. Configure custom DNS
```json
{
  "options": {
    "env": {
      "RESOLVER_CONFIG": "/path/to/custom/resolv.conf"
    }
  }
}
```

## Authentication Issues

### Problem: API returns 401 Unauthorized
```
Error: Unexpected HTTP status: 401 (expected: 200)
```

**Solutions:**
1. Verify token configuration
```json
// .vscode/settings.json
{
  "myapp.apiToken": "your-valid-token"
}
```

2. Check token format in task
```json
{
  "args": ["--header", "Authorization: Bearer ${config:myapp.apiToken}"]
}
```

3. Test authentication manually
```bash
curl -H "Authorization: Bearer your-token" https://api.example.com/health
```

### Problem: Token expired or invalid
**Solutions:**
1. Refresh token in settings
2. Implement token refresh in wrapper script
```bash
# In wrapper script
if [[ "$HTTP_STATUS" == "401" ]]; then
  echo "Token may be expired, check configuration" >&2
fi
```

## Database Connection Issues

### Problem: Database connection refused
```
Error: PostgreSQL connection failed
```

**Solutions:**
1. Verify database is running
```bash
pg_isready -h localhost -p 5432
```

2. Check connection parameters
```json
{
  "options": {
    "env": {
      "PGHOST": "localhost",
      "PGPORT": "5432", 
      "PGDATABASE": "myapp",
      "PGUSER": "health_checker",
      "PGPASSWORD": "secure_password"
    }
  }
}
```

3. Test connection manually
```bash
psql "postgresql://user:pass@host:port/db" -c "SELECT 1"
```

### Problem: Database timeout
**Solutions:**
1. Increase timeout
```json
{
  "args": ["--timeout", "30"]
}
```

2. Optimize query
```sql
-- Use lightweight health check query
SELECT 1 as health_check;
```

## Configuration Issues

### Problem: VS Code variable not resolved
```
Error: ${config:myapp.apiUrl} not found
```

**Solutions:**
1. Add setting to workspace settings
```json
// .vscode/settings.json
{
  "myapp.apiUrl": "https://api.example.com"
}
```

2. Use environment variable fallback
```json
{
  "args": ["--url", "${config:myapp.apiUrl:${env:API_URL}}"]
}
```

### Problem: Environment variable not set
**Solutions:**
1. Set in shell profile
```bash
# ~/.bashrc or ~/.zshrc
export API_TOKEN="your-token"
```

2. Set in VS Code launch configuration
```json
// .vscode/launch.json
{
  "configurations": [{
    "env": {
      "API_TOKEN": "your-token"
    }
  }]
}
```

## Output & Parsing Issues

### Problem: JSON output malformed
**Solutions:**
1. Validate JSON in wrapper script
```bash
if ! echo "$OUTPUT" | jq empty 2>/dev/null; then
  echo "Error: Invalid JSON output" >&2
  exit 1
fi
```

2. Use structured output template
```bash
cat > "$OUTPUT_FILE" << EOF
{
  "success": $SUCCESS,
  "latencyMs": $DURATION,
  "timestamp": $(date +%s)000
}
EOF
```

### Problem: Health Watch can't read output
**Solutions:**
1. Ensure output file is written before script exits
```bash
# Sync file to disk
sync "$OUTPUT_FILE"
```

2. Use consistent file naming
```bash
OUTPUT_FILE="/tmp/healthwatch-$(basename "$0" .sh)-$(date +%s).json"
```

## Platform-Specific Issues

### Windows PowerShell Issues
**Problem: Execution policy prevents script execution**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Problem: Path separators in tasks.json**
```json
{
  "command": "${workspaceFolder}\\scripts\\Check-Http.ps1"
}
```

### macOS Issues  
**Problem: Gatekeeper blocks unsigned scripts**
```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine scripts/check-http.sh
```

### Linux Issues
**Problem: Missing dependencies**
```bash
# Install common tools
sudo apt-get install curl jq postgresql-client redis-tools
```

## Performance Issues

### Problem: High CPU usage during checks
**Solutions:**
1. Limit concurrent checks
2. Increase check intervals
3. Optimize wrapper scripts

### Problem: Memory leaks in long-running checks
**Solutions:**
1. Add timeout guards
2. Clean up temporary files
3. Use process isolation

```bash
# Clean up on exit
trap 'rm -f "$TEMP_FILES"' EXIT
```

## Debugging Tips

### Enable Debug Logging
```bash
# In wrapper scripts
if [[ "${DEBUG:-false}" == "true" ]]; then
  set -x  # Enable bash debug output
fi
```

### Test Tasks Manually
```bash
# Execute task directly
.vscode/tasks.json -> copy command and args
./scripts/check-http.sh --url https://api.example.com --output-json
```

### Check Health Watch Logs
```
VS Code -> Developer -> Toggle Developer Tools -> Console
Look for Health Watch log messages
```

---

Need more help? Check our [FAQ](FAQ.md) or [open an issue](https://github.com/healthwatch/issues).
```

## 📋 Documentation Deliverables

### Quick Start Materials
- [ ] **5-Minute Setup Guide** - Zero-configuration walkthrough
- [ ] **Template Selection Guide** - Choose the right template for your use case
- [ ] **Verification Checklist** - Confirm everything is working correctly

### Customization Documentation
- [ ] **Parameter Reference** - Complete documentation of all template options
- [ ] **VS Code Variables Guide** - Using workspace variables and settings
- [ ] **Security Best Practices** - Safe handling of secrets and network requests
- [ ] **Advanced Patterns** - Complex scenarios and custom logic

### Real-World Examples
- [ ] **E-Commerce Stack** - Multi-service API monitoring
- [ ] **Microservices with Docker** - Container health checking
- [ ] **Business Logic Validation** - Custom Python/Node.js health checks
- [ ] **Multi-Region Setup** - Geographic distribution monitoring
- [ ] **Database Monitoring** - SQL and NoSQL health validation

### Troubleshooting Resources
- [ ] **Common Issues Guide** - 20+ frequent problems and solutions
- [ ] **Platform-Specific Notes** - Windows, macOS, Linux differences
- [ ] **Debug Techniques** - How to diagnose template issues
- [ ] **Performance Optimization** - Reduce overhead and improve reliability

### Integration Materials
- [ ] **CI/CD Integration** - Using templates in automated pipelines
- [ ] **Team Setup Guide** - Sharing templates across development teams
- [ ] **Enterprise Patterns** - Large-scale deployment considerations
- [ ] **Migration Guide** - Converting from other monitoring solutions

---

*This subtask creates the comprehensive documentation that transforms complex task-based monitoring into a simple, approachable solution. Clear guides and real-world examples ensure every user can successfully implement monitoring for their specific use case.*

📚 **Comprehensive Guides** | 🌍 **Real-World Examples** | 🔧 **Troubleshooting Solutions**
