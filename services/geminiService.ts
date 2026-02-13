import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { RTLAnalysis } from "../types";

export const analyzeRTLInterface = async (base64Image: string): Promise<RTLAnalysis> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.length < 10) {
    throw new Error("检测到 API 密钥缺失。请确保环境已预配置 process.env.API_KEY。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
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
          { text: "深度扫描此截图。重点标注所有‘左对齐’的文字块。必须严格返回 JSON 结果。" }
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
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    return JSON.parse(jsonStr) as RTLAnalysis;
  } catch (err: any) {
    console.error("Analysis Failure:", err);
    throw new Error(err.message || "分析任务处理失败，请重试。");
  }
};