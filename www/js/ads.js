// Ads (Google AdMob through @capacitor-community/admob).
//
// Ads only run inside the Android app. In a browser there is no ad backend, so every call
// is a no-op and rewarded offers are hidden. Tests can inject a fake backend as
// window.__adsMock with the same methods as the plugin.
//
// The IDs below are Google's official TEST IDs: they show sample ads and pay nothing.
// Before publishing, replace them with your own ad unit IDs from AdMob, set TESTING to
// false, and put your AdMob App ID in android/app/src/main/res/values/strings.xml
// (admob_app_id). See docs/PLAY_STORE.md.
(function (root) {
  const CONFIG = {
    TESTING: true,
    banner: 'ca-app-pub-3940256099942544/9214589741',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    // A full-screen ad after a loss is shown at most every LOSSES_PER_AD losses and never
    // twice within MIN_SECONDS_BETWEEN.
    LOSSES_PER_AD: 2,
    MIN_SECONDS_BETWEEN: 90,
  };

  let backend = null;
  let removed = false; // "Remove ads": no banners or interstitials (rewarded ads stay optional)
  let ready = false;
  let bannerShown = false;
  let losses = 0;
  let lastInterstitial = -Infinity;
  let interstitialLoaded = false;
  let privacyOptionsRequired = false;
  let rewardedLoaded = false;

  const now = () => (root.performance ? root.performance.now() : Date.now());
  const quiet = (p) => Promise.resolve(p).catch(() => null);

  function pluginBackend() {
    const cap = root.Capacitor;
    if (root.__adsMock) return root.__adsMock;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.AdMob) return cap.Plugins.AdMob;
    return null;
  }

  function setBannerSpace(px) {
    document.documentElement.style.setProperty('--banner-h', `${Math.round(px)}px`);
  }

  async function preloadInterstitial() {
    if (!ready || removed || interstitialLoaded) return;
    interstitialLoaded = !!(await quiet(backend.prepareInterstitial({ adId: CONFIG.interstitial, isTesting: CONFIG.TESTING })));
  }

  async function preloadRewarded() {
    if (!ready || rewardedLoaded) return;
    rewardedLoaded = !!(await quiet(backend.prepareRewardVideoAd({ adId: CONFIG.rewarded, isTesting: CONFIG.TESTING })));
  }

  const Ads = {
    CONFIG,

    // Starts AdMob and asks for consent where the law requires it (EEA/UK).
    async init({ adsRemoved } = {}) {
      backend = pluginBackend();
      removed = !!adsRemoved;
      if (!backend) return;
      try {
        await backend.initialize({ initializeForTesting: CONFIG.TESTING });
        let info = await quiet(backend.requestConsentInfo());
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') info = (await quiet(backend.showConsentForm())) || info;
        privacyOptionsRequired = !!info && info.privacyOptionsRequirementStatus === 'REQUIRED';
        if (backend.addListener) {
          backend.addListener('bannerAdSizeChanged', (size) => setBannerSpace(bannerShown && size ? size.height : 0));
        }
        ready = true;
      } catch (e) {
        backend = null;
        return;
      }
      preloadInterstitial();
      preloadRewarded();
    },

    available() {
      return ready;
    },

    // Players in regions with consent rules must be able to change their choice later.
    privacyOptionsRequired() {
      return ready && privacyOptionsRequired;
    },

    showPrivacyOptions() {
      return ready ? quiet(backend.showPrivacyOptionsForm()) : Promise.resolve();
    },

    setRemoved(value) {
      removed = !!value;
      if (removed) Ads.hideBanner();
    },

    // Banner on menu screens only, never over the puzzle.
    async showBanner() {
      if (!ready || removed || bannerShown) return;
      bannerShown = true;
      setBannerSpace(60);
      await quiet(backend.showBanner({ adId: CONFIG.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: CONFIG.TESTING }));
    },

    async hideBanner() {
      if (!ready || !bannerShown) return;
      bannerShown = false;
      setBannerSpace(0);
      await quiet(backend.removeBanner());
    },

    // Call after a loss (run over, time's up, out of moves). Shows a full-screen ad now and
    // then, then continues. Always resolves, ad or not.
    async afterLoss() {
      losses++;
      if (!ready || removed || losses < CONFIG.LOSSES_PER_AD) return false;
      if (now() - lastInterstitial < CONFIG.MIN_SECONDS_BETWEEN * 1000) return false;
      if (!interstitialLoaded) { preloadInterstitial(); return false; }
      interstitialLoaded = false;
      losses = 0;
      lastInterstitial = now();
      const shown = (await quiet(backend.showInterstitial().then(() => true))) === true;
      preloadInterstitial();
      return shown;
    },

    // Rewarded ad the player chose to watch. Resolves true only if the reward was earned.
    async rewarded() {
      if (!ready) return false;
      if (!rewardedLoaded) await preloadRewarded();
      if (!rewardedLoaded) return false;
      rewardedLoaded = false;
      const reward = await quiet(backend.showRewardVideoAd());
      preloadRewarded();
      return !!reward;
    },
  };

  root.Ads = Ads;
})(window);
