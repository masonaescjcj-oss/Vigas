/**
 * frontend/src/navigation/types.ts
 * ---------------------------------------------------------------------------
 * Compatibility re-export. The single source of truth for route params is
 * `src/types/navigation.ts`; this file used to hold a stale, divergent copy
 * (AuthStackParamList = { Auth }) that silently broke every screen importing
 * from here.
 * ---------------------------------------------------------------------------
 */

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ProjectStackParamList } from "../types/navigation";

export type {
  AuthStackParamList,
  ProjectStackParamList,
  ProfileStackParamList,
  MainTabParamList,
  RootStackParamList,
} from "../types/navigation";

/** Convenience typing for `useNavigation()` inside project-stack screens. */
export type ProjectNavigationProp = NativeStackNavigationProp<ProjectStackParamList>;
