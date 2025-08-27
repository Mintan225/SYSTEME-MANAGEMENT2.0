import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateTableQRCode, downloadQRCode } from "@/lib/qr-utils";
import { useToast } from "@/hooks/use-toast";
import authService from "@/lib/auth";
import { Download, QrCode, Trash2 } from "lucide-react";

interface Table {
  id: number;
  number: number;
  capacity: number;
  status: string;
  qrCode: string;
}

interface QRGeneratorProps {
  table: Table;
}

export function QRGenerator({ table }: QRGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    generateQR();
  }, [table.number]);

  const generateQR = async () => {
    setIsGenerating(true);
    try {
      const qrUrl = await generateTableQRCode(table.number, {
        width: 200,
        margin: 2,
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le code QR",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
        headers: authService.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur lors de la suppression");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Table supprimée avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tables"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = () => {
    if (qrCodeUrl) {
      downloadQRCode(qrCodeUrl, `table-${table.number}-qr.png`);
      toast({
        title: "Succès",
        description: "QR code téléchargé",
      });
    }
  };

  const handleDelete = () => {
    if (window.confirm(
      `Êtes-vous sûr de vouloir supprimer la table ${table.number} ?\n\n` +
      `Cette action est irréversible et supprimera définitivement :\n` +
      `- Le QR code de la table\n` +
      `- Toutes les données associées\n\n` +
      `Les commandes actives doivent être terminées avant la suppression.`
    )) {
      deleteMutation.mutate(table.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-success";
      case "occupied":
        return "bg-warning";
      case "reserved":
        return "bg-primary";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "Disponible";
      case "occupied":
        return "Occupée";
      case "reserved":
        return "Réservée";
      default:
        return status;
    }
  };

  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Table {table.number}</span>
          <Badge className={`${getStatusColor(table.status)} text-white`}>
            {getStatusLabel(table.status)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          {isGenerating ? (
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <QrCode className="h-8 w-8 text-gray-400 animate-pulse" />
            </div>
          ) : qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt={`QR Code Table ${table.number}`}
              className="w-32 h-32 border rounded-lg"
            />
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <QrCode className="h-8 w-8 text-gray-400" />
            </div>
          )}

          <div className="text-sm text-gray-600">
            <p>Capacité: {table.capacity} personnes</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
            <Button
              size="sm"
              variant="outline"
              onClick={generateQR}
              disabled={isGenerating}
            >
              <QrCode className="h-4 w-4 mr-1" />
              Régénérer
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!qrCodeUrl || isGenerating}
            >
              <Download className="h-4 w-4 mr-1" />
              Télécharger
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
