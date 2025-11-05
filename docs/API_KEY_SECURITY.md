# API Key Security Implementation Guide

This document outlines the secure API key storage mechanism implemented for the Story Image Generation feature and general API key management in CreativeBridge.

## 🔒 Security Overview

The API key security system provides:

- **Secure Storage**: API keys stored in environment variables, never in code
- **Log Protection**: Automatic masking of API keys in all logs and console output
- **Access Monitoring**: Tracking and auditing of API key access patterns
- **Validation**: Format validation and security checks for all API keys
- **Error Handling**: Secure error messages that don't expose sensitive information

## 🛡️ Security Features

### 1. API Key Masking

All API keys are automatically masked when logged:

```typescript
// Input:  sk-proj-1234567890abcdef...xyz
// Output: sk-proj-123...xyz (in logs)
// Output: ✅ [CONFIGURED] (in status reports)
```

### 2. Access Tracking

The system tracks:

- Number of API key accesses per service
- Daily access patterns
- Suspicious access frequency (>100/minute triggers alert)
- Last access timestamps

### 3. Security Validation

Each API key is validated for:

- **Format compliance** (OpenAI: `sk-*`, Replicate: `r8_*`, ElevenLabs: `sk_*`)
- **Non-empty values** for required services
- **Security policy compliance**

### 4. Audit Logging

All API key operations are logged to the audit system:

- Key access events (with masked keys)
- Validation failures
- Security policy violations
- Service initialization events

## 📁 Architecture

### Core Components

```
src/services/
├── secureApiKeyManager.ts    # Main security service
├── environment.ts            # Enhanced environment config
├── auditLogger.ts           # Security audit logging
└── scripts/
    └── testApiKeySecurity.ts # Security test suite
```

### Key Classes

1. **SecureApiKeyManager**: Core security service
2. **ApiService**: Enumeration of supported services
3. **LogCapture**: Testing utility for log security
4. **SecurityError**: Structured error handling

## 🔧 Usage

### Basic API Key Access

```typescript
import { getApiKey, ApiService } from '../services/secureApiKeyManager';

// Secure API key retrieval
const { key, error } = getApiKey(ApiService.REPLICATE_PRIMARY);

if (error) {
  // Handle security error without exposing details
  console.error('Service configuration error');
  return;
}

// Use the key safely
const response = await fetch(endpoint, {
  headers: { Authorization: `Bearer ${key}` },
});
```

### Security Status Monitoring

```typescript
import { useApiKeyStatus } from '../services/secureApiKeyManager';

// React hook for monitoring
const { status, isValid, errors, warnings } = useApiKeyStatus();

// Check specific service
if (!status[ApiService.REPLICATE_PRIMARY].valid) {
  // Handle configuration issue
}
```

### Secure Logging

```typescript
import { secureLogger } from '../services/secureApiKeyManager';

// Log API calls safely
secureLogger.logApiCall(ApiService.REPLICATE_PRIMARY, '/v1/predictions', true, {
  duration: 1234,
  status: 200,
});

// Log service initialization
secureLogger.logServiceInit(ApiService.OPENAI, true, { version: '4.0' });
```

## ⚙️ Configuration

### Environment Variables

```bash
# Required Services
REPLICATE_API_TOKEN=r8_your_token_here
OPENAI_API_KEY=sk-your_key_here

# Optional Services
BACKUP_IMAGE_API_TOKEN=r8_your_backup_token_here
ELEVENLABS_API_KEY=sk_your_elevenlabs_key_here

# Security Settings
IMAGE_GENERATION_ENABLED=false  # Feature flag
```

### Security Configuration

The system uses the existing security framework:

```typescript
// Security levels applied based on environment
const securityConfig = getSecurityConfig();

// Development: Relaxed security, detailed logging
// Production: Strict security, minimal exposure
```

## 🧪 Testing

### Running Security Tests

```bash
# Run the complete security test suite
npm run test:security

# Or run specific API key security tests
node -r ts-node/register src/scripts/testApiKeySecurity.ts
```

### Test Coverage

The security tests verify:

1. **Log Masking**: No API keys exposed in console output
2. **Validation**: Proper format checking and error handling
3. **Access Tracking**: Monitoring and statistics collection
4. **Secure Logging**: Audit logs don't expose sensitive data
5. **Status Reporting**: Safe configuration status display

### Example Test Output

```
🧪 Starting API Key Security Tests...

📝 Test 1: API Key Masking in Logs
✅ Key Masking: No API keys found exposed in logs

🔍 Test 2: API Key Validation
✅ Key Validation: All configured API keys are valid

📊 Test 3: Security Monitoring
✅ Access Tracking: API key access statistics properly tracked

📝 Test 4: Secure Logging Utilities
✅ Secure Logging: Secure logging utilities work correctly

📋 Test 5: API Key Status Reporting
✅ Status Reporting: API key status properly reported with masking

📊 Test Summary
═════════════════════════════════════════════════
✅ Key Masking
✅ Key Validation
✅ Access Tracking
✅ Secure Logging
✅ Status Reporting
═════════════════════════════════════════════════
Results: 5/5 tests passed
🎉 All API key security tests passed!
✅ API keys are properly secured and not exposed in logs
```

## 🚨 Security Best Practices

### Development

1. **Never commit API keys** to version control
2. **Use `.env.example`** for documentation
3. **Test with fake keys** when possible
4. **Review logs** for accidental key exposure

### Production

1. **Use environment variables** or secure secret management
2. **Rotate keys regularly** (every 90 days recommended)
3. **Monitor access patterns** for anomalies
4. **Set up alerting** for security violations

### Code Reviews

When reviewing code that handles API keys:

1. ✅ Verify no keys are hardcoded
2. ✅ Check logging doesn't expose keys
3. ✅ Ensure error messages are safe
4. ✅ Validate access patterns are monitored

## 🔄 Key Rotation

### Rotation Process

1. **Generate new API keys** from service providers
2. **Update environment variables** in deployment
3. **Test connectivity** with new keys
4. **Revoke old keys** after successful deployment
5. **Monitor for any issues** in first 24 hours

### Rotation Schedule

- **OpenAI**: Every 90 days
- **Replicate**: Every 90 days
- **ElevenLabs**: Every 90 days
- **Emergency rotation**: Immediately if compromise suspected

## 📈 Monitoring

### Key Metrics

The system tracks:

- API key access frequency per service
- Failed validation attempts
- Security policy violations
- Service initialization success rates

### Alerts

Automatic alerts for:

- Excessive API key access (>100/minute)
- Invalid key format attempts
- Missing required keys
- Service initialization failures

### Audit Trail

All security events are logged with:

- Timestamp and user context
- Masked key information
- Risk scores and severity levels
- Actionable security recommendations

## 🆘 Incident Response

### If API Key Compromise Suspected

1. **Immediately rotate** the affected key
2. **Review audit logs** for suspicious activity
3. **Check access patterns** around the time of suspected compromise
4. **Update security configurations** if needed
5. **Document the incident** for future prevention

### Emergency Contacts

- **Security Team**: [Contact Information]
- **API Provider Support**: [Service-specific contacts]
- **DevOps Team**: [Deployment support]

## 📚 Additional Resources

- [Environment Configuration Guide](./environment-setup.md)
- [Security Architecture Overview](../SECURITY.md)
- [Audit Logging Documentation](./audit-logging.md)
- [API Integration Guidelines](./api-integration.md)

---

**Last Updated**: October 2025  
**Version**: 1.0  
**Reviewed By**: Security Team
