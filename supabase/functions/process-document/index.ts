import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";
import { getTextExtractor } from "https://esm.sh/unpdf@1.1.0";

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

    const { documentId } = await req.json();
    console.log('Processing document:', documentId);

    // Get document details
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download document');
    }

    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const extract = await getTextExtractor();
    const arrayBuffer = await fileData.arrayBuffer();
    const data = await extract(new Uint8Array(arrayBuffer), 'application/pdf');
    
    const fullText = data.text;
    const totalPages = data.totalPages || 1;

    console.log(`Extracted text from ${totalPages} pages`);

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GOOGLE_GEMINI_API_KEY') || '');
    const model = genAI.getGenerativeModel({ model: "embedding-001" });

    // Chunk text with sentence awareness
    const chunks = chunkText(fullText, 1000);
    console.log(`Created ${chunks.length} chunks`);

    // Process chunks in batches to avoid rate limits
    const batchSize = 5;
    let totalChunks = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const promises = batch.map(async (chunk, index) => {
        try {
          const result = await model.embedContent(chunk.text);
          const embedding = result.embedding;

          return {
            document_id: documentId,
            user_id: document.user_id,
            content: chunk.text,
            page_number: chunk.page || 1,
            chunk_index: i + index,
            embedding: `[${embedding.values.join(',')}]`,
            token_count: chunk.text.length
          };
        } catch (error) {
          console.error(`Error processing chunk ${i + index}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      const validChunks = batchResults.filter(chunk => chunk !== null);

      if (validChunks.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('document_chunks')
          .insert(validChunks);

        if (insertError) {
          console.error('Error inserting chunks:', insertError);
        } else {
          totalChunks += validChunks.length;
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update document status
    await supabaseClient
      .from('documents')
      .update({
        status: 'completed',
        total_pages: totalPages,
        total_chunks: totalChunks
      })
      .eq('id', documentId);

    console.log(`Successfully processed document with ${totalChunks} chunks`);

    return new Response(
      JSON.stringify({ success: true, chunks: totalChunks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function chunkText(text: string, maxTokens: number): Array<{text: string, page?: number}> {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const potentialChunk = currentChunk + sentence + '. ';
    
    if (potentialChunk.length > maxTokens && currentChunk.length > 0) {
      chunks.push({ text: currentChunk.trim() });
      currentChunk = sentence + '. ';
    } else {
      currentChunk = potentialChunk;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ text: currentChunk.trim() });
  }

  return chunks;
}