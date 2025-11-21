# Voice Input/Output Feature - Implementation Tasks

## Overview

**Based on:** voice-input-output-PRD.md  
**Implementation Timeline:** 2-3 weeks  
**Phases:** 3 phases (Speaker Enhancement → Microphone Integration → Error Handling & Polish)

---

## Phase 1: Speaker Button Enhancement (Week 1)

### Task 1.1: Analyze Current TTS Implementation

**Objective:** Understand existing text-to-speech service and identify required modifications

**Implementation Steps:**

- [x] Review `src/services/textToSpeech.ts` implementation
- [x] Review `src/services/textToSpeechSafe.ts` and `textToSpeechIsolated.ts` if applicable
- [x] Identify current pause/resume capabilities
- [x] Review how `speakStoryContent()` currently works
- [x] Document current state management in `HomeScreen.tsx`
- [x] Identify what needs to be added for pause/resume functionality

**Verification Test:**

```javascript
// Test: Verify current TTS service capabilities
import textToSpeechService from 'src/services/textToSpeech';
// Check available methods
expect(typeof textToSpeechService.speak).toBe('function');
expect(typeof textToSpeechService.stop).toBe('function');
// Check if pause/resume exists
console.log('Available methods:', Object.keys(textToSpeechService));
```

**Validation Steps:**

1. Open `src/services/textToSpeech.ts` and verify the file exists and is readable
2. Check that `speak()` and `stop()` methods are present in the service
3. Document whether `pause()` and `resume()` methods exist or are missing
4. Review `HomeScreen.tsx` and identify where `textToSpeechService` is used
5. Create a summary document listing:
   - Current TTS service methods available
   - Current state management approach
   - Missing functionality needed for pause/resume
6. Verify all implementation steps are completed by checking each checkbox

**Expected Outcome:**

- Complete understanding of current TTS implementation
- Clear documentation of existing vs. needed functionality
- Identification of all files that need modification

---

### Task 1.2: Implement Pause/Resume Functionality in TTS Service

**Objective:** Add pause and resume capabilities to the text-to-speech service

**Implementation Steps:**

- [x] Review React Native TTS library documentation for pause/resume support
- [x] Add `pause()` method to TTS service (if not exists)
- [x] Add `resume()` method to TTS service (if not exists)
- [x] Add state tracking for pause/resume status
- [x] Handle platform-specific differences (iOS vs Android)
- [x] Add error handling for pause/resume operations
- [x] Update TypeScript interfaces to include pause/resume methods

**Verification Test:**

```javascript
// Test: TTS pause/resume functionality
describe('TTS Pause/Resume', () => {
  test('pauses speech correctly', async () => {
    await textToSpeechService.speak('Test text');
    await textToSpeechService.pause();
    expect(textToSpeechService.isPaused()).toBe(true);
  });

  test('resumes speech from pause point', async () => {
    await textToSpeechService.speak('Long test text');
    await textToSpeechService.pause();
    await textToSpeechService.resume();
    expect(textToSpeechService.isPaused()).toBe(false);
  });
});
```

**Validation Steps:**

1. Run the verification tests: `npm test -- textToSpeech`
2. Verify `pause()` method exists and can be called on the TTS service
3. Verify `resume()` method exists and can be called on the TTS service
4. Test pause/resume on a physical device:
   - Start speaking a long text
   - Call `pause()` - speech should stop
   - Call `resume()` - speech should continue from where it paused
5. Test on both iOS and Android devices
6. Verify TypeScript compilation passes without errors
7. Check that `isPaused()` method returns correct state

**Expected Outcome:**

- All verification tests pass
- `pause()` and `resume()` methods work correctly on both platforms
- No TypeScript errors
- Speech pauses and resumes from the correct position

---

### Task 1.3: Extract Latest Story Continuation

**Objective:** Implement logic to extract only the latest continuation from story content

**Implementation Steps:**

- [x] Analyze `currentSession.story_content` structure
- [x] Determine how to identify the latest continuation (by round, timestamp, or delimiter)
- [x] Create utility function `extractLatestContinuation(storyContent: string): string`
- [x] Handle edge cases (empty story, single continuation, etc.)
- [x] Add unit tests for extraction logic
- [x] Consider story metadata to identify continuation boundaries

**Verification Test:**

```javascript
// Test: Latest continuation extraction
describe('Extract Latest Continuation', () => {
  test('extracts only the latest continuation', () => {
    const fullStory =
      'Once upon a time...\n\nThen the hero continued...\n\nThe story reached its climax...';
    const latest = extractLatestContinuation(fullStory);
    expect(latest).toBe('The story reached its climax...');
    expect(latest).not.toContain('Once upon a time');
  });

  test('handles single continuation', () => {
    const story = 'A single story continuation.';
    const latest = extractLatestContinuation(story);
    expect(latest).toBe(story);
  });

  test('handles empty story gracefully', () => {
    const latest = extractLatestContinuation('');
    expect(latest).toBe('');
  });
});
```

**Validation Steps:**

1. Run unit tests: `npm test -- extractLatestContinuation`
2. Manually test with a real story session:
   - Create a story with multiple continuations
   - Call `extractLatestContinuation()` with the full story content
   - Verify only the last continuation is returned
3. Test edge cases:
   - Empty string returns empty string
   - Single continuation returns the entire story
   - Story with only whitespace/newlines handles gracefully
4. Verify the function is exported and can be imported
5. Check that the function handles different story formats (with/without delimiters)
6. Test with actual `currentSession.story_content` from the app

**Expected Outcome:**

- All unit tests pass
- Function correctly extracts only the latest continuation
- Edge cases are handled gracefully
- Function works with real story data from the app

---

### Task 1.4: Update Speaker Button State Management

**Objective:** Implement state management for speaker button (idle/speaking/paused)

**Implementation Steps:**

- [x] Add state variable for speaker status: `speakerState: 'idle' | 'speaking' | 'paused'`
- [x] Update `isSpeaking` state to track detailed status
- [x] Add state update handlers for TTS events (onStart, onPause, onResume, onFinish)
- [x] Connect TTS service event listeners to state updates
- [x] Ensure state updates trigger UI re-renders
- [x] Clean up event listeners on component unmount

**Verification Test:**

```javascript
// Test: Speaker button state management
describe('Speaker Button State', () => {
  test('updates to speaking when playback starts', async () => {
    const { result } = renderHook(() => useSpeakerState());
    await speakStoryContent('Test');
    await waitFor(() => {
      expect(result.current.speakerState).toBe('speaking');
    });
  });

  test('updates to paused when paused', async () => {
    await speakStoryContent('Test');
    await pauseSpeech();
    expect(speakerState).toBe('paused');
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- speakerButtonState`
2. In HomeScreen, verify `speakerState` state variable exists with type `'idle' | 'speaking' | 'paused'`
3. Manually test state transitions:
   - Start with idle state
   - Trigger TTS start - verify state changes to 'speaking'
   - Pause TTS - verify state changes to 'paused'
   - Resume TTS - verify state changes to 'speaking'
   - Finish TTS - verify state returns to 'idle'
4. Check that event listeners are properly set up and cleaned up
5. Verify state updates trigger UI re-renders (check React DevTools)
6. Test on component unmount - verify listeners are removed

