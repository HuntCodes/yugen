import Expo
import React
import ReactAppDependencyProvider
import AVFoundation

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    // Configure audio session for speaker output by default
    configureAudioSession()
    
    // Set up a timer to repeatedly check and force speaker mode
    setupAudioMonitoring()

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  private func setupAudioMonitoring() {
    // Create a timer that runs every 2 seconds to ensure speaker mode is active
    Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
      self?.forceSpeakerMode()
    }
  }
  
  private func forceSpeakerMode() {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      let outputs = audioSession.currentRoute.outputs
      
      // Only force speaker if it's not already using built-in speaker
      if !outputs.contains(where: { $0.portType == .builtInSpeaker }) {
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Periodic check found non-speaker output, forcing speaker mode...")
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Current outputs: \(outputs.map { $0.portType.rawValue + " (" + $0.portName + ")" }.joined(separator: ", "))")
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Current category: \(audioSession.category.rawValue), mode: \(audioSession.mode.rawValue)")
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Current options: \(audioSession.categoryOptions.rawValue)")
        
        // Some devices require deactivating and reactivating the session
        try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
        
        // Use videoChat mode which is more aggressive for speaker routing
        try audioSession.setCategory(.playAndRecord, mode: .videoChat, options: [.defaultToSpeaker, .allowBluetooth])
        try audioSession.overrideOutputAudioPort(.speaker)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        
        // Check if the change was successful
        let newOutputs = audioSession.currentRoute.outputs
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] After forcing: \(newOutputs.map { $0.portType.rawValue + " (" + $0.portName + ")" }.joined(separator: ", "))")
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Is using speaker: \(newOutputs.contains(where: { $0.portType == .builtInSpeaker }))")
        
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Forced speaker mode in periodic check")
      } else {
        // Even if it's already using speaker, log the current state for debugging
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Periodic check: Already using speaker")
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Current category: \(audioSession.category.rawValue), mode: \(audioSession.mode.rawValue)")
        print("⚠️⚠️⚠️ [AUDIO_DEBUG] Current options: \(audioSession.categoryOptions.rawValue)")
      }
    } catch {
      print("❌❌❌ [AUDIO_DEBUG] Error forcing speaker in periodic check: \(error.localizedDescription)")
    }
  }
  
  private func configureAudioSession() {
    print("⚠️⚠️⚠️ [AUDIO_DEBUG] Starting audio session configuration in AppDelegate")
    do {
      let audioSession = AVAudioSession.sharedInstance()
      
      // First deactivate any existing sessions 
      try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
      
      // Use videoChat mode which is more aggressive for speaker routing than default mode
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Setting audio category to playAndRecord with videoChat mode")
      try audioSession.setCategory(.playAndRecord, mode: .videoChat, options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers])
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Category set successfully: \(audioSession.category), options: \(audioSession.categoryOptions)")
      
      // Then explicitly override the output port to force speaker
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Explicitly overriding output port to speaker")
      try audioSession.overrideOutputAudioPort(.speaker)
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Output port override successful")
      
      // Finally activate the session with a more aggressive flag
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Activating audio session")
      try audioSession.setActive(true, options: [.notifyOthersOnDeactivation])
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Audio session activated successfully")
      
      // Check if speaker is actually being used
      let outputs = audioSession.currentRoute.outputs
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Current audio outputs: \(outputs.map { $0.portType.rawValue + " (" + $0.portName + ")" }.joined(separator: ", "))")
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Is using speaker: \(outputs.contains(where: { $0.portType == .builtInSpeaker }))")
      
      // Register for route change notifications
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleRouteChange),
        name: AVAudioSession.routeChangeNotification,
        object: nil
      )
      
      // Also register for interruption notifications
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleInterruption),
        name: AVAudioSession.interruptionNotification,
        object: nil
      )
      
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Audio session configured and observers added")
    } catch {
      print("❌❌❌ [AUDIO_DEBUG] Error setting default audio output: \(error.localizedDescription)")
    }
  }
  
  @objc private func handleRouteChange(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
      return
    }
    
    let audioSession = AVAudioSession.sharedInstance()
    let outputs = audioSession.currentRoute.outputs
    
    print("⚠️⚠️⚠️ [AUDIO_DEBUG] Audio route changed: reason=\(reason)")
    print("⚠️⚠️⚠️ [AUDIO_DEBUG] New audio outputs: \(outputs.map { $0.portType.rawValue + " (" + $0.portName + ")" }.joined(separator: ", "))")
    
    // If current output is not the speaker, immediately force it back
    if !outputs.contains(where: { $0.portType == .builtInSpeaker }) {
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Speaker not being used after route change, attempting to force speaker again")
      forceSpeakerMode()
    }
  }
  
  @objc private func handleInterruption(notification: Notification) {
    guard let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
        return
    }
    
    if type == .ended {
      // When an interruption ends, immediately force the speaker back on
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Audio session interruption ended, re-applying speaker settings")
      forceSpeakerMode()
    } else if type == .began {
      print("⚠️⚠️⚠️ [AUDIO_DEBUG] Audio session interrupted")
    }
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
