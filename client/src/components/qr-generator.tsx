import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateTableQRCode, downloadQRCode } from "@/lib/qr-utils";
import { useToast } from "@/hooks/use-toast";
import authService from "@/lib/auth";
import { Download, Trash2, QrCode } from "lucide-react";
import type { Table } from "@shared/schema";

interface QRGeneratorProps {
  table: Table;
}

export function QRGenerator({ table }: QRGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateQR = async () => {
    setIsGenerating(true);
    try {
      const qrUrl = await generateTableQRCode(table.number);
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le code QR",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    generateQR();
  }, [table.number]);

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
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la table ${table.number} ?`)) {
      deleteMutation.mutate(table.id);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-center text-lg">
          Table {table.number}
        </CardTitle>
        <p className="text-sm text-gray-500 text-center">
          Capacité: {table.capacity} personnes
        </p>
        <p className="text-xs text-blue-600 text-center break-all">
          {table.qrCode}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {qrCodeUrl ? (
          <div className="flex justify-center">
            <img 
              src={qrCodeUrl} 
              alt={`QR Code Table ${table.number}`}
              className="w-32 h-32 border rounded-md"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-32 h-32 bg-gray-100 border rounded-md flex items-center justify-center">
              <QrCode className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
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
              variant="outline"
              onClick={() => {
                const testUrl = generateTableQRData(table.number);
                window.open(testUrl, '_blank');
              }}
            >
              🔗 Tester
            </Button>
          </div>

          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteMutation.isPending ? "Suppression..." : "Supprimer la table"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}