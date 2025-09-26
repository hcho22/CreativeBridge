# Development Guide for CreativeBridge

## 🛠 Development Setup

### Pre-commit Hooks

This project uses **Husky** and **lint-staged** to enforce code quality standards before commits.

#### What happens on commit:

- ESLint runs on all TypeScript/JavaScript files and auto-fixes issues
- Prettier formats all code and markdown files
- Only properly formatted and linted code can be committed

#### Manual commands:

```bash
# Run linting with auto-fix
npm run lint:fix

# Format all files
npm run format

# Regular linting (no auto-fix)
npm run lint
```

#### Bypassing pre-commit hooks (not recommended):

```bash
git commit --no-verify -m "your message"
```

---

## 🐛 Debugging with Reactotron

### Setup Instructions

1. **Install Reactotron Desktop App:**

   - Download from: https://github.com/infinitered/reactotron/releases
   - Install the desktop application

2. **Start Reactotron:**

   - Open Reactotron desktop app
   - It will listen on `localhost:9090` by default

3. **Connect Your App:**
   - Start your React Native development server: `npm start`
   - Run your app: `npm run ios` or `npm run android`
   - The app will automatically connect to Reactotron in development mode

### Using Reactotron

#### Automatic Logging

- All `console.log`, `console.warn`, and `console.error` calls are automatically sent to Reactotron
- Authentication events are automatically logged with emojis for easy identification

#### Manual Logging with useReactotron Hook

```typescript
import { useReactotron } from '../hooks';

const MyComponent = () => {
  const { logInfo, logError, displayObject } = useReactotron();

  const handleSomething = () => {
    logInfo('🎯 Button clicked');

    // Display complex objects
    displayObject('User Profile', userProfile);

    // Log errors with context
    try {
      // risky operation
    } catch (error) {
      logError(error, 'Failed to update profile');
    }
  };

  return <YourComponent />;
};
```

#### Direct Reactotron Usage

```typescript
import reactotron from '../services/reactotron';

// Simple logging
reactotron.log?.('Hello from Reactotron');

// Display objects
reactotron.display?.({
  name: 'API Response',
  value: response,
  preview: 'User authentication successful',
});

// Track errors
reactotron.error?.('Something went wrong', error);
```

### Features Available in Reactotron

1. **Timeline:** See all logs and events in chronological order
2. **State:** Monitor React state changes
3. **API:** Track network requests and responses
4. **Performance:** Monitor app performance metrics
5. **Custom Commands:** Send commands from Reactotron to your app

### Debugging Tips

- Use emojis in log messages for easier visual scanning
- Group related logs with consistent prefixes
- Use `displayObject` for complex data structures
- Component mount/unmount is automatically logged when using `useReactotron`

---

## 📱 Platform-Specific Debugging

### iOS Simulator

- Reactotron connects automatically to `localhost`
- Use iOS Safari dev tools for web debugging
- Access device logs via Xcode Console

### Android Emulator/Device

- Reactotron auto-detects device IP
- Use `adb logcat` for system logs
- Chrome DevTools for React Native debugging

---

## 🔧 Code Quality Standards

### ESLint Rules

- Extends `@react-native` configuration
- TypeScript strict mode enforcement
- React hooks rules
- React Native specific linting

### Prettier Configuration

- Single quotes for strings
- Trailing commas
- Arrow function parentheses avoided when possible

### Pre-commit Checks

- All staged `.js`, `.jsx`, `.ts`, `.tsx` files are linted and formatted
- All `.json` and `.md` files are formatted
- Commit blocked if linting/formatting fails

---

## 🚀 Performance Monitoring

### Reactotron Performance Tracking

```typescript
// Track function performance
const startTime = Date.now();
// ... your code ...
reactotron.log?.(`⏱ Operation took ${Date.now() - startTime}ms`);
```

### React Native Performance

- Use Reactotron's performance monitor
- Enable Hermes for better JavaScript performance
- Monitor memory usage in development builds

---

## 🧪 Testing Integration

### Running Tests

```bash
npm test           # Run Jest tests
npm run test:watch # Run tests in watch mode
```

### Debug Tests with Reactotron

Tests don't connect to Reactotron by default. For debugging test failures, temporarily enable logging in test files.

---

## 🔗 Useful Development Commands

```bash
# Development
npm start                 # Start Metro bundler
npm run ios              # Run on iOS
npm run android          # Run on Android

# Code Quality
npm run lint             # Check linting
npm run lint:fix         # Fix linting issues
npm run format           # Format code

# Assets
npm run setup-icons      # Generate app icons
npm run generate-icons   # Generate iOS icons
npm run generate-android-icons # Generate Android icons

# Building
npm run build:ios        # Build iOS app
npm run build:android    # Build Android app
npm run build:all        # Build both platforms
```

---

## 📞 Getting Help

If you encounter issues with the development setup:

1. Check this documentation first
2. Verify your development environment meets the prerequisites
3. Clear Metro cache: `npm start -- --reset-cache`
4. Reinstall dependencies: `rm -rf node_modules && npm install`
5. For iOS: `cd ios && rm -rf Pods Podfile.lock && pod install && cd ..`

---

_Happy coding! 🎉_
