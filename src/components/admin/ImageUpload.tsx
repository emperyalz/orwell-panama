"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  currentImageUrl?: string;
  onUploaded: (storageId: string) => void | Promise<void>;
  label?: string;
  className?: string;
}

export function ImageUpload({
  currentImageUrl,
  onUploaded,
  label = "Upload Image",
  className = "",
}: ImageUploadProps) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 8_000_000) {
      setError("Usa JPG, PNG, WebP o AVIF de hasta 8 MB.");
      e.target.value = "";
      return;
    }
    setError("");

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload to Convex
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("No se pudo subir la imagen");
      const { storageId } = await response.json();
      if (!storageId) throw new Error("No se recibió el archivo");
      await onUploaded(storageId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo subir la imagen");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  const displayImage = preview || currentImageUrl;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {/* Preview */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)]">
          {displayImage ? (
            <>
              <img
                src={displayImage}
                alt="Preview"
                className="h-full w-full object-cover"
              />
              {preview && (
                <button
                  onClick={() => {
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-[var(--muted-foreground)]" />
            </div>
          )}
        </div>

        {/* Upload button */}
        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />
            {uploading ? "Uploading..." : "Choose File"}
          </button>
          <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
            JPG, PNG, WebP o AVIF. Máximo 8 MB.
          </p>
          {error && <p role="alert" className="mt-1 text-[10px] text-red-600">{error}</p>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
