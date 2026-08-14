/**
 * frontend/src/hooks/useSubscription.ts
 * ---------------------------------------------------------------------------
 * Wrapper hook for RevenueCat SDK Purchases.
 * Manages active subscriptions, tier checks, and billing queries.
 * ---------------------------------------------------------------------------
 */

import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useAuthStore } from "../stores/authStore";

export interface SubscriptionPackage {
  id: string;
  title: string;
  priceString: string;
  period: "monthly" | "yearly";
  savings?: string;
}

export const useSubscription = () => {
  const { profile, loadProfile } = useAuthStore();
  const [offerings, setOfferings] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(false);

  // Set up mock offerings matching standard product packages
  useEffect(() => {
    setOfferings([
      { id: "pkg_monthly", title: "اشتراک ماهانه پرو (Pro Monthly)", priceString: "$19.99", period: "monthly" },
      { id: "pkg_yearly", title: "اشتراک سالانه پرو (Pro Yearly)", priceString: "$149.99", period: "yearly", savings: "صرفه‌جویی ۳۷٪" },
    ]);
  }, []);

  const purchasePackage = async (pkg: SubscriptionPackage) => {
    setLoading(true);
    try {
      // Simulation of RevenueCat payment gateway interface
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert("پرداخت موفق", `خرید بسته ${pkg.title} با موفقیت انجام شد.`);
      
      // Update profile status in Supabase (simulate webhooks sync)
      await loadProfile();
    } catch (e: any) {
      Alert.alert("خرید ناموفق", e.message || "پرداخت توسط درگاه رد شد.");
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert("بازیابی موفق", "خریدهای قبلی شما با موفقیت بازیابی شد.");
    } catch (e: any) {
      Alert.alert("خطا", "یافتن خرید قبلی ناموفق بود.");
    } finally {
      setLoading(false);
    }
  };

  return {
    offerings,
    isLoading: loading,
    activeSubscription: profile?.subscription_tier || "free",
    purchasePackage,
    restorePurchases,
  };
};
