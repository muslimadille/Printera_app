import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileImage, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getUploadUrl, getFileUrl } from '@/lib/userApi';

interface MontageUploadProps {
  montageUrl: string;
  onUrlChange: (url: string) => void;
  sessionToken: string;
}

const MontageUpload = ({ montageUrl, onUrlChange, sessionToken }: MontageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('يرجى رفع ملف PDF أو صورة فقط');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الملف يجب أن لا يتجاوز 10 ميجابايت');
      return;
    }

    setUploading(true);
    try {
      const { path, upload_url, token } = await getUploadUrl(sessionToken, file.name);
      
      // Upload directly to signed URL
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');

      // Store the path (not public URL)
      onUrlChange(`storage:${path}`);
      toast.success('تم رفع ملف المونتاج بنجاح');
    } catch (err: any) {
      toast.error('فشل رفع الملف: ' + (err.message || ''));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onUrlChange('');
    setViewUrl(null);
    toast.info('تم إزالة ملف المونتاج');
  };

  const handleView = async () => {
    if (!montageUrl) return;
    try {
      // If it's a storage path, get signed URL
      if (montageUrl.startsWith('storage:')) {
        const filePath = montageUrl.replace('storage:', '');
        const { signed_url } = await getFileUrl(sessionToken, filePath);
        window.open(signed_url, '_blank');
      } else {
        // Legacy public URL
        window.open(montageUrl, '_blank');
      }
    } catch {
      toast.error('فشل تحميل الملف');
    }
  };

  // Get display URL for images
  const getDisplayUrl = async () => {
    if (!montageUrl) return;
    if (montageUrl.startsWith('storage:')) {
      try {
        const filePath = montageUrl.replace('storage:', '');
        const { signed_url } = await getFileUrl(sessionToken, filePath);
        setViewUrl(signed_url);
      } catch {
        setViewUrl(null);
      }
    } else {
      setViewUrl(montageUrl);
    }
  };

  // Load view URL when montageUrl changes
  useState(() => {
    if (montageUrl) getDisplayUrl();
  });

  const isImage = montageUrl?.match(/\.(png|jpg|jpeg|webp)$/i) || 
    (viewUrl && viewUrl.match(/\.(png|jpg|jpeg|webp)/i));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <FileImage className="w-5 h-5" />
          ملف المونتاج (مرجع بصري)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ارفق ملف المونتاج (PDF أو صورة) كمرجع بصري مع التسعيرة
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>رفع ملف</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1"
            />
            {uploading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-2" />}
          </div>
        </div>

        {montageUrl && (
          <div className="border rounded-lg p-3 bg-muted/50 space-y-2">
            <p className="text-sm font-medium text-foreground">الملف المرفق:</p>
            {isImage && viewUrl ? (
              <img
                src={viewUrl}
                alt="مونتاج"
                className="max-h-48 rounded border object-contain mx-auto"
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileImage className="w-4 h-4" />
                <span>ملف PDF مرفق</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleView}
              >
                <ExternalLink className="w-3 h-3" />
                فتح الملف
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1"
                onClick={handleRemove}
              >
                <Trash2 className="w-3 h-3" />
                إزالة
              </Button>
            </div>
          </div>
        )}

        {!montageUrl && !uploading && (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">اضغط لرفع ملف المونتاج</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG — حتى 10 ميجابايت</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MontageUpload;
