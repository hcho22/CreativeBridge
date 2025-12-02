import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechRecognizerModule)
class SpeechRecognizerModule: RCTEventEmitter {
    
    // MARK: - Properties
    
    private let speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    private var currentLocale: Locale
    private var isListening = false
    private var lastPartialResult: String = ""
    
    // MARK: - Initialization
    
    override init() {
        self.currentLocale = Locale(identifier: "en-US")
        self.speechRecognizer = SFSpeechRecognizer(locale: currentLocale)
        super.init()
    }
    
    // MARK: - RCTEventEmitter
    
    @objc override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return [
            "SpeechRecognizerResult",
            "SpeechRecognizerPartialResult",
            "SpeechRecognizerError",
            "SpeechRecognizerStateChange"
        ]
    }
    
    // MARK: - State Management
    
    private func updateState(_ state: String) {
        sendEvent(withName: "SpeechRecognizerStateChange", body: ["state": state])
    }
    
    private func sendError(code: String, message: String) {
        sendEvent(withName: "SpeechRecognizerError", body: [
            "code": code,
            "message": message
        ])
    }
    
    // MARK: - Permission Handling
    
    @objc func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        var microphoneGranted = false
        var speechGranted = false
        
        let group = DispatchGroup()
        
        // Request microphone permission
        group.enter()
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            microphoneGranted = granted
            group.leave()
        }
        
        // Request speech recognition permission
        group.enter()
        SFSpeechRecognizer.requestAuthorization { status in
            speechGranted = (status == .authorized)
            group.leave()
        }
        
        group.notify(queue: .main) {
            let result: [String: Any] = [
                "microphone": microphoneGranted,
                "speechRecognition": speechGranted,
                "granted": microphoneGranted && speechGranted
            ]
            resolve(result)
        }
    }
    
    @objc func checkPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
        let microphoneStatus = AVAudioSession.sharedInstance().recordPermission
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        
        let microphoneGranted = (microphoneStatus == .granted)
        let speechGranted = (speechStatus == .authorized)
        
        let result: [String: Any] = [
            "microphone": microphoneGranted,
            "speechRecognition": speechGranted,
            "granted": microphoneGranted && speechGranted
        ]
        resolve(result)
    }
    
    // MARK: - Availability Check
    
    @objc func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let recognizer = speechRecognizer else {
            resolve(false)
            return
        }
        resolve(recognizer.isAvailable)
    }
    
    // MARK: - Start Dictation
    
    @objc func startDictation(_ locale: String,
                               resolver resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
        
        // Check if already listening
        if isListening {
            reject("ALREADY_LISTENING", "Speech recognition is already active", nil)
            return
        }
        
        // Update locale if different
        let newLocale = Locale(identifier: locale)
        let recognizer: SFSpeechRecognizer?
        
        if newLocale.identifier != currentLocale.identifier {
            recognizer = SFSpeechRecognizer(locale: newLocale)
            self.currentLocale = newLocale
        } else {
            recognizer = self.speechRecognizer
        }
        
        // Check availability
        guard let speechRecognizer = recognizer, speechRecognizer.isAvailable else {
            reject("NOT_AVAILABLE", "Speech recognition is not available", nil)
            return
        }
        
        // Check authorization
        let authStatus = SFSpeechRecognizer.authorizationStatus()
        guard authStatus == .authorized else {
            reject("NOT_AUTHORIZED", "Speech recognition is not authorized. Status: \(authStatus.rawValue)", nil)
            return
        }
        
        // Check microphone permission
        let micStatus = AVAudioSession.sharedInstance().recordPermission
        guard micStatus == .granted else {
            reject("MIC_NOT_AUTHORIZED", "Microphone access is not authorized", nil)
            return
        }
        
        do {
            try startRecognition(with: speechRecognizer)
            isListening = true
            updateState("listening")
            resolve(true)
        } catch {
            reject("START_ERROR", "Failed to start speech recognition: \(error.localizedDescription)", error)
        }
    }
    
    private func startRecognition(with recognizer: SFSpeechRecognizer) throws {
        // Cancel any existing task
        recognitionTask?.cancel()
        recognitionTask = nil
        
        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        
        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        guard let recognitionRequest = recognitionRequest else {
            throw NSError(domain: "SpeechRecognizer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to create recognition request"])
        }
        
        // Configure request
        recognitionRequest.shouldReportPartialResults = true
        
        // Use on-device recognition if available (iOS 13+)
        if #available(iOS 13, *) {
            recognitionRequest.requiresOnDeviceRecognition = false // Allow cloud for better accuracy
        }
        
        // Get input node
        let inputNode = audioEngine.inputNode
        
        // Create recognition task
        recognitionTask = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            
            var isFinal = false
            
            if let result = result {
                let transcription = result.bestTranscription.formattedString
                isFinal = result.isFinal
                
                if isFinal {
                    // Send final result
                    self.sendEvent(withName: "SpeechRecognizerResult", body: [
                        "text": transcription,
                        "isFinal": true
                    ])
                    self.lastPartialResult = ""
                } else {
                    // Send partial result only if different
                    if transcription != self.lastPartialResult {
                        self.lastPartialResult = transcription
                        self.sendEvent(withName: "SpeechRecognizerPartialResult", body: [
                            "text": transcription,
                            "isFinal": false
                        ])
                    }
                }
            }
            
            if error != nil || isFinal {
                self.stopAudioEngine()
                
                if let error = error as NSError? {
                    // Don't report cancellation as error
                    if error.domain != "kAFAssistantErrorDomain" || error.code != 216 {
                        self.sendError(code: "RECOGNITION_ERROR", message: error.localizedDescription)
                    }
                }
                
                if isFinal {
                    self.updateState("idle")
                }
            }
        }
        
        // Configure audio input
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }
        
        // Start audio engine
        audioEngine.prepare()
        try audioEngine.start()
    }
    
    // MARK: - Stop Dictation
    
    @objc func stopDictation(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard isListening else {
            resolve(false)
            return
        }
        
        updateState("processing")
        
        // End the audio request to trigger final result
        recognitionRequest?.endAudio()
        
        // Give time for final result to come through
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.stopAudioEngine()
            self?.updateState("idle")
            resolve(true)
        }
    }
    
    // MARK: - Cancel Dictation
    
    @objc func cancelDictation(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
        recognitionTask?.cancel()
        stopAudioEngine()
        updateState("idle")
        resolve(true)
    }
    
    // MARK: - Helper Methods
    
    private func stopAudioEngine() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
        lastPartialResult = ""
        
        // Restore audio session for TTS
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers, .duckOthers])
            try audioSession.setActive(true)
        } catch {
            print("Failed to restore audio session: \(error)")
        }
    }
}

