import { Dashboard } from "@/components/dashboard/Dashboard";
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Bot, FileText, Zap, Shield } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground text-lg">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  // Landing page for non-authenticated users
  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-primary rounded-full blur-3xl opacity-10 animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-secondary rounded-full blur-3xl opacity-10 animate-pulse delay-1000"></div>
      
      <div className="relative z-10">
        {/* Header */}
        <header className="container py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-primary rounded-xl shadow-glow">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                DocChat AI
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth?mode=signin">
                <Button variant="outline" className="transition-spring hover:scale-105">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button className="bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>
        </header>

        {/* Hero section */}
        <section className="container py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent leading-tight">
              Chat with Your
              <br />
              <span className="bg-gradient-secondary bg-clip-text text-transparent">Documents</span>
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
              Transform your PDFs into intelligent conversations. Upload, ask questions, and get instant AI-powered insights from your documents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/auth?mode=signup">
                <Button 
                  size="lg" 
                  className="bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button text-lg py-6 px-8"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Start Free Today
                </Button>
              </Link>
              <Link to="/auth?mode=signin">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="transition-spring hover:scale-105 text-lg py-6 px-8"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section className="container py-20">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Powerful AI Features
            </h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of document interaction with our advanced AI technology
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-card/80 backdrop-blur-xl border border-border/50 shadow-elegant hover:shadow-hover transition-spring">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-4">AI-Powered Chat</h4>
              <p className="text-muted-foreground">
                Engage in natural conversations with your documents using advanced AI technology
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-card/80 backdrop-blur-xl border border-border/50 shadow-elegant hover:shadow-hover transition-spring">
              <div className="w-16 h-16 bg-gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-4">Smart Processing</h4>
              <p className="text-muted-foreground">
                Upload PDFs and let our AI extract and understand your content automatically
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-card/80 backdrop-blur-xl border border-border/50 shadow-elegant hover:shadow-hover transition-spring">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold mb-4">Secure & Private</h4>
              <p className="text-muted-foreground">
                Your documents are encrypted and secure. Only you have access to your data
              </p>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="container py-20 text-center">
          <div className="max-w-3xl mx-auto p-12 rounded-3xl bg-gradient-card/80 backdrop-blur-xl border border-border/50 shadow-elegant">
            <h3 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Ready to Transform Your Documents?
            </h3>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of users who have revolutionized how they interact with their documents
            </p>
            <Link to="/auth?mode=signup">
              <Button 
                size="lg" 
                className="bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button text-xl py-8 px-12"
              >
                <Zap className="w-6 h-6 mr-3" />
                Get Started Now - It's Free
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Index;
