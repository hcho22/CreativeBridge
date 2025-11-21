# Voice Input/Output Feature - Product Requirements Document (PRD)

## Overview

**Feature Name:** Voice Input/Output for Story Continuation  
**Priority:** High  
**Target Platform:** iOS and Android  
**Estimated Timeline:** 2-3 weeks

## Problem Statement

Currently, users must type their story continuations using the on-screen keyboard. This creates barriers for:

- Young users (K-2) who may struggle with typing skills
- Users who prefer speaking over typing
- Users who want a more natural, conversational storytelling experience

The Speaker and Microphone buttons exist on the game screen but are not fully functional. The Speaker button partially works but needs refinement, and the Microphone button only shows placeholder alerts.

## Goals & Success Criteria

### Primary Goals

- Enable users to listen to the latest story continuation via the Speaker button
- Enable users to speak their story continuation via the Microphone button
- Provide voice input as a supplement to typing (not a replacement)
- Maintain feature parity with typed input (same grade-level constraints, same AI processing)

### Success Criteria

- Speaker button can pause/resume reading the latest continuation
- Microphone button successfully transcribes speech to text
- Transcribed text appears immediately in the input field
- Users can edit transcribed text before submitting
- Voice input respects same grade-level constraints as typed input
- 90%+ of voice recognition attempts complete successfully
- Feature works across all grade levels (K-2, 3-5, 6-8, 9-12)
- Graceful fallback to typing when voice input unavailable

## User Stories

### Core User Stories

**As a** K-2 student using CreativeBridge  
**I want to** speak my story continuation instead of typing it  
**So that** I can participate in storytelling even if I haven't mastered typing yet

**As a** CreativeBridge user  
**I want to** listen to the latest story continuation being read aloud  
**So that** I can hear the story progression and better understand what to continue

**As a** user who prefers speaking  
**I want to** use voice input as an alternative to typing  
**So that** I can express my ideas more naturally and quickly

### Additional User Stories

- **As a user**, I want to see the transcribed text immediately so I can verify it's correct
- **As a user**, I want to edit the transcribed text before submitting so I can fix any recognition errors
- **As a user**, I want the microphone button to show different states (idle/listening/processing) so I know what's happening
- **As a user**, I want to pause and resume story playback so I can control the reading pace
- **As a user**, I want voice features to work the same way as typing so the experience is consistent

## Functional Requirements

### Speaker Button (Text-to-Speech)

1. **Playback Functionality**

   - Read only the latest story continuation (not the entire story from beginning)
   - Display pause icon (⏹️) when speaking, speaker icon (🔊) when idle
   - Tapping during playback should pause the speech
   - Tapping when paused should resume from where it stopped
   - Tapping when idle should start reading from the beginning of the latest continuation

2. **Content Selection**

   - Read the most recent continuation added to the story
   - Do not read user's input text
   - Handle empty or missing continuation gracefully (button disabled)

3. **State Management**
   - Track speaking state (idle/speaking/paused)
   - Update button icon based on current state
   - Disable button when no story content available

### Microphone Button (Speech-to-Text)

1. **Voice Input Functionality**

   - Tap to start listening, tap again to stop
   - Show different button states: idle (🎤), listening (🔴), processing (⏳)
   - Transcribe speech to text in real-time
   - Insert transcribed text immediately into the input field
   - Allow users to edit transcribed text before submitting

2. **Input Field Integration**

   - Append transcribed text to existing input field content (if any)
   - Preserve any text user has already typed
   - Allow full editing of combined text (typed + spoken)

3. **State Indicators**

   - **Idle state**: Show microphone emoji (🎤)
   - **Listening state**: Show red circle or listening indicator (🔴)
   - **Processing state**: Show processing indicator (⏳) with optional loading spinner
   - Update button appearance based on current state

4. **Submission Flow**

   - After transcription, user must still tap "Continue Story" button
   - Voice input does not auto-submit
   - Same validation rules apply (non-empty input required)

5. **Noise Handling**
   - Wait a few seconds of silence before finalizing transcription
   - Handle background noise gracefully
   - Allow user to stop listening manually if needed

