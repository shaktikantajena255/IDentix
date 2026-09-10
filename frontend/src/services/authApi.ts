/**
 * IDentix — Auth API Service
 * Real API calls to backend auth endpoints.
 * All calls go to /api/v1/auth/* (proxied to FastAPI by Vite).
 */

const BASE = '/api/v1/auth';

export interface LoginResult {
  preAuthToken: string;
  badgeId: string;
  fullName: string;
  role: string;
  requiresBiometric: boolean;
  biometricBypassActive: boolean;
}

export interface AccessTokenResult {
  accessToken: string;
  officerId: string;
  badgeId: string;
  fullName: string;
  role: string;
  expiresInSeconds: number;
  sessionId: string;
  biometricStatus: string;
}

export interface ApiAuthError {
  status: number;
  detail: string | Record<string, unknown>;
}

async function post<T>(path: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }));
    throw { status: res.status, detail: err.detail ?? err } as ApiAuthError;
  }
  return res.json() as Promise<T>;
}

/**
 * Step 1: Password authentication.
 * Throws ApiAuthError on failure.
 * Does NOT grant access — only issues a short-lived pre-auth token.
 */
export async function loginWithPassword(badgeId: string, password: string): Promise<LoginResult> {
  const data = await post<{
    pre_auth_token: string;
    badge_id: string;
    full_name: string;
    role: string;
    requires_biometric: boolean;
    biometric_bypass_active: boolean;
  }>('/login', { badge_id: badgeId, password });

  return {
    preAuthToken: data.pre_auth_token,
    badgeId: data.badge_id,
    fullName: data.full_name,
    role: data.role,
    requiresBiometric: data.requires_biometric,
    biometricBypassActive: data.biometric_bypass_active,
  };
}

/**
 * Step 2: Face verification.
 * Sends the pre-auth token + base64-encoded face image.
 * Returns full access token on success.
 * Throws ApiAuthError with status 503 if biometric service unavailable.
 */
export async function verifyFace(preAuthToken: string, faceImageB64: string): Promise<AccessTokenResult> {
  const data = await post<{
    access_token: string;
    officer_id: string;
    badge_id: string;
    full_name: string;
    role: string;
    expires_in_seconds: number;
    session_id: string;
    biometric_status: string;
  }>('/face-verify', { pre_auth_token: preAuthToken, face_image_b64: faceImageB64 });

  return {
    accessToken: data.access_token,
    officerId: data.officer_id,
    badgeId: data.badge_id,
    fullName: data.full_name,
    role: data.role,
    expiresInSeconds: data.expires_in_seconds,
    sessionId: data.session_id,
    biometricStatus: data.biometric_status,
  };
}

/**
 * Logout: records audit event server-side. Token is cleared client-side by the caller.
 */
export async function logout(accessToken: string): Promise<void> {
  await fetch(`${BASE}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {}); // Best-effort — don't block UI on network failure
}

/**
 * Restore session: validate a stored access token on page reload.
 * Returns officer profile if valid, null if expired or invalid.
 */
export async function validateSession(accessToken: string): Promise<AccessTokenResult | null> {
  try {
    const res = await fetch(`${BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accessToken,
      officerId: data.officer_id,
      badgeId: data.badge_id,
      fullName: data.full_name,
      role: data.role,
      expiresInSeconds: 0,
      sessionId: data.session_id,
      biometricStatus: 'VERIFIED',
    };
  } catch {
    return null;
  }
}
