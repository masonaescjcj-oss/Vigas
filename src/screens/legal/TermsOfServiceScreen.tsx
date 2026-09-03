/**
 * frontend/src/screens/legal/TermsOfServiceScreen.tsx
 * ---------------------------------------------------------------------------
 * The terms, rendered from the shared document. See PrivacyPolicyScreen.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { TERMS_OF_SERVICE } from "../../core/legal/documents";
import { LegalDocumentScreen } from "./LegalDocumentScreen";

export const TermsOfServiceScreen = () => <LegalDocumentScreen document={TERMS_OF_SERVICE} />;