### User Experience Flow

#### Speaker Button Flow

1. User views story with latest continuation
2. User taps Speaker button (🔊)
3. Latest continuation begins reading aloud
4. Button icon changes to pause (⏹️)
5. User can tap to pause/resume
6. When finished, button returns to speaker icon (🔊)

#### Microphone Button Flow

1. User taps Microphone button (🎤)
2. Button changes to listening state (🔴)
3. User speaks their continuation
4. User taps button again to stop listening
5. Button changes to processing state (⏳)
6. Transcribed text appears in input field immediately
7. Button returns to idle state (🎤)
8. User can edit transcribed text if needed
9. User taps "Continue Story" button to submit

### Error Handling

1. **Speech Recognition Failures**

   - If recognition fails, show user-friendly error message
   - Prompt user to try again
   - Provide option to type instead
   - Do not block user from continuing with typing

2. **Permission Denials**

   - Request microphone permission when first using voice input
   - Show clear explanation of why permission is needed
   - If denied, gracefully fall back to typing
   - Allow user to enable permissions later in device settings

3. **Service Unavailability**

   - If speech recognition service unavailable, disable mic button
   - Show appropriate message to user
   - Always allow typing as fallback

4. **Background Noise/Interruptions**
   - Wait a few seconds of silence before finalizing transcription
   - Allow user to manually stop listening
   - Show transcribed text even if incomplete
   - Let user edit to fix any issues

## Technical Requirements

### Text-to-Speech (Speaker Button)

1. **Service Integration**

   - Use existing `textToSpeechService` (already implemented)
   - Call `speakStoryContent()` with latest continuation only
   - Implement pause/resume functionality
   - Track speaking state in component

2. **Content Extraction**

   - Identify the latest continuation in `currentSession.story_content`
   - Extract only the most recent addition (not full story)
   - Handle story content parsing to separate continuations

3. **State Management**
   - Add `isSpeaking` state to track playback status
   - Update button icon based on state
   - Handle stop/pause/resume actions

### Speech-to-Text (Microphone Button)

1. **Service Integration**

   - Use existing `VoiceInput` component (already implemented)
   - Integrate `@react-native-voice/voice` library
   - Handle permission requests for microphone access

