import { GoogleGenAI, Type } from "@google/genai";

// Inicialización segura. El API_KEY es inyectado por el entorno.
const ai = new GoogleGenAI({ 
  apiKey: (typeof process !== 'undefined' && process.env?.API_KEY) ? process.env.API_KEY : "" 
});

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
    console.error("Error en Gemini getSkillSuggestions:", error);
    return [];
  }
}

export async function getPlanningAnalysis(history: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Eres un experto entrenador de gimnasia artística. Analiza los siguientes datos de progreso mensual: ${history}. 
      
      TU TAREA:
      1. Evalúa qué aparatos están siendo descuidados.
      2. Identifica inconsistencias en las habilidades practicadas.
      3. Sugiere 3 enfoques clave para el próximo mes.
      
      FORMATO DE SALIDA (OBLIGATORIO):
      - Usa Títulos en MAYÚSCULAS seguidos de dos puntos (ej: ANÁLISIS DE APARATOS:).
      - Usa viñetas claras (-) para los puntos específicos.
      - Escribe párrafos cortos y directos.
      - Evita el lenguaje genérico; sé pedagógicamente específico.
      - Responde en español con un tono profesional de élite.`,
    });
    return response.text || "No se pudo generar el análisis.";
  } catch (error) {
    console.error("Error en Gemini getPlanningAnalysis:", error);
    return "Error al conectar con la IA de análisis pedagógico. Por favor revisa la consola.";
  }
}