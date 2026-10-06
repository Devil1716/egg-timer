# Keep the screen-awake bridge callable from the timer page.
-keepclassmembers class com.eggtimer.app.MainActivity$ScreenBridge {
    @android.webkit.JavascriptInterface <methods>;
}
