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
import { View, ScrollView, SafeAreaView, ActivityIndicator } from "react-native";
import { Text } from "../../components/Typography";
import { Button } from "../../components/Button";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { useTheme } from "../../theme/ThemeProvider";
import { directionStyleFor } from "../../theme/direction";
import { confirmAction, notify } from "../../services/notify";
import { errorFeedback, successFeedback } from "../../services/haptics";
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
    const outcome = await shareLink(share.url, share.title ?? "My app");
    if (outcome === "copied") notify("Link copied", share.url);
    else if (outcome === "manual") notify("Your link", share.url);
  };

  const handleRevoke = async (share: ShareRecord) => {
    const confirmed = await confirmAction(
      "Take this link down?",
      "Anyone with the link stops being able to open the page. This cannot be undone — publishing again gives a new link.",
      { destructive: true, confirmLabel: "Take down" },
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
      <ScreenHeader
        title="Shared links"
        subtitle={live.length ? `${live.length} live` : undefined}
        divider={false}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <Text variant="body" className="px-1 pt-1 pb-5" style={{ color: colors.inkSecondary, lineHeight: 22 }}>
          Pages you publish from the preview. Anyone with the link can open them — no account needed.
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={colors.inkMuted} style={{ marginVertical: 16 }} />
        ) : shares.length === 0 ? (
          <Card>
            <Text variant="caption" style={{ color: colors.inkMuted, lineHeight: 18 }}>
              Nothing published yet. Open a project's preview and press Share.
            </Text>
          </Card>
        ) : (
          shares.map((share) => {
            const revoked = !!share.revoked_at;
            return (
              // A taken-down link is history, not an option. Dimming it says
              // so without hiding the record.
              <Card key={share.code} className="mb-3" style={{ opacity: revoked ? 0.55 : 1 }}>
                <View className="flex-row items-center">
                  <Text variant="body" className="font-uiMedium flex-1 mr-2" style={directionStyleFor(share.title)} numberOfLines={1}>
                    {share.title ?? "Untitled page"}
                  </Text>
                  <Pill tone={revoked ? "muted" : "success"}>{revoked ? "Taken down" : "Live"}</Pill>
                </View>

                <Text variant="caption" className="mt-1.5" style={{ color: revoked ? colors.inkMuted : colors.inkSecondary }} numberOfLines={1}>
                  {share.url ?? `Taken down ${relativeTime(share.revoked_at!)}`}
                </Text>
                <Text variant="caption" className="mt-0.5" style={{ color: colors.inkMuted }}>
                  Published {relativeTime(share.created_at)} · {readableSize(share.size_bytes)}
                </Text>

                {!revoked && (
                  <View className="flex-row mt-3">
                    <Button label="Send link" tone="neutral" size="sm" disabled={busyCode !== null} onPress={() => void handleShare(share)} />
                    <View style={{ width: 8 }} />
                    <Button
                      label="Take down"
                      tone="ghost"
                      size="sm"
                      loading={busyCode === share.code}
                      disabled={busyCode !== null}
                      onPress={() => void handleRevoke(share)}
                    />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
