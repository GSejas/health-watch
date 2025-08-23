# 🎨 Subtask: Templates & Samples Creation

![Story Points](https://img.shields.io/badge/Story_Points-1_SP-green?style=flat-square)
![Type](https://img.shields.io/badge/Type-Template_Creation-blue?style=flat-square)
![Status](https://img.shields.io/badge/Status-Not_Started-red?style=flat-square)

## 📋 Subtask Overview

**Create a comprehensive library of task templates and wrapper scripts that cover the most common monitoring scenarios. Templates should be production-ready, well-documented, and easy to customize.**

## 🎯 Success Criteria

- [ ] **20+ task templates** covering major monitoring scenarios
- [ ] **8+ wrapper scripts** with robust error handling and JSON output
- [ ] **Cross-platform compatibility** (Windows PowerShell, bash, zsh)
- [ ] **Security best practices** built into all templates
- [ ] **Performance optimization** (efficient timeouts, minimal overhead)

## 📁 Template Categories

### 1. HTTP/HTTPS Health Checks

#### 🌐 Basic HTTP Templates
```json
// templates/http/basic-get.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:http-basic",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "${config:healthwatch.targets.primary}",
        "--timeout", "30",
        "--output-json"
      ],
      "group": "test",
      "presentation": {
        "echo": false,
        "reveal": "silent",
        "panel": "shared",
        "showReuseMessage": false
      }
    }
  ]
}
```

```json
// templates/http/authenticated-api.json  
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:api-auth",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-http.sh",
      "args": [
        "--url", "${config:healthwatch.api.baseUrl}/health",
        "--method", "GET",
        "--header", "Authorization: Bearer ${config:healthwatch.api.token}",
        "--header", "Content-Type: application/json",
        "--expected-status", "200",
        "--timeout", "45",
        "--verify-ssl",
        "--output-json"
      ],
      "options": {
        "env": {
          "USER_AGENT": "HealthWatch/2.0",
          "REQUEST_ID": "${config:healthwatch.requestId}"
        }
      }
    }
  ]
}
```

#### 🔒 Advanced HTTP Templates
```json
// templates/http/rest-api-validation.json
{
  "version": "2.0.0", 
  "tasks": [
    {
      "label": "healthwatch:rest-validation",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-rest-api.sh",
      "args": [
        "--base-url", "${config:healthwatch.api.baseUrl}",
        "--auth-token", "${config:healthwatch.api.token}",
        "--validate-endpoints", "/health,/metrics,/version",
        "--check-response-time",
        "--validate-json-schema",
        "--timeout", "60",
        "--output-json"
      ]
    }
  ]
}
```

```json
// templates/http/graphql-health.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:graphql",
      "type": "shell", 
      "command": "${workspaceFolder}/scripts/check-graphql.sh",
      "args": [
        "--endpoint", "${config:healthwatch.graphql.endpoint}",
        "--query", "{ health { status timestamp } }",
        "--headers-file", "${workspaceFolder}/.healthwatch/graphql-headers.json",
        "--timeout", "30",
        "--output-json"
      ]
    }
  ]
}
```

### 2. Database & Data Store Templates

#### 🗄️ SQL Database Templates
```json
// templates/database/postgresql.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:postgres",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-database.sh",
      "args": [
        "--type", "postgres",
        "--host", "${config:healthwatch.db.host}",
        "--port", "${config:healthwatch.db.port}",
        "--database", "${config:healthwatch.db.name}",
        "--query", "SELECT 1 as health_check",
        "--timeout", "15",
        "--output-json"
      ],
      "options": {
        "env": {
          "PGUSER": "${config:healthwatch.db.user}",
          "PGPASSWORD": "${config:healthwatch.db.password}",
          "PGCONNECT_TIMEOUT": "10"
        }
      }
    }
  ]
}
```

```json
// templates/database/mysql.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:mysql",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-database.sh", 
      "args": [
        "--type", "mysql",
        "--host", "${config:healthwatch.mysql.host}",
        "--port", "${config:healthwatch.mysql.port}",
        "--database", "${config:healthwatch.mysql.database}",
        "--check-replica-lag",
        "--timeout", "20",
        "--output-json"
      ],
      "options": {
        "env": {
          "MYSQL_USER": "${config:healthwatch.mysql.user}",
          "MYSQL_PASSWORD": "${config:healthwatch.mysql.password}"
        }
      }
    }
  ]
}
```

#### 🚀 NoSQL & Cache Templates
```json
// templates/nosql/redis.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:redis",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-redis.sh",
      "args": [
        "--host", "${config:healthwatch.redis.host}",
        "--port", "${config:healthwatch.redis.port}",
        "--auth", "${config:healthwatch.redis.password}",
        "--test-key", "healthwatch:ping:${workspaceFolderBasename}",
        "--check-memory-usage",
        "--timeout", "10",
        "--output-json"
      ]
    }
  ]
}
```

```json
// templates/nosql/mongodb.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:mongodb",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-mongodb.sh",
      "args": [
        "--connection-string", "${config:healthwatch.mongodb.connectionString}",
        "--database", "${config:healthwatch.mongodb.database}",
        "--collection", "health_check",
        "--check-replica-set",
        "--timeout", "25",
        "--output-json"
      ]
    }
  ]
}
```

### 3. Container & Service Templates

#### 🐳 Docker Health Templates
```json
// templates/docker/container-health.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:docker-container",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-docker.sh",
      "args": [
        "--container", "${config:healthwatch.docker.containerName}",
        "--check-running",
        "--check-healthy",
        "--check-logs",
        "--timeout", "20",
        "--output-json"
      ]
    }
  ]
}
```

```json
// templates/docker/compose-stack.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:docker-compose",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-docker-compose.sh",
      "args": [
        "--compose-file", "${config:healthwatch.docker.composeFile}",
        "--services", "${config:healthwatch.docker.services}",
        "--check-networks",
        "--check-volumes", 
        "--timeout", "30",
        "--output-json"
      ]
    }
  ]
}
```

#### 🔧 System Service Templates
```json
// templates/services/systemd.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:systemd-service",
      "type": "shell",
      "command": "${workspaceFolder}/scripts/check-systemd.sh",
      "args": [
        "--service", "${config:healthwatch.service.name}",
        "--check-status",
        "--check-recent-failures",
        "--check-memory-usage",
        "--timeout", "15",
        "--output-json"
      ]
    }
  ]
}
```

```json
// templates/services/windows-service.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:windows-service", 
      "type": "shell",
      "command": "powershell.exe",
      "args": [
        "-ExecutionPolicy", "Bypass",
        "-File", "${workspaceFolder}/scripts/Check-WindowsService.ps1",
        "-ServiceName", "${config:healthwatch.service.name}",
        "-CheckPerformanceCounters",
        "-Timeout", "15",
        "-OutputJson"
      ]
    }
  ]
}
```

### 4. Custom Script Templates

#### 📝 Business Logic Templates
```json
// templates/custom/business-validation.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:business-logic",
      "type": "shell",
      "command": "${config:healthwatch.custom.interpreter}",
      "args": [
        "${workspaceFolder}/scripts/business-health-check.py",
        "--config", "${workspaceFolder}/.healthwatch/business-config.json",
        "--timeout", "60",
        "--output-json"
      ],
      "options": {
        "env": {
          "PYTHONPATH": "${workspaceFolder}/src:${workspaceFolder}/lib",
          "HEALTH_CHECK_ENV": "${config:healthwatch.environment}"
        }
      }
    }
  ]
}
```

```json
// templates/custom/integration-test.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "healthwatch:integration-test",
      "type": "shell", 
      "command": "npm",
      "args": [
        "run",
        "test:integration:health",
        "--",
        "--reporter", "json",
        "--timeout", "45000"
      ],
      "options": {
        "cwd": "${workspaceFolder}",
        "env": {
          "NODE_ENV": "test",
          "HEALTH_CHECK_MODE": "true"
        }
      }
    }
  ]
}
```

## 🔧 Wrapper Script Library

### 1. Universal HTTP Check Script

#### check-http.sh (bash/zsh)
```bash
#!/bin/bash
# scripts/check-http.sh - Production-ready HTTP health checker
# Supports: authentication, custom headers, SSL verification, JSON output

set -euo pipefail

# Configuration with defaults
declare -A CONFIG=(
    [URL]=""
    [METHOD]="GET"
    [TIMEOUT]=30
    [EXPECTED_STATUS]=200
    [OUTPUT_JSON]=false
    [FOLLOW_REDIRECTS]=false
    [VERIFY_SSL]=true
    [USER_AGENT]="HealthWatch/2.0"
    [MAX_REDIRECTS]=5
    [CONNECT_TIMEOUT]=10
)

declare -a HEADERS=()
declare -a CURL_EXTRA_ARGS=()

# Argument parsing
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --url)
                CONFIG[URL]="$2"
                shift 2
                ;;
            --method)
                CONFIG[METHOD]="$(echo "$2" | tr '[:lower:]' '[:upper:]')"
                shift 2
                ;;
            --timeout)
                CONFIG[TIMEOUT]="$2"
                shift 2
                ;;
            --expected-status)
                CONFIG[EXPECTED_STATUS]="$2"
                shift 2
                ;;
            --header)
                HEADERS+=("$2")
                shift 2
                ;;
            --output-json)
                CONFIG[OUTPUT_JSON]=true
                shift
                ;;
            --follow-redirects)
                CONFIG[FOLLOW_REDIRECTS]=true
                shift
                ;;
            --no-verify-ssl)
                CONFIG[VERIFY_SSL]=false
                shift
                ;;
            --user-agent)
                CONFIG[USER_AGENT]="$2"
                shift 2
                ;;
            --max-redirects)
                CONFIG[MAX_REDIRECTS]="$2"
                shift 2
                ;;
            --connect-timeout)
                CONFIG[CONNECT_TIMEOUT]="$2"
                shift 2
                ;;
            --curl-arg)
                CURL_EXTRA_ARGS+=("$2")
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "Error: Unknown option '$1'" >&2
                echo "Use --help for usage information" >&2
                exit 1
                ;;
        esac
    done
}

# Validation
validate_config() {
    if [[ -z "${CONFIG[URL]}" ]]; then
        echo "Error: --url is required" >&2
        exit 1
    fi
    
    if ! [[ "${CONFIG[TIMEOUT]}" =~ ^[0-9]+$ ]] || [[ "${CONFIG[TIMEOUT]}" -lt 1 ]]; then
        echo "Error: --timeout must be a positive integer" >&2
        exit 1
    fi
    
    if ! [[ "${CONFIG[EXPECTED_STATUS]}" =~ ^[0-9]{3}$ ]]; then
        echo "Error: --expected-status must be a 3-digit HTTP status code" >&2
        exit 1
    fi
}

# Build curl command
build_curl_command() {
    local -a cmd=(curl)
    
    # Basic options
    cmd+=(--silent --show-error)
    cmd+=(--write-out "HTTPSTATUS:%{http_code};TOTAL_TIME:%{time_total};SIZE:%{size_download};REDIRECT_COUNT:%{num_redirects}")
    cmd+=(--max-time "${CONFIG[TIMEOUT]}")
    cmd+=(--connect-timeout "${CONFIG[CONNECT_TIMEOUT]}")
    cmd+=(--user-agent "${CONFIG[USER_AGENT]}")
    
    # SSL verification
    if [[ "${CONFIG[VERIFY_SSL]}" == false ]]; then
        cmd+=(--insecure)
    fi
    
    # Redirects
    if [[ "${CONFIG[FOLLOW_REDIRECTS]}" == true ]]; then
        cmd+=(--location --max-redirs "${CONFIG[MAX_REDIRECTS]}")
    fi
    
    # Headers
    for header in "${HEADERS[@]}"; do
        cmd+=(--header "$header")
    done
    
    # HTTP method
    cmd+=(--request "${CONFIG[METHOD]}")
    
    # Extra curl arguments
    for arg in "${CURL_EXTRA_ARGS[@]}"; do
        cmd+=("$arg")
    done
    
    # URL (must be last)
    cmd+=("${CONFIG[URL]}")
    
    echo "${cmd[@]}"
}

# Execute HTTP check
execute_check() {
    local start_time end_time duration response curl_exit=0
    
    start_time=$(date +%s%3N)
    
    # Execute curl with timeout wrapper
    response=$(timeout $((CONFIG[TIMEOUT] + 10)) $(build_curl_command) 2>&1) || curl_exit=$?
    
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    # Parse curl output
    local http_status curl_time response_size redirect_count
    http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2 || echo "0")
    curl_time=$(echo "$response" | grep -o "TOTAL_TIME:[0-9.]*" | cut -d: -f2 || echo "0")
    response_size=$(echo "$response" | grep -o "SIZE:[0-9]*" | cut -d: -f2 || echo "0") 
    redirect_count=$(echo "$response" | grep -o "REDIRECT_COUNT:[0-9]*" | cut -d: -f2 || echo "0")
    
    # Determine success/failure
    local success=true error_message=""
    
    if [[ $curl_exit -ne 0 ]]; then
        success=false
        case $curl_exit in
            124) error_message="HTTP request timed out" ;;
            6) error_message="Could not resolve host" ;;
            7) error_message="Failed to connect to host" ;;
            28) error_message="Operation timeout" ;;
            35) error_message="SSL connect error" ;;
            60) error_message="SSL certificate problem" ;;
            *) error_message="HTTP request failed (curl exit code: $curl_exit)" ;;
        esac
    elif [[ "$http_status" != "${CONFIG[EXPECTED_STATUS]}" ]]; then
        success=false
        error_message="Unexpected HTTP status: $http_status (expected: ${CONFIG[EXPECTED_STATUS]})"
    fi
    
    # Output results
    output_results "$success" "$duration" "$error_message" \
                  "$http_status" "$curl_time" "$response_size" "$redirect_count"
    
    # Exit with appropriate code
    if [[ "$success" == true ]]; then
        exit 0
    else
        exit 1
    fi
}

# Output formatting
output_results() {
    local success=$1 duration=$2 error_message=$3
    local http_status=$4 curl_time=$5 response_size=$6 redirect_count=$7
    
    if [[ "${CONFIG[OUTPUT_JSON]}" == true ]]; then
        # Create temp file for JSON output
        local output_file="/tmp/healthwatch-http-$(date +%s)-$$.json"
        
        cat > "$output_file" << EOF
{
  "success": $success,
  "latencyMs": $duration,
  "timestamp": $(date +%s)000,
  "details": {
    "httpStatus": $http_status,
    "expectedStatus": ${CONFIG[EXPECTED_STATUS]},
    "curlTime": $curl_time,
    "responseSize": $response_size,
    "redirectCount": $redirect_count,
    "method": "${CONFIG[METHOD]}",
    "url": "${CONFIG[URL]}",
    "userAgent": "${CONFIG[USER_AGENT]}",
    "sslVerification": ${CONFIG[VERIFY_SSL]},
    "followRedirects": ${CONFIG[FOLLOW_REDIRECTS]}
  }$(if [[ "$success" == false ]]; then echo ',
  "error": "'"$error_message"'"'; fi)
}
EOF
        
        # Print file path for Health Watch to read
        echo "$output_file"
    else
        # Human-readable output
        if [[ "$success" == true ]]; then
            echo "✅ HTTP check successful"
            echo "   URL: ${CONFIG[URL]}"
            echo "   Status: $http_status (expected: ${CONFIG[EXPECTED_STATUS]})"
            echo "   Response time: ${duration}ms (curl: ${curl_time}s)"
            echo "   Response size: $response_size bytes"
            [[ "$redirect_count" -gt 0 ]] && echo "   Redirects: $redirect_count"
        else
            echo "❌ HTTP check failed"
            echo "   URL: ${CONFIG[URL]}"
            echo "   Error: $error_message"
            [[ "$http_status" != "0" ]] && echo "   HTTP Status: $http_status"
            echo "   Duration: ${duration}ms"
        fi
    fi
}

show_help() {
    cat << 'EOF'
Health Watch HTTP Checker

USAGE:
    check-http.sh --url <URL> [OPTIONS]

REQUIRED:
    --url <URL>                  Target URL to check

OPTIONS:
    --method <METHOD>            HTTP method (default: GET)
    --timeout <SECONDS>          Request timeout (default: 30)
    --connect-timeout <SECONDS>  Connection timeout (default: 10)
    --expected-status <CODE>     Expected HTTP status (default: 200)
    --header <HEADER>            Custom header (can be used multiple times)
    --user-agent <AGENT>         User agent string (default: HealthWatch/2.0)
    --max-redirects <COUNT>      Maximum redirects (default: 5)
    --curl-arg <ARG>             Additional curl argument
    
FLAGS:
    --output-json               Output structured JSON for Health Watch
    --follow-redirects          Follow HTTP redirects
    --no-verify-ssl             Skip SSL certificate verification
    -h, --help                  Show this help message

EXAMPLES:
    # Basic health check
    check-http.sh --url https://api.example.com/health --output-json
    
    # Authenticated API check
    check-http.sh --url https://api.example.com/protected \
                  --header "Authorization: Bearer token123" \
                  --expected-status 200 \
                  --output-json
    
    # Custom timeout and SSL settings
    check-http.sh --url https://slow-api.example.com \
                  --timeout 60 \
                  --no-verify-ssl \
                  --follow-redirects \
                  --output-json
EOF
}

# Main execution
main() {
    parse_arguments "$@"
    validate_config
    execute_check
}

# Run if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

#### Check-Http.ps1 (PowerShell)
```powershell
# scripts/Check-Http.ps1 - PowerShell HTTP health checker
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Url,
    
    [string]$Method = "GET",
    [int]$Timeout = 30,
    [int]$ExpectedStatus = 200,
    [string[]]$Headers = @(),
    [switch]$OutputJson,
    [switch]$FollowRedirects,
    [switch]$SkipCertificateCheck,
    [string]$UserAgent = "HealthWatch/2.0",
    [int]$MaxRedirects = 5
)

# Initialize result object
$result = @{
    success = $false
    latencyMs = 0
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    details = @{
        httpStatus = 0
        expectedStatus = $ExpectedStatus
        method = $Method
        url = $Url
        userAgent = $UserAgent
    }
}

try {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Build request parameters
    $requestParams = @{
        Uri = $Url
        Method = $Method
        TimeoutSec = $Timeout
        UserAgent = $UserAgent
        UseBasicParsing = $true
    }
    
    # Add headers
    if ($Headers.Count -gt 0) {
        $headerHash = @{}
        foreach ($header in $Headers) {
            $parts = $header -split ':', 2
            if ($parts.Count -eq 2) {
                $headerHash[$parts[0].Trim()] = $parts[1].Trim()
            }
        }
        $requestParams['Headers'] = $headerHash
    }
    
    # SSL and redirect settings
    if ($SkipCertificateCheck) {
        $requestParams['SkipCertificateCheck'] = $true
    }
    
    if (-not $FollowRedirects) {
        $requestParams['MaximumRedirection'] = 0
    } else {
        $requestParams['MaximumRedirection'] = $MaxRedirects
    }
    
    # Execute request
    $response = Invoke-WebRequest @requestParams
    $stopwatch.Stop()
    
    # Update result
    $result.latencyMs = $stopwatch.ElapsedMilliseconds
    $result.details.httpStatus = [int]$response.StatusCode
    $result.details.responseSize = $response.Content.Length
    
    # Check if status matches expected
    if ($response.StatusCode -eq $ExpectedStatus) {
        $result.success = $true
    } else {
        $result.error = "Unexpected HTTP status: $($response.StatusCode) (expected: $ExpectedStatus)"
    }
    
} catch {
    $stopwatch.Stop()
    $result.latencyMs = $stopwatch.ElapsedMilliseconds
    $result.error = $_.Exception.Message
    
    # Try to extract status code from web exception
    if ($_.Exception -is [System.Net.WebException]) {
        $webResponse = $_.Exception.Response
        if ($webResponse) {
            $result.details.httpStatus = [int]$webResponse.StatusCode
        }
    }
}

# Output results
if ($OutputJson) {
    $tempFile = [System.IO.Path]::GetTempFileName() + ".json"
    $result | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempFile -Encoding UTF8
    Write-Output $tempFile
} else {
    if ($result.success) {
        Write-Host "✅ HTTP check successful" -ForegroundColor Green
        Write-Host "   URL: $Url"
        Write-Host "   Status: $($result.details.httpStatus) (expected: $ExpectedStatus)"
        Write-Host "   Response time: $($result.latencyMs)ms"
    } else {
        Write-Host "❌ HTTP check failed" -ForegroundColor Red
        Write-Host "   URL: $Url"
        Write-Host "   Error: $($result.error)"
        if ($result.details.httpStatus -gt 0) {
            Write-Host "   HTTP Status: $($result.details.httpStatus)"
        }
    }
}

# Exit with appropriate code
if ($result.success) {
    exit 0
} else {
    exit 1
}
```

### 2. Database Connection Scripts

#### check-database.sh
```bash
#!/bin/bash
# scripts/check-database.sh - Multi-database health checker

set -euo pipefail

DB_TYPE=""
HOST="localhost"
PORT=""
DATABASE=""
USERNAME=""
PASSWORD=""
TIMEOUT=10
OUTPUT_JSON=false
QUERY=""
CHECK_PERFORMANCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            DB_TYPE="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --database)
            DATABASE="$2"
            shift 2
            ;;
        --username)
            USERNAME="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --query)
            QUERY="$2"
            shift 2
            ;;
        --check-performance)
            CHECK_PERFORMANCE=true
            shift
            ;;
        --output-json)
            OUTPUT_JSON=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Database-specific implementations
