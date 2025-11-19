# Development Standard Operating Procedures (SOPs)

## Overview

This document outlines the standard operating procedures for developing and maintaining the CreativeBridge application. These procedures ensure code quality, security, and consistency across the development team.

## Code Development Workflow

### 1. Feature Development Process

#### Branch Management
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/[feature-name]

# Work on feature with regular commits
git add .
git commit -m "feat: descriptive commit message"

# Push and create pull request
git push origin feature/[feature-name]
```

#### Code Quality Standards
- **TypeScript**: All new code must use TypeScript with strict type checking
- **ESLint**: Code must pass all linting rules before commit
- **Prettier**: Consistent code formatting enforced via pre-commit hooks
- **Testing**: New features require unit and integration tests

#### Pre-commit Checklist
```bash
# Run linting and fix issues
npm run lint:fix

# Run type checking
npm run type-check

# Run test suite
npm test

# Build verification
npm run build
```

### 2. Database Migration Procedures

#### Creating a New Migration
```bash
# 1. Create migration file in /sql/ directory
touch sql/[timestamp]_[descriptive_name].sql

# 2. Follow migration template structure
-- Migration: [Description]
-- Created: [Date]
-- Author: [Name]

-- Migration Up
BEGIN;

-- Your changes here
ALTER TABLE table_name ADD COLUMN new_column TYPE;

-- Update RLS policies if needed
CREATE POLICY "policy_name" ON table_name FOR SELECT USING (auth.uid() = user_id);

-- Test the migration
SELECT 1; -- Basic validation

COMMIT;

-- Rollback procedure (commented)
-- BEGIN;
-- ALTER TABLE table_name DROP COLUMN new_column;
-- COMMIT;
```

#### Migration Testing Process
1. **Local Testing**: Apply migration to local development database
2. **Validation**: Run application tests to ensure no breaking changes
3. **Staging**: Deploy to staging environment for integration testing
4. **Production**: Apply during maintenance window with rollback plan

#### Migration Best Practices
- Always include rollback procedures
- Test migrations on database copies
- Update TypeScript types after schema changes
- Document any breaking changes

### 3. Adding New API Routes/Services

#### Service Layer Structure
```typescript
// src/services/[serviceName].ts
import { supabase } from './supabase';
import { Database } from '../types/database';

export class ServiceName {
  // Public methods
  public async methodName(params: Type): Promise<ReturnType> {
    try {
      // Implementation
      return result;
    } catch (error) {
      // Error handling
      throw new Error(`ServiceName.methodName failed: ${error.message}`);
    }
  }

  // Private helper methods
  private async helperMethod(): Promise<void> {
    // Implementation
  }
}

export const serviceName = new ServiceName();
```

#### Integration Checklist
1. **Type Safety**: Define interfaces in `src/types/`
2. **Error Handling**: Implement comprehensive error handling
3. **Testing**: Create unit tests in `src/__tests__/services/`
4. **Documentation**: Update service documentation
5. **Integration**: Add to relevant screens/components

### 4. Component Development Guidelines

#### Component Structure
```typescript
// src/components/[category]/[ComponentName].tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ComponentProps } from '../../types';

interface Props {
  // Define prop types
}

export const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // Component logic
  
  return (
    <View style={styles.container}>
      {/* Component JSX */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Styles
  },
});
```

#### Testing Components
```typescript
// src/__tests__/components/[ComponentName].test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ComponentName } from '../../components/category/ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    const { getByText } = render(<ComponentName />);
    expect(getByText('Expected Text')).toBeTruthy();
  });

  it('handles user interaction', () => {
    const mockCallback = jest.fn();
    const { getByTestId } = render(<ComponentName onPress={mockCallback} />);
    
    fireEvent.press(getByTestId('button'));
    expect(mockCallback).toHaveBeenCalled();
  });
});
```

## Security Procedures

### 1. API Key Management

#### Secure Storage
```typescript
// src/services/secureApiKeyManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

class SecureApiKeyManager {
  private static readonly OPENAI_KEY = 'secure_openai_key';
  private static readonly REPLICATE_KEY = 'secure_replicate_key';

  public static async storeApiKey(service: string, key: string): Promise<void> {
    await AsyncStorage.setItem(`secure_${service}_key`, key);
  }

  public static async getApiKey(service: string): Promise<string | null> {
    return await AsyncStorage.getItem(`secure_${service}_key`);
  }
}
```

#### Environment Configuration
```bash
# .env.example
OPENAI_API_KEY=your_openai_key_here
REPLICATE_API_TOKEN=your_replicate_token_here
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Data Validation Procedures

#### Input Validation
```typescript
// Always validate user input
const validateStoryContent = (content: string): boolean => {
  if (!content || content.trim().length === 0) {
    throw new Error('Story content cannot be empty');
  }
  
  if (content.length > 10000) {
    throw new Error('Story content exceeds maximum length');
  }
  
  // Additional validation rules
  return true;
};
```

