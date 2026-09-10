import { useState, useEffect } from 'react';
import type { ConnectionStatus } from '@shared/types';
import { db } from '../services/db';

export interface NetworkState {
  status: ConnectionStatus;
  isOnline: boolean;
  lastChecked: Date;
  pendingSyncCount: number;
  serverLatencyMs: number | null;
}

export function useNetworkStatus(): NetworkState {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [status, setStatus] = useState<ConnectionStatus>(navigator.onLine ? 'ONLINE' : 'OFFLINE');
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [serverLatencyMs, setServerLatencyMs] = useState<number | null>(null);

  // Monitor pending offline queue items in IndexedDB
  useEffect(() => {
    const checkQueue = async () => {
      try {
        const count = await db.offlineSyncQueue.where('status').equals('PENDING').count();
        setPendingSyncCount(count);
      } catch (err) {
        console.error('Failed to query sync queue:', err);
      }
    };
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  // Ping backend to detect actual reachability (not just local network interface)
  const checkHealth = async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setStatus('OFFLINE');
      setServerLatencyMs(null);
      setLastChecked(new Date());
      return;
    }

    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      const latency = Math.round(performance.now() - startTime);
      setServerLatencyMs(latency);
      setLastChecked(new Date());

      if (res.ok) {
        setIsOnline(true);
        setStatus(latency > 800 ? 'LOW_CONNECTIVITY' : 'ONLINE');
      } else {
        setIsOnline(true);
        setStatus('LOW_CONNECTIVITY');
      }
    } catch {
      // Server unreachable even if browser thinks it's online
      setIsOnline(true); // browser has interface
      setStatus('LOW_CONNECTIVITY'); // but backend is offline/unreachable
      setServerLatencyMs(null);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus('OFFLINE');
      setServerLatencyMs(null);
      setLastChecked(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check and periodic heartbeat every 15 seconds
    checkHealth();
    const interval = setInterval(checkHealth, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return {
    status,
    isOnline,
    lastChecked,
    pendingSyncCount,
    serverLatencyMs
  };
}
