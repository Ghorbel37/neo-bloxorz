## Neo Bloxorz 1.3.3: updates install properly (and vibration with them)

**Please uninstall Neo Bloxorz once, then install this APK.**

Why vibration "still didn't work": every APK released so far was signed with a different,
random key (each CI build made a new one). Android refuses to install an update signed with a
different key, so the vibration fixes in 1.3.1 and 1.3.2 most likely never reached your phone.

- APKs are now always signed with the same key, so from this version on every update installs
  over the previous one and keeps your progress. CI checks the signature on every build.
- Vibration uses the native Haptics plugin exactly the way the Carreau app does, with
  normal-strength buzzes; Settings › Test vibration shows what happens on your phone.

Uninstalling deletes progress saved by the old version (one time only, sorry).

### Install
Uninstall the old version, then download `neo-bloxorz-v1.3.3-debug.apk` below and open it on
your Android phone.
