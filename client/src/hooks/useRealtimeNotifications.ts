
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationData {
  type: 'order_update' | 'new_order' | 'table_status';
  message: string;
  data?: any;
}

export function useRealtimeNotifications() {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulation de WebSocket avec polling pour les notifications
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/notifications/poll', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const notifications: NotificationData[] = await response.json();
          notifications.forEach(notification => {
            toast({
              title: "Notification",
              description: notification.message,
              variant: notification.type === 'new_order' ? 'default' : 'destructive'
            });
          });
        }
      } catch (error) {
        console.error('Error polling notifications:', error);
      }
    }, 5000);

    setIsConnected(true);
    return () => {
      clearInterval(pollInterval);
      setIsConnected(false);
    };
  }, [toast]);

  return { isConnected };
}
