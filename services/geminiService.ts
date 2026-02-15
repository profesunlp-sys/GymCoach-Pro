import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export async function getDraftMessage(type: 'bienvenida' | 'alerta' | 'felicitacion', studentName: string): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Escribe un mensaje de WhatsApp corto y profesional para un padre de familia. 
      Tipo: ${type}. Alumno: ${studentName}. Gimnasio: GymCoach Pro.
      Tono: Empático, motivador y profesional. Máximo 60 palabras.`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error en getDraftMessage:", error);
    return "Error al generar mensaje.";
  }
}

export async function processClassAudio(audioBase64: string, mimeType: string): Promise<any> {
  try {
    const ai = getAI();
    // Correctly structured contents with parts for multimodal input (audio + text)
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: audioBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Analiza este audio de un entrenador de gimnasia reportando su clase. 
            Extrae la información y devuélvela estrictamente en formato JSON.
            Si hay términos técnicos que no entiendes o falta información crucial (como qué aparato se usó específicamente), marca 'clarificationNeeded' como true y escribe la pregunta en 'question'.
            
            Formato esperado:
            {
              "warmup": ["item1", "item2"],
              "apparatusUsed": ["Suelo", "Viga", etc],
              "skillsCovered": ["habilidad1", "habilidad2"],
              "entrenador": "nombre detectado o null",
              "grupo": "nivel detectado o null",
              "clarificationNeeded": boolean,
              "question": "texto de la pregunta si es necesario"
            }
            
            Los aparatos válidos son: Suelo, Viga, Paralelas, Salto, Anillas, Arzones, Barra Fija.`,
          },
        ]
      },
      config: {
        responseMimeType: "application/json",
      },
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error procesando audio:", error);
    throw error;
  }
}

export async function refineClassAnalysis(previousData: any, userClarification: string): Promise<any> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `El entrenador proporcionó esta información previa de la clase: ${JSON.stringify(previousData)}.
      Ante la duda de la IA, el entrenador aclara: "${userClarification}".
      Actualiza los datos y devuelve el JSON final sin necesidad de más aclaraciones.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Error refinando análisis:", error);
    throw error;
  }
}

export async function analyzeChurnRisk(data: any): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza estos datos de asistencia y pagos: ${JSON.stringify(data)}. 
      Identifica alumnos en riesgo de abandonar el gimnasio y sugiere acciones de retención.`,
    });
    return response.text || "Análisis no disponible.";
  } catch (error) {
    console.error("Error en analyzeChurnRisk:", error);
    return "Error en el análisis de retención.";
  }
}

export async function getPlanningAnalysis(history: string): Promise<string> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Eres un experto entrenador de gimnasia. Analiza: ${history}. 
      Proporciona: 1. Análisis de aparatos, 2. Debilidades detectadas, 3. Plan próximo mes. 
      Formato: Directo, técnico, profesional.`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Error en getPlanningAnalysis:", error);
    return "Error en IA.";
  }
}
