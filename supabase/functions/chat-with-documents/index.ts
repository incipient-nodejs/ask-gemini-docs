import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message, conversationId } = await req.json();
    console.log('Processing chat message:', message);

    // Get user from conversation
    const { data: conversation } = await supabaseClient
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GOOGLE_GEMINI_API_KEY') || '');
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const chatModel = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Generate embedding for user question
    const questionEmbedding = await embeddingModel.embedContent(message);
    const embeddingVector = `[${questionEmbedding.embedding.values.join(',')}]`;

    // Search for relevant document chunks
    const { data: chunks, error: searchError } = await supabaseClient.rpc(
      'match_documents',
      {
        query_embedding: embeddingVector,
        match_threshold: 0.7,
        match_count: 5,
        user_id_param: conversation.user_id
      }
    );

    if (searchError) {
      console.error('Search error:', searchError);
    }

    let context = '';
    let sources = [];

    if (chunks && chunks.length > 0) {
      context = chunks.map((chunk: any) => chunk.content).join('\n\n');
      sources = chunks.map((chunk: any) => ({
        document_name: chunk.document_name,
        page_number: chunk.page_number,
        chunk_content: chunk.content.substring(0, 200) + '...'
      }));
    }

    // Generate response using Gemini
    const prompt = context 
      ? `Based on the following document content, please answer the user's question. If the answer is not in the provided content, say so clearly.

Document content:
${context}

User question: ${message}

Please provide a helpful and accurate answer based only on the information provided in the document content above. If you reference specific information, be clear about it.`
      : `I don't have any document content to reference for your question: "${message}". Please upload some documents first so I can help answer questions based on their content.`;

    const result = await chatModel.generateContent(prompt);
    const response = result.response.text();

    return new Response(
      JSON.stringify({ 
        response,
        sources: context ? sources : []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});