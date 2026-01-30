import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AVFoundation
import EXUpdates

@main
class AppDelegate: UIResponder, UIApplicationDelegate, AppControllerDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // CRITICAL: Initialize expo-updates AppController BEFORE React Native starts
    // This must happen first to avoid crashes when modules try to access AppController.sharedInstance
    AppController.initializeWithoutStarting()

    // Configure audio session for TTS playback
    // This allows TTS to work even when the device is in silent mode
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.playback, mode: .spokenAudio, options: [.mixWithOthers, .duckOthers])
      try audioSession.setActive(true)
      print("✅ Audio session configured for TTS playback")
    } catch {
      print("❌ Failed to configure audio session: \(error.localizedDescription)")
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    // CRITICAL: Start expo-updates BEFORE starting React Native
    // This ensures startupProcedure is initialized before getConstantsForModule() is called
    if AppController.sharedInstance.isActiveController {
      AppController.sharedInstance.delegate = self
      AppController.sharedInstance.start()
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // MARK: - AppControllerDelegate

  func appController(_ appController: AppControllerInterface, didStartWithSuccess success: Bool) {
    // This delegate method is called when expo-updates finishes loading
    // We don't need to do anything here since React Native is already running
    if success {
      print("✅ expo-updates started successfully")
    } else {
      print("⚠️ expo-updates failed to start, using fallback bundle")
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Get bundle URL provider
    let bundleURLProvider = RCTBundleURLProvider.sharedSettings()
    
    // Try to get the bundle URL with the standard entry point
    // For Expo projects, the entry point is resolved via expo/scripts/resolveAppEntry
    // but the bundle root should still be "index" for the Metro bundler
    guard let url = bundleURLProvider.jsBundleURL(forBundleRoot: "index") else {
      // Fallback: construct the URL manually if automatic resolution fails
      // This ensures the app can connect to Metro even if URL provider fails
      #if targetEnvironment(simulator)
        // For simulator, use localhost
        return URL(string: "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false")
      #else
        // For physical device, use your Mac's local IP address
        // Make sure your iPhone is on the same WiFi network as your Mac
        return URL(string: "http://192.168.1.68:8081/index.bundle?platform=ios&dev=true&minify=false")
      #endif
    }
    
    return url
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
