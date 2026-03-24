import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/models';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required.' },
        { status: 400 }
      );
    }

    const maiaProvider = PROVIDERS.maia;
    if (!maiaProvider || !maiaProvider.baseUrl) {
      return NextResponse.json(
        { error: 'Image generation service is not configured.' },
        { status: 500 }
      );
    }

    // Call Maia Router with flux-ultra model for image generation
    const response = await fetch(`${maiaProvider.baseUrl}/images/generations`, {
      method: 'POST',
      headers: maiaProvider.getHeaders(),
      body: JSON.stringify({
        model: 'flux-ultra',
        prompt: prompt.trim(),
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errMsg = err.error?.message || `Image generation failed: ${response.status}`;
      return NextResponse.json({ error: errMsg }, { status: response.status });
    }

    const data = await response.json();

    // Extract image URL from response (OpenAI-compatible format)
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image was generated. Please try a different prompt.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      // If base64, prefix it
      isBase64: !!data.data?.[0]?.b64_json && !data.data?.[0]?.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
