/**
 * Which builds may send someone out to buy something.
 *
 * Getting this wrong in one direction costs a tap. Getting it wrong in the
 * other is a Play policy violation, so the cases that matter are the ones where
 * the answer should be "no".
 */

import { describe, expect, it } from "vitest";
import {
  type Channel,
  limitMessage,
  normaliseChannel,
  purchaseAffordance,
} from "../distribution";

describe("who may link out", () => {
  it("lets the web do anything — no store, no rules", () => {
    expect(purchaseAffordance("web", "web").canLinkOut).toBe(true);
    // Even if the channel string is wrong, web is web.
    expect(purchaseAffordance("web", "play").canLinkOut).toBe(true);
    expect(purchaseAffordance("web", "unknown").canLinkOut).toBe(true);
  });

  it("lets a direct APK or alternative store link out", () => {
    // Not distributed by Google, so Google's link-out rules do not reach it.
    expect(purchaseAffordance("android", "direct").canLinkOut).toBe(true);
  });

  it("does not let a Play build link out", () => {
    expect(purchaseAffordance("android", "play").canLinkOut).toBe(false);
  });

  it("treats an unconfigured native build as Play", () => {
    // Fails closed. A build that forgot to set the channel must not opt itself
    // into a fee-and-reporting regime on someone else's developer account.
    expect(purchaseAffordance("android", "unknown").canLinkOut).toBe(false);
    expect(purchaseAffordance("ios", "unknown").canLinkOut).toBe(false);
  });

  it("does not let an App Store build link out either", () => {
    // Apple's rules are their own and are not what this was reasoned about,
    // so the conservative answer stands until it is.
    expect(purchaseAffordance("ios", "ios-app-store").canLinkOut).toBe(false);
  });

  it("always allows saying that plans exist", () => {
    // Play's settlement stopped prohibiting this, and refusing to explain a
    // limit would be worse for the user than any rule requires.
    const channels: Channel[] = ["play", "direct", "web", "ios-app-store", "unknown"];
    for (const channel of channels) {
      expect(purchaseAffordance("android", channel).canMentionPlans).toBe(true);
    }
  });
});

describe("reading the channel from the environment", () => {
  it("accepts the spellings a build script is likely to use", () => {
    expect(normaliseChannel("play")).toBe("play");
    expect(normaliseChannel("google-play")).toBe("play");
    expect(normaliseChannel("APK")).toBe("direct");
    expect(normaliseChannel(" Direct ")).toBe("direct");
    expect(normaliseChannel("bazaar")).toBe("direct");
    expect(normaliseChannel("web")).toBe("web");
  });

  it("treats anything it does not recognise as unknown", () => {
    // Which then reads as Play. A typo in a build variable must not unlock
    // link-out.
    expect(normaliseChannel("playstore-maybe")).toBe("unknown");
    expect(normaliseChannel(undefined)).toBe("unknown");
    expect(normaliseChannel(null)).toBe("unknown");
    expect(normaliseChannel("")).toBe("unknown");
    expect(purchaseAffordance("android", normaliseChannel("typo"))).toEqual({
      canLinkOut: false,
      canMentionPlans: true,
    });
  });
});

describe("what a user who ran out is told", () => {
  it("offers the button where a button is allowed", () => {
    const message = limitMessage(purchaseAffordance("web", "web"));
    expect(message.action).toBe("Update subscription");
    expect(message.body).toContain("resets at midnight UTC");
  });

  it("gives no button on Play, but still says where to go", () => {
    const message = limitMessage(purchaseAffordance("android", "play"));
    expect(message.action).toBeNull();
    // The sentence has to carry the whole answer, because the app cannot take
    // them there — a dead end that explains nothing would be the worst outcome.
    expect(message.body).toContain("website");
    expect(message.body).toContain("resets at");
  });

  it("uses the reset time it is given", () => {
    expect(limitMessage(purchaseAffordance("web", "web"), "9am Tehran time").body)
      .toContain("9am Tehran time");
  });
});

describe("when the product sells nothing", () => {
  // Launching free: the checkout, plans and tier gating all still exist and are
  // still tested, but no surface may offer them. This is the switch that does
  // it, and it is checked before the platform rules on purpose.
  it("closes the purchase route on every platform, web included", () => {
    for (const platform of ["android", "ios", "web"]) {
      for (const channel of ["play", "direct", "web", "ios-app-store", "unknown"] as const) {
        const affordance = purchaseAffordance(platform, channel, false);
        expect(affordance.canLinkOut, `${platform}/${channel}`).toBe(false);
        expect(affordance.canMentionPlans, `${platform}/${channel}`).toBe(false);
      }
    }
  });

  it("does not dangle an upgrade that does not exist", () => {
    const message = limitMessage(purchaseAffordance("web", "web", false), "midnight UTC");
    expect(message.action).toBe(null);
    expect(message.body).toContain("midnight UTC");
    // The limit is simply the limit. Mentioning a plan nobody can buy is worse
    // than the wait itself.
    expect(message.body).not.toMatch(/plan|upgrade|subscri/i);
  });

  it("leaves the paid behaviour untouched when billing is on", () => {
    // The default must stay what it was, or turning billing back on later is a
    // second migration rather than a flag.
    expect(purchaseAffordance("web", "web").canLinkOut).toBe(true);
    expect(purchaseAffordance("android", "direct").canLinkOut).toBe(true);
    expect(purchaseAffordance("android", "play").canLinkOut).toBe(false);
    expect(purchaseAffordance("android", "play").canMentionPlans).toBe(true);
  });
});
