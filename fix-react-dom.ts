/**
 * Corrections pour les erreurs DOM React (removeChild)
 * Ces erreurs surviennent généralement lors :
 * 1. Mise à jour d'état pendant démontage de composants
 * 2. Manipulation directe du DOM avec React
 * 3. Conditions de course entre mises à jour d'état
 */

import { useEffect, useRef, useState } from 'react';

// Hook personnalisé pour éviter les mises à jour d'état après démontage
export function useSafeState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setSafeState = (newState: T | ((prevState: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  };

  return [state, setSafeState] as const;
}

// Hook pour éviter les fuites mémoire dans les requêtes async
export function useAbortController() {
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    controllerRef.current = new AbortController();
    
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return controllerRef.current;
}

// Fonction utilitaire pour les requêtes sécurisées
export async function safeFetch(url: string, options: RequestInit = {}, controller?: AbortController) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request was aborted');
      return null;
    }
    throw error;
  }
}

// Composant wrapper pour éviter les erreurs de rendu
export function SafeRender({ children, fallback = null }: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('SafeRender caught error:', error);
    return <>{fallback}</>;
  }
}

// Hook pour nettoyer les event listeners
export function useEventListener<T extends keyof WindowEventMap>(
  type: T,
  listener: (event: WindowEventMap[T]) => void,
  target: Window | Element = window
) {
  useEffect(() => {
    if (target && target.addEventListener) {
      target.addEventListener(type, listener as EventListener);
      return () => {
        target.removeEventListener(type, listener as EventListener);
      };
    }
  }, [type, listener, target]);
}

// Pattern pour les composants qui font des requêtes
export function useDataFetching<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [data, setData] = useSafeState<T | null>(null);
  const [isLoading, setIsLoading] = useSafeState(true);
  const [error, setError] = useSafeState<Error | null>(null);
  const controller = useAbortController();

  useEffect(() => {
    if (!controller) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await fetchFn();
        
        if (controller && !controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (controller && !controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (controller && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
  }, deps);

  return { data, isLoading, error };
}
