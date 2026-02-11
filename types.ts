
export enum ErrorType {
  FRONTEND = '前端实现错误',
  GRAMMAR = '语法/语言错误',
  OPTIMIZATION = '优化建议'
}

export interface BoundingBox {
  y: number;
  x: number;
  height: number;
  width: number;
}

export interface DisplayError {
  type: ErrorType;
  overview: string; // 问题概述
  content: string;  // 具体内容
  location: BoundingBox;
}

export interface RTLAnalysis {
  language: '阿拉伯语' | '波斯语';
  displayErrors: DisplayError[];
  overallSummary: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  image: string;
  analysis?: RTLAnalysis;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
