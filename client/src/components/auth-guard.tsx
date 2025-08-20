import { useEffect, useRef } from 'react';
import authService from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const isHandlingError = useRef(false);

  useEffect(() => {
    const handleApiError = (event: CustomEvent) => {
      // Prevent multiple simultaneous error handling
      if (isHandlingError.current) {
        return;
      }

      if (event.detail.status === 401 || event.detail.status === 403) {
        isHandlingError.current = true;
        
        console.log("Auth error detected, logging out user");
        
        try {
          toast({
            title: "Session expirée",
            description: "Veuillez vous reconnecter pour continuer",
            variant: "destructive",
          });
        } catch (toastError) {
          console.warn('Toast error:', toastError);
        }

        // Use setTimeout to prevent React state update conflicts
        setTimeout(() => {
          try {
            authService.logout();
          } catch (logoutError) {
            console.warn('Logout error:', logoutError);
            // Force redirect even if logout fails
            window.location.href = '/login';
          } finally {
            isHandlingError.current = false;
          }
        }, 100);
      }
    };

    window.addEventListener('apiError', handleApiError as EventListener);
    
    return () => {
      window.removeEventListener('apiError', handleApiError as EventListener);
      isHandlingError.current = false;
    };
  }, [toast]);

  return <>{children}</>;
}