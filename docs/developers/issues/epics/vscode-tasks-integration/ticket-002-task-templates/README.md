# 🎫 Ticket 002: Task Templates

![Priority](https://img.shields.io/badge/Priority-MEDIUM-yellow?style=flat-square)
![Story Points](https://img.shields.io/badge/Story_Points-1_SP-green?style=flat-square)
![Type](https://img.shields.io/badge/Type-Templates_&_Examples-brightgreen?style=flat-square)
![Status](https://img.shields.io/badge/Status-Ready_for_Implementation-blue?style=flat-square)

## 📋 Ticket Summary

**Create example tasks and scripts for common monitoring scenarios with comprehensive templates that enable quick setup for HTTP checks, database connections, and custom health monitoring.**

## Summary
Create example tasks and scripts for common monitoring scenarios.

## Template Examples

### HTTP Health Check Task
```json
{
  "label": "healthwatch:check-api",
  "type": "shell",
  "command": "curl",
  "args": [
    "-f", "-s", "-o", "/dev/null",
    "--max-time", "30",
    "${config:myapp.apiUrl}/health"
  ]
}
```

### Database Connection Task  
```json
{
  "label": "healthwatch:check-db",
  "type": "shell", 
  "command": "pg_isready",
  "args": [
    "-h", "${config:myapp.db.host}",
    "-p", "${config:myapp.db.port}",
    "-U", "${config:myapp.db.user}"
  ]
}
```

### Custom Script Task
```json
{
  "label": "healthwatch:check-service",
  "type": "shell",
  "command": "${workspaceFolder}/scripts/health-check.sh"
}
```

## Deliverables
- [ ] Common task templates (HTTP, database, custom)
- [ ] Sample wrapper scripts 
- [ ] Quick setup documentation
- [ ] Best practices guide

**Story Points: 1**

---

## 📋 **Review Checklist**
- [ ] **Template Quality**: All templates follow VS Code task best practices
- [ ] **Cross-Platform**: Templates work on Windows, macOS, and Linux
- [ ] **Documentation**: Clear setup instructions and parameter explanations
- [ ] **Examples**: Practical, real-world monitoring scenarios covered
- [ ] **Ready for Users**: Templates are copy-paste ready with minimal configuration