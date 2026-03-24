const fetch = require('node-fetch');

// "NanoBanana" was the 🍌 emoji icon on Google AI Studio's image generation page.
// The actual product is Imagen 4 / Gemini Flash Image via the Gemini API.
//
// Two modes:
//   - MERGE mode: uses gemini-2.5-flash-image (takes image inputs → outputs image)
//     Perfect for iris-to-iris merging where we supply the two iris photos.
//   - GENERATE mode: uses imagen-4.0-generate-001 (text-to-image only)
//     Used for reference image generation from prompts without input images.

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MERGE_MODEL = 'gemini-2.5-flash-image';
const GENERATE_MODEL = 'imagen-4.0-generate-001';

const GENERIC_IRIS_PREFIX = `Take the iris only. Make sure the iris is round and fully showing in case the eye isn't fully open. Do not change the color of the iris, but feel free to make it more defined with enhanced color depth and ultrarealistic detail. Preserve the natural texture and patterns (crypts, furrows, collarette) of each iris. Ensure high-resolution output with sharp focus on iris details. Maintain proper circular geometry with clean limbal ring definition.`;

class NanoBananaService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Prepend the generic iris processing prefix to any template prompt.
   */
  buildIrisPrompt(templatePrompt) {
    return `${GENERIC_IRIS_PREFIX}\n\n${templatePrompt}`;
  }

  /**
   * Generate a merged iris image using Gemini Flash Image.
   * Accepts the two iris images as input, outputs a merged result.
   *
   * @param {string} prompt - Full artistic prompt (use buildIrisPrompt)
   * @param {Array<{buffer: Buffer, mimeType: string}>} inputImages - The two iris image buffers
   * @returns {Promise<Buffer>} Generated image as a buffer
   */
  async generateImage(prompt, inputImages = []) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `${GEMINI_API_BASE}/${MERGE_MODEL}:generateContent?key=${this.apiKey}`;

    // Build multimodal parts: text prompt + input iris images
    const parts = [{ text: prompt }];

    for (const img of inputImages) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType || 'image/jpeg',
          data: img.buffer.toString('base64'),
        },
      });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 120000,
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        const errorJson = await response.json();
        errorBody = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorBody = await response.text();
      }
      throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();

    // Parse Gemini generateContent response
    const candidates = result.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
    }

    throw new Error('Gemini API returned no image in response');
  }

  /**
   * Generate a reference/preview image using Imagen 4 (text-to-image).
   * Used for admin template previews where no real iris photos exist yet.
   *
   * @param {string} templatePrompt - Template's artistic prompt
   * @returns {Promise<Buffer>} Generated reference image buffer
   */
  async generateReferenceImage(templatePrompt) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const prompt = this.buildIrisPrompt(
      `${templatePrompt} Reference example using artistic placeholder irises.`
    );

    const url = `${GEMINI_API_BASE}/${GENERATE_MODEL}:predict?key=${this.apiKey}`;

    const payload = {
      instances: [{ prompt }],
      parameters: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/png',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 120000,
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        const errorJson = await response.json();
        errorBody = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorBody = await response.text();
      }
      throw new Error(`Imagen API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();

    // Imagen 4 response: { predictions: [{ bytesBase64Encoded: "..." }] }
    const predictions = result.predictions || [];
    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      return Buffer.from(predictions[0].bytesBase64Encoded, 'base64');
    }

    throw new Error('Imagen API returned no image in response');
  }
}

module.exports = new NanoBananaService();
