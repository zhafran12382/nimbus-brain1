import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Image generation endpoint using flux-ultra model via Maia Router.
 * Uses the Maia Router API internally — Maia is NOT exposed in the UI provider dropdown.
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide an image description.' },
        { status: 400 }
      );
    }

    const maiaBaseUrl = process.env.MAIA_BASE_URL;
    const maiaApiKey = process.env.MAIA_API_KEY;

    if (!maiaBaseUrl || !maiaApiKey) {
      return NextResponse.json(
        { error: 'Image generation service is not configured.' },
        { status: 500 }
      );
    }

    const response = await fetch(`${maiaBaseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${maiaApiKey}`,
      },
      body: JSON.stringify({
        model: 'flux-ultra',
        prompt: prompt.trim(),
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errorMessage = err.error?.message || `Image generation failed: ${response.status}`;
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();

    // Extract image URL from response (standard OpenAI-compatible format)
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image was generated. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      is_base64: !!data.data?.[0]?.b64_json && !data.data?.[0]?.url,
      prompt: prompt.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
