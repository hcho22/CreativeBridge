# CreativeBridge: Interactive Story Writing App

A mobile story-writing application where users create engaging narratives with AI assistance while building their creative writing skills across different grade levels.

## 📱 Features

### 🎮 Core Functionality
- **Grade-level Story Creation** - Choose from K-2, 3-5, 6-8, or 9-12 difficulty levels
- **AI-Assisted Writing** - Collaborative storytelling with intelligent AI support
- **Voice Input Support** - Accessibility-focused voice-to-text functionality using ElevenLabs Voice AI
- **Story Library Management** - Import and continue previous stories from your personal database
- **Profile Management** - Track writing progress, XP, streaks, and achievements
- **Cross-platform Support** - Native iOS and Android applications

### 👤 User Profile System
- **User Authentication** - Secure login/signup with Supabase
- **XP & Streak Tracking** - Gamified writing experience
- **Statistics Dashboard** - Games played, words written, best scores
- **Grade Level Preferences** - Personalized content difficulty
- **Story History** - Access to all previously created stories

### 📖 Story Features
- **Story Import** - Load stories from your database or upload text files
- **Collaborative Writing** - Turn-based storytelling with AI
- **Grade-appropriate Content** - Age-appropriate challenges and prompts
- **Progress Saving** - Continue stories across multiple sessions

## 🛠 Tech Stack

- **Frontend**: React Native 0.81.1 with TypeScript
- **Backend**: Supabase (Authentication, Database, Storage)
- **Voice AI**: ElevenLabs Voice AI integration
- **Navigation**: React Navigation v7
- **State Management**: React Context API
- **Styling**: React Native StyleSheet
- **Icons**: React Native Vector Icons

## 📋 Prerequisites

- Node.js 20 or higher
- React Native development environment setup
- iOS development: Xcode, CocoaPods
- Android development: Android Studio, Java JDK
- Supabase account
- ElevenLabs API key (for voice features)

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/CreativeBridge.git
cd CreativeBridge
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# iOS: Install CocoaPods dependencies
cd ios && pod install && cd ..
```

### 3. Environment Setup

Create a Supabase project at [supabase.com](https://supabase.com) and configure your environment:

1. **Database Setup**: Run the following SQL in your Supabase SQL Editor:
```sql
-- User profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  total_xp INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_games_played INTEGER DEFAULT 0,
  total_words_written INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  preferred_grade_level TEXT DEFAULT 'K-2',
  speech_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stories/scores table
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  player_email TEXT NOT NULL,
  story TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. **Configuration**: Update `src/services/supabase.ts` with your Supabase credentials:
```typescript
const supabaseUrl = 'your-supabase-url';
const supabaseAnonKey = 'your-supabase-anon-key';
```

### 4. Running the Application

#### iOS
```bash
# Start Metro
npm start

# Run iOS (in another terminal)
npm run ios
```

#### Android
```bash
# Start Metro
npm start

# Run Android (in another terminal)
npm run android
```

## 📁 Project Structure

```
CreativeBridge/
├── App.tsx                      # Main application component
├── src/
│   ├── context/
│   │   └── AuthContext.tsx      # Authentication & user management
│   ├── services/
│   │   └── supabase.ts         # Supabase client configuration
│   └── components/
│       └── common/
│           └── VoiceInput.tsx   # Voice input component
├── ios/                        # iOS native code
├── android/                    # Android native code
├── scripts/                    # Build and icon generation scripts
└── assets/                     # App icons and assets
```

## 🎯 Usage

### Getting Started
1. **Sign Up/Login** - Create an account or log in with existing credentials
2. **Select Grade Level** - Choose your preferred difficulty (K-2, 3-5, 6-8, 9-12)
3. **Configure Speech** - Enable/disable voice input features
4. **Start Creating** - Begin a new story or continue an existing one

### Creating Stories
1. **New Story** - Tap "Start Game" to begin a fresh story
2. **Continue Story** - Import from your story library or upload a text file
3. **AI Collaboration** - Write collaboratively with AI assistance
4. **Save Progress** - Your stories are automatically saved to your profile

### Profile Management
- **View Statistics** - Track your writing progress and achievements
- **Manage Preferences** - Update grade level, speech settings, and display name
- **Story Library** - Access all your previously created stories

## 🔧 Build Scripts

```bash
# Development
npm start              # Start Metro bundler
npm run ios           # Run on iOS simulator/device
npm run android       # Run on Android emulator/device

# Asset Generation
npm run setup-icons   # Generate app icons for all platforms
npm run generate-icons       # Generate iOS icons
npm run generate-android-icons  # Generate Android icons

# Production Builds
npm run build:ios     # Build iOS app for distribution
npm run build:android # Build Android app for distribution
npm run build:all     # Build both platforms

# Code Quality
npm run lint         # Run ESLint
npm test            # Run Jest tests
```

## 🌟 Key Features Deep Dive

### Grade Level System
- **K-2**: Simple vocabulary, basic sentence structure
- **3-5**: Intermediate complexity, creative prompts
- **6-8**: Advanced storytelling, character development
- **9-12**: Complex narratives, literary techniques

### Voice Integration
- **Speech-to-Text**: Convert voice to written text
- **AI Voice Reading**: ElevenLabs integration for story playback
- **Accessibility**: Full voice navigation support
- **Quick Toggle**: Alt+S keyboard shortcut for speech

### Story Management
- **Database Storage**: Stories saved to Supabase
- **File Import**: Upload .txt files from device
- **Version Control**: Track story iterations and changes
- **Export Options**: Share stories in various formats

## 🔒 Privacy & Security

- **Data Encryption**: All data encrypted in transit and at rest
- **User Authentication**: Secure JWT-based authentication
- **Privacy Compliance**: COPPA and privacy regulation compliant
- **Local Storage**: Sensitive data stored securely on device

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Development Guidelines

- Follow TypeScript strict mode
- Use React Native best practices
- Maintain accessibility standards
- Write comprehensive tests
- Document all API changes

## 🐛 Troubleshooting

### Common Issues

**Metro bundler issues:**
```bash
# Clear Metro cache
npm start -- --reset-cache
```

**iOS build issues:**
```bash
# Clean and reinstall pods
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
```

**Android build issues:**
```bash
# Clean gradle cache
cd android && ./gradlew clean && cd ..
```

### Getting Help

- Check the [React Native Troubleshooting Guide](https://reactnative.dev/docs/troubleshooting)
- Review [Supabase Documentation](https://supabase.com/docs)
- Create an issue in this repository

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Native Team** - For the excellent mobile development framework
- **Supabase** - For backend-as-a-service platform
- **ElevenLabs** - For voice AI integration
- **OpenAI** - For AI-powered story collaboration
- **Story_Quest** - Original inspiration and reference implementation

## 📞 Support

For support, email support@creativebridge.app or create an issue in this repository.

---

**Built with ❤️ for creative writers of all ages**