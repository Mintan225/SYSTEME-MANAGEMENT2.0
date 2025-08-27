import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export async function generateQRCode(
  text: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    ...options,
  };

  try {
    const dataUrl = await QRCode.toDataURL(text, defaultOptions);
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

export function generateTableQRData(tableNumber: number, baseUrl?: string): string {
  // Générer l'URL avec le protocole HTTPS pour une meilleure compatibilité
  let url;
  
  if (baseUrl) {
    url = baseUrl;
  } else {
    // Utiliser HTTPS par défaut pour éviter les problèmes de sécurité sur mobile
    const origin = window.location.origin.replace('http://', 'https://');
    url = `${origin}/menu/${tableNumber}`;
  }
  
  // S'assurer que l'URL est bien formatée
  return url;
}

export async function generateTableQRCode(
  tableNumber: number,
  options?: QRCodeOptions
): Promise<string> {
  const qrData = generateTableQRData(tableNumber);
  
  // Paramètres optimisés pour une meilleure lisibilité sur tous les appareils
  const optimizedOptions = {
    width: 300, // Taille plus grande pour une meilleure lecture
    margin: 4,  // Marge plus importante
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M', // Niveau de correction d'erreur moyen
    ...options,
  };
  
  return generateQRCode(qrData, optimizedOptions);
}

export function downloadQRCode(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  
  // Utiliser click() directement sans ajouter au DOM pour éviter les erreurs
  link.style.display = 'none';
  
  try {
    document.body.appendChild(link);
    link.click();
    
    // Supprimer immédiatement après le clic
    if (link.parentNode === document.body) {
      document.body.removeChild(link);
    }
  } catch (error) {
    console.warn('Error during QR code download:', error);
    // En cas d'erreur, tentative de nettoyage
    try {
      if (link.parentNode === document.body) {
        document.body.removeChild(link);
      }
    } catch (cleanupError) {
      console.warn('Error during cleanup:', cleanupError);
    }
  }
}