2. **Input Field Integration**

   - Connect transcribed text to `userInput` state
   - Append to existing input (don't replace)
   - Maintain ability to edit combined text

3. **State Management**

   - Track voice input state: 'idle' | 'listening' | 'processing'
   - Update button appearance based on state
   - Handle start/stop listening actions

4. **Transcription Processing**
   - Receive speech results from Voice library
   - Clean and format transcribed text
   - Insert into input field immediately
   - Handle partial results if needed

### Permissions Handling

1. **Microphone Permission**

   - Request permission on first mic button tap
   - Show clear explanation dialog
   - Handle permission denial gracefully
   - Check permission status before enabling voice input

2. **Platform-Specific Handling**
   - iOS: Handle Info.plist permissions
   - Android: Handle runtime permissions via PermissionsAndroid
   - Provide platform-appropriate permission dialogs

### Grade-Level Integration

1. **Constraint Application**

   - Voice input must respect same grade-level constraints as typed input
   - Apply vocabulary and complexity limits to transcribed text
   - Use same validation rules regardless of input method

2. **AI Processing**
   - Process voice-transcribed input identically to typed input
   - Use same `continueStory` API endpoint
   - Apply same grade-level adjustments to AI responses

### Error Handling Implementation

1. **Recognition Errors**

   - Catch `SpeechErrorEvent` from Voice library
   - Display user-friendly error messages
   - Provide "Try Again" option
   - Never block user from typing as alternative

2. **Service Errors**
   - Handle TTS service unavailability
   - Handle speech recognition service unavailability
   - Gracefully degrade to typing-only mode
   - Show appropriate UI indicators

## Non-Functional Requirements

### Performance

- Voice recognition should respond within 1-2 seconds
- Transcription should appear in input field immediately after stopping
- TTS playback should start within 500ms of button tap
- No UI blocking during voice processing

### Accessibility

- Voice features should be accessible to screen readers
- Button states should be clearly announced
- Error messages should be accessible
- Support for accessibility settings (e.g., reduced motion)

### Compatibility

- Feature must work on iOS 13+ and Android 8+
- Support for all grade levels (K-2, 3-5, 6-8, 9-12)
- Work with existing story continuation flow
- Compatible with existing text input functionality

### Reliability

- 90%+ success rate for voice recognition
- Graceful fallback when services unavailable
- No data loss if voice input fails
- Consistent behavior across devices

## UI/UX Requirements

### Button States

**Speaker Button:**

- Idle: Blue background, 🔊 emoji
- Speaking: Blue background, ⏹️ emoji
- Disabled: Gray background, 🔊 emoji (when no content)

**Microphone Button:**

- Idle: Purple background, 🎤 emoji
- Listening: Purple background, 🔴 emoji or "Listening..." text
- Processing: Purple background, ⏳ emoji or spinner
- Disabled: Gray background, 🎤 emoji (when unavailable)

### Visual Feedback

- No additional visual feedback needed while listening (per requirements)
- Button state changes are sufficient indication
- Error messages appear as alerts or inline text

### Layout

- Maintain existing button layout and positioning
- Buttons remain in same row as current implementation
- No changes to overall screen layout

## Dependencies

### Existing Components

- `VoiceInput` component (already exists in `src/components/common/VoiceInput.tsx`)
- `textToSpeechService` (already exists in `src/services/textToSpeech.ts`)
- `HomeScreen` component (where buttons are located)

### External Libraries

- `@react-native-voice/voice` (already installed)
- React Native Text-to-Speech (already integrated)

### Permissions

- iOS: `NSMicrophoneUsageDescription` in Info.plist
- Android: `RECORD_AUDIO` permission in AndroidManifest.xml

## Testing Requirements

### Unit Tests

- Test speaker button state transitions
- Test microphone button state transitions
- Test text transcription insertion
- Test pause/resume functionality

### Integration Tests

- Test full voice input flow (speak → transcribe → submit)
- Test speaker playback flow
- Test error handling scenarios
- Test permission request flow

### User Acceptance Tests

- Verify voice input works for all grade levels
- Verify transcribed text can be edited
- Verify pause/resume works correctly
- Verify fallback to typing when voice unavailable
- Verify same story continuation behavior for voice vs. typed input

## Implementation Notes

### Key Files to Modify

1. `src/screens/HomeScreen.tsx`

   - Integrate VoiceInput component
   - Implement speaker pause/resume
   - Connect transcribed text to input field
   - Update button state management

2. `src/components/common/VoiceInput.tsx`

   - May need minor adjustments for integration
   - Ensure proper state management
   - Handle error cases

3. `src/services/textToSpeech.ts`
   - May need pause/resume functionality
   - Ensure latest continuation extraction

### Implementation Phases

**Phase 1: Speaker Button Enhancement**

- Implement pause/resume functionality
- Extract latest continuation only
- Update state management
- Test playback controls

**Phase 2: Microphone Button Integration**

- Integrate VoiceInput component
- Connect to input field
- Implement state management
- Handle permissions

**Phase 3: Error Handling & Polish**

- Implement error handling
- Add user feedback
- Test edge cases
- Ensure graceful degradation

## Open Questions / Future Enhancements

1. **Permission Handling**: Consider adding permission explanation screen on first app launch
2. **Visual Feedback**: May want to add subtle listening indicator in future iterations
3. **Offline Support**: Consider offline speech recognition capabilities
4. **Language Support**: May want to support multiple languages in future
5. **Voice Commands**: Could add voice commands for navigation in future

## Success Metrics

- 80%+ of K-2 users try voice input at least once
- 60%+ of voice input attempts result in successful transcription
- 90%+ of speaker button taps result in successful playback
- Zero increase in story continuation errors due to voice input
- User satisfaction score of 4+ out of 5 for voice features
