package com.amazonhackathon

import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "AmazonHackathon"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Forwards remote/D-pad key presses to JS as a "remoteKey" event (core React Native has no
   * TV key event API). Left/right are consumed when a slider (the player's progress bar,
   * identified by its accessibility label) has focus, so they seek instead of moving focus away.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (event.action == KeyEvent.ACTION_DOWN) {
      val key =
          when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> "left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
            KeyEvent.KEYCODE_DPAD_UP -> "up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "down"
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> "select"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "playPause"
            KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "fastForward"
            KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
            else -> null
          }

      if (key != null) {
        (application as ReactApplication)
            .reactHost
            ?.currentReactContext
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("remoteKey", key)

        val onSlider = currentFocus?.contentDescription?.toString() in SLIDER_LABELS
        if (onSlider && (key == "left" || key == "right")) {
          return true
        }
      }
    }
    return super.dispatchKeyEvent(event)
  }

  companion object {
    // Must match the progress bar's accessibilityLabel in components/PlayerScreen.tsx
    private val SLIDER_LABELS = setOf("Playback position")
  }
}
