import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenAI } from '@google/genai';

interface AIConfig {
  aiEnabled: boolean;
  aiModel: string;
  apiKey: string;
  apiBaseUrl: string;
}

export async function getAIConfig(): Promise<AIConfig> {
  try {
    const docRef = doc(db, 'settings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        aiEnabled: data.aiEnabled ?? true,
        aiModel: data.aiModel || 'gemini-3.1-pro-preview',
        apiKey: data.apiKey || '',
        apiBaseUrl: data.apiBaseUrl || '',
      };
    }
  } catch (error) {
    console.error('Failed to fetch AI config:', error);
  }
  return {
    aiEnabled: true,
    aiModel: 'gemini-3.1-pro-preview',
    apiKey: '',
    apiBaseUrl: '',
  };
}

export async function callAI(prompt: string, systemInstruction?: string): Promise<string> {
  const config = await getAIConfig();
  
  if (!config.aiEnabled) {
    throw new Error('AI Assistant is disabled by administrator.');
  }

  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('API Key is not configured.');
  }

  // If the model is not a gemini model and a custom base URL is provided, assume it's an OpenAI-compatible endpoint
  if (!config.aiModel.toLowerCase().includes('gemini') && config.apiBaseUrl) {
    const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response from AI.';
  } else {
    // Default to Google GenAI SDK
    const ai = new GoogleGenAI({ 
      apiKey,
      ...(config.apiBaseUrl ? { httpOptions: { baseUrl: config.apiBaseUrl } } : {})
    });
    const response = await ai.models.generateContent({
      model: config.aiModel,
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined
    });
    return response.text || 'No response from AI.';
  }
}