**Expected Outcome:**

- State variable exists and has correct type
- State transitions work correctly for all scenarios
- Event listeners are properly managed
- No memory leaks from event listeners

---

### Task 1.5: Implement Speaker Button Tap Handler

**Objective:** Create handler that toggles between play/pause/resume based on current state

**Implementation Steps:**

- [x] Create `handleSpeakerButtonPress()` function in HomeScreen
- [x] Implement logic:
  - If idle → start reading latest continuation
  - If speaking → pause
  - If paused → resume
- [x] Extract latest continuation before speaking
- [x] Update button icon based on state (🔊 for idle, ⏹️ for speaking/paused)
- [x] Handle disabled state (no story content)
- [x] Add error handling for TTS failures

**Verification Test:**

```javascript
// Test: Speaker button tap handler
describe('Speaker Button Handler', () => {
  test('starts playback when idle', async () => {
    const { getByTestId } = render(<HomeScreen />);
    const speakerButton = getByTestId('speaker-button');

    fireEvent.press(speakerButton);
    await waitFor(() => {
      expect(textToSpeechService.speak).toHaveBeenCalled();
    });
  });

  test('pauses when speaking', async () => {
    await startSpeaking();
    fireEvent.press(speakerButton);
    expect(textToSpeechService.pause).toHaveBeenCalled();
  });

  test('resumes when paused', async () => {
    await startSpeaking();
    await pauseSpeaking();
    fireEvent.press(speakerButton);
    expect(textToSpeechService.resume).toHaveBeenCalled();
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- speakerButtonHandler`
2. In HomeScreen, verify `handleSpeakerButtonPress()` function exists
3. Manually test on device:
   - Tap speaker button when idle → should start reading latest continuation
   - Tap speaker button while speaking → should pause
   - Tap speaker button while paused → should resume
4. Verify latest continuation is extracted before speaking (not full story)
5. Test with no story content → button should be disabled
6. Check error handling when TTS service fails
7. Verify button icon updates correctly based on state

**Expected Outcome:**

- Handler function exists and works correctly
- All state transitions (idle → speaking → pause → resume) work
- Only latest continuation is read, not full story
- Button is disabled when no content available
- Error cases are handled gracefully

---

### Task 1.6: Update Speaker Button UI

**Objective:** Update button to show correct icon and state based on speaker status

**Implementation Steps:**

- [x] Update button icon rendering logic:
  - Show 🔊 when `speakerState === 'idle'`
  - Show ⏹️ when `speakerState === 'speaking' || speakerState === 'paused'`
- [x] Update button disabled state (when no story content)
- [x] Ensure button styling matches existing design
- [x] Add accessibility labels that reflect current state
- [x] Test button appearance in all states

**Verification Test:**

```javascript
// Test: Speaker button UI updates
describe('Speaker Button UI', () => {
  test('shows speaker icon when idle', () => {
    const { getByTestId } = render(<HomeScreen speakerState="idle" />);
    const button = getByTestId('speaker-button');
    expect(button).toHaveTextContent('🔊');
  });

  test('shows pause icon when speaking', () => {
    const { getByTestId } = render(<HomeScreen speakerState="speaking" />);
    const button = getByTestId('speaker-button');
    expect(button).toHaveTextContent('⏹️');
  });

  test('is disabled when no story content', () => {
    const { getByTestId } = render(<HomeScreen storyContent={null} />);
    const button = getByTestId('speaker-button');
    expect(button).toBeDisabled();
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- speakerButtonUI`
2. Visually inspect the speaker button in the app:
   - When idle → shows 🔊 emoji
   - When speaking → shows ⏹️ emoji
   - When paused → shows ⏹️ emoji
3. Test button disabled state:
   - With no story content → button is grayed out and disabled
   - With story content → button is enabled
4. Verify button styling matches existing design
5. Check accessibility labels:
   - Button has `accessibilityLabel` that reflects current state
   - Screen reader announces correct state
6. Test button appearance in all three states visually

**Expected Outcome:**

- Correct icons display for each state
- Button disabled state works correctly
- Styling is consistent with existing design
- Accessibility labels are correct

---

### Task 1.7: Integration Testing for Phase 1

**Objective:** Test complete speaker button functionality end-to-end

**Implementation Steps:**

- [x] Test complete flow: idle → speaking → pause → resume → finish
- [x] Test with different story lengths
- [x] Test with empty story content
- [x] Test error scenarios (TTS service unavailable)
- [x] Verify latest continuation is read (not full story)
- [x] Test on both iOS and Android
- [x] Verify no memory leaks from event listeners

**Verification Test:**

```javascript
// Test: Complete speaker button flow
describe('Speaker Button Integration', () => {
  test('complete playback flow works', async () => {
    const mockStory = {
      story_content: 'Part 1\n\nPart 2\n\nPart 3',
    };

    const { getByTestId } = render(<HomeScreen currentSession={mockStory} />);
    const speakerButton = getByTestId('speaker-button');

    // Start playback
    fireEvent.press(speakerButton);
    await waitFor(() => {
      expect(textToSpeechService.speak).toHaveBeenCalledWith('Part 3');
    });

    // Pause
    fireEvent.press(speakerButton);
    expect(textToSpeechService.pause).toHaveBeenCalled();

    // Resume
    fireEvent.press(speakerButton);
    expect(textToSpeechService.resume).toHaveBeenCalled();
  });
});
```

**Validation Steps:**

1. Run integration tests: `npm test -- speakerButtonIntegration`
2. End-to-end manual test on device:
   - Start a story session with multiple continuations
   - Tap speaker button → verify only latest continuation is read
   - Tap again to pause → verify speech stops
   - Tap again to resume → verify speech continues
   - Let it finish → verify button returns to idle state
3. Test with different story lengths (short, medium, long)
4. Test with empty story content → verify button is disabled
5. Test error scenario: disable TTS service → verify graceful handling
6. Test on both iOS and Android
7. Check for memory leaks: perform flow multiple times, check memory usage
8. Verify no regressions in existing functionality

**Expected Outcome:**

- Complete flow works end-to-end
- Only latest continuation is read (not full story)
- Pause/resume works correctly
- Works on both platforms
- No memory leaks
- No regressions

---

## Phase 2: Microphone Button Integration (Week 2)

### Task 2.1: Review VoiceInput Component

**Objective:** Understand existing VoiceInput component capabilities and integration points

**Implementation Steps:**

- [x] Review `src/components/common/VoiceInput.tsx` implementation
- [x] Identify component props and callbacks
- [x] Review state management (`idle`, `listening`, `processing`)
- [x] Check permission handling implementation
- [x] Review error handling in component
- [x] Identify what modifications are needed for HomeScreen integration

**Verification Test:**

```javascript
// Test: VoiceInput component structure
import { VoiceInput } from 'src/components/common/VoiceInput';

describe('VoiceInput Component Review', () => {
  test('component exports correctly', () => {
    expect(VoiceInput).toBeDefined();
  });

  test('has required props', () => {
    const props = {
      onSpeechResult: jest.fn(),
      isEnabled: true,
    };
    expect(() => render(<VoiceInput {...props} />)).not.toThrow();
  });
});
```

