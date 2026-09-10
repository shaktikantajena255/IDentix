/**
 * IDentix — Screening State Machine Context
 *
 * State: IDLE → SCREENING_READY → SCREENING_ACTIVE → SCREENING_PROCESSING
 *                                                          ↓
 *                                               SCREENING_RESULT
 *                                                          ↓
 *                                               SCREENING_COMPLETE
 *
 * Navigation lock: React Router useBlocker is active when phase is
 * SCREENING_ACTIVE or SCREENING_PROCESSING — prevents accidental route changes.
 */
import React, {
  createContext, useContext, useReducer, useCallback
} from 'react';
import { useBlocker } from 'react-router-dom';
import type { ScreeningPhase } from '@shared/types';

interface ActiveScreening {
  caseId: string;
  officerId: string;
  officerName: string;
  checkpointId: string;
  sessionId: string;
  startedAt: string;
  isFullscreen: boolean;
}

interface ScreeningState {
  phase: ScreeningPhase;
  active: ActiveScreening | null;
  showExitConfirm: boolean;
  exitBlocked: boolean; // true when a navigation was blocked, pending confirmation
}

type ScreeningAction =
  | { type: 'READY'; active: ActiveScreening }
  | { type: 'START' }
  | { type: 'PROCESSING' }
  | { type: 'RESULT' }
  | { type: 'COMPLETE' }
  | { type: 'REQUEST_EXIT' }
  | { type: 'CANCEL_EXIT' }
  | { type: 'CONFIRM_EXIT' }
  | { type: 'SET_FULLSCREEN'; isFullscreen: boolean }
  | { type: 'NAV_BLOCKED' }
  | { type: 'NAV_UNBLOCKED' };

function reducer(state: ScreeningState, action: ScreeningAction): ScreeningState {
  switch (action.type) {
    case 'READY':
      return { ...state, phase: 'SCREENING_READY', active: action.active };
    case 'START':
      return { ...state, phase: 'SCREENING_ACTIVE' };
    case 'PROCESSING':
      return { ...state, phase: 'SCREENING_PROCESSING' };
    case 'RESULT':
      return { ...state, phase: 'SCREENING_RESULT' };
    case 'COMPLETE':
      return { phase: 'IDLE', active: null, showExitConfirm: false, exitBlocked: false };
    case 'REQUEST_EXIT':
      return { ...state, showExitConfirm: true };
    case 'CANCEL_EXIT':
      return { ...state, showExitConfirm: false, exitBlocked: false };
    case 'CONFIRM_EXIT':
      return { phase: 'IDLE', active: null, showExitConfirm: false, exitBlocked: false };
    case 'SET_FULLSCREEN':
      return state.active
        ? { ...state, active: { ...state.active, isFullscreen: action.isFullscreen } }
        : state;
    case 'NAV_BLOCKED':
      return { ...state, showExitConfirm: true, exitBlocked: true };
    case 'NAV_UNBLOCKED':
      return { ...state, exitBlocked: false };
    default:
      return state;
  }
}

const INITIAL: ScreeningState = {
  phase: 'IDLE',
  active: null,
  showExitConfirm: false,
  exitBlocked: false,
};

interface ScreeningContextValue {
  state: ScreeningState;
  startReady: (active: ActiveScreening) => void;
  startActive: () => void;
  setProcessing: () => void;
  setResult: () => void;
  complete: () => void;
  requestExit: () => void;
  cancelExit: () => void;
  confirmExit: (navigate: () => void) => void;
  setFullscreen: (isFullscreen: boolean) => void;
  isLocked: boolean; // true during ACTIVE or PROCESSING — navigation blocked
}

const ScreeningContext = createContext<ScreeningContextValue | null>(null);

export const ScreeningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const isLocked =
    state.phase === 'SCREENING_ACTIVE' || state.phase === 'SCREENING_PROCESSING';

  // ── React Router Navigation Blocker ────────────────────────────────────────
  // This is a REAL navigation block — prevents all route changes (back button,
  // direct URL changes, navigate() calls) when screening is active.
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isLocked && currentLocation.pathname !== nextLocation.pathname,
      [isLocked]
    )
  );

  // When the blocker fires, show the exit confirmation modal
  React.useEffect(() => {
    if (blocker.state === 'blocked') {
      dispatch({ type: 'NAV_BLOCKED' });
    }
  }, [blocker.state]);

  const startReady = useCallback((active: ActiveScreening) =>
    dispatch({ type: 'READY', active }), []);
  const startActive = useCallback(() => dispatch({ type: 'START' }), []);
  const setProcessing = useCallback(() => dispatch({ type: 'PROCESSING' }), []);
  const setResult = useCallback(() => dispatch({ type: 'RESULT' }), []);
  const complete = useCallback(() => dispatch({ type: 'COMPLETE' }), []);
  const requestExit = useCallback(() => dispatch({ type: 'REQUEST_EXIT' }), []);
  const cancelExit = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
    dispatch({ type: 'CANCEL_EXIT' });
  }, [blocker]);
  const confirmExit = useCallback((navigate: () => void) => {
    dispatch({ type: 'CONFIRM_EXIT' });
    if (blocker.state === 'blocked') blocker.proceed();
    else navigate();
  }, [blocker]);
  const setFullscreen = useCallback((isFullscreen: boolean) =>
    dispatch({ type: 'SET_FULLSCREEN', isFullscreen }), []);

  return (
    <ScreeningContext.Provider value={{
      state, startReady, startActive, setProcessing, setResult, complete,
      requestExit, cancelExit, confirmExit, setFullscreen, isLocked,
    }}>
      {children}
    </ScreeningContext.Provider>
  );
};

export function useScreening(): ScreeningContextValue {
  const ctx = useContext(ScreeningContext);
  if (!ctx) throw new Error('useScreening must be used within <ScreeningProvider>');
  return ctx;
}
