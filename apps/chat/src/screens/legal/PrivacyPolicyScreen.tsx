/**
 * frontend/src/screens/legal/PrivacyPolicyScreen.tsx
 * ---------------------------------------------------------------------------
 * The privacy policy, rendered from the shared document so the copy shown in
 * the app and the copy published for the store listing cannot diverge.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { PRIVACY_POLICY } from "../../core/legal/documents";
import { LegalDocumentScreen } from "./LegalDocumentScreen";

export const PrivacyPolicyScreen = () => <LegalDocumentScreen document={PRIVACY_POLICY} />;
