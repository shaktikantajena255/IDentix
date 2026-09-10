import Dexie, { type EntityTable } from 'dexie';
import type {
  ScreeningCase,
  ScreeningDocument,
  AuditLogEntry,
  TravellerDocument,
  WatchlistHit
} from '@shared/types';

export interface OfflineSyncItem {
  id: string;
  entityType: 'SCREENING' | 'AUDIT_LOG' | 'DOCUMENT';
  entityId: string;
  payload: Record<string, unknown>;
  enqueuedAt: string;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  lastError?: string;
}

export interface WatchlistLocalRecord {
  id: string;
  documentNumber: string;
  issuingCountry: string;
  documentType: string;
  holderName: string;
  dateOfBirth?: string;
  reason: string;
  sourceList: string;
  createdAt: string;
}

/**
 * IDentix Local Offline Database
 * Built with Dexie.js on top of browser IndexedDB.
 * Provides resilient, zero-latency local storage for checkpoint operations.
 */
export class IDentixDatabase extends Dexie {
  screenings!: EntityTable<ScreeningCase, 'id'>;
  documents!: EntityTable<ScreeningDocument, 'id'>;
  auditLogs!: EntityTable<AuditLogEntry, 'id'>;
  offlineSyncQueue!: EntityTable<OfflineSyncItem, 'id'>;
  vaultDocuments!: EntityTable<TravellerDocument, 'id'>;
  watchlist!: EntityTable<WatchlistLocalRecord, 'id'>;

  constructor() {
    super('IDentix_LocalDB');
    this.version(1).stores({
      screenings: 'id, checkpointId, officerId, status, riskLevel, createdAt, isSynced',
      documents: 'id, screeningId, documentType, acquisitionMode, uploadedAt',
      auditLogs: 'id, timestamp, userId, action, targetEntity',
      offlineSyncQueue: 'id, entityType, entityId, enqueuedAt, status',
      vaultDocuments: 'id, documentType, expiryDate, uploadedAt',
      watchlist: 'id, documentNumber, issuingCountry, holderName'
    });
  }
}

export const db = new IDentixDatabase();

// Helper functions for real local case management
export interface CreateScreeningCaseOptions {
  officerId: string;
  officerName: string;
  checkpointId: string;
  sessionId?: string;
}

export async function createLocalScreeningCase(
  officerIdOrOptions: string | CreateScreeningCaseOptions,
  officerNameArg?: string,
  checkpointIdArg?: string,
  sessionIdArg?: string
): Promise<ScreeningCase> {
  let officerId: string;
  let officerName: string;
  let checkpointId: string;
  let sessionId: string;

  if (typeof officerIdOrOptions === 'object') {
    officerId = officerIdOrOptions.officerId;
    officerName = officerIdOrOptions.officerName;
    checkpointId = officerIdOrOptions.checkpointId;
    sessionId = officerIdOrOptions.sessionId || `SES-${Date.now()}`;
  } else {
    officerId = officerIdOrOptions;
    officerName = officerNameArg || 'Officer';
    checkpointId = checkpointIdArg || 'T2-CP-04B';
    sessionId = sessionIdArg || `SES-${Date.now()}`;
  }

  const newCase: ScreeningCase = {
    id: `SCR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    checkpointId,
    officerId,
    officerName,
    sessionId,
    createdAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    riskLevel: 'CLEAR',
    confidenceScore: 0.0,
    officerDecision: 'PENDING',
    documents: [],
    evidence: [],
    isSynced: false,
  };

  await db.screenings.add(newCase);

  // Record audit log
  await logAuditEvent({
    userId: officerId,
    userName: officerName,
    userRole: 'OFFICER',
    action: 'SCREENING_INITIATED',
    targetEntity: 'SCREENING',
    targetId: newCase.id,
    details: { checkpointId }
  });

  return newCase;
}

export async function logAuditEvent(params: {
  userId: string;
  userName: string;
  userRole: 'OFFICER' | 'SUPERVISOR' | 'ADMIN';
  action: string;
  targetEntity: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): Promise<AuditLogEntry> {
  const timestamp = new Date().toISOString();
  // Basic chained-hash simulation for local tamper-evidence
  const integrityHash = `SHA256:${Math.random().toString(36).substring(2)}${Date.now()}`;

  const entry: AuditLogEntry = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp,
    userId: params.userId,
    userName: params.userName,
    userRole: params.userRole,
    action: params.action,
    targetEntity: params.targetEntity,
    targetId: params.targetId,
    details: params.details || {},
    integrityHash
  };

  await db.auditLogs.add(entry);
  return entry;
}
