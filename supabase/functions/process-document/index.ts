import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@1.1.0';

// Enhanced text chunking function with better logic
function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 200): { content: string; startIndex: number; endIndex: number }[] {
  const chunks: { content: string; startIndex: number; endIndex: number }[] = [];
  
  if (!text || text.length === 0) {
    return chunks;
  }
  
  // Clean the text - remove excessive whitespace but preserve structure
  const cleanText = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .trim();
  
  if (cleanText.length <= maxChunkSize) {
    return [{ content: cleanText, startIndex: 0, endIndex: cleanText.length }];
  }
  
  // Split by sentences first
  const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let currentStartIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
    
    if (potentialChunk.length > maxChunkSize && currentChunk.length > 0) {
      // Save current chunk
      const endIndex = currentStartIndex + currentChunk.length;
      chunks.push({
        content: currentChunk.trim(),
        startIndex: currentStartIndex,
        endIndex: endIndex
      });
      
      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + ' ' + sentence;
      currentStartIndex = Math.max(0, endIndex - overlap);
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startIndex: currentStartIndex,
      endIndex: currentStartIndex + currentChunk.length
    });
  }
  
  // Filter out chunks that are too short to be meaningful
  return chunks.filter(chunk => chunk.content.length > 50);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get document info
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError) throw downloadError;

    console.log('📄 Processing PDF with unpdf library...');
    
    // Use unpdf library for proper PDF text extraction
    const pdfBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(pdfBuffer);
    
    console.log('📋 Loading PDF document...');
    const pdf = await getDocumentProxy(uint8Array);
    
    console.log('📝 Extracting text from PDF...');
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    
    console.log(`📄 PDF processed: ${totalPages} pages, ${text.length} characters`);
    
    if (!text || text.length < 10) {
      throw new Error('No readable text found in PDF. The PDF may be image-based or corrupted.');
    }
    
    // Split text into intelligent chunks
    const textChunks = chunkText(text, 1000, 200);
    console.log(`🔢 Created ${textChunks.length} chunks from text`);
    
    // Prepare chunks for processing with better metadata
    const chunks = textChunks.map((chunkData, index) => ({
      content: chunkData.content,
      page: Math.ceil((chunkData.startIndex / text.length) * totalPages) || 1,
      index,
      startIndex: chunkData.startIndex,
      endIndex: chunkData.endIndex
    }));

    // Generate embeddings for each chunk using Google Gemini
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔢 Processing chunk ${i + 1}/${chunks.length}`);
      
      try {
        // Generate embedding
        const embeddingResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/embedding-001',
            content: { parts: [{ text: chunk.content }] }
          })
        });

        if (!embeddingResponse.ok) {
          console.error('❌ Embedding API error:', await embeddingResponse.text());
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.embedding?.values;

        if (!embedding) {
          console.error('❌ No embedding generated for chunk', i);
          continue;
        }

        console.log(`✅ Generated embedding for chunk ${i + 1}, dimension:`, embedding.length);

        // Store chunk with embedding and enhanced metadata in the 'document_chunks' table
        const { error: insertError } = await supabaseClient
          .from('document_chunks')
          .insert({
            document_id: documentId,
            chunk_index: i,
            content: chunk.content,
            page_number: chunk.page,
            embedding: embedding,
            token_count: chunk.content.split(' ').length,  // Calculate token count
            user_id: document.user_id,  // Link user ID from the document
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('❌ Failed to insert chunk:', insertError);
          throw insertError;
        }

        console.log(`✅ Stored chunk ${i + 1} in database`);
      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${i + 1}:`, chunkError);
        continue;
      }
    }

    // Update document status
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({
        status: 'completed',
        total_chunks: chunks.length,
        total_pages: totalPages
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('❌ Failed to update document status:', updateError);
      throw updateError;
    }

    console.log('✅ Document processing completed successfully');
    console.log(`📊 Total chunks stored: ${chunks.length}`);

    return new Response(JSON.stringify({ 
      success: true, 
      chunksProcessed: chunks.length,
      totalPages: totalPages,
      textLength: text.length,
      extractionMethod: 'unpdf'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error processing document:', error);
    
    // Try to update document status to failed
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { documentId } = await req.json();
      await supabaseClient
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', documentId);
    } catch (updateError) {
      console.error('❌ Failed to update document status to failed:', updateError);
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
