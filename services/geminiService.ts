
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { RTLAnalysis } from "../types";

export const analyzeRTLInterface = async (base64Image: string): Promise<RTLAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1],
            },
          },
          { text: "请扫描截图中的所有文字块。重点检查每一个文字块的对齐方式（左/中/右），并将左对齐的 RTL 文本标注为‘前端实现错误’。必须返回 JSON 格式结果。" }
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            language: { type: Type.STRING },
            displayErrors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  overview: { type: Type.STRING },
                  content: { type: Type.STRING },
                  location: {
                    type: Type.OBJECT,
                    properties: {
                      y: { type: Type.NUMBER },
                      x: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                      width: { type: Type.NUMBER }
                    },
                    required: ["y", "x", "height", "width"]
                  }
                },
                required: ["type", "overview", "content", "location"]
              }
            },
            overallSummary: { type: Type.STRING }
          },
          required: ["language", "displayErrors", "overallSummary"]
        }
      }
    });

    let jsonStr = response.text?.trim() || '{}';
    
    // 兼容可能出现的 Markdown 代码块包裹
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    return JSON.parse(jsonStr) as RTLAnalysis;
  } catch (err: any) {
    console.error("Gemini Analysis Error:", err);
    if (err.message?.includes('500') || err.message?.includes('xhr')) {
      throw new Error("服务端响应超时或错误 (500)，可能是图片过大或网络不稳定，请重试。");
    }
    throw new Error("模型处理失败，请检查图片内容是否清晰后重试。");
  }
};
