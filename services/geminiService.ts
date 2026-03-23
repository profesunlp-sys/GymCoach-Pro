import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  // 1. Intentar obtener de Vercel (import.meta.env)
  const vercelKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // 2. Intentar obtener de AI Studio (inyectado en window.process)
  const studioKey = (window as any).process?.env?.GEMINI_API_KEY || (window as any).process?.env?.API_KEY;
  
  // 3. Fallback directo (clave proporcionada) para asegurar que funcione en Vercel
  const fallbackKey = "AIzaSyARdk49hhQgyaspzs9ICK-gVvtBb67rRyE";
  
  const apiKey = vercelKey || studioKey || fallbackKey;
    
  if (!apiKey || apiKey === "") {
    throw new Error("Falta la API Key en Vercel. Debes crear una variable llamada exactamente VITE_GEMINI_API_KEY en la configuración de Vercel y volver a desplegar.");
  }
  
  return new GoogleGenAI({ apiKey: apiKey as string });
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const is503 = error?.message?.includes('503') || error?.status === 503 || JSON.stringify(error).includes('503');
      const isOverloaded = error?.message?.includes('high demand') || error?.message?.includes('overloaded');
      
      if (is503 || isOverloaded) {
        console.warn(`Gemini API sobrecargada (intento ${i + 1}/${maxRetries}). Reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponencial backoff
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function getDraftMessage(type: 'bienvenida' | 'alerta' | 'felicitacion', studentName: string): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Escribe un mensaje de WhatsApp corto y profesional para un padre de familia. 
      Tipo: ${type}. Alumno: ${studentName}. Gimnasio: GymCoach Pro.
      Tono: Empático, motivador y profesional. Máximo 60 palabras.`,
    });
    return response.text || "";
  }).catch(error => {
    console.error("Error en getDraftMessage:", error);
    return "Error al generar mensaje.";
  });
}

export async function processClassAudio(audioBase64: string, mimeType: string): Promise<any> {
  return withRetry(async () => {
    const ai = getAI();
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
            
            REGLAS DE CONSISTENCIA:
            1. Si el entrenador menciona una habilidad (ej. "Mortal atrás"), asegúrate de que el aparato coincida (ej. "Suelo"). Si no coincide o es ambiguo, márcalo.
            2. Si el audio tiene mucho ruido o es ininteligible en partes clave, marca 'clarificationNeeded' como true.
            3. Si faltan datos obligatorios (entrenador, grupo o al menos un aparato), marca 'clarificationNeeded' como true.
            
            Formato esperado:
            {
              "warmup": ["item1", "item2"],
              "apparatusUsed": ["Suelo", "Viga", etc],
              "skillsCovered": ["habilidad1", "habilidad2"],
              "entrenador": "nombre detectado o null",
              "grupo": "nivel detectado o null",
              "confidence": number (0-100),
              "clarificationNeeded": boolean,
              "question": "texto de la pregunta específica para el usuario si algo no está claro",
              "inconsistencies": ["lista de dudas o contradicciones detectadas"]
            }
            
            Aparatos válidos: Suelo, Viga, Paralelas, Salto, Anillas, Arzones, Barra Fija.`,
          },
        ]
      },
      config: {
        responseMimeType: "application/json",
      },
    });
    
    return JSON.parse(response.text || "{}");
  });
}

export async function refineClassAnalysis(previousData: any, userClarification: string): Promise<any> {
  return withRetry(async () => {
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
  });
}

export async function analyzeChurnRisk(data: any): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza estos datos de asistencia y pagos: ${JSON.stringify(data)}. 
      Identifica alumnos en riesgo de abandonar el gimnasio y sugiere acciones de retención.`,
    });
    return response.text || "Análisis no disponible.";
  }).catch(error => {
    console.error("Error en analyzeChurnRisk:", error);
    return "Error en el análisis de retención.";
  });
}