check_postgres() {
    local port=${PORT:-5432}
    local query=${QUERY:-"SELECT 1 as health_check"}
    local connection_string="postgresql://$USERNAME:$PASSWORD@$HOST:$port/$DATABASE"
    
    local start_time end_time duration success=true error_message=""
    
    start_time=$(date +%s%3N)
    
    if timeout "$TIMEOUT" psql "$connection_string" -c "$query" >/dev/null 2>&1; then
        success=true
    else
        success=false
        error_message="PostgreSQL connection failed"
    fi
    
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    local details='{
        "dbType": "postgresql",
        "host": "'"$HOST"'",
        "port": '"$port"',
        "database": "'"$DATABASE"'",
        "query": "'"$query"'"
    }'
    
    if [[ "$CHECK_PERFORMANCE" == true && "$success" == true ]]; then
        local stats
        stats=$(timeout "$TIMEOUT" psql "$connection_string" -c "
            SELECT 
                (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        " -t -A -F',' 2>/dev/null || echo "0,0")
        
        local active_conn max_conn
        IFS=',' read -r active_conn max_conn <<< "$stats"
        
        details=$(echo "$details" | jq --arg ac "$active_conn" --arg mc "$max_conn" \
            '. + {performance: {activeConnections: ($ac | tonumber), maxConnections: ($mc | tonumber)}}')
    fi
    
    output_result "$success" "$duration" "$error_message" "$details"
}

check_redis() {
    local port=${PORT:-6379}
    local auth_arg=""
    
    if [[ -n "$PASSWORD" ]]; then
        auth_arg="-a $PASSWORD"
    fi
    
    local start_time end_time duration success=true error_message=""
    
    start_time=$(date +%s%3N)
    
    if timeout "$TIMEOUT" redis-cli -h "$HOST" -p "$port" $auth_arg ping | grep -q "PONG"; then
        success=true
    else
        success=false
        error_message="Redis connection failed"
    fi
    
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    local details='{
        "dbType": "redis",
        "host": "'"$HOST"'",
        "port": '"$port"'
    }'
    
    if [[ "$CHECK_PERFORMANCE" == true && "$success" == true ]]; then
        local info
        info=$(timeout "$TIMEOUT" redis-cli -h "$HOST" -p "$port" $auth_arg info memory | head -10 2>/dev/null || echo "")
        
        if [[ -n "$info" ]]; then
            local used_memory=$(echo "$info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
            local max_memory=$(echo "$info" | grep "maxmemory:" | cut -d: -f2 | tr -d '\r')
            
            details=$(echo "$details" | jq --arg um "$used_memory" --arg mm "$max_memory" \
                '. + {performance: {usedMemory: ($um | tonumber), maxMemory: ($mm | tonumber)}}')
        fi
    fi
    
    output_result "$success" "$duration" "$error_message" "$details"
}

output_result() {
    local success=$1 duration=$2 error_message=$3 details=$4
    
    if [[ "$OUTPUT_JSON" == true ]]; then
        local output_file="/tmp/healthwatch-database-$(date +%s)-$$.json"
        
        local json_output='{
            "success": '"$success"',
            "latencyMs": '"$duration"',
            "timestamp": '"$(date +%s)000"',
            "details": '"$details"'
        }'
        
        if [[ "$success" == false ]]; then
            json_output=$(echo "$json_output" | jq --arg err "$error_message" '. + {error: $err}')
        fi
        
        echo "$json_output" > "$output_file"
        echo "$output_file"
    else
        if [[ "$success" == true ]]; then
            echo "✅ Database check successful: $DB_TYPE at $HOST:${PORT:-'default'}"
            echo "   Response time: ${duration}ms"
        else
            echo "❌ Database check failed: $error_message"
            echo "   Target: $DB_TYPE at $HOST:${PORT:-'default'}"
            echo "   Duration: ${duration}ms"
        fi
    fi
    
    if [[ "$success" == true ]]; then
        exit 0
    else
        exit 1
    fi
}

