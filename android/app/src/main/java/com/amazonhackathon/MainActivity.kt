package com.amazonhackathon

import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private val handler = Handler(Looper.getMainLooper())

  // Held select/Enter state. The key-down is kept back until we know whether
  // it is a tap (replayed as a normal click) or a hold (voice command).
  private var pendingSelectDown: KeyEvent? = null
  private var pendingSelectUp: KeyEvent? = null
  private var selectHeld = false
  private val startVoice = Runnable {
    selectHeld = true
    emit("voiceStart")
  }
  // Runs RELEASE_DEBOUNCE_MS after a key-up unless another key-down arrives first.
  private val finishSelectRelease = Runnable { completeSelectPress() }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  // If the window loses focus mid-hold (e.g. a permission dialog opens), the
  // key-up never arrives here, so end the hold now instead of listening forever.
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (!hasFocus && pendingSelectDown != null) {
      endSelectPress()
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  private fun emit(eventName: String, data: Any? = null) {
    Log.d("VoiceDebug", "emit $eventName $data hasContext=${(application as ReactApplication).reactHost?.currentReactContext != null}")
    (application as ReactApplication)
        .reactHost
        ?.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit(eventName, data)
  }

  /**
   * Forwards remote/D-pad key presses to JS as a "remoteKey" event (core React Native has no
   * TV key event API). Left/right are consumed when a slider (the player's progress bar,
   * identified by its accessibility label) has focus, so they seek instead of moving focus away.
   *
   * Holding select/Enter for [HOLD_TO_TALK_MS] emits "voiceStart", and releasing it emits
   * "voiceStop" (used by the player's voice commands). A quicker press is a normal click.
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val isSelect =
        event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER
    if (isSelect) {
      return handleSelectKey(event)
    }

    if (event.action == KeyEvent.ACTION_DOWN) {
      val key =
          when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> "left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
            KeyEvent.KEYCODE_DPAD_UP -> "up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "down"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "playPause"
            KeyEvent.KEYCODE_MEDIA_PLAY -> "play"
            KeyEvent.KEYCODE_MEDIA_PAUSE -> "pause"
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "fastForward"
            KeyEvent.KEYCODE_MEDIA_REWIND -> "rewind"
            else -> null
          }

      if (key != null) {
        emit("remoteKey", key)

        val onSlider = currentFocus?.contentDescription?.toString() in SLIDER_LABELS
        if (onSlider && (key == "left" || key == "right")) {
          return true
        }
      }
    }
    return super.dispatchKeyEvent(event)
  }

  private fun handleSelectKey(event: KeyEvent): Boolean {
    Log.d("VoiceDebug", "select action=${event.action} repeat=${event.repeatCount} canceled=${event.isCanceled} pending=${pendingSelectDown != null} held=$selectHeld")
    when (event.action) {
      KeyEvent.ACTION_DOWN -> {
        if (pendingSelectUp != null) {
          // A down right after an up is the same hold: holding a PC key in the
          // emulator arrives as rapid up/down pairs (Windows key repeat).
          handler.removeCallbacks(finishSelectRelease)
          pendingSelectUp = null
        } else if (pendingSelectDown == null) {
          pendingSelectDown = KeyEvent(event)
          selectHeld = false
          handler.postDelayed(startVoice, HOLD_TO_TALK_MS)
        }
        // Swallow the down (and auto-repeats) until we know if it is a tap or a hold.
        return true
      }
      KeyEvent.ACTION_UP -> {
        if (pendingSelectDown == null) {
          return true // a release without its press is not a tap
        }
        if (event.isCanceled) {
          endSelectPress() // focus moved away mid-press
          return true
        }
        // Wait briefly before treating this as the real release.
        pendingSelectUp = KeyEvent(event)
        handler.removeCallbacks(finishSelectRelease)
        handler.postDelayed(finishSelectRelease, RELEASE_DEBOUNCE_MS)
        return true
      }
    }
    return super.dispatchKeyEvent(event)
  }

  // The key really was released: stop listening after a hold, or click after a tap.
  private fun completeSelectPress() {
    val down = pendingSelectDown
    val up = pendingSelectUp
    val wasHeld = selectHeld
    endSelectPress()

    if (!wasHeld && down != null && up != null) {
      // Short press: replay it so the focused button is clicked as usual.
      emit("remoteKey", "select")
      super.dispatchKeyEvent(down)
      super.dispatchKeyEvent(up)
    }
  }

  // Clears the press, ending voice listening if it had started. Never clicks.
  private fun endSelectPress() {
    handler.removeCallbacks(startVoice)
    handler.removeCallbacks(finishSelectRelease)
    pendingSelectDown = null
    pendingSelectUp = null
    if (selectHeld) {
      selectHeld = false
      emit("voiceStop")
    }
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  companion object {
    // Must match the progress bar's accessibilityLabel in components/PlayerScreen.tsx
    private val SLIDER_LABELS = setOf("Playback position")

    // How long select/Enter must be held before voice listening starts.
    private const val HOLD_TO_TALK_MS = 500L

    // How long after a key-up to wait for another key-down before it counts as a release.
    private const val RELEASE_DEBOUNCE_MS = 150L
  }
}