export async function getSearchGroundedAnswer(query: string): Promise<{ text: string, sources: any[] }> {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Eres un experto entrenador de gimnasia artística. Responde a la siguiente consulta sobre ejercitaciones, metodologías o enseñanza: "${query}". Usa información actualizada de la web.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((chunk: any) => chunk.web).filter(Boolean);
    
    return {
      text: response.text || "No se encontró información.",
      sources
    };
  }).catch(error => {
    console.error("Error en getSearchGroundedAnswer:", error);
    return { text: `Error al realizar la búsqueda: ${error.message || error}`, sources: [] };
  });
}

export async function analyzeAttendanceStats(stats: any): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza estas estadísticas de asistencia y matrícula del gimnasio: ${JSON.stringify(stats)}. 
      Proporciona un resumen ejecutivo, identifica tendencias (positivas o negativas) y sugiere 3 acciones concretas para mejorar la retención o el crecimiento. 
      Responde en español, con un tono profesional y directo. Usa markdown para el formato.`,
    });
    return response.text || "Análisis no disponible.";
  }).catch(error => {
    console.error("Error en analyzeAttendanceStats:", error);
    return "Error al analizar las estadísticas.";
  });
}

export async function queryUnifiedAssistant(query: string, sources: any[]): Promise<{ text: string, sources: any[] }> {
  return withRetry(async () => {
    const ai = getAI();
    
    // 1. Construir el contexto de conocimiento interno
    let internalKnowledgeContext = "";
    const activeSources = sources.filter(s => s.content && s.content.length > 0);
    
    if (activeSources.length > 0) {
      internalKnowledgeContext = "BIBLIOTECA TÉCNICA (DOCUMENTOS OFICIALES SUBIDOS):\n";
      activeSources.forEach(s => {
        internalKnowledgeContext += `--- INICIO DOCUMENTO: "${s.name}" ---\n${s.content}\n--- FIN DOCUMENTO: "${s.name}" ---\n\n`;
      });
    } else {
      return { 
        text: "No hay manuales o reglamentos cargados en la Biblioteca Técnica. Por favor, sube archivos PDF o texto en la sección de Biblioteca para poder consultarme.", 
        sources: [] 
      };
    }

    const systemPrompt = `Eres el "Consultor Técnico de Biblioteca" de GymCoach Pro. Tu función es estrictamente analítica y basada en evidencias.

    REGLAS DE ORO:
    1. SOLO DOCUMENTOS INTERNOS: Responde ÚNICAMENTE utilizando la información presente en la BIBLIOTECA TÉCNICA proporcionada arriba.
    2. SI NO ESTÁ, DI QUE NO ESTÁ: Si la consulta del usuario (ej. niveles específicos, ejercicios, series) NO figura en los documentos cargados, responde exactamente: "Lo siento, esa información no se encuentra en los manuales actuales de tu Biblioteca Técnica."
    3. PROHIBIDO INVENTAR: No utilices conocimiento externo, ni internet, ni menciones otras federaciones si no están en los textos provistos. Evita alucinaciones a toda costa.
    4. CITAS OBLIGATORIAS: Indica siempre de qué manual o página (si está disponible) extrajiste la respuesta.
    5. TONO: Profesional, seco, preciso y puramente técnico.`;

    const userQuery = `BIBLIOTECA TÉCNICA PROPORCIONADA:
    ${internalKnowledgeContext}
    
    CONSULTA DEL ENTRENADOR: "${query}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", 
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userQuery }] }],
      config: {
        temperature: 0.0, // Mínima creatividad para máxima adherencia al texto
      },
    });

    // Detectar fuentes citadas
    const internalSourcesUsed = activeSources
      .filter(s => response.text?.toLowerCase().includes(s.name.toLowerCase()) || 
                   (s.name.toLowerCase().includes('nivel e') && query.toLowerCase().includes('nivel e')))
      .map(s => ({ title: s.name, uri: '#' }));

    return {
      text: response.text || "No se encontró información relevante en la biblioteca.",
      sources: internalSourcesUsed
    };
  }).catch(error => {
    console.error("Error en queryUnifiedAssistant:", error);
    return { text: `Error de conexión con el sistema de análisis técnico.`, sources: [] };
  });
}

