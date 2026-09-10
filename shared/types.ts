/**
 * IDentix: Identity & Document Screening Platform
 * Shared Domain Models and API Contracts
 */

// ─── Document & Evidence Types ──────────────────────────────────────────────

export type DocumentType =
  | 'PASSPORT'
  | 'VISA'
  | 'NATIONAL_ID'
  | 'DRIVING_LICENCE'
  | 'PERMIT';

export type AcquisitionMode =
  | 'PHYSICAL_SCAN'
  | 'FILE_UPLOAD'
  | 'WEBCAM_CAPTURE'
  | 'VAULT_QR';

export type RiskLevel = 'CLEAR' | 'REVIEW' | 'HIGH_RISK';

export type EvidenceStatus = 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'UNAVAILABLE';
export type EvidenceSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type EvidenceCategory =
  | 'IMAGE_QUALITY' | 'MRZ_VALIDATION' | 'VIZ_CONSISTENCY'
  | 'TAMPER_FORENSICS' | 'SECURITY_FEATURES' | 'FACE_BIOMETRICS'
  | 'WATCHLIST_CHECK' | 'CROSS_DOCUMENT' | 'IDENTITY_GRAPH' | 'TIMELINE_ANALYSIS';

export type OfficerDecision =
  | 'PENDING' | 'ACCEPTED' | 'REFERRED_TO_SECONDARY' | 'REJECTED';

export type ConnectionStatus = 'ONLINE' | 'LOW_CONNECTIVITY' | 'OFFLINE';

// ─── Auth Types ─────────────────────────────────────────────────────────────

export type OfficerRole = 'OFFICER' | 'SUPERVISOR' | 'ADMIN';

export type BiometricStatus =
  | 'VERIFIED'
  | 'BYPASS_ACTIVE'
  | 'SERVICE_UNAVAILABLE'
  | 'MISMATCH';

export interface OfficerProfile {
  officerId: string;
  badgeId: string;
  fullName: string;
  role: OfficerRole;
  sessionId: string;
  loginAt: string;
  biometricStatus: BiometricStatus;
  accessToken: string;
}

/** Authentication state machine phases */
export type AuthPhase =
  | 'UNAUTHENTICATED'      // No session
  | 'PASSWORD_VERIFYING'   // API call in-flight
  | 'PASSWORD_VERIFIED'    // Password OK, awaiting biometric
  | 'BIOMETRIC_VERIFYING'  // Camera active, comparison in-flight
  | 'AUTHENTICATED';       // Full access granted

export interface PreAuthState {
  preAuthToken: string;
  badgeId: string;
  fullName: string;
  role: OfficerRole;
  biometricBypassActive: boolean;
}

// ─── Screening State Machine ─────────────────────────────────────────────────

export type ScreeningPhase =
  | 'IDLE'
  | 'SCREENING_READY'
  | 'SCREENING_ACTIVE'
  | 'SCREENING_PROCESSING'
  | 'SCREENING_RESULT'
  | 'SCREENING_COMPLETE';

// ─── Evidence & Case Types ───────────────────────────────────────────────────

export interface ExtractedField {
  fieldKey: string;
  label: string;
  visualValue: string | null;
  mrzValue: string | null;
  status: 'MATCH' | 'MISMATCH' | 'UNCHECKED' | 'NOT_APPLICABLE';
  confidence?: number;
}

export interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  title: string;
  description: string;
  status: EvidenceStatus;
  severity: EvidenceSeverity;
  sourceModule: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ScreeningDocument {
  id: string;
  screeningId: string;
  documentType: DocumentType;
  acquisitionMode: AcquisitionMode;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  imageUri?: string;
  thumbnailUri?: string;
  extractedFields: ExtractedField[];
  mrzRaw?: string;
  mrzChecksumValid?: boolean;
  uploadedAt: string;
}

export interface BiometricVerification {
  id: string;
  screeningId: string;
  docFaceUri?: string;
  liveFaceUri?: string;
  similarityScore: number;
  matchStatus: 'MATCH' | 'MISMATCH' | 'INCONCLUSIVE';
  livenessStatus: 'PASSED' | 'FAILED' | 'INCONCLUSIVE';
  livenessScore?: number;
  evaluatedAt: string;
}

export interface ScreeningCase {
  id: string;
  checkpointId: string;
  officerId: string;
  officerName: string;
  sessionId: string;
  createdAt: string;
  completedAt?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'REFERRED';
  riskLevel: RiskLevel;
  confidenceScore: number;
  officerDecision: OfficerDecision;
  officerNotes?: string;
  documents: ScreeningDocument[];
  evidence: EvidenceItem[];
  biometrics?: BiometricVerification;
  isSynced: boolean;
  syncedAt?: string;
}

// ─── Watchlist & Audit ───────────────────────────────────────────────────────

export interface WatchlistHit {
  id: string;
  documentNumber: string;
  issuingCountry: string;
  documentType: DocumentType;
  holderName: string;
  dateOfBirth?: string;
  reason: 'STOLEN' | 'LOST' | 'REVOKED' | 'WANTED' | 'SUSPECT';
  sourceList: string;
  hitTimestamp: string;
  confidence: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: OfficerRole;
  action: string;
  targetEntity: string;
  targetId?: string;
  ipAddress?: string;
  details: Record<string, unknown>;
  integrityHash: string;
}

// ─── Vault Types ──────────────────────────────────────────────────────────────

export interface VaultSession {
  sessionId: string;
  qrToken: string;
  officerId: string;
  checkpointId: string;
  createdAt: string;
  expiresAt: string;
  status: 'AWAITING_SCAN' | 'CONNECTED' | 'CONSENT_GRANTED' | 'TRANSFERRED' | 'EXPIRED';
  transferredDocId?: string;
}

export interface TravellerDocument {
  id: string;
  documentType: DocumentType;
  title: string;
  documentNumberMasked: string;
  expiryDate: string;
  issuingCountry: string;
  uploadedAt: string;
  fileSizeBytes: number;
  hasRenewalAlert: boolean;
  daysUntilExpiry: number;
}
