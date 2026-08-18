/**
 * frontend/src/screens/settings/SharedLinksScreen.tsx
 * ---------------------------------------------------------------------------
 * Every link you have published, and the way to take one down.
 *
 * This screen exists because the alternative is worse: publishing puts a page
 * on a public URL, and a user who cannot see what they have published cannot
 * unpublish it. Each publish is its own snapshot — sharing twice leaves two
 * live pages — so the list is the only place that tells the truth about how
 * many are out there.
 * ---------------------------------------------------------------------------
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Text } from "../../components/Typography";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { directionStyleFor } from "../../theme/direction";
import { confirmAction, notify } from "../../services/notify";
import { errorFeedback, successFeedback, tapFeedback } from "../../services/haptics";
import { listShares, revokeShare, type ShareRecord } from "../../services/shareService";
import { shareLink } from "../../services/shareSheet";
import { relativeTime } from "../../services/formatting";

/** Bytes as something a person reads, not a number of digits. */
function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SharedLinksScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShares(await listShares());
    } catch (e: any) {
      notify("Could not load your links", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleShare = async (share: ShareRecord) => {
    if (!share.url) return;
    tapFeedback();
    const outcome = await shareLink(share.url, share.title ?? "My app");
    if (outcome === "copied") notify("Link copied", share.url);
    else if (outcome === "manual") notify("Your link", share.url);
  };

  const handleRevoke = async (share: ShareRecord) => {
    const confirmed = await confirmAction(
      "Take this link down?",
      "Anyone with the link stops being able to open the page. This cannot be undone — publishing again gives a new link.",
    );
    if (!confirmed) return;

    setBusyCode(share.code);
    try {
      const { cacheSeconds } = await revokeShare(share.code);
      successFeedback();
      // Public pages are served through a CDN, so the page can still answer for
      // a few minutes. Saying so beats a user refreshing and thinking it broke.
      notify(
        "Taken down",
        `The page stops being served. Anyone who opened it in the last ${Math.round(cacheSeconds / 60)} minutes may still see a cached copy briefly.`,
      );
      await load();
    } catch (e: any) {
      errorFeedback();
      notify("Could not take it down", e?.message ?? "Please try again.");
    } finally {
      setBusyCode(null);
    }
  };

  const live = shares.filter((share) => !share.revoked_at);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.canvasBase }}>
      <View
        className="flex-row items-center justify-between px-6 py-4 border-b"
        style={{ borderBottomColor: colors.borderHairline }}
      >
        <View className="w-16" />
        <Text variant="h3" className="font-uiSemiBold">Shared links</Text>
        <TouchableOpacity onPress={() => { tapFeedback(); navigation.goBack(); }} className="p-2 w-16 items-end">
          <Text variant="body" className="font-uiMedium">Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text variant="caption" className="text-left leading-5 mb-5" style={{ color: colors.inkSecondary }}>
          {live.length === 0
            ? "Pages you publish from the preview appear here. Anyone with the link can open them — no account needed."
            : `${live.length} page${live.length === 1 ? "" : "s"} you have published. Anyone with the link can open ${live.length === 1 ? "it" : "them"} — no account needed.`}
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        ) : shares.length === 0 ? (
          <View
            className="p-4 rounded-2xl border"
            style={{ backgroundColor: colors.surfaceRaised, borderColor: colors.borderHairline }}
          >
            <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left leading-5">
              Nothing published yet. Open a project's preview and press Share.
            </Text>
          </View>
        ) : (
          shares.map((share) => {
            const revoked = !!share.revoked_at;
            return (
              <View
                key={share.code}
                className="p-4 rounded-2xl border mb-3"
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.borderHairline,
                  // A taken-down link is history, not an option. Dimming it says
                  // so without hiding the record.
                  opacity: revoked ? 0.55 : 1,
                }}
              >
                <View className="flex-row items-center mb-1">
                  <Icon
                    name={revoked ? "x" : "globe"}
                    size={13}
                    color={revoked ? colors.inkMuted : colors.success}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    variant="body"
                    className="font-uiMedium flex-1"
                    style={directionStyleFor(share.title)}
                    numberOfLines={1}
                  >
                    {share.title ?? "Untitled page"}
                  </Text>
                  <Text variant="caption" style={{ color: colors.inkMuted }} className="text-[10px]">
                    {readableSize(share.size_bytes)}
                  </Text>
                </View>

                <Text
                  variant="caption"
                  style={{ color: revoked ? colors.inkMuted : colors.inkSecondary }}
                  className="text-left text-[11px]"
                  numberOfLines={1}
                >
                  {share.url ?? `Taken down ${relativeTime(share.revoked_at!)}`}
                </Text>
                <Text variant="caption" style={{ color: colors.inkMuted }} className="text-left text-[11px] mt-0.5">
                  Published {relativeTime(share.created_at)}
                </Text>

                {!revoked && (
                  <View className="flex-row justify-end mt-3">
                    <TouchableOpacity
                      onPress={() => handleShare(share)}
                      disabled={busyCode !== null}
                      className="px-3 py-1.5 rounded-lg mr-2"
                      style={{ backgroundColor: colors.surfaceMuted }}
                    >
                      <Text variant="caption" className="text-[11px] font-uiMedium" style={{ color: colors.brandPrimary }}>
                        Send link
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleRevoke(share)}
                      disabled={busyCode !== null}
                      className="px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: colors.surfaceMuted }}
                    >
                      {busyCode === share.code ? (
                        <ActivityIndicator size="small" color={colors.failed} />
                      ) : (
                        <Text variant="caption" className="text-[11px] font-uiMedium" style={{ color: colors.failed }}>
                          Take down
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
