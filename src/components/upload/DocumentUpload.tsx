import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file only.",
          variant: "destructive"
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB.",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const uploadDocument = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique file path
      const fileExtension = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExtension}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Insert document record
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          name: selectedFile.name.replace(/\.[^/.]+$/, ""), // Remove extension
          original_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          status: 'processing'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress(75);

      // Trigger document processing
      const { error: functionError } = await supabase.functions.invoke('process-document', {
        body: { documentId: data.id }
      });

      if (functionError) {
        console.error('Processing function error:', functionError);
        // Update document status to error
        await supabase
          .from('documents')
          .update({ 
            status: 'error', 
            error_message: 'Failed to process document' 
          })
          .eq('id', data.id);
      }

      setUploadProgress(100);

      toast({
        title: "Upload successful!",
        description: "Your document is being processed and will be available for chat shortly.",
      });

      setSelectedFile(null);
      if (onUploadComplete) onUploadComplete();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred while uploading your document.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <Card className="shadow-card border border-border/50">
      <CardContent className="p-6">
        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-smooth
              ${isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? 'Drop your PDF here' : 'Upload your document'}
            </h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop your PDF file here, or click to select
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
              <span>• PDF files only</span>
              <span>• Max 10MB</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
              <FileText className="w-10 h-10 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {!uploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Progress value={uploadProgress} className="flex-1" />
                  <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {uploadProgress < 50 ? 'Uploading...' : 
                   uploadProgress < 75 ? 'Saving to database...' : 
                   'Processing document...'}
                </p>
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                onClick={uploadDocument}
                disabled={uploading}
                className="flex-1 bg-gradient-primary hover:opacity-90"
              >
                {uploading ? 'Processing...' : 'Upload Document'}
              </Button>
              {!uploading && (
                <Button variant="outline" onClick={removeFile}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="flex items-start space-x-2 p-3 bg-ai-blue/10 rounded-lg">
              <AlertCircle className="w-4 h-4 text-ai-blue mt-0.5 flex-shrink-0" />
              <p className="text-sm text-ai-blue">
                After uploading, your document will be processed to enable AI-powered conversations. 
                This may take a few moments depending on the document size.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};