#### Database Query Safety
```typescript
// Use parameterized queries
const { data, error } = await supabase
  .from('game_sessions')
  .select('*')
  .eq('user_id', userId)
  .eq('id', sessionId);

if (error) {
  throw new Error(`Database query failed: ${error.message}`);
}
```

## Testing Procedures

### 1. Test Categories

#### Unit Tests
- **Location**: `src/__tests__/services/`, `src/__tests__/utils/`
- **Purpose**: Test individual functions and classes
- **Coverage**: Aim for 80%+ coverage on critical business logic

#### Integration Tests
- **Location**: `src/__tests__/integration/`
- **Purpose**: Test component interactions and API integrations
- **Focus**: User workflows and data flow

#### Acceptance Tests
- **Location**: `src/__tests__/acceptance/`
- **Purpose**: End-to-end user journey testing
- **Scenarios**: Key user stories and edge cases

### 2. Test Execution

#### Local Testing
```bash
# Run all tests
npm test

# Run specific test category
npm test -- --testPathPattern=integration

# Run with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

#### Continuous Integration
- All tests must pass before merge
- Coverage reports generated automatically
- Performance regression testing

## Deployment Procedures

### 1. Environment Setup

#### Development Environment
```bash
# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Android setup (if needed)
npm run android:setup

# Start Metro bundler
npm start
```

#### Staging Deployment
```bash
# Build staging version
npm run build:staging

# Deploy to TestFlight (iOS)
npm run deploy:ios:staging

# Deploy to Play Store Internal Testing (Android)
npm run deploy:android:staging
```

### 2. Production Deployment

#### Pre-deployment Checklist
- [ ] All tests passing
- [ ] Code review completed
- [ ] Database migrations tested
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Changelog updated

#### Deployment Process
```bash
# Create release branch
git checkout -b release/v[version]

# Update version numbers
npm version [major|minor|patch]

# Build production version
npm run build:production

# Deploy to app stores
npm run deploy:production

# Tag release
git tag v[version]
git push origin v[version]
```

## Monitoring and Maintenance

### 1. Performance Monitoring

#### Key Metrics
- App launch time
- API response times
- Memory usage
- Crash rates
- User engagement metrics

#### Monitoring Tools
- **Reactotron**: Development debugging
- **Supabase Analytics**: Database performance
- **Custom Analytics**: User behavior tracking

### 2. Error Handling and Logging

#### Error Logging
```typescript
// src/services/errorLogger.ts
export const logError = (
  context: string,
  error: Error,
  additionalInfo?: Record<string, any>
) => {
  console.error(`[${context}] ${error.message}`, {
    stack: error.stack,
    ...additionalInfo,
  });
  
  // Send to monitoring service
  // analytics.logError(context, error, additionalInfo);
};
```

#### User Error Handling
```typescript
// User-friendly error messages
const handleApiError = (error: Error): string => {
  if (error.message.includes('network')) {
    return 'Please check your internet connection and try again.';
  }
  
  if (error.message.includes('auth')) {
    return 'Please log in again to continue.';
  }
  
  return 'Something went wrong. Please try again later.';
};
```

## Code Review Guidelines

### 1. Review Checklist

#### Functionality
- [ ] Code meets requirements
- [ ] Edge cases handled
- [ ] Error handling implemented
- [ ] Performance considerations addressed

#### Code Quality
- [ ] TypeScript types properly defined
- [ ] Code follows project conventions
- [ ] No console.log statements in production code
- [ ] Proper component lifecycle management

#### Security
- [ ] Input validation implemented
- [ ] No hardcoded secrets
- [ ] RLS policies respected
- [ ] XSS/injection vulnerabilities addressed

### 2. Review Process

1. **Self Review**: Developer reviews own code before submitting
2. **Peer Review**: At least one team member reviews
3. **Senior Review**: Complex changes reviewed by senior developer
4. **Testing**: All tests pass and new tests added as needed

## Emergency Procedures

### 1. Production Issues

#### Incident Response
1. **Assess Impact**: Determine severity and user impact
2. **Immediate Action**: Implement temporary fix if possible
3. **Communication**: Notify stakeholders of issue and status
4. **Root Cause**: Identify underlying cause
5. **Permanent Fix**: Implement and test comprehensive solution
6. **Post-Mortem**: Document lessons learned

#### Rollback Procedures
```bash
# Database rollback
-- Execute rollback SQL from migration file

# Application rollback
git checkout [previous-stable-commit]
npm run deploy:production
```

### 2. Security Incidents

#### Immediate Actions
1. **Isolate**: Identify and contain the security issue
2. **Assess**: Determine scope of potential data exposure
3. **Notify**: Inform security team and stakeholders
4. **Document**: Record all actions taken
5. **Remediate**: Fix vulnerability and implement safeguards

## Related Documentation
- [Project Architecture](../project_architecture.md) - System overview and design
- [Database Schema](../database_schema.md) - Database structure and relationships
- [API Integration Guide](../api_integration.md) - External service integration

---

**Last Updated**: November 2025  
**Version**: 1.0  
**Maintainer**: Development Team