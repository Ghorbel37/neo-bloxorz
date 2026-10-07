# Publishing Neo Bloxorz on Google Play

Everything in the repo is ready: the app builds a signed **AAB** (the format Google Play
requires) in CI, ads are wired up with Google AdMob, and the privacy policy and store
listing are written. What's left needs **your** accounts, so it can only be done by you.
Plan for about a week of waiting overall (identity checks, testing period, review).

| Step | Where | Time |
|---|---|---|
| 1. Turn on GitHub Pages (privacy policy URL) | GitHub | 1 min |
| 2. Create your upload key and add it to GitHub | your computer + GitHub | 10 min |
| 3. Create a Google Play developer account | Play Console | $25 once, ID check takes days |
| 4. Create an AdMob account and ad units | AdMob | 15 min |
| 5. Put your AdMob IDs in the game, release a build | repo | 5 min |
| 6. Create the app in Play Console and fill in the forms | Play Console | 1 h |
| 7. Test, then go live | Play Console | 14+ days for new personal accounts |

---

## 1. Turn on GitHub Pages

Google requires a public privacy policy for apps with ads. CI already publishes it (and a
playable web version of the game) to GitHub Pages; Pages just needs to be switched on once:

1. GitHub › your repo › **Settings › Pages**.
2. **Build and deployment › Source: GitHub Actions**.
3. Re-run the latest CI workflow (Actions tab › CI › Re-run all jobs).

Then these work:
- Privacy policy: https://ghorbel37.github.io/neo-bloxorz/privacy.html
- Web version: https://ghorbel37.github.io/neo-bloxorz/

## 2. Create your upload key

Google Play only accepts builds signed with your *upload key*. Create it once and **keep the
file and passwords safe** (a password manager plus a backup). You need Java installed
(`keytool` comes with it).

```sh
keytool -genkeypair -v -keystore neo-bloxorz-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your name; use the same password for the key when asked.
Never commit this file to git.

Add it to GitHub so CI can sign builds: repo › **Settings › Secrets and variables › Actions ›
New repository secret**, four times:

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the file, base64-encoded: `base64 -w0 neo-bloxorz-upload.jks` (macOS: `base64 -i neo-bloxorz-upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the key password (same as above if you reused it) |

From then on every CI run also produces `neo-bloxorz-vX.Y.Z.aab` (for Google Play) and a
signed `neo-bloxorz-vX.Y.Z.apk`, in the run's artifacts and on releases.

## 3. Google Play developer account

1. Go to https://play.google.com/console and sign up (one-time **$25** fee).
2. Choose a **personal** account (or organization if you have a registered business, which
   needs a D-U-N-S number).
3. Complete identity verification. This can take a few days.

> New **personal** accounts must run a **closed test with at least 12 testers for 14 days**
> before they can publish to production. Line up 12 friends with Android phones and Gmail
> addresses early. (Check Play Console for the current rule; Google changes it from time to time.)

## 4. AdMob account and ad units

Until this step the game shows Google's **test ads**, which pay nothing.

1. Sign up at https://admob.google.com with the same Google account.
2. **Apps › Add app › Android ›** "Is the app listed on a supported app store?" **No** (for now).
   Name: Neo Bloxorz. You get an **App ID** like `ca-app-pub-1234567890123456~1234567890`.
3. In the app, **Ad units › Add ad unit**, three times:
   - **Banner** (used on menus)
   - **Interstitial** (shown after some losses)
   - **Rewarded** (continue a run, extra time, extra hint)
   Each has an ID like `ca-app-pub-1234567890123456/1234567890`.
4. Set up **Privacy & messaging › GDPR** (European consent message) and publish it. The game
   already shows it to players who need it and has a "Privacy choices" button in Settings.
5. After the app is live on Play, link it in AdMob (App settings › App store details).

**Never tap your own live ads.** AdMob can ban the account. Add your phone as a test device
in AdMob (Settings › Test devices) before installing a build with real IDs.

## 5. Put your AdMob IDs in the game

Edit two files:

`android/app/src/main/res/values/strings.xml`
```xml
<string name="admob_app_id">ca-app-pub-YOUR_APP_ID</string>
```

`www/js/ads.js`
```js
const CONFIG = {
  TESTING: false,
  banner: 'ca-app-pub-.../...',       // your Banner unit
  interstitial: 'ca-app-pub-.../...', // your Interstitial unit
  rewarded: 'ca-app-pub-.../...',     // your Rewarded unit
  ...
```

Then bump `version` in `package.json` (and `APP_VERSION` in `www/js/game.js`; a test checks they
match), update `RELEASE_NOTES.md`, push, and run the CI workflow from the Actions tab with
**release** ticked. Download the `.aab` from the release.

## 6. Create the app in Play Console

**Create app**: name *Neo Bloxorz*, default language, **Game**, **Free**, accept the declarations.

Then work through **Dashboard › Set up your app**:

| Task | Answer |
|---|---|
| Privacy policy | `https://ghorbel37.github.io/neo-bloxorz/privacy.html` |
| App access | All functionality is available without special access |
| Ads | **Yes, my app contains ads** |
| Content rating | Fill in the questionnaire: puzzle game, no violence, no user interaction or sharing, no gambling. Expect **Everyone / PEGI 3** |
| Target audience | **13 and over** (13–15, 16–17, 18+). Choosing under-13 brings in the Families policy, which has stricter ad rules |
| News app | No |
| Data safety | See below |
| Government app / financial / health features | No / none / none |
| Store listing | Copy from `docs/play-store/listing.md` and upload the images in `docs/play-store/` |

**Data safety**: the game itself stores progress only on the device. The data comes from
the AdMob SDK. Google publishes the exact answers for AdMob; follow
https://developers.google.com/admob/android/privacy/play-data-disclosure. In short:
- **Data collected and shared**: Location › *Approximate location*; Device or other IDs;
  App activity › *App interactions*; App info and performance › *Crash logs*, *Diagnostics*.
  Purposes: Advertising or marketing, Analytics, Fraud prevention/security.
- **Encrypted in transit**: Yes.
- **Can users request deletion**: progress lives on the device (uninstall or *Reset all
  progress* deletes it); there is no account.

**App signing**: when you upload your first AAB, accept **Play App Signing**. Google keeps the
real signing key; your file from step 2 is only the upload key (if you ever lose it, Google
can reset it).

## 7. Test, then go live

1. **Testing › Internal testing**: create a release, upload the `.aab`, add yourself as a
   tester, install from the link and play through. Check that the test/real ads appear on
   menus only, and that "Continue" after losing all hearts works.
2. **Testing › Closed testing**: create a release with the same `.aab`, add your 12+ testers
   (email list or a Google Group), and keep it running **14 days** with them opted in.
3. **Production**: apply for access when Play Console allows it, create a production
   release, and send it for review (usually a few days).

## After launch

- **app-ads.txt** (recommended by AdMob): AdMob shows a line to publish. It must be at the
  root of the developer website in your Play listing. A simple way: create a GitHub repo named
  `Ghorbel37.github.io`, add a file `app-ads.txt` with that line, enable Pages for it, and set
  `https://ghorbel37.github.io` as the website in your Play listing.
- **Remove ads purchase**: the "Remove ads" option in Settings is ready on the game side
  (`setAdsRemoved(true)` in `www/js/game.js` turns ads off). Making it a real purchase needs
  an in-app product (for example `remove_ads`) created in Play Console › Monetize › Products,
  plus a billing plugin. That can be added once the app exists in Play Console.
- **Updates**: bump the version, push, run CI with **release**, and upload the new `.aab`
  to a new release in Play Console.
