import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Search, 
  Languages, 
  AlertCircle, 
  Info,
  Loader2,
  FileText,
  ShieldCheck,
  Plus,
  Clock,
  X,
  AlignLeft,
  AlignCenter,
  Type,
  CheckCircle2,
  History as HistoryIcon,
  Trash2
} from 'lucide-react';
import { RTLAnalysis, ErrorType, HistoryItem } from './types';
import { analyzeRTLInterface } from './services/geminiService';
import SchematicDiagram from './components/SchematicDiagram';

const App: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('rtl_audit_history');
      if (!saved) return [];
      const items: HistoryItem[] = JSON.parse(saved);
      // 重置处理中状态为待处理
      return items.map(item => item.status === 'processing' ? { ...item, status: 'pending' } : item);
    } catch (e) {
      return [];
    }
  });
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef<Set<string>>(new Set());

  const activeItem = history.find(item => item.id === activeId);

  const showToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const createHistoryEntry = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const resized = await resizeImage(base64);
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        image: resized,
        status: 'pending'
      };
      setHistory(prev => [newItem, ...prev]);
      setActiveId(newItem.id);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) createHistoryEntry(file);
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            createHistoryEntry(blob);
            return;
          }
        }
      }
    }
  }, [createHistoryEntry]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const runAnalysis = useCallback(async (id: string) => {
    if (processingRef.current.has(id)) return;

    const target = history.find(h => h.id === id);
    if (!target || target.status === 'completed') return;

    processingRef.current.add(id);
    setHistory(prev => prev.map(item => item.id === id ? { ...item, status: 'processing' } : item));

    try {
      const result = await analyzeRTLInterface(target.image);
      setHistory(prev => prev.map(item => item.id === id ? { 
        ...item, 
        analysis: result, 
        status: 'completed' 
      } : item));
      
      if (activeId === id) showToast('审计分析完成', 'success');
    } catch (err: any) {
      console.error(err);
      setHistory(prev => prev.map(item => item.id === id ? { ...item, status: 'failed' } : item));
      if (activeId === id) showToast(err.message || '分析中断', 'error');
    } finally {
      processingRef.current.delete(id);
    }
  }, [history, activeId, showToast]);

  useEffect(() => {
    const pendingItems = history.filter(item => item.status === 'pending');
    pendingItems.forEach(item => runAnalysis(item.id));
  }, [history, runAnalysis]);

  useEffect(() => {
    localStorage.setItem('rtl_audit_history', JSON.stringify(history));
  }, [history]);

  const loadHistoryItem = (id: string) => {
    setActiveId(id);
    setShowHistory(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const [activeHighlightIndex, setActiveHighlightIndex] = useState<number | null>(null);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-xl ${
            toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 
            toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200' :
            'bg-blue-500/20 border-blue-500/50 text-blue-200'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={18} /> : toast.type === 'success' ? <ShieldCheck size={18} /> : <Info size={18} />}
            <span className="text-sm font-bold tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}

      {/* 侧边历史记录栏 */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 border-r border-slate-800 transform transition-transform duration-500 ease-in-out ${showHistory ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
              <HistoryIcon size={16} className="text-blue-500" /> 审计历史记录
            </h2>
            <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                <Clock size={32} strokeWidth={1} />
                <p className="text-xs uppercase font-bold tracking-widest">暂无记录</p>
              </div>
            ) : (
              history.map(item => (
                <div 
                  key={item.id}
                  onClick={() => loadHistoryItem(item.id)}
                  className={`group relative bg-slate-800/40 hover:bg-slate-800 rounded-2xl p-3 border cursor-pointer transition-all ${
                    activeId === item.id ? 'border-blue-500 bg-slate-800' : 'border-slate-700/50 hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-slate-700">
                      <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="thumbnail" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-tighter mb-1">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                      {item.status === 'processing' || item.status === 'pending' ? (
                        <div className="flex items-center gap-2 text-blue-400">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">扫描中...</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 font-bold truncate">
                          {item.analysis?.overallSummary || '无结果'}
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* 主体内容 */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-20 shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(true)}
              className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-blue-400 transition-all active:scale-95 shadow-lg"
            >
              <HistoryIcon size={18} />
            </button>
            <div className="h-6 w-[1px] bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-blue-500" size={24} />
              <h1 className="text-lg font-black tracking-tight text-white uppercase italic text-shadow flex items-center">
                RTL AUDITOR <span className="ml-4 text-[11px] font-black not-italic bg-gradient-to-r from-blue-600 to-indigo-500 text-white px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] border border-blue-400/30 uppercase tracking-[0.25em] self-center">v0.2.6</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeId && (
              <button onClick={() => setActiveId(null)} className="flex items-center gap-2 text-slate-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
                <Plus size={16} /> 新分析
              </button>
            )}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-95 flex items-center gap-2"
            >
              <Upload size={14} /> 上传截图
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
        </header>

        <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
          {!activeItem ? (
            <div className="w-full flex items-center justify-center px-8 lg:px-12 animate-in fade-in zoom-in duration-1000">
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) createHistoryEntry(file); }}
                className={`w-full max-w-4xl h-[70vh] flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] transition-all duration-700 group cursor-pointer ${
                  isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5'
                }`}
              >
                <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-2xl border border-slate-800 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 mb-8 group-hover:border-blue-500/30">
                  <Type className="text-slate-700 group-hover:text-blue-500" size={40} />
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-4 text-center px-6">RTL 布局合规性审计引擎</h2>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">点击上传、拖入截图或粘贴 (Ctrl+V)</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex lg:flex-row flex-col p-8 lg:p-12 gap-8 overflow-hidden items-center justify-center">
              
              <div className="lg:w-[60%] flex flex-col gap-6 h-full relative overflow-hidden justify-center items-center">
                {activeItem.status !== 'completed' ? (
                  <div className="relative group rounded-[2rem] overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl flex items-center justify-center w-full h-[70vh]">
                    <img src={activeItem.image} alt="Target" className={`max-h-full w-auto object-contain transition-all duration-1000 ${activeItem.status === 'processing' ? 'opacity-30 blur-xl scale-110' : ''}`} />
                    
                    {activeItem.status === 'pending' && (
                       <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                          <button onClick={() => runAnalysis(activeItem.id)} className="bg-white text-black px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-2xl transform transition hover:scale-105 active:scale-95 flex items-center gap-4">
                            <Search size={24} /> 启动 AI 扫描
                          </button>
                       </div>
                    )}

                    {activeItem.status === 'processing' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
                        <Loader2 className="animate-spin text-blue-500" size={64} />
                        <p className="text-white font-black text-xl uppercase tracking-normal">识别引擎正在解析布局...</p>
                      </div>
                    )}

                    {activeItem.status === 'failed' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                        <AlertCircle className="text-red-500" size={60} />
                        <p className="text-white font-black uppercase tracking-widest">分析失败</p>
                        <button onClick={() => runAnalysis(activeItem.id)} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg">
                          重试分析
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-left-8 duration-700 h-full w-full flex flex-col justify-center">
                    <div className="flex items-center gap-3 px-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <Type className="text-blue-500" size={16} />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase italic">Recognition Alignment Map</h3>
                    </div>
                    <div className="flex-1 min-h-0">
                      <SchematicDiagram 
                        imageSrc={activeItem.image} 
                        annotations={activeItem.analysis?.displayErrors || []} 
                        mode="errors" 
                        activeHighlightIndex={activeHighlightIndex}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={`lg:w-[40%] flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-6 pl-2 h-full py-4 transition-all duration-300 isolate ${activeHighlightIndex !== null ? 'z-30 relative' : 'z-10 relative'}`}>
                {activeItem.status === 'completed' && activeItem.analysis ? (
                  <div className="space-y-6 animate-in slide-in-from-right-8 duration-700">
                    <div className="bg-slate-900/80 border-2 border-blue-500/20 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-sm">
                       <h4 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">审计概览</h4>
                       <p className="text-white text-xl font-black leading-tight italic">
                         {activeItem.analysis.overallSummary}
                       </p>
                    </div>

                    <div className="space-y-4 pb-24">
                      {activeItem.analysis.displayErrors && activeItem.analysis.displayErrors.length > 0 ? (
                        <>
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-4 flex items-center gap-2">
                            <FileText size={14} className="text-red-500" /> 识别到排版异常 ({activeItem.analysis.displayErrors.length})
                          </h3>
                          {activeItem.analysis.displayErrors.map((err, idx) => (
                            <div 
                              key={idx}
                              onMouseEnter={() => setActiveHighlightIndex(idx)}
                              onMouseLeave={() => setActiveHighlightIndex(null)}
                              className={`group relative bg-slate-900/40 border p-6 rounded-[2rem] transition-all duration-300 ${
                                activeHighlightIndex === idx 
                                  ? 'border-red-500 ring-4 ring-red-500/20 scale-[1.02] bg-slate-900 shadow-2xl z-50' 
                                  : 'border-slate-800/60 hover:border-slate-700 z-10'
                              }`}
                            >
                                <div className="flex gap-5">
                                  <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-sm font-black transition-all ${
                                    activeHighlightIndex === idx ? 'bg-red-500 text-white shadow-lg rotate-12' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {idx + 1}
                                  </div>
                                  <div className="space-y-3 flex-1 min-w-0">
                                    <span className={`text-[8px] font-black px-2 py-1 rounded-md border uppercase tracking-widest inline-block ${
                                      err.type === ErrorType.FRONTEND ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                      {err.type}
                                    </span>
                                    <h5 className="text-slate-100 text-base font-black leading-tight group-hover:text-white transition-colors">{err.overview}</h5>
                                    <p className="text-slate-400 text-xs leading-relaxed group-hover:text-slate-300">{err.content}</p>
                                  </div>
                                </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="py-20 flex flex-col items-center justify-center bg-emerald-500/5 border border-emerald-500/20 rounded-[3rem] text-center px-8 shadow-2xl">
                            <CheckCircle2 size={48} className="text-emerald-500 mb-6 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <h3 className="text-2xl font-black text-white uppercase tracking-wider">此界面布局合规</h3>
                            <p className="text-emerald-400/80 text-xs mt-2 font-bold uppercase tracking-widest">未发现 RTL 排版对齐错误。</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800/40 border-dashed rounded-[3rem] p-12 text-center gap-6">
                    <Loader2 size={32} className="text-slate-800 animate-spin" />
                    <p className="text-slate-600 text-[10px] uppercase font-bold tracking-widest italic">等待 AI 分析信号...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {showHistory && <div onClick={() => setShowHistory(false)} className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 transition-opacity animate-in fade-in" />}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
        .text-shadow { text-shadow: 0 4px 12px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
};

export default App;