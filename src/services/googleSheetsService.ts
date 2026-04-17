
/**
 * Servicio para interactuar con Google Apps Script (Google Sheets)
 * Conecta la aplicación con la planilla de cálculo para reportes externos.
 */

export interface SheetsSyncData {
  date: string;
  groupName: string;
  schedule: string;
  selectedDays: string[];
  ageGroups: string[];
  attendance: { name: string; present: boolean }[];
  warmupSkills: string[];
  apparatus: string[];
  apparatusDetails: Record<string, string[]>;
}

export class GoogleSheetsService {
  private webAppUrl: string;

  constructor() {
    this.webAppUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
  }

  /**
   * Envía los datos de una clase a Google Sheets
   */
  async syncClass(data: SheetsSyncData): Promise<{ success: boolean; error?: string }> {
    if (!this.webAppUrl) {
      console.warn("Google Script URL no configurada en .env (VITE_GOOGLE_SCRIPT_URL)");
      return { success: false, error: "URL de Google Script no configurada." };
    }

    try {
      // Usamos 'no-cors' si el script no maneja CORS, o intentamos una petición estándar
      // Nota: Apps Script requiere redirecciones y a veces devuelve errores de CORS en el navegador
      // aunque la ejecución se realice. Usualmente se usa un proxy o se maneja el error.
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        mode: 'no-cors', // Apps Script a veces lo requiere para simples POST desde el cliente
        headers: {
          'Content-Type': 'text/plain', // Apps Script prefiere esto para JSON.parse manual
        },
        body: JSON.stringify(data),
      });

      // Con no-cors no podemos ver el cuerpo de la respuesta, pero asumimos éxito si no hay excepción
      return { success: true };
    } catch (error: any) {
      console.error("Error al sincronizar con Google Sheets:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene el historial de la planilla
   */
  async getHistory(): Promise<any[]> {
    if (!this.webAppUrl) return [];

    try {
      const response = await fetch(`${this.webAppUrl}?action=getHistory`);
      const history = await response.json();
      return history;
    } catch (error) {
      console.error("Error al obtener historial de Sheets:", error);
      return [];
    }
  }
}

export const sheetsService = new GoogleSheetsService();
