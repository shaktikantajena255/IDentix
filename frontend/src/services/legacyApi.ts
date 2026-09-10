/**
 * Transport for the screening backend currently served by backend/main.py.
 * Requests are deliberately relative so Vite's existing /api proxy is used.
 */

const TOKEN_KEY = 'identix_access_token';

export class LegacyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new LegacyApiError(0, 'The IDentix backend is unavailable. Check that FastAPI is running.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new LegacyApiError(response.status, body.detail || `Request failed (${response.status}).`);
  }
  return response;
}

export async function loginOfficer(username: string, password: string) {
  const body = new FormData();
  body.append('username', username);
  body.append('password', password);
  const response = await request('/api/login', { method: 'POST', body });
  return response.json() as Promise<{
    access_token: string;
    officer: { id: number; username: string; full_name: string; badge_number: string };
  }>;
}

export async function getCurrentOfficer() {
  const response = await request('/api/me');
  return response.json() as Promise<{ id: number; username: string; full_name: string; badge_number: string }>;
}

export async function getBackendHealth() {
  const response = await request('/api/health');
  return response.json() as Promise<{ status: string; service: string; version: string }>;
}

export async function startScreening(documentImage: File, selfieImage?: File | null) {
  const body = new FormData();
  body.append('document_image', documentImage);
  if (selfieImage) body.append('selfie_image', selfieImage);
  const response = await request('/api/screening/start', { method: 'POST', body });
  return response.json() as Promise<ScreeningResult>;
}

export interface ScreeningCheck { status: string; detail: string; match_percentage?: number; }
export interface ScreeningResult {
  case_id: string;
  doc_type: string;
  extracted_name: string;
  extracted_dob: string;
  extracted_doc_number: string;
  extracted_expiry: string;
  extracted_nationality: string;
  checks: Record<string, ScreeningCheck>;
  insufficient_evidence: boolean;
  risk_score: number | null;
  risk_tier: string | null;
  risk_explanation: string;
  processing_time: number;
  online: boolean;
  ela_image_b64?: string;
  suspicious_region?: { x: number; y: number; w: number; h: number } | null;
}
