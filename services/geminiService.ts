
import { GoogleGenAI } from "@google/genai";

// Función auxiliar para obtener la instancia de IA de forma segura
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
