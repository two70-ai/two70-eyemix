const fetch = require('node-fetch');
const FormData = require('form-data');

const GENERIC_IRIS_PREFIX = `Take the iris only. Make sure the iris is round and fully showing in case the eye isn't fully open. Do not change the color of the iris, but feel free to make it more defined with enhanced color depth and ultrarealistic detail. Preserve the natural texture and patterns (crypts, furrows, collarette) of each iris. Ensure high-resolution output with sharp focus on iris details. Maintain proper circular geometry with clean limbal ring definition.`;

class NanoBananaService {
  constructor() {
    this.apiKey = process.env.NANOBANANA_API_KEY;
    this.apiUrl = process.env.NANOBANANA_API_URL || 'https://api.nanobanana.com/v1/generate';
  }

  /**
   * Prepend the generic iris processing prefix to any template prompt
   * @param {string} templatePrompt - The specific artistic prompt from the template
   * @returns {string} Full prompt with iris prefix
   */
  buildIrisPrompt(templatePrompt) {
    return `${GENERIC_IRIS_PREFIX}\n\n${templatePrompt}`;
  }

  /**
   * Convert a buffer to a base64 data URL
   * @param {Buffer} buffer - Image buffer
   * @param {string} mimeType - MIME type of the image
   * @returns {string} Base64 data URL
   */
  bufferToBase64(buffer, mimeType = 'image/jpeg') {
    const base64 = buffer.toString('base64');
    return `data:${mimeType}:base64,${base64}`;
  }

  /**
   * Generate a merged iris image using the NanoBanana API
   * @param {string} prompt - Full prompt (use buildIrisPrompt to build it)
   * @param {Array<{buffer: Buffer, mimeType: string}>} inputImages - Array of iris image buffers
   * @returns {Promise<Buffer>} Generated image as a buffer
   */
  async generateImage(prompt, inputImages = []) {
    if (!this.apiKey) {
      throw new Error('NanoBanana API key not configured');
    }

    // Build request payload
    const payload = {
      prompt,
      model: 'iris-merge-v1',
      width: 2480,
      height: 3508,
      quality: 'high',
      output_format: 'png',
    };

    // Attach input images if provided
    if (inputImages && inputImages.length > 0) {
      payload.input_images = inputImages.map((img, index) => ({
        id: `iris_${index + 1}`,
        data: img.buffer.toString('base64'),
        mime_type: img.mimeType || 'image/jpeg',
      }));
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 120000, // 2 minutes timeout for AI generation
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        const errorJson = await response.json();
        errorBody = errorJson.error || errorJson.message || JSON.stringify(errorJson);
      } catch {
        errorBody = await response.text();
      }
      throw new Error(`NanoBanana API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();

    // Handle different response formats
    if (result.image_url) {
      // URL-based response: fetch the image
      const imgResponse = await fetch(result.image_url);
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch generated image from URL: ${imgResponse.status}`);
      }
      return Buffer.from(await imgResponse.arrayBuffer());
    } else if (result.image_base64 || result.data) {
      // Base64-based response
      const base64Data = result.image_base64 || result.data;
      // Strip data URL prefix if present
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      return Buffer.from(cleanBase64, 'base64');
    } else if (result.images && result.images.length > 0) {
      // Array response (some APIs return arrays)
      const firstImage = result.images[0];
      if (typeof firstImage === 'string') {
        const cleanBase64 = firstImage.replace(/^data:image\/[a-z]+;base64,/, '');
        return Buffer.from(cleanBase64, 'base64');
      }
      if (firstImage.url) {
        const imgResponse = await fetch(firstImage.url);
        return Buffer.from(await imgResponse.arrayBuffer());
      }
      if (firstImage.b64_json) {
        return Buffer.from(firstImage.b64_json, 'base64');
      }
    }

    throw new Error('Unexpected API response format: no image data found');
  }

  /**
   * Generate a reference image using placeholder iris images (solid colored circles)
   * @param {string} templatePrompt - Template's artistic prompt
   * @returns {Promise<Buffer>} Generated reference image buffer
   */
  async generateReferenceImage(templatePrompt) {
    const prompt = this.buildIrisPrompt(
      `${templatePrompt} Reference example using placeholder irises.`
    );

    // Create simple placeholder iris buffers (SVG-based colored circles)
    const placeholderIrisA = this.createPlaceholderIrisSVG('#4a90d9', '#1a3d6b');
    const placeholderIrisB = this.createPlaceholderIrisSVG('#7b4fa6', '#3d1a6b');

    return this.generateImage(prompt, [
      { buffer: Buffer.from(placeholderIrisA), mimeType: 'image/svg+xml' },
      { buffer: Buffer.from(placeholderIrisB), mimeType: 'image/svg+xml' },
    ]);
  }

  /**
   * Create a simple SVG placeholder iris image
   * @param {string} primaryColor - Main iris color
   * @param {string} secondaryColor - Pupil color
   * @returns {string} SVG markup string
   */
  createPlaceholderIrisSVG(primaryColor, secondaryColor) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <defs>
        <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:${secondaryColor};stop-opacity:1" />
          <stop offset="30%" style="stop-color:${primaryColor};stop-opacity:1" />
          <stop offset="70%" style="stop-color:${primaryColor};stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#111;stop-opacity:1" />
        </radialGradient>
        <radialGradient id="pupilGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#333;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#000;stop-opacity:1" />
        </radialGradient>
      </defs>
      <!-- Sclera (white of eye) -->
      <ellipse cx="256" cy="256" rx="240" ry="180" fill="#f0f0f0"/>
      <!-- Iris -->
      <circle cx="256" cy="256" r="130" fill="url(#irisGrad)"/>
      <!-- Iris texture lines -->
      <circle cx="256" cy="256" r="130" fill="none" stroke="${primaryColor}" stroke-width="1" stroke-dasharray="3,8" opacity="0.5"/>
      <circle cx="256" cy="256" r="100" fill="none" stroke="${secondaryColor}" stroke-width="1" stroke-dasharray="2,6" opacity="0.4"/>
      <circle cx="256" cy="256" r="70" fill="none" stroke="${primaryColor}" stroke-width="1" stroke-dasharray="2,4" opacity="0.3"/>
      <!-- Pupil -->
      <circle cx="256" cy="256" r="45" fill="url(#pupilGrad)"/>
      <!-- Limbal ring -->
      <circle cx="256" cy="256" r="130" fill="none" stroke="#111" stroke-width="8"/>
      <!-- Highlight -->
      <ellipse cx="230" cy="220" rx="18" ry="12" fill="white" opacity="0.6" transform="rotate(-30 230 220)"/>
    </svg>`;
  }
}

module.exports = new NanoBananaService();
