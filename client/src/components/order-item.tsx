import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import  authService  from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { downloadReceipt, type ReceiptData } from "@/lib/receipt-generator";
import { Download } from "lucide-react";

interface OrderItemProps {
  order: {
    id: number;
    tableId: number;
    customerName?: string;
    customerPhone?: string;
    status: string;
    paymentMethod?: string;
    paymentStatus: string;
    total: string;
    notes?: string;
    createdAt: string;
    orderItems: Array<{
      id: number;
      quantity: number;
      price: string;
      notes?: string;
      product: {
        id: number;
        name: string;
        description?: string;
        price: string;
      };
    }>;
  };
}

const statusConfig = {
  pending: { label: "En attente", color: "bg-warning" },
  preparing: { label: "Préparation", color: "bg-primary" },
  ready: { label: "Prêt", color: "bg-success" },
  completed: { label: "Terminé", color: "bg-gray-500" },
  cancelled: { label: "Annulé", color: "bg-destructive" },
};

const paymentStatusConfig = {
  pending: { label: "En attente", color: "bg-warning" },
  paid: { label: "Payé", color: "bg-success" },
  failed: { label: "Échec", color: "bg-destructive" },
};

export function OrderItem({ order }: OrderItemProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, updates }: { orderId: number; updates: any }) => {
      console.log("Updating order:", orderId, "with:", updates);

      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Update failed:", response.status, errorText);

        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { message: `HTTP ${response.status}: ${errorText}` };
        }
        throw new Error(error.message || "Failed to update order");
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("Order updated successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", { active: true }] });

      toast({
        title: "Commande mise à jour",
        description: "Le statut de la commande a été modifié avec succès.",
      });
    },
    onError: (error: Error) => {
      console.error("Order update error:", error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (!newStatus || newStatus === order.status) return;

    const updates: any = { status: newStatus };

    // Auto-completion logic
    if (newStatus === 'completed') {
      updates.paymentStatus = 'paid';
      updates.completedAt = new Date().toISOString();
    }

    updateOrderMutation.mutate({
      orderId: order.id,
      updates,
    });
  };

  const handlePaymentStatusChange = (newPaymentStatus: string) => {
    if (!newPaymentStatus || newPaymentStatus === order.paymentStatus) return;

    updateOrderMutation.mutate({
      orderId: order.id,
      updates: { paymentStatus: newPaymentStatus },
    });
  };

  // Récupérer les tables pour trouver le numéro de table correspondant à l'ID
  const { data: tables = [] } = useQuery({
    queryKey: ["/api/tables"],
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  const tableNumber = tables.find((table: any) => table.id === order.tableId)?.number || order.tableId;

  const safeOrder = {
    ...order,
    status: order.status || 'pending',
    paymentStatus: order.paymentStatus || 'pending',
    customerName: order.customerName || 'Client',
    orderItems: order.orderItems || []
  };

  const handleDownloadReceipt = () => {
    if (!safeOrder.orderItems || safeOrder.orderItems.length === 0) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu : aucun produit commandé",
        variant: "destructive",
      });
      return;
    }

    const receiptData: ReceiptData = {
      orderId: safeOrder.id,
      customerName: safeOrder.customerName || 'Client',
      customerPhone: safeOrder.customerPhone,
      tableNumber: tableNumber,
      items: safeOrder.orderItems.map(item => ({
        name: item.product.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.price) * item.quantity
      })),
      subtotal: parseFloat(safeOrder.total),
      total: parseFloat(safeOrder.total),
      paymentMethod: safeOrder.paymentMethod || 'Espèces',
      paymentDate: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
      restaurantName: 'Mon Restaurant',
      restaurantAddress: 'Adresse du restaurant',
      restaurantPhone: '+225 XX XX XX XX'
    };

    try {
      downloadReceipt(receiptData);
      toast({
        title: "Succès",
        description: "Reçu téléchargé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le reçu",
        variant: "destructive",
      });
    }
  };

  const statusInfo = statusConfig[safeOrder.status as keyof typeof statusConfig];
  const paymentInfo = paymentStatusConfig[safeOrder.paymentStatus as keyof typeof paymentStatusConfig];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold">Commande #{safeOrder.id}</h3>
              <Badge className={`${statusConfig[safeOrder.status as keyof typeof statusConfig]?.color || 'bg-gray-500'} text-white`}>
                {statusConfig[safeOrder.status as keyof typeof statusConfig]?.label || safeOrder.status}
              </Badge>
              <Badge variant={safeOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                {paymentStatusConfig[safeOrder.paymentStatus as keyof typeof paymentStatusConfig]?.label || safeOrder.paymentStatus}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(safeOrder.total)}</p>
            <p className="text-sm text-gray-500">
              {format(new Date(safeOrder.createdAt), "HH:mm", { locale: fr })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">
              <strong>Table:</strong> {tableNumber}
            </p>
            {safeOrder.customerName && (
              <p className="text-sm text-gray-600">
                <strong>Client:</strong> {safeOrder.customerName}
              </p>
            )}
            {safeOrder.customerPhone && (
              <p className="text-sm text-gray-600">
                <strong>Téléphone:</strong> {safeOrder.customerPhone}
              </p>
            )}
          </div>
          <div>
            {safeOrder.paymentMethod && (
              <p className="text-sm text-gray-600">
                <strong>Paiement:</strong> {safeOrder.paymentMethod}
              </p>
            )}
            {safeOrder.notes && (
              <p className="text-sm text-gray-600">
                <strong>Notes:</strong> {safeOrder.notes}
              </p>
            )}
          </div>
        </div>

        {/* Produits commandés */}
        {safeOrder.orderItems && safeOrder.orderItems.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Produits commandés :</h4>
            <div className="space-y-2">
              {safeOrder.orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <span className="font-medium">{item.product.name}</span>
                    {item.notes && (
                      <span className="text-sm text-gray-600 ml-2">({item.notes})</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-600">Qté: {item.quantity}</span>
                    <span className="font-medium">{formatCurrency(item.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          {safeOrder.status !== "completed" && safeOrder.status !== "cancelled" && (
            <div className="flex space-x-2">
              {safeOrder.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("preparing")}
                  disabled={updateOrderMutation.isPending}
                >
                  Commencer préparation
                </Button>
              )}
              {safeOrder.status === "preparing" && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("ready")}
                  disabled={updateOrderMutation.isPending}
                >
                  Marquer comme prêt
                </Button>
              )}
              {safeOrder.status === "ready" && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("completed")}
                  disabled={updateOrderMutation.isPending}
                >
                  Terminer
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStatusChange("cancelled")}
                disabled={updateOrderMutation.isPending}
              >
                Annuler
              </Button>
            </div>
          )}

          {/* Bouton de téléchargement du reçu - disponible pour toutes les commandes payées */}
          {safeOrder.paymentStatus === "paid" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadReceipt}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Télécharger reçu
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}