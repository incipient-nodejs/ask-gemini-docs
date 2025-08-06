import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry utility with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const isRetryable = error.message.includes('503') || 
                         error.message.includes('429') || 
                         error.message.includes('500') ||
                         error.message.includes('overloaded') ||
                         error.message.includes('network');
      
      if (!isRetryable) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Gemini API call with retry logic
async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  return await retryWithBackoff(async () => {
    console.log('🤖 Calling Gemini API...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', errorText);
      
      if (response.status === 503) {
        throw new Error(`GEMINI_OVERLOADED: ${errorText}`);
      }
      if (response.status === 429) {
        throw new Error(`GEMINI_RATE_LIMITED: ${errorText}`);
      }
      
      throw new Error(`Gemini API failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    const aiResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiResponse) {
      console.error('❌ No AI response text found in:', responseData);
      throw new Error('No response generated from Gemini');
    }
    
    console.log('✅ Generated Gemini response, length:', aiResponse.length);
    return aiResponse;
  }, 3, 1000);
}

// OpenAI fallback with retry logic
async function callOpenAIFallback(prompt: string, apiKey: string): Promise<string> {
  return await retryWithBackoff(async () => {
    console.log('🔄 Calling OpenAI as fallback...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that answers questions based on provided document context.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error(`OpenAI API failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    const aiResponse = responseData.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('No response generated from OpenAI');
    }
    
    console.log('✅ Generated OpenAI response, length:', aiResponse.length);
    return aiResponse;
  }, 2, 1000);
}

// Generate AI response with fallback logic
async function generateAIResponse(prompt: string): Promise<{ response: string; provider: string }> {
  const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (geminiApiKey) {
    try {
      const response = await callGeminiAPI(prompt, geminiApiKey);
      return { response, provider: 'Gemini' };
    } catch (error) {
      console.error('❌ Gemini failed:', error.message);
      
      if (error.message.includes('GEMINI_OVERLOADED') || error.message.includes('GEMINI_RATE_LIMITED')) {
        console.log('🔄 Gemini overloaded, trying OpenAI fallback...');
        
        if (openaiApiKey) {
          try {
            const response = await callOpenAIFallback(prompt, openaiApiKey);
            return { response, provider: 'OpenAI (fallback)' };
          } catch (fallbackError) {
            console.error('❌ OpenAI fallback also failed:', fallbackError.message);
          }
        }
      }
      
      throw error;
    }
  }

  if (openaiApiKey) {
    try {
      const response = await callOpenAIFallback(prompt, openaiApiKey);
      return { response, provider: 'OpenAI' };
    } catch (error) {
      console.error('❌ OpenAI failed:', error.message);
      throw error;
    }
  }
  
  throw new Error('No AI API keys configured');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message, userId } = await req.json();
    console.log('💬 Chat request:', { sessionId, userId, messageLength: message?.length });
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('❌ Missing Gemini API key');
      throw new Error('Google Gemini API key not configured');
    }
    
    console.log('✅ API key configured, processing message...');

    // Generate embedding for the user's message with retry
    console.log('🔄 Generating embedding for query...');
    const queryEmbedding = await retryWithBackoff(async () => {
      const embeddingResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/embedding-001',
          content: { parts: [{ text: message }] }
        })
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error('❌ Embedding API error:', errorText);
        throw new Error(`Embedding API failed: ${embeddingResponse.status} - ${errorText}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.embedding?.values;

      if (!embedding) {
        console.error('❌ No embedding returned:', embeddingData);
        throw new Error('Failed to generate query embedding');
      }
      
      return embedding;
    }, 3, 1000);
    
    console.log('✅ Generated embedding with', queryEmbedding.length, 'dimensions');

    // **Updated Section: Searching for relevant documents**
    console.log('🔍 Searching for relevant documents...');
    const { data: searchResults, error: searchError } = await supabaseClient.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
      user_id: userId
    });

    let chunks;
    if (searchError) {
      console.error('❌ Search error:', searchError);
      console.log('🔄 Using fallback: getting recent chunks...');
      
      // Fallback to fetching recent document chunks from the user's documents
      const { data: fallbackChunks, error: fallbackError } = await supabaseClient
        .from('document_chunks')
        .select(`
          content,
          page_number,
          documents!inner(title, user_id)  -- Ensure correct join and column reference
        `)
        .eq('documents.user_id', userId)   // Ensure we're filtering by user_id
        .limit(5);                         // Limit the number of chunks returned
      
      if (fallbackError) {
        console.error('❌ Fallback query error:', fallbackError);
        chunks = [];
      } else {
        chunks = fallbackChunks || [];
        console.log('✅ Fallback found', chunks.length, 'chunks');
      }
    } else {
      chunks = searchResults || [];
      console.log('✅ Vector search found', chunks.length, 'chunks');
    }

    // **Improved Fallback Logic**
    if (chunks.length === 0) {
      console.log('⚠️ No relevant document chunks found!');
      return new Response(JSON.stringify({ 
        response: "I couldn't find relevant documents for your query. Please check if the documents are correctly processed.",
        sources: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build context from retrieved chunks
    const context = chunks.map((chunk: any) => chunk.content).join('\n\n');
    const sources = chunks.map((chunk: any) => ({
      document_title: chunk.documents?.title || 'Document',
      chunk_content: chunk.content.substring(0, 100) + '...',
      page_number: chunk.page_number
    }));

    console.log('📄 Built context from', chunks.length, 'chunks, total chars:', context.length);

    if (context.length === 0) {
      console.log('⚠️ No context found, using general response');
      const generalResponse = "I don't have any document content to reference. Please upload some documents first, and make sure they are properly processed.";
      
      await supabaseClient
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: generalResponse,
          sources: []
        });
        
      return new Response(JSON.stringify({ 
        response: generalResponse,
        sources: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate response using AI with fallback
    console.log('🤖 Generating AI response with fallback support...');
    const prompt = `Based on the following context from documents, answer the user's question. If the answer cannot be found in the context, say so clearly.

Context:
${context}

User Question: ${message}

Answer:`;

    let aiResponse: string;
    let provider: string;
    
    try {
      const result = await generateAIResponse(prompt);
      aiResponse = result.response;
      provider = result.provider;
      console.log(`✅ Generated response using ${provider}`);
    } catch (error) {
      console.error('❌ All AI providers failed:', error.message);
      
      let userMessage = "I'm experiencing technical difficulties right now. ";
      
      if (error.message.includes('overloaded') || error.message.includes('503')) {
        userMessage += "The AI service is currently overloaded. Please try again in a few moments.";
      } else if (error.message.includes('rate') || error.message.includes('429')) {
        userMessage += "Too many requests are being processed. Please wait a moment and try again.";
      } else {
        userMessage += "Please try again later or contact support if the issue persists.";
      }
      
      await supabaseClient
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: userMessage,
          sources: []
        });
        
      return new Response(JSON.stringify({ 
        response: userMessage,
        sources: [],
        error: 'AI_SERVICE_UNAVAILABLE'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save assistant message
    console.log('💾 Saving response to database...');
    const { error: saveError } = await supabaseClient
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse,
        sources: sources
      });

    if (saveError) {
      console.error('❌ Error saving message:', saveError);
    } else {
      console.log('✅ Response saved successfully');
    }

    return new Response(JSON.stringify({ 
      response: aiResponse,
      sources: sources,
      provider: provider
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in chat function:', error);
    console.error('❌ Error stack:', error.stack);
    
    const errorMessage = error.message || 'An unexpected error occurred';
    console.log('📤 Returning error response:', errorMessage);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
