
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getSkillSuggestions(apparatus: string, ageGroup: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Sugiere 5 habilidades de gimnasia artística para el aparato "${apparatus}" dirigidas a un grupo de edad de "${ageGroup}".`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    if (response.text) {
        return JSON.parse(response.text.trim());
    }
    return [];
  } catch (error) {
    console.error("Error fetching Gemini suggestions:", error);
    return [];
  }
}
