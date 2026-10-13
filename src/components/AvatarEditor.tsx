import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Brush,
  Check,
  Droplets,
  RotateCcw,
  Smile,
  Type,
} from "lucide-react";

type EditorTool = "draw" | "blur" | "text" | "emoji";

const SIZE = 512;
const COLORS = ["#ffffff", "#000000", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#0a84ff", "#bf5af2", "#ff2d55"];
const EMOJIS = ["🔥", "❤️", "😍", "😎", "😂", "🥶", "💀", "⭐", "🐱", "🐸", "🚀", "🎮", "👑", "✨", "💎", "🦋"];

function drawCover(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const context = canvas.getContext("2d");
  if (!context) return false;

  canvas.width = SIZE;
  canvas.height = SIZE;
  const scale = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight);
  const width = SIZE / scale;
  const height = SIZE / scale;
  const x = (image.naturalWidth - width) / 2;
  const y = (image.naturalHeight - height) / 2;
  context.clearRect(0, 0, SIZE, SIZE);
  context.drawImage(image, x, y, width, height, 0, 0, SIZE, SIZE);
  return true;
}

export function AvatarEditor({
  file,
  onCancel,
  onSave,
  saving = false,
}: {
  file: File | null;
  onCancel: () => void;
  onSave: (editedFile: File) => Promise<void> | void;
  saving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<EditorTool>("draw");
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(12);
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("🔥");
  const [undoCount, setUndoCount] = useState(0);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!file) return;
    let disposed = false;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    setReady(false);
    setError("");
    setTool("draw");
    setUndoCount(0);
    historyRef.current = [];

    image.onload = () => {
      if (disposed) return;
      const canvas = canvasRef.current;
      if (!canvas || !drawCover(canvas, image)) {
        setError("Не удалось открыть изображение.");
        return;
      }
      imageRef.current = image;
      setReady(true);
    };
    image.onerror = () => {
      if (!disposed) setError("Не удалось открыть это изображение. Попробуйте другой файл.");
    };
    image.src = objectUrl;

    return () => {
      disposed = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) return null;

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(SIZE, ((event.clientX - rect.left) / rect.width) * SIZE)),
      y: Math.max(0, Math.min(SIZE, ((event.clientY - rect.top) / rect.height) * SIZE)),
    };
  };

  const saveUndoState = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    historyRef.current = [...historyRef.current.slice(-19), context.getImageData(0, 0, SIZE, SIZE)];
    setUndoCount(historyRef.current.length);
  };

  const applyBlur = (point: { x: number; y: number }) => {
    const context = canvasRef.current?.getContext("2d");
    const blurred = blurCanvasRef.current;
    if (!context || !blurred) return;
    context.save();
    context.beginPath();
    context.arc(point.x, point.y, Math.max(10, brushSize * 1.35), 0, Math.PI * 2);
    context.clip();
    context.drawImage(blurred, 0, 0);
    context.restore();
  };

  const placeText = (point: { x: number; y: number }) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const value = text.trim();
    if (!value) {
      setError("Сначала напишите текст ниже.");
      return;
    }
    context.save();
    context.font = "800 " + Math.max(24, brushSize * 2.5) + "px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.lineWidth = Math.max(4, brushSize / 2);
    context.strokeStyle = "rgba(0,0,0,0.8)";
    context.fillStyle = color;
    const lines = value.split("\n").slice(0, 4);
    const lineHeight = Math.max(28, brushSize * 3);
    const startY = point.y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      context.strokeText(line.slice(0, 80), point.x, startY + index * lineHeight, SIZE - 24);
      context.fillText(line.slice(0, 80), point.x, startY + index * lineHeight, SIZE - 24);
    });
    context.restore();
    setError("");
  };

  const placeEmoji = (point: { x: number; y: number }) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.save();
    context.font = Math.max(32, brushSize * 4) + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(emoji, point.x, point.y);
    context.restore();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready || saving || exporting) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const point = getPoint(event);
    canvas.setPointerCapture(event.pointerId);
    saveUndoState();

    if (tool === "draw") {
      lastPointRef.current = point;
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = color;
      context.lineWidth = brushSize;
    } else if (tool === "blur") {
      const blurred = document.createElement("canvas");
      blurred.width = SIZE;
      blurred.height = SIZE;
      const blurContext = blurred.getContext("2d");
      if (blurContext) {
        blurContext.filter = "blur(" + Math.max(5, brushSize * 0.8) + "px)";
        blurContext.drawImage(canvas, 0, 0);
        blurContext.filter = "none";
        blurCanvasRef.current = blurred;
        applyBlur(point);
      }
    } else if (tool === "text") {
      placeText(point);
    } else {
      placeEmoji(point);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready || saving || exporting) return;
    const point = getPoint(event);
    if (tool === "draw" && lastPointRef.current) {
      const context = canvasRef.current?.getContext("2d");
      if (!context) return;
      context.lineTo(point.x, point.y);
      context.stroke();
      lastPointRef.current = point;
    } else if (tool === "blur" && blurCanvasRef.current) {
      applyBlur(point);
    }
  };

  const finishStroke = () => {
    lastPointRef.current = null;
    blurCanvasRef.current = null;
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    const context = canvasRef.current?.getContext("2d");
    if (previous && context) context.putImageData(previous, 0, 0);
    setUndoCount(historyRef.current.length);
  };

  const reset = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !drawCover(canvas, image)) return;
    historyRef.current = [];
    setUndoCount(0);
    setError("");
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready || saving || exporting) return;
    setError("");
    setExporting(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.93));
      if (!blob) throw new Error("Не удалось подготовить изображение.");
      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      const editedFile = new File([blob], baseName + "-edited.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      await onSave(editedFile);
      onCancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить аватарку.");
    } finally {
      setExporting(false);
    }
  };

  const toolButton = (value: EditorTool, label: string, icon: ReactNode) => (
    <button
      key={value}
      type="button"
      onClick={() => {
        setTool(value);
        setError("");
        finishStroke();
      }}
      className="flex-1 min-w-0 rounded-[15px] border px-2 py-2.5 flex flex-col items-center gap-1.5 text-[11px] font-bold tcy-press"
      style={{
        borderColor: tool === value ? "var(--tcy-accent)" : "var(--tcy-line)",
        background: tool === value ? "var(--tcy-card-strong)" : "var(--tcy-card)",
        color: tool === value ? "var(--tcy-accent)" : "var(--tcy-dim)",
      }}
      aria-pressed={tool === value}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "var(--tcy-bg, #101014)", color: "var(--tcy-text, #fff)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Редактор аватарки"
    >
      <header className="shrink-0 flex items-center gap-3 px-4 pt-3 safe-top pb-3 border-b tcy-line">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || exporting}
          className="tcy-press w-10 h-10 rounded-full tcy-card border tcy-line flex items-center justify-center tcy-dim disabled:opacity-50"
          aria-label="Назад"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold tcy-text">Редактор аватарки</h2>
          <p className="text-[11.5px] tcy-faint">Рисуйте, добавляйте текст и эффекты</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving || exporting}
          className="tcy-press w-10 h-10 rounded-full tcy-card flex items-center justify-center tcy-dim disabled:opacity-50"
          aria-label="Закрыть редактор"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="relative overflow-hidden rounded-[28px] border tcy-line tcy-card" style={{ aspectRatio: "1 / 1" }}>
            <canvas
              ref={canvasRef}
              aria-label="Предпросмотр аватарки. Используйте палец или мышь для редактирования."
              className="block w-full h-full"
              style={{ touchAction: "none", objectFit: "contain" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center tcy-card text-[13px] tcy-dim">
                {error || "Открываем изображение…"}
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[11.5px] tcy-faint">
            {tool === "draw"
              ? "Проведите пальцем или мышью по изображению"
              : tool === "blur"
                ? "Проведите по участкам, которые нужно размыть"
                : tool === "text"
                  ? "Введите текст и нажмите на нужное место на аватарке"
                  : "Выберите эмодзи и нажмите на место, куда его добавить"}
          </p>
        </div>

        <div className="mx-auto w-full max-w-[420px] flex gap-2">
          {toolButton("draw", "Кисть", <Brush size={18} />)}
          {toolButton("text", "Текст", <Type size={18} />)}
          {toolButton("emoji", "Эмодзи", <Smile size={18} />)}
          {toolButton("blur", "Размытие", <Droplets size={18} />)}
        </div>

        <section className="mx-auto w-full max-w-[420px] rounded-[20px] tcy-card border tcy-line p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="avatar-brush-size" className="text-[12.5px] font-bold tcy-text">
              {tool === "blur" ? "Размер размытия" : tool === "text" || tool === "emoji" ? "Размер текста / эмодзи" : "Размер кисти"}
            </label>
            <span className="text-[12px] font-semibold tcy-accent tabular-nums">{brushSize}</span>
          </div>
          <input
            id="avatar-brush-size"
            type="range"
            min={4}
            max={32}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            className="w-full accent-[color:var(--tcy-accent)]"
          />

          {(tool === "draw" || tool === "text") && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold tcy-dim mr-1">Цвет</span>
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  className="w-7 h-7 rounded-full border-2 tcy-press flex items-center justify-center"
                  style={{
                    background: item,
                    borderColor: color === item ? "var(--tcy-accent)" : "var(--tcy-line)",
                    boxShadow: color === item ? "0 0 0 2px var(--tcy-card)" : "none",
                  }}
                  aria-label={"Выбрать цвет " + item}
                  aria-pressed={color === item}
                />
              ))}
              <label className="w-8 h-8 rounded-full border tcy-line overflow-hidden relative tcy-press" title="Другой цвет">
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="absolute inset-[-8px] w-12 h-12 cursor-pointer"
                  aria-label="Выбрать произвольный цвет"
                />
              </label>
            </div>
          )}

          {tool === "text" && (
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={120}
              rows={2}
              placeholder="Введите текст…"
              className="w-full resize-none rounded-[14px] tcy-solid border tcy-line p-3 text-[13.5px] tcy-text outline-none focus:border-[color:var(--tcy-accent)]"
            />
          )}

          {tool === "emoji" && (
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJIS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setEmoji(item)}
                  className="h-9 rounded-[11px] text-xl tcy-press"
                  style={{
                    background: emoji === item ? "var(--tcy-card-strong)" : "transparent",
                    outline: emoji === item ? "1px solid var(--tcy-accent)" : "1px solid transparent",
                  }}
                  aria-label={"Выбрать эмодзи " + item}
                  aria-pressed={emoji === item}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={undo}
              disabled={undoCount === 0 || saving || exporting}
              className="flex-1 h-10 rounded-[13px] border tcy-line tcy-card text-[12px] font-bold tcy-press disabled:opacity-35 flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} /> Отменить
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={!ready || saving || exporting}
              className="flex-1 h-10 rounded-[13px] border tcy-line tcy-card text-[12px] font-bold tcy-press disabled:opacity-35"
            >
              Сбросить
            </button>
          </div>
        </section>
        {error && (
          <p role="alert" className="mx-auto w-full max-w-[420px] text-[12.5px] font-semibold tcy-danger">
            {error}
          </p>
        )}
      </main>

      <footer className="shrink-0 px-4 pt-3 pb-4 safe-bottom border-t tcy-line">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!ready || saving || exporting}
          className="w-full max-w-[420px] mx-auto h-12 rounded-[17px] tcy-gradient-accent flex items-center justify-center gap-2 text-[14px] font-extrabold tcy-press disabled:opacity-50"
          style={{ color: "var(--tcy-on-accent)" }}
        >
          <Check size={18} /> {saving || exporting ? "Сохраняем…" : "Сохранить аватарку"}
        </button>
      </footer>
    </div>
  );
}
