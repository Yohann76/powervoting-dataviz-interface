// Détecter automatiquement l'URL de l'API en fonction de l'hôte actuel
const getApiBaseUrl = () => {
  // Si une URL est définie dans les variables d'environnement, l'utiliser
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Sinon, utiliser le même hôte que l'application avec le port 3001
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    // Si on est sur localhost, utiliser localhost:3001
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }
    // Sinon, utiliser le même hôte avec le port 3001
    return `${protocol}//${host}:3001`;
  }
  
  // Fallback par défaut
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

export interface GeneratedFile {
  name: string;
  size: number;
  modified: string;
  type: 'json' | 'csv';
}

export interface Task {
  name: string;
}

export interface GenerateRequest {
  task: string;
  config?: string;
  options?: {
    tempData?: string;
    [key: string]: any;
  };
}

export interface GenerateResponse {
  success: boolean;
  output?: string;
  error?: string;
  outputFile?: string;
  exitCode?: number;
}

export const api = {
  async getTasks(): Promise<Task[]> {
    const response = await fetch(`${API_BASE_URL}/api/tasks`);
    if (!response.ok) throw new Error('Failed to fetch tasks');
    const data = await response.json();
    return data.tasks.map((name: string) => ({ name }));
  },

  async getDefaultConfig(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/config/default`);
    if (!response.ok) throw new Error('Failed to fetch default config');
    const data = await response.json();
    return data.config;
  },

  async getGeneratedFiles(): Promise<GeneratedFile[]> {
    const response = await fetch(`${API_BASE_URL}/api/generated-files`);
    if (!response.ok) throw new Error('Failed to fetch generated files');
    const data = await response.json();
    return data.files;
  },

  async downloadFile(filename: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/generated-files/${filename}`);
    if (!response.ok) throw new Error('Failed to download file');
    return response.blob();
  },

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate');
    }
    return response.json();
  },

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      console.log(`🔍 Tentative de connexion au backend: ${API_BASE_URL}/api/health`);
      
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log('✅ Backend accessible');
        return true;
      } else {
        console.error(`❌ Backend répond avec le statut: ${response.status}`);
        return false;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('⏱️ Timeout lors de la connexion au backend');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          console.error('🌐 Erreur réseau - Le backend n\'est peut-être pas démarré ou n\'est pas accessible');
          console.error(`   URL tentée: ${API_BASE_URL}/api/health`);
        } else {
          console.error('❌ Health check failed:', error);
        }
      }
      return false;
    }
  },
};

