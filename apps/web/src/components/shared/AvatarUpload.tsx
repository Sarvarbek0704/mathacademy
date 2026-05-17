import { useRef, useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Camera, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

function resolveUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE.replace('/api', '')}${url}`;
}

interface AvatarUploadProps {
  currentUrl?: string | null;
  ownerType: 'STUDENT' | 'TEACHER' | 'USER';
  ownerId: string;
  purpose?: string;
  onUploaded?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarUpload({
  currentUrl,
  ownerType,
  ownerId,
  purpose = 'AVATAR',
  onUploaded,
  size = 'md',
  className,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(resolveUrl(currentUrl));

  const sizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  };
  const iconSizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' };
  const cameraSize = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' };
  const badgeSize = { sm: 'h-5 w-5 -bottom-0.5 -right-0.5', md: 'h-6 w-6 -bottom-1 -right-1', lg: 'h-7 w-7 -bottom-1 -right-1' };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Faqat rasm fayllar qabul qilinadi");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fayl hajmi 5MB dan oshmasligi kerak");
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ownerType', ownerType);
      formData.append('ownerId', ownerId);
      formData.append('purpose', purpose);
      formData.append('fileName', file.name);

      const res = await api.post('/staff/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = res.data?.url || res.data?.fileUrl;
      if (uploadedUrl) {
        const resolved = resolveUrl(uploadedUrl);
        if (resolved) setPreviewUrl(resolved);
        onUploaded?.(uploadedUrl);
        toast.success("Rasm yuklandi");
      }
    } catch {
      // error handled by api interceptor
      setPreviewUrl(resolveUrl(currentUrl));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity',
          sizeClasses[size],
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        title="Rasm yuklash uchun bosing"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <User className={cn('text-muted-foreground', iconSizes[size])} />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-full">
            <Loader2 className={cn('animate-spin text-primary', iconSizes[size])} />
          </div>
        )}
      </div>

      {/* Camera badge */}
      <div
        className={cn(
          'absolute rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-sm hover:bg-primary/90 transition-colors',
          badgeSize[size],
        )}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <Camera className={cameraSize[size]} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