**Validation Steps:**

1. Open `src/components/common/VoiceInput.tsx` and verify file exists
2. Review component props interface and document:
   - `onSpeechResult` callback signature
   - `isEnabled` prop usage
   - Other props available
3. Check component state management:
   - Identify state variables (`idle`, `listening`, `processing`)
   - Review state transition logic
4. Review permission handling:
   - How permissions are requested
   - Error handling for denied permissions
5. Document integration points:
   - What needs to be connected in HomeScreen
   - Any modifications needed to VoiceInput component
6. Create integration checklist based on review

**Expected Outcome:**

- Complete understanding of VoiceInput component
- Clear documentation of props and callbacks
- Identified integration points and required modifications
- Integration checklist created

---

### Task 2.2: Set Up Microphone Permissions

**Objective:** Ensure microphone permissions are properly configured for both platforms

**Implementation Steps:**

- [x] Verify iOS: Check `Info.plist` for `NSMicrophoneUsageDescription`
- [x] Verify Android: Check `AndroidManifest.xml` for `RECORD_AUDIO` permission
- [x] Add permission description text if missing:
  - iOS: "CreativeBridge needs access to your microphone to enable voice input for stories."
  - Android: Add appropriate permission rationale
- [x] Test permission request flow on both platforms
- [x] Document permission handling approach

**Verification Test:**

```javascript
// Test: Permission configuration
describe('Microphone Permissions', () => {
  test('iOS Info.plist contains microphone usage description', () => {
    const plist = require('ios/CreativeBridge/Info.plist');
    expect(plist.NSMicrophoneUsageDescription).toBeTruthy();
  });

  test('Android manifest contains RECORD_AUDIO permission', () => {
    const manifest = require('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('RECORD_AUDIO');
  });
});
```

**Validation Steps:**

1. Run permission tests: `npm test -- microphonePermissions`
2. Check iOS `Info.plist`:
   - Open `ios/CreativeBridge/Info.plist`
   - Verify `NSMicrophoneUsageDescription` key exists
   - Verify description text is user-friendly and explains why permission is needed
3. Check Android manifest:
   - Open `android/app/src/main/AndroidManifest.xml`
   - Verify `<uses-permission android:name="android.permission.RECORD_AUDIO" />` exists
4. Test permission request flow on iOS device:
   - First mic button tap should trigger permission dialog
   - Dialog should show the description text
5. Test permission request flow on Android device:
   - First mic button tap should trigger permission dialog
   - Permission should be requested at runtime
6. Test permission denial:
   - Deny permission → verify graceful handling
   - Verify typing remains available

**Expected Outcome:**

- Permissions configured correctly for both platforms
- Permission description text is clear and user-friendly
- Permission request flow works on both platforms
- Denial is handled gracefully

---

### Task 2.3: Integrate VoiceInput Component into HomeScreen

**Objective:** Add VoiceInput component to HomeScreen and connect to input field

**Implementation Steps:**

