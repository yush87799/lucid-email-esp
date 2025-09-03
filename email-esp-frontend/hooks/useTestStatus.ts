'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getTestStatus } from '../lib/api';
import type { TestSessionStatus } from '../types/email';

export function useTestStatus(
  token: string | null,
  opts?: { intervalMs?: number }
) {
  const [data, setData] = useState<TestSessionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const intervalMs = opts?.intervalMs ?? 2500;

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await getTestStatus(token);
      
      // Debounce state updates to avoid flicker
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(() => {
        setData(result);
        setIsLoading(false);
        
        // Stop polling when status is final
        if (result.status === 'parsed' || result.status === 'error') {
          stop();
        }
      }, 100);
      
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        setIsLoading(false);
      }
    }
  }, [token, stop]);

  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!token) {
      setData(null);
      setError(null);
      setIsLoading(false);
      stop();
      return;
    }

    // Initial fetch
    fetchStatus();

    // Start polling
    intervalRef.current = setInterval(fetchStatus, intervalMs);

    // Cleanup on unmount or token change
    return () => {
      stop();
    };
  }, [token, intervalMs, fetchStatus, stop]);

  return {
    data,
    isLoading,
    error,
    refresh,
    stop,
  };
}
