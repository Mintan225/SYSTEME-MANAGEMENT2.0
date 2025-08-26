
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateTableQRCode, downloadQRCode } from "@/lib/qr-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import authService from "@/lib/auth";

interface Table {
  id: number;
  number: number;
  capacity: number;
  status: string;
  qrCode: string;
}

interface QRGeneratorProps {
  table: Table;
  onDelete: (id: number) => void;
}

export function QRGenerator({ table, onDelete }: QRGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (table.qrCode) {
      generateTableQRCode(table.qrCode)
        .then(setQrCodeUrl)
        .catch((error) => {
          console.error("Error generating QR code:", error);
          toast({
            title: "Erreur",
            description: "Impossible de générer le code QR",
            variant: "destructive",
          });
        });
    }
  }, [table.qrCode, toast]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = authService.getToken();
      if (!token) {
        throw new Error("Token non trouvé");
      }

      const response = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Delete response:", response.status, errorData);
        throw new Error(`Erreur ${response.status}: ${errorData}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Table supprimée avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onDelete(table.id);
    },
    onError: (error) => {
      console.error("Error deleting table:", error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression",
        variant: "destructive",
      });
    },
  });

  const handleDownload = () => {
    if (qrCodeUrl) {
      downloadQRCode(qrCodeUrl, `table-${table.number}-qr.png`);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la table ${table.number} ?`)) {
      deleteMutation.mutate(table.id);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Table {table.number}</span>
          <div className="flex items-center gap-2">
            <Badge variant={table.status === "available" ? "default" : "secondary"}>
              {table.status === "available" ? "Disponible" : "Occupée"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {table.capacity} places
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {qrCodeUrl && (
          <div className="flex justify-center">
            <img
              src={qrCodeUrl}
              alt={`QR Code pour table ${table.number}`}
              className="w-48 h-48 border rounded"
            />
          </div>
        )}
        
        <div className="text-sm text-muted-foreground text-center">
          <p>URL: {table.qrCode}</p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button onClick={handleDownload} disabled={!qrCodeUrl} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Télécharger
          </Button>
          
          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
