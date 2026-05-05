import * as FileSystem from 'expo-file-system/legacy';

import { GEMINI_API_KEY } from './config';

const USE_DEMO_MODE = false;

export interface GeminiAnalysisResult {
  imageComplete: boolean;
  completenessNote: string;
  hasDamage: boolean;
  damageSummary?: {
    dents: Array<{ location: string; size: string; confidenceScore: number }>;
    scratches: Array<{ location: string; depth: string; confidenceScore: number }>;
  };
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  description: string;
  recommendations: string[];
  // Maintain backward compatibility for UI
  damageType?: string;
}

/**
 * Convert image file to base64 string for Gemini API
 */
async function imageToBase64(imageUri: string): Promise<string> {
  try {
    console.log('Converting image to base64:', imageUri);

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    if (!base64 || base64.length === 0) {
      throw new Error('Image conversion returned empty result');
    }

    console.log('Image converted to base64, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze car image using Google Gemini AI for damage detection
 * @param imageUri - URI of the car image to analyze
 * @returns Analysis result with damage information
 */
export async function analyzeCarDamageWithGemini(imageUri: string, expectedAngle: string = "Car View"): Promise<GeminiAnalysisResult> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_GOOGLE_API_KEY')) {
      console.error('Gemini API key not configured.');
      throw new Error(
        'Gemini API key not configured.'
      );
    }

    if (USE_DEMO_MODE) {
      console.log('DEMO MODE - Returning simulated analysis');

      const hasDamage = Math.random() < 0.5;

      return {
        imageComplete: true,
        completenessNote: 'Lighting is sufficient for micro-analysis',
        hasDamage: hasDamage,
        damageSummary: {
          dents: hasDamage ? [{ location: 'Front Bumper', size: '2cm', confidenceScore: 0.9 }] : [],
          scratches: hasDamage ? [{ location: 'Door Panel', depth: 'Surface', confidenceScore: 0.8 }] : []
        },
        severity: hasDamage ? 'minor' : 'none',
        description: hasDamage
          ? `Simulated forensic analysis: localized deformation detected on the panel.`
          : 'Simulated analysis: No visible micro-deformations or surface disruptions detected.',
        recommendations: hasDamage
          ? ['Paintless Dent Repair suggested', 'Buffing required']
          : ['Regular maintenance recommended'],
        damageType: hasDamage ? 'Dent & Scratches' : 'None'
      };
    }

    console.log('Analyzing car image with Gemini AI...');
    console.log('Using configured API Key');

    const base64 = await imageToBase64(imageUri);

    const isInterior = expectedAngle.toLowerCase().includes('interior') || expectedAngle.toLowerCase().includes('dashboard');
    const isSpecial = expectedAngle.toLowerCase().includes('engine') || expectedAngle.toLowerCase().includes('trunk');

    const payload = {
      contents: [
        {
          parts: [
            {
              text: `SYSTEM ROLE:
You are a Senior Automotive Forensic Appraiser.
Your goal is to detect ALL damage, from major smashes to "invisible" parking lot dings, as well as interior wear and maintenance issues.

Before performing damage detection, you MUST validate whether the image meets professional automotive inspection standards for the specified view: ${expectedAngle}.

--------------------------------------------------------
STAGE 1: PRACTICAL IMAGE VALIDATION (REAL-WORLD TOLERANT)
--------------------------------------------------------

Before detecting damage, verify that the image is usable for inspection.

DO NOT reject for small angle imperfections.
DO NOT reject for normal daylight variation.
ONLY reject if inspection is genuinely impossible.

=========================
1. BASIC VISIBILITY CHECK
=========================

Reject ONLY if:

- Image is clearly blurry (details not sharp)
${isInterior ? '- Key interior components (seats, dashboard, door cards) are not clearly visible' :
                  (isSpecial ? '- The target compartment (engine/trunk) is not clearly visible' : '- Main exterior panel is not clearly visible')}
- Target area is heavily obstructed (person, object, extreme glare)
- Image is extremely dark or extremely overexposed
${!isInterior && !isSpecial ? '- No usable reflections visible at all (required for exterior reflection analysis)' : ''}

If any of the above is true:
- imageComplete = false
- hasDamage = false
- severity = "none"
- description = "Image rejected – reason (e.g., 'Target area not clearly visible')"
- STOP analysis

=========================
2. ANGLE & LIGHTING TOLERANCE
=========================

${isInterior || isSpecial ?
                  'Accept any angle that shows the component clearly. Normal interior or engine bay lighting/shadows are expected and acceptable if details are visible.' :
                  `Ideal exterior inspection angle is 15–45° from panel, but DO NOT reject unless:
- Panel surface is almost completely flat to camera (no reflection distortion visible at all)
- OR extreme side angle where panel shape cannot be evaluated`}

Normal handheld angles are acceptable.

=========================
3. COVERAGE (SIMPLIFIED)
=========================

Accept if:
${isInterior ? '- Interior cabin elements are reasonably visible' :
                  (isSpecial ? '- The respective bay (engine or trunk) is visible and inspectable' : '- At least one main exterior panel is clearly visible')}
- Area occupies reasonable portion of frame

If image passes these practical checks:
- imageComplete = true
- Proceed to forensic scan.

--------------------------------------------------------
STAGE 2: DAMAGE & CONDITION DETECTION PROTOCOL
--------------------------------------------------------

### SENSITIVITY: EXTREME

${isInterior ? `
FOCUS AREA: INTERIOR CABIN
1. UPHOLSTERY: Check for tears, cigarette burns, heavy stains, or sagging headliner.
2. PLASTICS/TRIM: Check for cracked dashboard, broken air vents, missing knobs, or heavy scuffs.
3. WEAR: Check for worn steering wheel, scratched screens, or damaged buttons.
` : (isSpecial ? `
FOCUS AREA: MECHANICAL / UTILITY
1. VISUAL DEFECTS: Check for fluid leaks, frayed belts, excessive corrosion, or missing caps/tools.
2. STRUCTURAL: Check for sub-frame bends, impact signs in the trunk well, or missing insulation.
` : `
FOCUS AREA: EXTERIOR PANELS
1. FLAT PANELS: Use the "Ripple" Test — if a reflection wiggles or bends, IT IS A DENT.
2. DESIGN LINES: Use the "Kink" Test — if a curve is flat or jagged, IT IS A DENT.
3. CRITICAL CUES: Look for Refraction (snake effect), Light Pooling (shadow bowls), and Texture Breaks (paint scratches).
`)}

--------------------------------------------------------
TASK: HIGH-PRECISION FORENSIC SCAN
--------------------------------------------------------

Perform a pixel-perfect scan of this ${expectedAngle} view.
Look for ANY deviation from factory-standard condition.

Accuracy Rule:
- Do NOT invent damage.
- Do NOT ignore subtle distortion or minor wear.
- Be confident but technical and evidence-based.

--------------------------------------------------------
FINAL OUTPUT — STRICT JSON ONLY
--------------------------------------------------------

Return ONLY RAW JSON. No markdown. No explanation.

{
  "imageComplete": boolean,
  "completenessNote": "Summary of visibility and lighting quality",
  "hasDamage": boolean,
  "damageSummary": {
    "dents": [
      {
        "location": "Specify exact part",
        "size": "Estimated size or severity",
        "confidenceScore": 0.0
      }
    ],
    "scratches": [
      {
        "location": "Specify exact part",
        "depth": "Surface|Deep|Through Paint",
        "confidenceScore": 0.0
      }
    ]
  },
  "severity": "none|minor|moderate|severe",
  "description": "Precise technical findings of defects or wear found in this specific view.",
  "recommendations": ["Actionable steps for repair or cleaning"]
}`,
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
    console.log('Calling Gemini API (gemini-3-flash-preview)...');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', response.status, errorData);
      throw new Error(`Gemini API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const responseText = data.candidates[0].content.parts[0].text;
    console.log('Raw AI Response:', responseText);

    let cleanedText = responseText;
    if (cleanedText.includes('```')) {
      cleanedText = cleanedText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    }

    const analysisResult = JSON.parse(cleanedText) as GeminiAnalysisResult;

    // Backward compatibility: Populate damageType if missing
    if (!analysisResult.damageType) {
      const dentCount = analysisResult.damageSummary?.dents?.length || 0;
      const scratchCount = analysisResult.damageSummary?.scratches?.length || 0;

      const types = [];
      if (dentCount > 0) types.push(`${dentCount} Dent(s)`);
      if (scratchCount > 0) types.push(`${scratchCount} Scratch(es)`);

      analysisResult.damageType = types.length > 0 ? types.join(' & ') : (analysisResult.hasDamage ? 'Damage Detected' : 'No Damage');
    }

    console.log('Analysis Complete:', analysisResult);

    return analysisResult;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}

/**
 * Batch analyze multiple car images
 */
export async function analyzeBatchCarDamage(imageUris: string[]): Promise<GeminiAnalysisResult[]> {
  const results: GeminiAnalysisResult[] = [];

  for (let i = 0; i < imageUris.length; i++) {
    try {
      console.log(`Analyzing image ${i + 1}/${imageUris.length}...`);

      const { label } = await import('./carDetection').then(m => m.PHOTO_CONFIG[i]);

      const result = await analyzeCarDamageWithGemini(imageUris[i], label);
      results.push(result);

      if (i < imageUris.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Failed to analyze image ${i + 1}:`, error);
      results.push({
        hasDamage: false,
        damageType: 'Analysis Failed',
        severity: 'none',
        description: 'Could not analyze image due to network or API error.',
        recommendations: [],
        imageComplete: false,
        completenessNote: 'Analysis failed'
      });
    }
  }

  return results;
}

/**
 * Generate damage report summary
 */
export function generateDamageReport(results: GeminiAnalysisResult[]): {
  totalImages: number;
  damageCount: number;
  averageSeverity: string;
  summary: string;
} {
  const totalImages = results.length;
  const damageCount = results.filter((r) => r.hasDamage).length;
  const severities = results
    .filter((r) => r.hasDamage)
    .map((r) => r.severity);

  const severityOrder = { none: 0, minor: 1, moderate: 2, severe: 3 };
  const averageSeverity =
    severities.length > 0
      ? Object.keys(severityOrder).find(
        (k) =>
          severityOrder[k as keyof typeof severityOrder] ===
          Math.round(
            severities.reduce((sum, s) => sum + severityOrder[s as keyof typeof severityOrder], 0) /
            severities.length
          )
      ) || 'minor'
      : 'none';

  const summary =
    damageCount === 0
      ? 'No damage detected in any photos'
      : `Damage detected in ${damageCount}/${totalImages} photos. Average severity: ${averageSeverity}`;

  return {
    totalImages,
    damageCount,
    averageSeverity,
    summary,
  };
}
