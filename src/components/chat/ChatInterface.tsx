import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Plus, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatInterfaceProps {
  documentsRefreshTrigger?: number;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ documentsRefreshTrigger }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [hasDocuments, setHasDocuments] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if user has processed documents
  const checkForDocuments = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .limit(1);
      
      setHasDocuments((data?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking documents:', error);
    }
  };

  // Fetch conversations
  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (user) {
      checkForDocuments();
      fetchConversations();
    }
  }, [user, documentsRefreshTrigger]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
    } else {
      setMessages([]);
    }
  }, [activeConversation]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewConversation = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: `New Chat ${conversations.length + 1}`
        })
        .select()
        .single();

      if (error) throw error;
      
      setConversations(prev => [data, ...prev]);
      setActiveConversation(data.id);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error creating conversation",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversation === conversationId) {
        setActiveConversation(null);
      }

      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed.",
      });
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error deleting conversation",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !user || !activeConversation || loading) return;
    if (!hasDocuments) {
      toast({
        title: "No documents available",
        description: "Please upload and wait for a document to be processed before chatting.",
        variant: "destructive"
      });
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    try {
      // Add user message to local state immediately
      const tempUserMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMessage]);

      // Save user message to database
      const { data: userMsgData, error: userMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation,
          user_id: user.id,
          role: 'user',
          content: userMessage
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Replace temp message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempUserMessage.id ? userMsgData as Message : msg
      ));

      // Get AI response
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chat-with-documents', {
        body: { 
          message: userMessage,
          sessionId: activeConversation,
          userId: user.id
        }
      });

      if (aiError) throw aiError;

      // Add AI response to messages
      const { data: aiMsgData, error: aiMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation,
          user_id: user.id,
          role: 'assistant',
          content: aiResponse.response,
          sources: aiResponse.sources || null
        })
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;

      setMessages(prev => [...prev, aiMsgData as Message]);

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        const title = userMessage.length > 50 
          ? userMessage.substring(0, 50) + '...' 
          : userMessage;
        
        await supabase
          .from('conversations')
          .update({ title })
          .eq('id', activeConversation);
        
        setConversations(prev => prev.map(c => 
          c.id === activeConversation ? { ...c, title } : c
        ));
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Error sending message",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
      
      // Remove the temp user message on error
      setMessages(prev => prev.filter(msg => msg.id !== `temp-${Date.now()}`));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-[600px] lg:h-[700px] bg-gradient-card/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-elegant overflow-hidden">
      {/* Conversations Sidebar */}
      <div className="hidden md:flex md:w-80 lg:w-96 border-r border-border/50 bg-background/40 backdrop-blur-sm flex-col">
        <div className="p-4 border-b border-border/50">
          <Button 
            onClick={createNewConversation}
            className="w-full bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button text-sm font-medium"
            disabled={!hasDocuments}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-6 text-center">
              <LoadingSpinner size="sm" />
              <p className="text-sm text-muted-foreground mt-3">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/60" />
              <p className="text-base font-medium text-muted-foreground mb-1">No conversations yet</p>
              <p className="text-sm text-muted-foreground/80">
                {hasDocuments ? '✨ Start your first AI conversation' : '📄 Upload a document to begin'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-spring mb-2 hover:shadow-card",
                      activeConversation === conversation.id
                        ? "bg-gradient-primary/10 border border-primary/20 shadow-card"
                        : "hover:bg-muted/50 hover:backdrop-blur-sm"
                    )}
                    onClick={() => setActiveConversation(conversation.id)}
                  >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conversation.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conversation.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive ml-2"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Start a conversation</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Ask questions about your uploaded documents
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] md:max-w-[80%] p-4 rounded-2xl shadow-card transition-spring",
                          message.role === 'user'
                            ? "bg-gradient-primary text-white shadow-button"
                            : "bg-background/80 backdrop-blur-sm border border-border/50"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/30">
                            <p className="text-xs opacity-80 mb-2">Sources:</p>
                            {message.sources.map((source: any, index: number) => (
                              <div key={index} className="flex items-center space-x-2 text-xs opacity-80">
                                <ExternalLink className="w-3 h-3" />
                                <span>{source.document_name} (Page {source.page_number})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <p className={cn(
                          "text-xs mt-2 opacity-70",
                          message.role === 'user' ? "text-right" : "text-left"
                        )}>
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted border border-border/50 p-3 rounded-lg">
                        <LoadingSpinner size="sm" />
                        <p className="text-sm text-muted-foreground ml-2">AI is thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 md:p-6 border-t border-border/50 bg-background/20 backdrop-blur-sm">
              <div className="flex space-x-3">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={hasDocuments ? "💭 Ask anything about your documents..." : "📄 Upload a document first to start chatting"}
                  disabled={loading || !hasDocuments}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 text-base py-3 px-4 bg-background/50 border-border/50 focus:border-primary/50 transition-spring"
                />
                <Button 
                  onClick={sendMessage}
                  disabled={loading || !inputMessage.trim() || !hasDocuments}
                  className="bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button px-6 py-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-6">
            <div className="max-w-md">
              <div className="mb-6">
                <MessageCircle className="w-20 h-20 mx-auto mb-4 text-muted-foreground/60" />
                <h3 className="text-2xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent">
                  Welcome to DocChat AI
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {hasDocuments 
                    ? '🚀 Select a conversation or start a new one to begin your intelligent document chat experience.'
                    : '📄 Upload your first document to unlock the power of AI-driven document conversations.'
                  }
                </p>
              </div>
              {hasDocuments && (
                <Button 
                  onClick={createNewConversation}
                  className="bg-gradient-primary hover:opacity-90 transition-spring btn-animate shadow-button text-lg py-6 px-8"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Start New Conversation
                </Button>
              )}
              {/* Mobile hint */}
              <div className="md:hidden mt-6 p-4 bg-gradient-glow rounded-xl border border-border/50">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> Rotate your device or use a larger screen for the best chat experience
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};