# Main execution
case "$DB_TYPE" in
    postgres|postgresql)
        check_postgres
        ;;
    redis)
        check_redis
        ;;
    mysql)
        check_mysql
        ;;
    mongodb)
        check_mongodb
        ;;
    *)
        echo "Unsupported database type: $DB_TYPE"
        echo "Supported types: postgres, redis, mysql, mongodb"
        exit 1
        ;;
esac
```

## 📋 Implementation Tasks

### Template Creation
- [ ] **HTTP/HTTPS templates** (8 variants covering basic to complex scenarios)
- [ ] **Database templates** (PostgreSQL, MySQL, Redis, MongoDB with auth & performance)
- [ ] **Container templates** (Docker, Docker Compose, Kubernetes pods)
- [ ] **Service templates** (systemd, Windows services, PM2 processes)
- [ ] **Custom script templates** (Python, Node.js, PowerShell business logic)

### Script Development
- [ ] **check-http.sh/.ps1** - Universal HTTP checker with full feature set
- [ ] **check-database.sh/.ps1** - Multi-database connection validator
- [ ] **check-docker.sh/.ps1** - Container health and status checker
- [ ] **check-systemd.sh** - Linux service status checker
- [ ] **Check-WindowsService.ps1** - Windows service health checker
- [ ] **check-custom.sh/.ps1** - Wrapper for custom business logic scripts

### Cross-Platform Support
- [ ] **bash/zsh compatibility** - All scripts work on macOS/Linux
- [ ] **PowerShell compatibility** - Native Windows support with PowerShell Core
- [ ] **Environment detection** - Auto-select appropriate script variant
- [ ] **Path handling** - Cross-platform file path resolution

### Documentation & Examples
- [ ] **Template usage guides** - How to customize each template category
- [ ] **Script parameter reference** - Complete documentation of all options
- [ ] **Integration examples** - Real-world usage scenarios
- [ ] **Troubleshooting guide** - Common issues and solutions

---

*This subtask creates the foundational template library that makes Health Watch task-based monitoring accessible to all users. Professional-grade templates with comprehensive scripts eliminate the complexity of custom task creation.*

🎨 **Professional Templates** | 🔧 **Robust Scripts** | 🌍 **Cross-Platform**
