# OpenAI Ephemeral Key Edge Function

This Supabase Edge Function securely generates ephemeral keys for OpenAI's real-time audio API.

## Why This Function Is Needed

According to OpenAI's documentation, ephemeral keys should be generated server-side rather than directly from the client:

> The developer's server uses a standard API key to request an ephemeral key from the OpenAI REST API, and returns that new key to the browser.

This Edge Function acts as that server-side component, keeping your OpenAI API key secure.

## Deployment

1. Install the Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project (if not already linked):
   ```bash
   supabase link --project-ref your-project-ref
   ```
   
4. Set your OpenAI API key as a secret:
   ```bash
   supabase secrets set OPENAI_API_KEY=your-openai-api-key
   ```

5. Deploy the function:
   ```bash
   supabase functions deploy ephemeral-key --no-verify-jwt
   ```

## Usage

The function accepts a POST request with an optional model and voice parameter:

```typescript
fetch('https://your-project-ref.supabase.co/functions/v1/ephemeral-key', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini', // optional
    voice: 'alloy' // optional
  })
})
```

It will return the full response from OpenAI's `/v1/realtime/sessions` endpoint, which includes the ephemeral key.

## Troubleshooting

If you encounter issues:

1. Check that your OpenAI API key is correctly set as a secret.
2. Verify that your OpenAI API key has permissions for the Audio and Speech APIs.
3. Check the Supabase logs with `supabase functions logs ephemeral-key`. 