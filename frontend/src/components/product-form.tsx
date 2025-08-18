// client/components/ProductForm.tsx

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { insertProductSchema } from "@shared/schema";
import authService from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Upload, X } from "lucide-react";

interface Category {
  id: number;
  name: string;
}

const productFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, "Le prix est requis et doit être positif"),
  categoryId: z.coerce.number().min(1, "La catégorie est requise"),
  imageUrl: z.string().url("URL d'image invalide").optional().or(z.literal("")),
  available: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: any;
  onSuccess?: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>(
    product?.imageUrl || ""
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- Charger les catégories ---
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories", {
        headers: authService.getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Impossible de charger les catégories");
      return response.json();
    },
  });

  // --- Form setup ---
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      price: product?.price ? product.price : 0.01,
      categoryId: product?.categoryId || 0,
      imageUrl: product?.imageUrl || "",
      available: product?.available ?? true,
    },
  });

  // --- Création produit ---
  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur API création produit");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Produit créé" });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (err: Error) =>
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      }),
  });

  // --- Mise à jour produit ---
  const updateMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur API modification produit");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Produit modifié" });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setOpen(false);
      onSuccess?.();
    },
    onError: (err: Error) =>
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      }),
  });

  // --- Upload image ---
  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/products/upload-image", {
        method: "POST",
        headers: authService.getAuthHeaders(), // ⚠️ pas de Content-Type ici
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || `Erreur upload (${response.status})`);
      }

      const result = await response.json();
      const imageUrl = result.imageUrl;
      form.setValue("imageUrl", imageUrl);
      setImagePreview(imageUrl);

      toast({ title: "Succès", description: "Image téléchargée" });
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Échec du téléchargement",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast({
        title: "Erreur",
        description: "Fichier invalide",
        variant: "destructive",
      });
    if (file.size > 5 * 1024 * 1024)
      return toast({
        title: "Erreur",
        description: "Image max 5MB",
        variant: "destructive",
      });
    handleImageUpload(file);
  };

  const removeImage = () => {
    form.setValue("imageUrl", "");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (data: ProductFormData) => {
    if (product) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const getCategoryNameById = (id: number | null) => {
    const found = categories.find((c) => c.id === id);
    return found ? found.name : "Sélectionner une catégorie";
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {product ? "Modifier" : "Ajouter un produit"}
      </Button>
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {product ? "Modifier le produit" : "Ajouter un produit"}
            </h2>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Nom */}
              <div>
                <Label>Nom</Label>
                <Input {...form.register("name")} placeholder="Nom produit" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <Textarea {...form.register("description")} />
              </div>

              {/* Prix */}
              <div>
                <Label>Prix (FCFA)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("price", { valueAsNumber: true })}
                />
              </div>

              {/* Catégorie */}
              <div>
                <Label>Catégorie</Label>
                <Select
                  value={form.watch("categoryId")?.toString() || ""}
                  onValueChange={(v) =>
                    form.setValue("categoryId", Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {getCategoryNameById(form.watch("categoryId"))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCategories ? (
                      <SelectItem value="loading" disabled>
                        Chargement...
                      </SelectItem>
                    ) : categories.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Aucune catégorie
                      </SelectItem>
                    ) : (
                      categories.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Image */}
              <div className="space-y-2">
                <Label>Image</Label>
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      className="w-full h-32 object-cover rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  variant="outline"
                >
                  {isUploading ? "Upload..." : <Upload className="h-4 w-4 mr-2" />}
                  {isUploading ? "" : "Choisir une image"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Disponible */}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={form.watch("available")}
                  onCheckedChange={(v) => form.setValue("available", v)}
                />
                <Label>Disponible</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Enregistrement..." : product ? "Modifier" : "Ajouter"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
