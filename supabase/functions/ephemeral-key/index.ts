import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the OpenAI key from environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    // Get parameters from request if needed
    let model = 'gpt-4o-mini-realtime-preview';
    let voice = 'verse';

    // Allow overriding parameters via request body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.model) {
          // Map generic names to realtime preview counterparts expected by the Realtime API
          const requested = String(body.model);
          if (requested === 'gpt-4o') {
            model = 'gpt-4o-mini-realtime-preview';
          } else if (requested === 'gpt-4o-mini') {
            model = 'gpt-4o-mini-realtime-preview';
          } else {
            model = requested;
          }
        }
        if (body.voice) voice = body.voice;
      } catch (error) {
        // Continue with defaults if JSON parsing fails
        console.error('Failed to parse request body:', error);
      }
    }

    // Request ephemeral key from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Return the response with CORS headers
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error:', err.message);

    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