- [ ] Import VoiceInput component into HomeScreen
- [ ] Add VoiceInput component to render (initially hidden or as mic button replacement)
- [ ] Create state for voice input: `voiceInputState: 'idle' | 'listening' | 'processing'`
- [ ] Connect `onSpeechResult` callback to update `userInput` state
- [ ] Implement `handleVoiceResult(text: string)` function
- [ ] Append transcribed text to existing input (don't replace)
- [ ] Test basic integration

**Verification Test:**

```javascript
// Test: VoiceInput integration
describe('VoiceInput Integration', () => {
  test('transcribed text appears in input field', async () => {
    const { getByTestId } = render(<HomeScreen />);
    const voiceInput = getByTestId('voice-input');

    // Simulate speech result
    fireEvent(voiceInput, 'onSpeechResult', { text: 'Hello world' });

    await waitFor(() => {
      const inputField = getByTestId('story-input');
      expect(inputField.props.value).toContain('Hello world');
    });
  });

  test('appends to existing input text', async () => {
    const { getByTestId } = render(
      <HomeScreen initialInput="Existing text " />,
    );
    const voiceInput = getByTestId('voice-input');

    fireEvent(voiceInput, 'onSpeechResult', { text: 'new text' });

    await waitFor(() => {
      const inputField = getByTestId('story-input');
      expect(inputField.props.value).toBe('Existing text new text');
    });
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- voiceInputIntegration`
2. Verify VoiceInput is imported in HomeScreen
3. Check that `voiceInputState` state variable exists with correct type
4. Verify `handleVoiceResult()` function exists and is connected to `onSpeechResult`
5. Manual test on device:
   - Use VoiceInput component to speak text
   - Verify transcribed text appears in input field immediately
   - Type some text first, then use voice input
   - Verify voice text is appended (not replacing typed text)
6. Test with empty input field → verify voice text still works
7. Verify input field remains editable after voice transcription

**Expected Outcome:**

- VoiceInput component integrated
- State management working correctly
- Transcribed text appears in input field
- Text appends correctly (doesn't replace existing text)
- Input field remains editable

---

### Task 2.4: Replace Mic Button with VoiceInput Integration

**Objective:** Replace placeholder mic button with functional VoiceInput integration

**Implementation Steps:**

- [x] Remove placeholder Alert.alert code from mic button
- [x] Implement tap-to-start/stop functionality
- [x] Connect mic button to VoiceInput component's start/stop methods
- [x] Update mic button to show VoiceInput state
- [x] Handle button press:
  - If idle → start listening
  - If listening → stop listening
  - If processing → do nothing (disabled)
- [x] Update button disabled state based on VoiceInput availability

**Verification Test:**

```javascript
// Test: Mic button functionality
describe('Mic Button Integration', () => {
  test('starts listening on first tap', () => {
    const { getByTestId } = render(<HomeScreen />);
    const micButton = getByTestId('mic-button');

    fireEvent.press(micButton);
    expect(Voice.start).toHaveBeenCalled();
  });

  test('stops listening on second tap', () => {
    const { getByTestId } = render(<HomeScreen voiceState="listening" />);
    const micButton = getByTestId('mic-button');

    fireEvent.press(micButton);
    expect(Voice.stop).toHaveBeenCalled();
  });

  test('is disabled when processing', () => {
    const { getByTestId } = render(<HomeScreen voiceState="processing" />);
    const micButton = getByTestId('mic-button');
    expect(micButton).toBeDisabled();
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- micButtonIntegration`
2. Verify placeholder Alert.alert code is removed from mic button
3. Manual test on device:
   - Tap mic button when idle → should start listening (check button state changes)
   - Tap mic button while listening → should stop listening
   - Try tapping while processing → button should be disabled
4. Verify VoiceInput start/stop methods are called correctly
5. Check button state updates reflect VoiceInput state
6. Test button disabled state when VoiceInput unavailable
7. Verify no console errors when toggling listening state

**Expected Outcome:**

- Placeholder code removed
- Tap-to-start/stop works correctly
- Button state reflects VoiceInput state accurately
- Button disabled when processing
- No errors in console

---

### Task 2.5: Implement Mic Button State Indicators

**Objective:** Update mic button to show different states (idle/listening/processing)

**Implementation Steps:**

- [x] Update button icon/emoji based on state:
  - Idle: 🎤
  - Listening: 🔴
  - Processing: ⏳ (with optional spinner)
- [x] Update button styling for each state (if needed)
- [x] Ensure state updates are reactive
- [x] Add accessibility labels that reflect current state
- [x] Test visual appearance in all states

**Verification Test:**

```javascript
// Test: Mic button state indicators
describe('Mic Button States', () => {
  test('shows mic icon when idle', () => {
    const { getByTestId } = render(<HomeScreen voiceState="idle" />);
    const button = getByTestId('mic-button');
    expect(button).toHaveTextContent('🎤');
  });

  test('shows listening indicator when listening', () => {
    const { getByTestId } = render(<HomeScreen voiceState="listening" />);
    const button = getByTestId('mic-button');
    expect(button).toHaveTextContent('🔴');
  });

  test('shows processing indicator when processing', () => {
    const { getByTestId } = render(<HomeScreen voiceState="processing" />);
    const button = getByTestId('mic-button');
    expect(button).toHaveTextContent('⏳');
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- micButtonStates`
2. Visually inspect mic button in app:
   - When idle → shows 🎤 emoji
   - When listening → shows 🔴 emoji
   - When processing → shows ⏳ emoji (with optional spinner)
3. Test state transitions:
   - Tap button → verify icon changes from 🎤 to 🔴
   - Stop listening → verify icon changes from 🔴 to ⏳ then back to 🎤
4. Verify button styling is consistent across states
5. Check accessibility labels:
   - Button has `accessibilityLabel` for each state
   - Screen reader announces state changes
6. Test all three states visually and functionally

**Expected Outcome:**

- Correct icons display for each state
- State transitions are smooth and immediate
- Styling is consistent
- Accessibility labels are correct for each state

---

### Task 2.6: Implement Text Transcription Handling

**Objective:** Handle transcribed text and insert into input field with proper formatting

**Implementation Steps:**

- [x] Create `handleVoiceTranscription(text: string)` function
- [x] Clean transcribed text (trim whitespace, handle punctuation)
- [x] Append to existing `userInput` state (preserve typed text)
- [x] Add space between existing and new text if needed
- [x] Update input field immediately after transcription
- [x] Ensure user can edit combined text
- [x] Handle empty transcriptions gracefully

**Verification Test:**

```javascript
// Test: Text transcription handling
describe('Transcription Handling', () => {
  test('appends transcribed text to existing input', () => {
    const { result } = renderHook(() => {
      const [input, setInput] = useState('Existing text');
      return { input, setInput };
    });

    handleVoiceTranscription('new text', result.current.setInput);

    expect(result.current.input).toBe('Existing text new text');
  });

  test('handles empty transcription', () => {
    const setInput = jest.fn();
    handleVoiceTranscription('', setInput);
    expect(setInput).not.toHaveBeenCalled();
  });

  test('trims whitespace from transcription', () => {
    const setInput = jest.fn();
    handleVoiceTranscription('  spaced text  ', setInput);
    expect(setInput).toHaveBeenCalledWith(
      expect.stringContaining('spaced text'),
    );
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- transcriptionHandling`
2. Verify `handleVoiceTranscription()` function exists
3. Manual test on device:
   - Type "Hello " in input field
   - Use voice input to say "world"
   - Verify input field shows "Hello world" (appended, not replaced)
4. Test text cleaning:
   - Speak text with extra spaces → verify trimmed
   - Speak text with punctuation → verify handled correctly
5. Test empty transcription:
   - Trigger voice input but say nothing → verify no error, input unchanged
6. Test editing after transcription:
   - Transcribe text via voice
   - Manually edit the transcribed text → verify editing works
7. Verify space is added between existing and new text when needed

**Expected Outcome:**

- Function exists and works correctly
- Text appends properly (doesn't replace)
- Text cleaning works (trim, punctuation handling)
- Empty transcriptions handled gracefully
- Combined text (typed + spoken) is fully editable

---

### Task 2.7: Implement Silence Detection for Auto-Stop

**Objective:** Add logic to wait for silence before finalizing transcription

**Implementation Steps:**

- [x] Review Voice library's silence detection capabilities
- [x] Implement timeout mechanism (wait few seconds of silence)
- [x] Configure silence threshold if available
- [x] Allow manual stop to override auto-stop
- [x] Handle edge cases (very short speech, long pauses)
- [x] Test with various speech patterns

**Verification Test:**

```javascript
// Test: Silence detection
describe('Silence Detection', () => {
  test('waits for silence before finalizing', async () => {
    jest.useFakeTimers();
    const onSpeechResult = jest.fn();

    startVoiceInput(onSpeechResult);
    // Simulate speech with pause
    simulateSpeech('Hello');
    await jest.advanceTimersByTime(2000); // 2 seconds of silence

    expect(onSpeechResult).toHaveBeenCalledWith('Hello');
  });

  test('allows manual stop before silence timeout', async () => {
    const onSpeechResult = jest.fn();

    startVoiceInput(onSpeechResult);
    simulateSpeech('Hello');
    stopVoiceInput(); // Manual stop

    expect(onSpeechResult).toHaveBeenCalledWith('Hello');
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- silenceDetection`
2. Review Voice library documentation for silence detection capabilities
3. Manual test on device:
   - Start voice input
   - Speak a sentence, then pause for a few seconds
   - Verify transcription finalizes after silence period
4. Test manual stop:
   - Start voice input
   - Speak and immediately tap stop button
   - Verify transcription finalizes immediately (doesn't wait for silence)
5. Test edge cases:
   - Very short speech (< 1 second) → verify handled correctly
   - Long pause during speech → verify doesn't finalize prematurely
6. Verify silence timeout is configurable (2-3 seconds recommended)
7. Test with background noise → verify doesn't interfere with silence detection

**Expected Outcome:**

- Silence detection works correctly
- Manual stop overrides auto-stop
- Edge cases handled gracefully
- Timeout is configurable and appropriate
- Background noise doesn't interfere

---

### Task 2.8: Ensure Voice Input Respects Grade-Level Constraints

**Objective:** Verify voice input goes through same validation as typed input

**Implementation Steps:**

- [x] Review existing grade-level validation for typed input
- [x] Ensure transcribed text goes through same validation pipeline
- [x] Test that voice input triggers same validation errors as typing
- [x] Verify AI processing treats voice input identically to typed input
- [x] Document that voice input is processed the same way

**Verification Test:**

```javascript
// Test: Grade-level constraints
describe('Voice Input Grade-Level Constraints', () => {
  test('applies same validation as typed input', () => {
    const typedInput = 'Simple story';
    const voiceInput = 'Simple story';

    const typedValidation = validateInput(typedInput, 'K-2');
    const voiceValidation = validateInput(voiceInput, 'K-2');

    expect(voiceValidation).toEqual(typedValidation);
  });

  test('sends to same API endpoint', async () => {
    const typedResult = await continueStory('typed text', 'K-2');
    const voiceResult = await continueStory('voice text', 'K-2');

    expect(voiceResult.endpoint).toBe(typedResult.endpoint);
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- gradeLevelConstraints`
2. Review existing grade-level validation for typed input
3. Manual test with different grade levels:
   - Set grade level to K-2
   - Type input → note validation behavior
   - Use voice input with same text → verify same validation
4. Test API processing:
   - Submit typed input → note API call details
   - Submit voice input → verify same API endpoint and parameters
5. Test with different grade levels (K-2, 3-5, 6-8, 9-12):
   - Verify voice input respects grade-level constraints for each
6. Verify AI response adjustments are same for voice vs typed input
7. Document that voice input uses same validation pipeline

**Expected Outcome:**

- Voice input uses same validation as typed input
- Same API endpoint and processing for both input methods
- Grade-level constraints apply correctly to voice input
- AI responses are consistent regardless of input method

---

### Task 2.9: Integration Testing for Phase 2

**Objective:** Test complete microphone button functionality end-to-end

**Implementation Steps:**

- [x] Test complete flow: tap → listen → speak → stop → transcribe → edit → submit
- [x] Test with different speech lengths
- [x] Test with background noise
- [x] Test permission denial flow
- [x] Test error scenarios
- [x] Verify transcribed text can be edited
- [x] Test on both iOS and Android
- [x] Verify "Continue Story" button works with voice input

**Verification Test:**

```javascript
// Test: Complete microphone flow
describe('Microphone Integration', () => {
  test('complete voice input flow works', async () => {
    const { getByTestId } = render(<HomeScreen />);
    const micButton = getByTestId('mic-button');
    const continueButton = getByTestId('continue-story-button');

    // Start listening
    fireEvent.press(micButton);
    expect(Voice.start).toHaveBeenCalled();

    // Simulate speech
    simulateSpeech('The hero continued the adventure');

    // Stop listening
    fireEvent.press(micButton);

    // Wait for transcription
    await waitFor(() => {
      const input = getByTestId('story-input');
      expect(input.props.value).toContain('The hero continued the adventure');
    });

    // Submit
    fireEvent.press(continueButton);
    expect(continueStory).toHaveBeenCalled();
  });
});
```

**Validation Steps:**

1. Run integration tests: `npm test -- microphoneIntegration`
2. End-to-end manual test on device:
   - Tap mic button → verify starts listening (button shows 🔴)
   - Speak story continuation
   - Tap mic button again → verify stops listening (button shows ⏳ then 🎤)
   - Verify transcribed text appears in input field immediately
   - Edit transcribed text if needed
   - Tap "Continue Story" button → verify story continues with voice input
3. Test with different speech lengths (short, medium, long)
4. Test with background noise → verify handles gracefully
5. Test permission denial flow → verify typing still works
6. Test error scenarios → verify graceful handling
7. Test on both iOS and Android
8. Verify "Continue Story" button works correctly with voice input

**Expected Outcome:**

- Complete flow works end-to-end
- Transcription appears immediately
- Text can be edited before submission
- "Continue Story" works with voice input
- Works on both platforms
- Error scenarios handled gracefully

---

## Phase 3: Error Handling & Polish (Week 3)

### Task 3.1: Implement Speech Recognition Error Handling

**Objective:** Handle speech recognition failures gracefully with user-friendly messages

**Implementation Steps:**

- [x] Catch `SpeechErrorEvent` from Voice library
- [x] Map error types to user-friendly messages:
  - Network errors: "Network error. Please check your connection and try again."
  - Permission errors: "Microphone permission is required for voice input."
  - Recognition errors: "Voice recognition failed. Please try again."
  - Generic errors: "Something went wrong. Please try again or type your input."
- [x] Display error messages via Alert or inline text
- [x] Provide "Try Again" option in error dialogs
- [x] Ensure typing remains available as fallback
- [x] Reset voice input state after errors

**Verification Test:**

```javascript
// Test: Error handling
describe('Speech Recognition Error Handling', () => {
  test('handles network errors', async () => {
    const mockError = { error: { message: 'network' } };
    Voice.onSpeechError(mockError);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        expect.any(String),
      );
    });
  });

  test('handles permission errors', async () => {
    const mockError = { error: { message: 'permission' } };
    Voice.onSpeechError(mockError);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        expect.stringContaining('Microphone permission'),
        expect.any(String),
      );
    });
  });

  test('resets state after error', async () => {
    const { result } = renderHook(() => useVoiceInput());
    simulateError();

    await waitFor(() => {
      expect(result.current.voiceState).toBe('idle');
    });
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- speechRecognitionErrorHandling`
2. Test error scenarios on device:
   - Simulate network error → verify user-friendly message appears
   - Simulate permission error → verify appropriate message
   - Simulate recognition error → verify "try again" message
   - Simulate generic error → verify fallback message
3. Verify error messages are displayed via Alert or inline text
4. Check "Try Again" option works in error dialogs
5. Verify typing remains available after errors
6. Check voice input state resets to 'idle' after errors
7. Test all error types and verify correct messages for each

**Expected Outcome:**

- All error types handled with appropriate messages
- Error messages are user-friendly and actionable
- "Try Again" option works
- Typing always available as fallback
- State resets correctly after errors

---

### Task 3.2: Implement Permission Request Flow

**Objective:** Request microphone permission with clear explanation and handle denial

**Implementation Steps:**

- [x] Check permission status before enabling voice input
- [x] Request permission on first mic button tap (if not granted)
- [x] Show clear explanation dialog before requesting:
  - "CreativeBridge needs access to your microphone to enable voice input for stories."
- [x] Handle permission denial gracefully:
  - Show message explaining why permission is needed
  - Provide option to enable in device settings
  - Disable mic button but keep typing available
- [x] Handle permission grant:
  - Enable voice input
  - Show success feedback (optional)
- [x] Test on both iOS and Android

**Verification Test:**

```javascript
// Test: Permission handling
describe('Permission Request Flow', () => {
  test('requests permission on first use', async () => {
    PermissionsAndroid.check.mockResolvedValue(false);
    const { getByTestId } = render(<HomeScreen />);
    const micButton = getByTestId('mic-button');

    fireEvent.press(micButton);

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      expect.objectContaining({
        title: expect.any(String),
        message: expect.stringContaining('microphone'),
      }),
    );
  });

  test('disables mic button when permission denied', async () => {
    PermissionsAndroid.check.mockResolvedValue(false);
    PermissionsAndroid.request.mockResolvedValue(
      PermissionsAndroid.RESULTS.DENIED,
    );

    const { getByTestId } = render(<HomeScreen />);
    const micButton = getByTestId('mic-button');

    fireEvent.press(micButton);
    await waitFor(() => {
      expect(micButton).toBeDisabled();
    });
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- permissionRequestFlow`
2. Test permission flow on iOS device:
   - First mic button tap → verify permission dialog appears with explanation
   - Grant permission → verify voice input works
   - Deny permission → verify mic button disabled, typing still works
3. Test permission flow on Android device:
   - First mic button tap → verify runtime permission request
   - Grant permission → verify voice input works
   - Deny permission → verify mic button disabled, typing still works
4. Test permission status check:
   - Verify permission is checked before enabling voice input
   - Verify permission status is checked on app resume
5. Test permission denial handling:
   - Verify message explains why permission is needed
   - Verify option to enable in device settings (if applicable)
   - Verify mic button is disabled but typing works
6. Test permission grant:
   - Verify voice input enables after grant
   - Verify optional success feedback appears

**Expected Outcome:**

- Permission request works on both platforms
- Clear explanation provided before request
- Denial handled gracefully with clear messaging
- Typing always available when permission denied
- Permission grant enables voice input correctly

---

### Task 3.3: Implement Service Unavailability Handling

**Objective:** Gracefully handle cases when TTS or speech recognition services are unavailable

**Implementation Steps:**

- [x] Check TTS service availability before enabling speaker button
- [x] Check speech recognition service availability before enabling mic button
- [x] Disable buttons when services unavailable
- [x] Show appropriate UI indicators (grayed out, disabled state)
- [x] Provide user feedback explaining why feature is unavailable
- [x] Ensure typing always remains available as fallback
- [x] Handle service becoming available/unavailable during app use

**Verification Test:**

```javascript
// Test: Service availability handling
describe('Service Unavailability', () => {
  test('disables speaker button when TTS unavailable', () => {
    textToSpeechService.isServiceAvailable = jest.fn(() => false);

    const { getByTestId } = render(<HomeScreen />);
    const speakerButton = getByTestId('speaker-button');

    expect(speakerButton).toBeDisabled();
  });

  test('disables mic button when speech recognition unavailable', () => {
    Voice.isAvailable = jest.fn(() => false);

    const { getByTestId } = render(<HomeScreen />);
    const micButton = getByTestId('mic-button');

    expect(micButton).toBeDisabled();
  });

  test('typing remains available when voice services unavailable', () => {
    // Both services unavailable
    textToSpeechService.isServiceAvailable = jest.fn(() => false);
    Voice.isAvailable = jest.fn(() => false);

    const { getByTestId } = render(<HomeScreen />);
    const inputField = getByTestId('story-input');

    expect(inputField).not.toBeDisabled();
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- serviceUnavailability`
2. Test TTS service unavailability:
   - Disable TTS service → verify speaker button is disabled
   - Verify button shows disabled state (grayed out)
   - Verify user feedback explains why feature unavailable
3. Test speech recognition service unavailability:
   - Disable speech recognition → verify mic button is disabled
   - Verify button shows disabled state
   - Verify user feedback explains why feature unavailable
4. Test both services unavailable:
   - Disable both → verify both buttons disabled
   - Verify typing input field remains enabled
5. Test service becoming available during app use:
   - Start with service unavailable → verify buttons disabled
   - Enable service → verify buttons become enabled
6. Verify UI indicators clearly show disabled state
7. Verify user feedback messages are clear and helpful

**Expected Outcome:**

- Buttons disabled when services unavailable
- Clear UI indicators for disabled state
- User feedback explains unavailability
- Typing always remains available
- Service availability changes handled dynamically

---

### Task 3.4: Implement Background Noise Handling

**Objective:** Handle background noise and interruptions during voice input

**Implementation Steps:**

- [x] Configure silence timeout (wait few seconds before finalizing)
- [x] Allow manual stop to override auto-stop
- [x] Show transcribed text even if incomplete
- [x] Let user edit to fix noise-related transcription errors
- [x] Consider adding noise reduction settings (if library supports)
- [x] Test with various noise levels
- [x] Provide user guidance on optimal recording conditions

**Verification Test:**

```javascript
// Test: Background noise handling
describe('Background Noise Handling', () => {
  test('waits for silence before finalizing', async () => {
    jest.useFakeTimers();
    const onSpeechResult = jest.fn();

    startVoiceInput(onSpeechResult);
    simulateSpeechWithNoise('Hello', { noiseLevel: 'high' });

    // Should wait for silence
    await jest.advanceTimersByTime(3000);

    expect(onSpeechResult).toHaveBeenCalled();
  });

  test('allows manual stop during noise', async () => {
    const onSpeechResult = jest.fn();

    startVoiceInput(onSpeechResult);
    simulateSpeechWithNoise('Hello', { noiseLevel: 'high' });

    // Manual stop should work immediately
    stopVoiceInput();

    expect(onSpeechResult).toHaveBeenCalled();
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- backgroundNoiseHandling`
2. Test silence timeout on device:
   - Start voice input
   - Speak with pauses → verify waits for silence before finalizing
   - Verify timeout is configurable (2-3 seconds)
3. Test manual stop override:
   - Start voice input with background noise
   - Manually stop → verify transcription finalizes immediately
4. Test incomplete transcription:
   - Start voice input with noise
   - Verify transcribed text appears even if incomplete
   - Verify user can edit to fix errors
5. Test with various noise levels:
   - Quiet environment → verify works well
   - Moderate noise → verify handles gracefully
   - High noise → verify still functional, user can edit
6. Test noise reduction (if library supports):
   - Verify settings are applied if available
7. Verify user guidance is provided (if applicable)

**Expected Outcome:**

- Silence timeout works correctly
- Manual stop overrides auto-stop
- Incomplete transcriptions still shown
- User can edit to fix noise-related errors
- Works in various noise environments

---

### Task 3.5: Add Accessibility Support

**Objective:** Ensure voice features are accessible to screen readers and assistive technologies

**Implementation Steps:**

- [x] Add `accessibilityLabel` to speaker button with state context
- [x] Add `accessibilityLabel` to mic button with state context
- [x] Add `accessibilityHint` explaining button functionality
- [x] Ensure button states are announced by screen readers
- [x] Make error messages accessible
- [x] Test with VoiceOver (iOS) and TalkBack (Android)
- [x] Ensure keyboard navigation works

**Verification Test:**

```javascript
// Test: Accessibility support
describe('Accessibility', () => {
  test('speaker button has proper accessibility labels', () => {
    const { getByLabelText } = render(<HomeScreen speakerState="idle" />);
    const button = getByLabelText(/speaker|read story/i);
    expect(button).toBeTruthy();
  });

  test('mic button announces state changes', () => {
    const { getByLabelText, rerender } = render(
      <HomeScreen voiceState="idle" />,
    );

    rerender(<HomeScreen voiceState="listening" />);
    const button = getByLabelText(/listening/i);
    expect(button).toBeTruthy();
  });

  test('error messages are accessible', () => {
    const { getByLabelText } = render(
      <HomeScreen showError="Network error occurred" />,
    );
    const error = getByLabelText(/error|network/i);
    expect(error).toBeTruthy();
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- accessibilitySupport`
2. Test with VoiceOver on iOS:
   - Enable VoiceOver
   - Navigate to speaker button → verify label is announced correctly
   - Navigate to mic button → verify label is announced correctly
   - Change button states → verify state changes are announced
3. Test with TalkBack on Android:
   - Enable TalkBack
   - Navigate to buttons → verify labels announced
   - Verify state changes announced
4. Test accessibility labels:
   - Verify `accessibilityLabel` exists for both buttons
   - Verify labels reflect current state
   - Verify `accessibilityHint` explains functionality
5. Test error message accessibility:
   - Trigger error → verify error message is accessible
   - Verify screen reader announces errors
6. Test keyboard navigation:
   - Verify buttons can be navigated with keyboard
   - Verify buttons can be activated with keyboard
7. Verify all interactive elements have proper accessibility properties

**Expected Outcome:**

- VoiceOver/TalkBack reads all elements correctly
- Button states are announced
- Error messages are accessible
- Keyboard navigation works
- All accessibility requirements met

---

### Task 3.6: Add Loading States and User Feedback

**Objective:** Provide clear feedback during voice processing operations

**Implementation Steps:**

- [x] Show loading indicator during transcription processing
- [x] Update button states clearly (idle → listening → processing → idle)
- [x] Provide visual feedback for successful transcription
- [x] Show error states clearly
- [x] Ensure feedback doesn't block user interaction
- [x] Test feedback timing and appearance

**Verification Test:**

```javascript
// Test: Loading states and feedback
describe('User Feedback', () => {
  test('shows processing indicator during transcription', async () => {
    const { getByTestId } = render(<HomeScreen voiceState="processing" />);
    const micButton = getByTestId('mic-button');

    expect(micButton).toHaveTextContent('⏳');
    // Could also check for ActivityIndicator
  });

  test('provides feedback on successful transcription', async () => {
    const { getByText } = render(<HomeScreen />);

    simulateSuccessfulTranscription('Hello world');

    await waitFor(() => {
      // Could show toast or update input field
      const input = getByTestId('story-input');
      expect(input.props.value).toContain('Hello world');
    });
  });
});
```

**Validation Steps:**

1. Run tests: `npm test -- loadingStatesAndFeedback`
2. Test loading indicators:
   - Start voice input → verify processing indicator appears (⏳)
   - Verify indicator shows during transcription
   - Verify indicator disappears when complete
3. Test button state updates:
   - Verify state transitions are clear (idle → listening → processing → idle)
   - Verify state changes are immediate and visible
4. Test successful transcription feedback:
   - Complete voice input → verify text appears in input field
   - Verify visual feedback (if any) appears
5. Test error state feedback:
   - Trigger error → verify error state is clearly shown
   - Verify error doesn't block user interaction
6. Test feedback timing:
   - Verify feedback appears promptly
   - Verify feedback doesn't cause UI blocking
7. Verify all feedback is non-intrusive and helpful

**Expected Outcome:**

- Loading indicators work correctly
- State transitions are clear and immediate
- Success feedback is provided
- Error states are clearly indicated
- Feedback doesn't block interaction

---

### Task 3.7: Performance Optimization

**Objective:** Ensure voice features don't impact app performance

**Implementation Steps:**

- [x] Optimize event listener management (cleanup on unmount)
- [x] Ensure voice processing doesn't block UI thread
- [x] Optimize state updates to prevent unnecessary re-renders
- [x] Test memory usage during voice operations
- [x] Profile performance on lower-end devices
- [x] Optimize transcription processing speed
- [x] Ensure TTS doesn't cause audio conflicts

**Verification Test:**

```javascript
// Test: Performance optimization
describe('Performance', () => {
  test('voice processing does not block UI', async () => {
    const startTime = Date.now();

    startVoiceInput();
    simulateLongSpeech();

    // UI should remain responsive
    expect(Date.now() - startTime).toBeLessThan(100);

    await waitForTranscription();
  });

  test('cleans up event listeners on unmount', () => {
    const { unmount } = render(<HomeScreen />);
    const removeListenerSpy = jest.spyOn(Voice, 'removeAllListeners');

    unmount();

    expect(removeListenerSpy).toHaveBeenCalled();
  });

  test('memory usage stays within limits', async () => {
    const initialMemory = performance.memory?.usedJSHeapSize || 0;

    // Perform multiple voice operations
    for (let i = 0; i < 10; i++) {
      await performVoiceInput();
    }

    const finalMemory = performance.memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // < 10MB
  });
});
```

**Validation Steps:**

1. Run performance tests: `npm test -- performanceOptimization`
2. Test event listener cleanup:
   - Use voice features multiple times
   - Unmount component → verify listeners are removed
   - Check for memory leaks
3. Test UI responsiveness:
   - Start voice input → verify UI remains responsive
   - Verify no UI blocking during processing
   - Verify app remains usable during voice operations
4. Test memory usage:
   - Perform multiple voice operations
   - Monitor memory usage → verify stays within limits
   - Check for memory leaks over time
5. Test on lower-end devices:
   - Test on older iOS device (if available)
   - Test on lower-end Android device
   - Verify performance is acceptable
6. Test transcription speed:
   - Measure time from stop to transcription appearing
   - Verify appears immediately (< 1 second)
7. Test TTS performance:
   - Verify TTS starts quickly (< 500ms)
   - Verify no audio conflicts
8. Profile performance:
   - Use React DevTools Profiler
   - Identify any performance bottlenecks
   - Optimize if needed

**Expected Outcome:**

- Event listeners properly cleaned up
- UI remains responsive during voice operations
- Memory usage stays within limits
- No memory leaks
- Performance acceptable on lower-end devices
- Transcription appears immediately

---

### Task 3.8: Cross-Platform Testing

**Objective:** Ensure features work correctly on both iOS and Android

**Implementation Steps:**

- [x] Test speaker button on iOS (13+)
- [x] Test mic button on iOS (13+)
- [x] Test permission flows on both platforms
- [x] Test error handling on both platforms
- [x] Verify UI consistency across platforms
- [x] Test on multiple device sizes

**Verification Test:**

```javascript
// Test: Cross-platform compatibility
describe('Cross-Platform Testing', () => {
  test('works on iOS', () => {
    Platform.OS = 'ios';
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('speaker-button')).toBeTruthy();
    expect(getByTestId('mic-button')).toBeTruthy();
  });

  test('works on Android', () => {
    Platform.OS = 'android';
    const { getByTestId } = render(<HomeScreen />);

    expect(getByTestId('speaker-button')).toBeTruthy();
    expect(getByTestId('mic-button')).toBeTruthy();
  });

  test('handles platform-specific permission flows', async () => {
    Platform.OS = 'ios';
    await testPermissionFlow();

    Platform.OS = 'android';
    await testPermissionFlow();
  });
});
```

**Validation Steps:**

1. Run cross-platform tests: `npm test -- crossPlatformTesting`
2. Test speaker button on iOS (13+):
   - Verify pause/resume works
   - Verify latest continuation is read
   - Test on multiple iOS versions if possible
3. Test speaker button on Android (8+):
   - Verify pause/resume works
   - Verify latest continuation is read
   - Test on multiple Android versions if possible
4. Test mic button on iOS (13+):
   - Verify voice input works
   - Verify transcription appears
   - Test permission flow
5. Test mic button on Android (8+):
   - Verify voice input works
   - Verify transcription appears
   - Test permission flow
6. Test permission flows on both platforms:
   - Verify iOS permission flow works
   - Verify Android permission flow works
7. Test error handling on both platforms:
   - Verify errors handled correctly on iOS
   - Verify errors handled correctly on Android
8. Verify UI consistency:
   - Compare UI appearance on both platforms
   - Verify buttons look consistent
   - Verify state indicators consistent
9. Test on multiple device sizes:
   - iPhone SE (small)
   - iPhone Pro Max (large)
   - Various Android screen sizes

**Expected Outcome:**

- Features work on both iOS and Android
- Permission flows work correctly on both platforms
- Error handling works on both platforms
- UI is consistent across platforms
- Works on various device sizes

---

### Task 3.9: Final Integration and End-to-End Testing

**Objective:** Comprehensive testing of complete voice input/output feature

**Implementation Steps:**

- [x] Test complete user journey: listen → speak → transcribe → edit → submit
- [x] Test all error scenarios
- [x] Test with different grade levels
- [x] Test with various story lengths
- [x] Test edge cases (empty input, very long speech, etc.)
- [x] Verify no regressions in existing functionality
- [x] Test performance under load
- [x] Verify accessibility compliance
- [x] Test on physical devices (not just simulators)

**Verification Test:**

```javascript
// Test: Complete end-to-end flow
describe('End-to-End Voice Features', () => {
  test('complete voice interaction flow', async () => {
    const { getByTestId } = render(<HomeScreen />);

    // 1. Listen to story
    const speakerButton = getByTestId('speaker-button');
    fireEvent.press(speakerButton);
    await waitFor(() => {
      expect(textToSpeechService.speak).toHaveBeenCalled();
    });

    // 2. Speak continuation
    const micButton = getByTestId('mic-button');
    fireEvent.press(micButton);
    simulateSpeech('The hero continued the adventure');
    fireEvent.press(micButton);

    // 3. Edit transcription
    await waitFor(() => {
      const input = getByTestId('story-input');
      expect(input.props.value).toContain('The hero continued');
    });

    // Edit the input
    fireEvent.changeText(
      getByTestId('story-input'),
      'The hero continued the amazing adventure',
    );

    // 4. Submit
    const continueButton = getByTestId('continue-story-button');
    fireEvent.press(continueButton);

    await waitFor(() => {
      expect(continueStory).toHaveBeenCalledWith(
        expect.stringContaining('amazing adventure'),
      );
    });
  });

  test('handles all error scenarios gracefully', async () => {
    const errorScenarios = [
      'permission-denied',
      'network-error',
      'recognition-failed',
      'service-unavailable',
    ];

    for (const scenario of errorScenarios) {
      await testErrorScenario(scenario);
      // Verify typing still works
      const input = getByTestId('story-input');
      expect(input).not.toBeDisabled();
    }
  });
});
```

**Validation Steps:**

1. Run all end-to-end tests: `npm test -- endToEndVoiceFeatures`
2. Complete user journey test on device:
   - Start story session
   - Tap speaker button → listen to latest continuation
   - Pause and resume playback
   - Tap mic button → speak continuation
   - Verify transcription appears
   - Edit transcribed text
   - Tap "Continue Story" → verify story continues
3. Test all error scenarios:
   - Permission denied
   - Network error
   - Recognition failed
   - Service unavailable
   - Verify typing always works as fallback
4. Test with different grade levels:
   - K-2: Verify voice input works
   - 3-5: Verify voice input works
   - 6-8: Verify voice input works
   - 9-12: Verify voice input works
5. Test with various story lengths:
   - Short continuations
   - Medium continuations
   - Long continuations
6. Test edge cases:
   - Empty input
   - Very long speech
   - Very short speech
   - Multiple voice inputs in sequence
7. Verify no regressions:
   - Test existing typing functionality still works
   - Test existing story continuation still works
   - Test other app features unaffected
8. Test performance under load:
   - Multiple rapid voice inputs
   - Multiple story continuations
   - Verify app remains responsive
9. Verify accessibility compliance:
   - Test with VoiceOver/TalkBack
   - Verify all elements accessible
10. Test on physical devices:
    - iOS device (not simulator)
    - Android device (not emulator)
    - Verify microphone works correctly

**Expected Outcome:**

- Complete user journey works end-to-end
- All error scenarios handled gracefully
- Works for all grade levels
- Works with various story lengths
- Edge cases handled correctly
- No regressions in existing functionality
- Performance acceptable under load
- Accessibility requirements met
- Works correctly on physical devices

---

## Quality Assurance Checklist

### Functional Testing

- [x] Speaker button reads only latest continuation
- [x] Speaker button pauses/resumes correctly
- [x] Mic button starts/stops listening on tap
- [x] Transcribed text appears immediately in input field
- [x] Transcribed text can be edited
- [x] Voice input works for all grade levels
- [x] "Continue Story" button works with voice input
- [x] Voice input respects same constraints as typed input
- [x] Typing remains available as fallback

### Technical Testing

- [x] TTS pause/resume works correctly
- [x] Latest continuation extraction is accurate
- [x] Voice recognition responds within 1-2 seconds
- [x] Transcription appears immediately after stopping
- [x] No UI blocking during voice processing
- [x] Event listeners are properly cleaned up
- [x] Memory usage stays within limits
- [x] No memory leaks from voice operations

### Platform Testing

- [x] Works on iOS 13+
- [x] Permission requests work on both platforms
- [x] Error handling works on both platforms
- [x] UI is consistent across platforms

### Error Handling Testing

- [x] Speech recognition failures show user-friendly errors
- [x] Permission denials are handled gracefully
- [x] Service unavailability disables buttons appropriately
- [x] Background noise is handled correctly
- [x] Network errors are handled
- [x] Typing always remains available

### Accessibility Testing

- [x] VoiceOver reads all elements correctly (iOS)
- [x] Button states are announced
- [x] Error messages are accessible
- [x] Keyboard navigation works
- [x] Touch targets meet 44pt minimum

### Performance Testing

- [x] Voice recognition success rate > 90%
- [x] TTS playback starts within 500ms
- [x] Transcription appears immediately
- [x] No performance degradation with voice features
- [x] App remains responsive during voice operations

---

## Definition of Done

A task is considered complete when:

1. ✅ Implementation is finished and tested
2. ✅ All verification tests pass
3. ✅ Code review is completed
4. ✅ Manual testing on physical devices confirms functionality
5. ✅ No regression in existing functionality
6. ✅ Error handling is comprehensive
7. ✅ Performance requirements are met
8. ✅ Accessibility requirements are satisfied
9. ✅ Works on both iOS and Android
10. ✅ Documentation is updated (if applicable)

---

## Dependencies and Prerequisites

### Technical Prerequisites

- React Native development environment set up
- iOS and Android development tools
- Access to physical devices for testing (voice features need real hardware)
- Understanding of React Native voice libraries
- Knowledge of platform-specific permission handling

### Library Dependencies

- `@react-native-voice/voice` (already installed)
- React Native Text-to-Speech (already integrated)
- Platform-specific permission handling libraries

### Design Prerequisites

- Button state icons/emojis defined
- Error message copy approved
- Permission request dialog copy approved
- UI specifications for button states

### Testing Prerequisites

- Jest testing framework configured
- React Native Testing Library set up
- iOS and Android simulators/emulators
- Physical iOS and Android devices for voice testing
- Accessibility testing tools (VoiceOver, TalkBack)

---

## Notes

- Voice features require physical device testing (simulators may not support microphone)
- Permission handling differs significantly between iOS and Android
- Background noise handling may need tuning based on real-world testing
- Consider user feedback for silence timeout duration
- May need to adjust transcription accuracy expectations based on library limitations

---

_This task list provides a comprehensive roadmap for implementing the voice input/output feature according to the requirements specified in voice-input-output-PRD.md_
