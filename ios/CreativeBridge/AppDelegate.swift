import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import AVFoundation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
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

    factory.startReactNative(
      withModuleName: "CreativeBridge",
      in: window,
      launchOptions: launchOptions
    )

    return true
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
        // For physical device, you may need to replace localhost with your machine's IP
        // For now, try localhost (works if device is on same network and Metro is accessible)
        return URL(string: "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false")
      #endif
    }
    
    return url
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
