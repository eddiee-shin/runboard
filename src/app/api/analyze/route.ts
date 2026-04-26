import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const APP_SOURCES: Record<string, number> = {
  'nike': 1,
  'garmin': 2,
  'strava': 3,
  'apple': 1, // Fallback to nike for now if apple is selected
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    distance_km: { type: Type.NUMBER, description: "Total distance run in kilometers (e.g. 5.23)" },
    duration_sec: { type: Type.INTEGER, description: "Total duration run in seconds" },
    pace_sec_per_km: { type: Type.INTEGER, description: "Pace in seconds per kilometer (e.g. 5'30\" => 330)" },
    calories: { type: Type.INTEGER, description: "Calories burned" },
    avg_heart_rate: { type: Type.INTEGER, description: "Average heart rate in bpm" },
    activity_date: { type: Type.STRING, description: "Date of the run in YYYY-MM-DD format" },
    feedback_text: { type: Type.STRING, description: "A short, energetic 1-sentence coaching feedback in Korean based on the run" },
  },
  required: ["distance_km", "duration_sec", "pace_sec_per_km", "calories", "avg_heart_rate", "activity_date", "feedback_text"]
};

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageBase64, sourceApp, userContext } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const sourceAppId = APP_SOURCES[sourceApp] || 1;

    // Remove the data URI prefix (data:image/jpeg;base64,) if present
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';

    let promptText = `You are a sports data extraction assistant and a personalized running coach. 
Extract running data from the provided screenshot of a running app (${sourceApp}). 
Then, provide a short, energetic 1-sentence coaching feedback in Korean.`;

    if (userContext) {
      promptText += `\n\nUser Context for Feedback:\n`;
      if (userContext.weeklyGoal) promptText += `- Weekly Goal: ${userContext.weeklyGoal} km\n`;
      if (userContext.monthlyGoal) promptText += `- Monthly Goal: ${userContext.monthlyGoal} km\n`;
      if (userContext.memo) promptText += `- User Memo/Condition: "${userContext.memo}"\n`;
      promptText += `\nPlease use this context to make your 1-sentence Korean feedback highly personalized and encouraging (e.g. mentioning their progress towards goals or giving advice related to their memo).`;
    }

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const resultText = response.text || "{}";
    const parsedData = JSON.parse(resultText);

    return NextResponse.json({ success: true, data: parsedData });

  } catch (error: any) {
    console.error('Error analyzing run:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze' }, { status: 500 });
  }
}
