
import React, { useRef, useEffect } from 'react';
import { DisplayError } from '../types';

interface SchematicDiagramProps {
  imageSrc: string;
  annotations: DisplayError[];
  mode: 'errors' | 'corrections';
  activeHighlightIndex?: number | null;
}

const SchematicDiagram: React.FC<SchematicDiagramProps> = ({ imageSrc, annotations, mode, activeHighlightIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      render();
      startRenderLoop();
    };

    const render = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const img = imgRef.current;
      const container = containerRef.current;

      if (!canvas || !ctx || !img || !container) return;

      const availableWidth = container.clientWidth;
      const availableHeight = window.innerHeight * 0.8;

      const scaleW = availableWidth / img.width;
      const scaleH = availableHeight / img.height;
      const scale = Math.min(scaleW, scaleH);

      const targetWidth = img.width * scale;
      const targetHeight = img.height * scale;

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 1. 绘制底层原图
      ctx.save();
      if (activeHighlightIndex !== null) {
        ctx.globalAlpha = 0.5;
        ctx.filter = 'brightness(40%) blur(2px)';
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      frameRef.current += 1;
      const pulse = 1 + Math.sin(frameRef.current * 0.15) * 0.1;

      // 分开两遍绘制：先选框，后标签，确保标签不被遮挡
      annotations.forEach((item, index) => {
        const box = item.location;
        if (!box) return;

        const x = (box.x / 1000) * canvas.width;
        const y = (box.y / 1000) * canvas.height;
        const w = (box.width / 1000) * canvas.width;
        const h = (box.height / 1000) * canvas.height;

        const isHighlighted = activeHighlightIndex === index;
        const color = '#FF3B30'; // 使用标准的系统红
        
        ctx.save();
        if (isHighlighted) {
          // 局部还原亮度
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // 绘制光晕
          ctx.shadowBlur = 40;
          ctx.shadowColor = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          ctx.strokeRect(x, y, w, h);
          
          // 扫描动画
          ctx.fillStyle = `rgba(255, 59, 48, ${0.1 + Math.sin(frameRef.current * 0.2) * 0.05})`;
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.globalAlpha = activeHighlightIndex === null ? 0.9 : 0.1;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x, y, w, h);
        }
        ctx.restore();
      });

      // 绘制标签气泡
      annotations.forEach((item, index) => {
        const box = item.location;
        if (!box) return;

        const x = (box.x / 1000) * canvas.width;
        const y = (box.y / 1000) * canvas.height;
        
        const isHighlighted = activeHighlightIndex === index;
        const color = '#FF3B30';
        const labelText = `${index + 1}`;

        ctx.save();
        
        const radius = 14;
        // 边界保护逻辑：防止标签超出顶部
        let drawY = y - radius * 2.5;
        let isTopCut = drawY < 20;
        if (isTopCut) {
          drawY = y + radius * 1.5; // 如果顶部空间不足，标签显示在下方
        }

        // 左右边界保护
        let drawX = x;
        if (drawX < 20) drawX = 20;
        if (drawX > canvas.width - 20) drawX = canvas.width - 20;

        if (isHighlighted) {
          ctx.translate(drawX, drawY + radius);
          ctx.scale(pulse * 1.2, pulse * 1.2);
          ctx.translate(-drawX, -(drawY + radius));
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(255, 59, 48, 0.8)';
        } else if (activeHighlightIndex !== null) {
          ctx.globalAlpha = 0.2;
        }

        // 背景
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(drawX - radius, drawY - radius, radius * 2, radius * 2, 8);
        ctx.fill();

        // 尖角逻辑
        ctx.beginPath();
        if (isTopCut) {
          ctx.moveTo(drawX - 5, drawY - radius);
          ctx.lineTo(drawX + 5, drawY - radius);
          ctx.lineTo(drawX, drawY - radius - 6);
        } else {
          ctx.moveTo(drawX - 5, drawY + radius);
          ctx.lineTo(drawX + 5, drawY + radius);
          ctx.lineTo(drawX, drawY + radius + 6);
        }
        ctx.closePath();
        ctx.fill();

        // 文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, drawX, drawY);

        ctx.restore();
      });
    };

    const startRenderLoop = () => {
      const loop = () => {
        render();
        animationRef.current = requestAnimationFrame(loop);
      };
      animationRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener('resize', render);
    return () => {
      window.removeEventListener('resize', render);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [imageSrc, annotations, activeHighlightIndex]);

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center bg-slate-900/40 rounded-[2.5rem] overflow-hidden p-4 border border-slate-800/60 shadow-inner">
      <canvas ref={canvasRef} className="block shadow-2xl border-2 border-slate-700/40 rounded-2xl max-h-[80vh] object-contain transition-all duration-300" />
    </div>
  );
};

export default SchematicDiagram;
