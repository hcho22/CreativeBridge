# Ralphy Configuration for CreativeBridge

## Overview

Ralphy is an AI-powered development automation tool that helps maintain code quality, enforce development standards, and streamline workflows for the CreativeBridge project. This configuration replaces the legacy Ralph JSON-based system while preserving all learnings and best practices.

## Quick Start

### Ralphy Commands

```bash
# Test the project
npm test

# Run linting
npm run lint

# Build the project
npm run build

# Type checking
npx tsc --noEmit
```

## Configuration Structure

The Ralphy configuration is stored in [`config.yaml`](config.yaml) and includes:

### 1. Project Information

- **Name**: CreativeBridge
- **Languages**: TypeScript, JavaScript
- **Frameworks**: React Native, Expo, Supabase
- **Description**: AI-powered educational storytelling app

### 2. Development Commands

- `test`: Run test suites
- `lint`: Code quality checks
- `build`: Production build
- `typecheck`: TypeScript validation

### 3. Development Rules

#### Code Quality

- TypeScript strict mode enforcement
- Follow existing patterns in `src/services/`
- > 80% test coverage for business logic
- React Native cross-platform compatibility
- AsyncStorage for persistent storage

#### Database Standards

- Migration files with CREATE TABLE IF NOT EXISTS
- Comprehensive RLS policies for all user data
- SECURITY DEFINER for privileged functions
- Explicit parameter naming (p_parameter_name)
- JSONB with GIN indexes for metadata
- Proper rollback procedures

#### Documentation Requirements

- **CRITICAL**: Always update `.agent/` docs after feature implementation
- Update `.agent/System/` for architecture changes
- Update `.agent/Tasks/` for feature implementations
- Update `.agent/SOP/` for new procedures
- Document schema changes in `database_schema.md`
- Read `.agent/README.md` before planning

#### Security & Safety

- Never commit sensitive keys or credentials
- Never modify .env files, keystores, or credentials
- All database changes require migration files
- Test on both iOS and Android
- Follow Supabase RLS patterns
- Validate and sanitize all user inputs

#### Service Layer Patterns

- Exponential backoff retry (3 attempts: 1s, 2s, 4s)
- Fail fast on auth errors
- Provide fallback/degraded functionality
- LRU caching (1000 entries, 24hr TTL)
- Performance targets: <200ms API, <100ms DB
- Non-blocking async operations
- Batch operations to reduce round-trips

#### Testing Standards

- Mock external services (OpenAI, Replicate, Supabase)
- Test edge cases and error conditions
- Test authorization scenarios
- Performance tests for time-critical operations
- Integration tests for multi-service workflows
- All tests must pass before completion

#### React Native Integration

- Service functions called from screens
- AsyncStorage for session tokens (24hr expiration)
- Supabase RPC with SECURITY DEFINER
- Real-time subscriptions where needed
- React Navigation v7 (tabs + stack)
- React Context API with AsyncStorage persistence

#### AI/LLM Integration

- Explicit JSON schema in prompts
- Normalization: lowercase + singular
- Regex fallback when LLM fails
- OpenAI text-embedding-3-small (1536 dimensions)
- Cosine similarity threshold: 0.85
- Rate limiting with exponential backoff

#### Git & Version Control

- Feature branches: `feature/description` or `fix/description`
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Include `Co-Authored-By: Claude` in commits
- Never force push to main/master

### 4. Boundaries (Protected Files)

Ralphy will **never modify** these files:

#### Sensitive Configuration

- `.env*` files
- `*.keystore` files
- `credentials.json`
- `app.config.js`
- `google-services.json`
- `GoogleService-Info.plist`

#### Historical Archives

- `.agent/Ralph/archive/**` (preserves legacy system)

#### Build Artifacts

- `build/**`
- `.expo/**`
- `android/app/build/**`
- `ios/build/**`
- `ios/Pods/**`
- `node_modules/**`

#### Package Manager Locks

- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`

## Ralph Migration Context

Ralphy replaces the legacy Ralph JSON-based system and preserves all learnings:

- **Migration Date**: 2026-01-20
- **Completion Rate**: 15/16 user stories (93.75%)
- **Archive Path**: `.agent/Ralph/archive/`
- **Quality Gates**: typecheck, lint, test

### Key Learnings Preserved

1. **Database**: JSONB for embeddings, comprehensive RLS policies, indexed queries
2. **Services**: Exponential backoff, LRU caching, batch operations
3. **Testing**: 80%+ coverage, mock external services, test authorization
4. **React Native**: AsyncStorage sessions, Supabase RPC, service-based APIs

## Integration with Claude Code

When using Claude Code with Ralphy configuration:

1. **Before Starting**: Claude reads `config.yaml` to understand project constraints
2. **During Development**: Rules are enforced automatically
3. **File Protection**: Boundaries prevent accidental modification of sensitive files
4. **Documentation Updates**: CLAUDE.md requirements ensure docs stay current

## File Structure

```
.agent/Ralphy/
├── config.yaml          # Main configuration file (tracked in git)
├── README.md            # This file - comprehensive documentation
├── progress.txt         # Progress tracking (not tracked in git)
├── logs/               # Runtime logs (not tracked in git)
└── .cache/             # Cache files (not tracked in git)
```

## Version Control

### Tracked Files

- `config.yaml` - Main configuration
- `README.md` - Documentation

### Ignored Files (in .gitignore)

- `progress.txt` - Runtime progress
- `logs/` - Log files
- `.cache/` - Cache directory

## Maintenance

### Updating Configuration

When updating `config.yaml`:

1. Test changes locally first
2. Ensure quality gates still pass
3. Update this README if adding new rules
4. Commit changes with descriptive message

### Quality Gates

All code must pass these gates:

```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Tests
npm test
```

## Troubleshooting

### Common Issues

**Issue**: Ralphy suggests modifying protected files
**Solution**: Check `boundaries.never_touch` in config.yaml

**Issue**: Documentation not being updated
**Solution**: Review "Documentation Requirements" rules

**Issue**: Tests failing
**Solution**: Ensure all quality gates pass before marking tasks complete

## Resources

- [Ralphy Documentation](https://github.com/michaelshimeles/ralphy)
- [Project README](../../README.md)
- [System Architecture](.agent/System/project_architecture.md)
- [Development SOPs](.agent/SOP/development_procedures.md)

## Metadata

- **Ralphy Version**: 4.3.0
- **Initialized**: 2026-01-22
- **Migration From**: Ralph JSON-based system
- **Maintainer**: Development Team

---

**Note**: This configuration is designed to work seamlessly with Claude Code while preserving all the learnings and best practices from the legacy Ralph system. Always read `.agent/README.md` before planning any feature implementation.
