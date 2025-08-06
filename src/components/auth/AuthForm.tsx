import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { Bot, Mail, Lock, User } from 'lucide-react';

export const AuthForm = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'signin';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const isSignUp = mode === 'signup';
  const isForgotPassword = mode === 'forgot';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        await resetPassword(formData.email);
      } else if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (!error) {
          navigate('/auth?mode=signin');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (!error) {
          navigate('/');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-primary rounded-full blur-3xl opacity-10 animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-secondary rounded-full blur-3xl opacity-10 animate-pulse delay-1000"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center mb-8 animate-bounce">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-primary rounded-2xl shadow-button transform transition-spring hover:scale-110">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                DocChat AI
              </h1>
              <p className="text-sm text-muted-foreground">Intelligent document conversations</p>
            </div>
          </div>
        </div>

        <Card className="shadow-elegant border-0 bg-gradient-card/80 backdrop-blur-xl glass transform transition-spring hover:shadow-hover">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl text-center font-bold">
              {isForgotPassword 
                ? '🔐 Reset Password' 
                : isSignUp 
                ? '🚀 Create Account' 
                : '👋 Welcome Back'
              }
            </CardTitle>
            <CardDescription className="text-center text-base">
              {isForgotPassword 
                ? 'Enter your email address and we\'ll send you a secure reset link'
                : isSignUp 
                ? 'Join thousands of users who chat with their documents using AI' 
                : 'Sign in to continue your intelligent document conversations'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="pl-10"
                      required={isSignUp}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button text-lg py-6" 
                disabled={loading}
              >
                {loading ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : null}
                {isForgotPassword 
                  ? '📧 Send Reset Link' 
                  : isSignUp 
                  ? '🎉 Create My Account' 
                  : '✨ Sign Me In'
                }
              </Button>
            </form>

            <div className="space-y-3 text-center">
              {!isForgotPassword && (
                <Link 
                  to="/auth?mode=forgot" 
                  className="text-primary hover:text-primary-glow transition-smooth font-medium inline-flex items-center space-x-1 hover:underline"
                >
                  <span>🔐</span>
                  <span>Forgot your password?</span>
                </Link>
              )}
              
              <div className="pt-4 border-t border-border/50">
                {isSignUp ? (
                  <p className="text-muted-foreground">
                    Already have an account?{' '}
                    <Link to="/auth?mode=signin" className="text-primary hover:text-primary-glow transition-smooth font-semibold hover:underline">
                      Sign in here
                    </Link>
                  </p>
                ) : !isForgotPassword ? (
                  <p className="text-muted-foreground">
                    New to DocChat AI?{' '}
                    <Link to="/auth?mode=signup" className="text-primary hover:text-primary-glow transition-smooth font-semibold hover:underline">
                      Create your account
                    </Link>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Remember your password?{' '}
                    <Link to="/auth?mode=signin" className="text-primary hover:text-primary-glow transition-smooth font-semibold hover:underline">
                      Sign in instead
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};