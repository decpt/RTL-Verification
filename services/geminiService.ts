import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { RTLAnalysis } from "../types";

export const analyzeRTLInterface = async (base64Image: string): Promise<RTLAnalysis> => {
  // 直接从 process.env 获取，不进行手动干预，符合 SDK 安全指南
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("检测到 API 密钥缺失。请确保环境已预配置 process.env.API_KEY。");
  }

  // 每次请求实例化一次，确保捕获最新环境上下文
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

    const jsonStr = response.text || '{}';
    return JSON.parse(jsonStr) as RTLAnalysis;
  } catch (err: any) {
    console.error("Gemini Analysis Error:", err);
    
    if (err.message?.includes("API key not valid") || err.message?.includes("403")) {
      throw new Error("API 密钥校验失败或权限受限，请检查当前环境授权。");
    }

    if (err.message?.includes('500') || err.message?.includes('xhr')) {
      throw new Error("后端响应异常，请尝试缩小图片尺寸或重试。");
    }
    
    throw new Error(err.message || "审计分析失败，请检查网络或图片内容。");
  }
};