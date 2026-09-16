import { isNativeApp } from "@/lib/native";

/** Real AdMob rewarded ad unit - "watch an ad, get 10 Blox" (see the
 * claim_ad_reward Postgres function for the actual reward amount/cooldown,
 * which is enforced server-side so a modified APK can't just call it in a
 * loop). Test ads are shown in dev builds so nobody accidentally racks up
 * invalid impressions against the real ad unit while developing. */
const REWARDED_AD_UNIT_ID = "ca-app-pub-6108003662443877/9033628276";

let initialized = false;

async function ensureInitialized() {
  if (initialized) return;
  const { AdMob } = await import("@capacitor-community/admob");
  await AdMob.initialize({ initializeForTesting: import.meta.env.DEV });
  initialized = true;
}

/** Loads and shows a rewarded ad, resolving with the reward amount once the
 * viewer actually earns it - resolves `null` if they close it early or it
 * fails to load/show, either way without granting anything. Native only;
 * always resolves `null` on the web (there's nothing to show). */
export async function watchRewardedAd(): Promise<number | null> {
  if (!isNativeApp()) return null;
  const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");
  await ensureInitialized();

  try {
    await AdMob.prepareRewardVideoAd({
      adId: REWARDED_AD_UNIT_ID,
      isTesting: import.meta.env.DEV,
    });
    const reward = await new Promise<{ amount: number } | null>((resolve) => {
      let settled = false;
      void AdMob.addListener(RewardAdPluginEvents.Rewarded, (item) => {
        if (settled) return;
        settled = true;
        resolve({ amount: item.amount });
      });
      void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        if (settled) return;
        settled = true;
        resolve(null);
      });
      void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        if (settled) return;
        settled = true;
        resolve(null);
      });
      void AdMob.showRewardVideoAd();
    });
    return reward ? reward.amount : null;
  } catch {
    return null;
  }
}
