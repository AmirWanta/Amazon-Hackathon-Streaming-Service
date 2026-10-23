# Troubleshooting


## Failed to start ai enhancer:

This error may appear while running .\scripts\start-ai-enhancer.ps1

```
adb.exe : * daemon not running; starting now at tcp:5037
At .\scripts\start-ai-enhancer.ps1:82 char:5
+     & adb.exe start-server *> $null
+     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (* daemon not ru...now at tcp:5037:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError

 ```

Running the script may also not open Expo Go after starting the voice pipeline.

Fix:

1) Run adb kill-server
2) Run adb start-server
   Terminal should output:
   * daemon not running; starting now at tcp:5037
   * daemon started successfully

3) Check adb devices. The output should return your emulated device attached.

## App not opening in Expo Go?

Select 'r' while focused on the terminal. If the output displays on this:

No apps connected. Sending "reload" to all React Native apps failed. Make sure your app is running in the simulator or on a phone connected via USB.


## Port 8081 already in use. Use port 8082?

Make sure to select no as the project uses port 8081. Close any other builds that are using the port and run .\scripts\start-ai-enhancer again or npx expo run:android.

## Terminate batch process

When running .\scripts\start-ai-enhancer.ps1, the project may ask to terminate batch process (Y/N). Write N and press enter. Execute the script again.

## Port 8081 is being used by another process

Use port 8082 instead? 

Make sure to select no and allow the project to build on port 8081

## Catalog metadata not showing up/playback media not working

Run 
```
curl.exe -i http://YOUR-KRAKEND-PROXY-URL/v1/tv/popular
curl.exe -i http://YOUR-KRAKEND-PROXY-URL/v1/movies/popular
```

The terminal should output the catalog metadata for both shows and movies. If it fails, restart both scripts

```
.\scripts\start-jellyfin.ps1
.\scripts\setup-demo-media.ps1
.\scripts\start-krakend.ps1
```

Make sure the proxy url is correct. You may be using the cloudflared generated url's or a lopback address like 127.0.0.01.

Android emulators are 10.0.2.2
Physical device ipconfig IPv4 addresses like 10.0.0.176