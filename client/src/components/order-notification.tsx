import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Clock, CheckCircle, ChefHat, Utensils } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface OrderNotificationProps {
  order: any;
  onClose?: () => void;
}

export function OrderNotification({ order, onClose }: OrderNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-hide notification after 8 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300); // Wait for animation to complete
    }, 8000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getStatusIcon = () => {
    switch (order.status) {
      case 'preparing':
        return <ChefHat className="h-5 w-5 text-yellow-600" />;
      case 'ready':
        return <Utensils className="h-5 w-5 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (order.status) {
      case 'preparing':
        return 'En préparation';
      case 'ready':
        return 'Prête !';
      case 'completed':
        return 'Terminée';
      default:
        return order.status;
    }
  };

  const getStatusColor = () => {
    switch (order.status) {
      case 'preparing':
        return 'bg-yellow-100 border-yellow-300';
      case 'ready':
        return 'bg-green-100 border-green-300';
      case 'completed':
        return 'bg-blue-100 border-blue-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 animate-in slide-in-from-right-full duration-300">
      <Card className={`border-2 shadow-lg ${getStatusColor()}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <h3 className="font-semibold text-gray-900">
                Commande #{order.id}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="mb-2">
              {getStatusText()}
            </Badge>

            <p className="text-sm text-gray-700">
              {order.status === 'preparing' && "🍴 Votre commande est en cours de préparation..."}
              {order.status === 'ready' && "🎉 Votre commande est prête ! Vous pouvez la récupérer."}
              {order.status === 'completed' && "✅ Votre commande a été servie. Merci !"}
            </p>

            <div className="text-xs text-gray-500 mt-2">
              Total: {formatCurrency(order.total || 0)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook pour écouter les mises à jour des commandes avec gestion robuste et polling plus fréquent
export function useOrderNotifications(tableId?: number, customerName?: string, customerPhone?: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [lastOrderStatuses, setLastOrderStatuses] = useState<Record<number, string>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastCheckRef = useRef<number>(0);

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!tableId || tableId === 0 || !customerName) return;

    const checkForUpdates = async () => {
      if (!isMountedRef.current) return;

      try {
        const response = await fetch(`/api/menu/${tableId}?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok || !isMountedRef.current) return;

        const data = await response.json();
        const currentOrders = data.orders || [];

        // Filtrer les commandes pour ce client spécifique avec une logique améliorée
        const customerOrders = currentOrders.filter((order: any) => {
          const nameMatch = customerName && order.customerName?.toLowerCase().trim() === customerName.toLowerCase().trim();
          const phoneMatch = customerPhone && order.customerPhone === customerPhone;

          // Si on a nom ET téléphone, les deux doivent correspondre
          if (customerName && customerPhone) {
            return nameMatch && phoneMatch;
          }
          // Si on a seulement le nom
          else if (customerName) {
            return nameMatch;
          }
          // Si on a seulement le téléphone
          else if (customerPhone) {
            return phoneMatch;
          }

          return false;
        });

        // Créer un log pour débugger
        if (process.env.NODE_ENV === 'development') {
          console.log("🔍 Notification polling:", {
            tableId,
            customerName,
            customerPhone,
            totalOrders: currentOrders.length,
            customerOrders: customerOrders.length,
            timestamp: new Date().toLocaleTimeString()
          });
        }

        // Mettre à jour le statut de connexion et la dernière mise à jour
        if (isMountedRef.current) {
          setIsConnected(true);
          setLastUpdate(new Date());
        }

        // Vérifier les changements de statut
        customerOrders.forEach((order: any) => {
          const previousStatus = lastOrderStatuses[order.id];
          const currentStatus = order.status;

          // Si c'est un changement de statut significatif
          if (previousStatus && 
              previousStatus !== currentStatus && 
              ['preparing', 'ready', 'completed'].includes(currentStatus) &&
              Date.now() - lastCheckRef.current > 1000) { // Éviter les doublons rapides

            const notificationId = `${order.id}-${currentStatus}-${Date.now()}`;

            console.log("🔔 Nouvelle notification:", {
              orderId: order.id,
              fromStatus: previousStatus,
              toStatus: currentStatus,
              customerName: order.customerName,
              notificationId,
              timestamp: new Date().toLocaleTimeString()
            });

            if (isMountedRef.current) {
              setNotifications(prev => {
                // Vérifier si cette notification existe déjà
                const exists = prev.some(n => 
                  n.id === order.id && 
                  n.status === currentStatus &&
                  Date.now() - n.timestamp < 5000 // Dans les 5 dernières secondes
                );

                if (!exists) {
                  const newNotification = { 
                    ...order, 
                    notificationId,
                    timestamp: Date.now(),
                    isStatusChange: true 
                  };

                  // Limiter à 3 notifications maximum
                  const updatedNotifications = [...prev, newNotification];
                  return updatedNotifications.slice(-3);
                }
                return prev;
              });
            }
          }
        });

        // Mettre à jour le cache des statuts
        if (isMountedRef.current) {
          const newStatuses: Record<number, string> = {};
          customerOrders.forEach((order: any) => {
            newStatuses[order.id] = order.status;
          });

          setLastOrderStatuses(newStatuses);
          lastCheckRef.current = Date.now();
        }

      } catch (error) {
        if (isMountedRef.current) {
          console.error("❌ Erreur lors de la vérification des mises à jour:", error);
          setIsConnected(false);
          
          // En cas d'erreur, augmenter légèrement l'intervalle pour éviter le spam
          setTimeout(() => {
            if (isMountedRef.current && intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(checkForUpdates, 3000); // 3 secondes au lieu de 2
            }
          }, 5000); // Attendre 5 secondes avant de reprendre
        }
      }
    };

    // Polling plus agressif: vérifier immédiatement puis toutes les 2 secondes
    console.log("🚀 Démarrage du polling pour notifications:", { tableId, customerName });
    checkForUpdates();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(checkForUpdates, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tableId, customerName, customerPhone]);

  const removeNotification = (notificationId?: string) => {
    if (notificationId && isMountedRef.current) {
      setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
    }
  };

  return {
    notifications,
    removeNotification,
    isConnected,
    lastUpdate
  };
}