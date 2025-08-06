import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { DocumentUpload } from '@/components/upload/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, MessageSquare, FileText, Sparkles } from 'lucide-react';

export const Dashboard = () => {
  const [documentsRefresh, setDocumentsRefresh] = useState(0);

  const handleUploadComplete = () => {
    setDocumentsRefresh(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-chat">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Transform Your Documents with AI
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your PDFs and start intelligent conversations. Ask questions, get insights, 
              and discover information with AI-powered document analysis.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-card border border-border/50">
              <CardHeader className="text-center">
                <div className="mx-auto p-3 bg-gradient-glow rounded-xl w-fit">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Upload Documents</CardTitle>
                <CardDescription>
                  Simply drag and drop your PDF files to get started
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card border border-border/50">
              <CardHeader className="text-center">
                <div className="mx-auto p-3 bg-gradient-glow rounded-xl w-fit">
                  <Sparkles className="w-6 h-6 text-ai-purple" />
                </div>
                <CardTitle className="text-lg">AI Processing</CardTitle>
                <CardDescription>
                  Advanced AI extracts and analyzes your document content
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card border border-border/50">
              <CardHeader className="text-center">
                <div className="mx-auto p-3 bg-gradient-glow rounded-xl w-fit">
                  <MessageSquare className="w-6 h-6 text-ai-cyan" />
                </div>
                <CardTitle className="text-lg">Smart Conversations</CardTitle>
                <CardDescription>
                  Ask questions and get instant, accurate answers with sources
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload and Documents Section */}
            <div className="lg:col-span-1 space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Documents
                </h3>
                <DocumentUpload onUploadComplete={handleUploadComplete} />
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Your Library
                </h3>
                <DocumentList refreshTrigger={documentsRefresh} />
              </div>
            </div>

            {/* Chat Section */}
            <div className="lg:col-span-2">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                AI Conversations
              </h3>
              <ChatInterface documentsRefreshTrigger={documentsRefresh} />
            </div>
          </div>

          {/* Help Section */}
          <Card className="shadow-card border border-ai-blue/20 bg-gradient-glow">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-ai-blue/20 rounded-lg">
                  <Sparkles className="w-5 h-5 text-ai-blue" />
                </div>
                <div>
                  <h4 className="font-semibold text-ai-blue mb-2">Getting Started Tips</h4>
                  <ul className="text-sm text-ai-blue/80 space-y-1">
                    <li>• Upload PDF documents up to 10MB in size</li>
                    <li>• Wait for processing to complete before starting conversations</li>
                    <li>• Ask specific questions to get the most accurate answers</li>
                    <li>• Use multiple conversations to organize different topics</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};