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
    if (window.confirm(
      `Êtes-vous sûr de vouloir supprimer la table ${table.number} ?\n\n` +
      `Cette action est irréversible et supprimera définitivement :\n` +
      `- Le QR code de la table\n` +
      `- Toutes les données associées\n\n` +
      `Les commandes actives doivent être terminées avant la suppression.`
    )) {
      deleteMutation.mutate(table.id, {
        onError: (error: any) => {
          // Gestion spécifique des erreurs de suppression
          if (error.message.includes("active orders")) {
            toast({
              title: "Suppression impossible",
              description: "Cette table a des commandes actives. Terminez-les d'abord.",
              variant: "destructive",
            });
          } else if (error.message.includes("constraint")) {
            toast({
              title: "Suppression impossible",
              description: "Cette table est liée à d'autres données du système.",
              variant: "destructive",
            });
          }
        }
      });
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
              {isGenerating ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-xs text-gray-500">Génération...</span>
                </div>
              ) : (
                <QrCode className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </div>
        )}

        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={!qrCodeUrl || isGenerating}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1" />
            Télécharger
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            variant="destructive"
            size="sm"
            className="flex-1"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}