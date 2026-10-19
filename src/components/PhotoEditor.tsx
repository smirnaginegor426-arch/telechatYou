import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Contrast,
  RotateCw,
  Type,
  Undo2,
  Brush,
  LoaderCircle,
  Image as ImageIcon,
} from "lucide-react";

type Tool = "draw" | "text";
type Filter = "original" | "mono" | "warm" | "vivid";
type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; size: number };
type TextMark = { id: number; text: string; x: number; y: number; color: string };

const FILTERS: Record<Filter, string> = {
  original: "none",
  mono: "grayscale(1)",
  warm: "sepia(0.32) saturate(1.14)",
  vivid: "contrast(1.12) saturate(1.28)",
};

const FILTER_LABELS: { id: Filter; title: string }[] = [
  { id: "original", title: "Оригинал" },
  { id: "mono", title: "Ч/Б" },
  { id: "warm", title: "Тёплый" },
  { id: "vivid", title: "Яркий" },
];

const BRUSH_COLORS = ["#ffffff", "#19191f", "#ff496c", "#ffdf4f", "#62e6a5", "#70b7ff"];

function outputMime(file: File) {
  if (file.type === "image/png") return "image/png";
  if (file.type === "image/webp") return "image/webp";
  return "image/jpeg";
}

function outputName(file: File, mime: string) {
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `${base}-edited.${ext}`;
}

export function PhotoEditor({
  image,
  onCancel,
  onSave,
}: {
  image: File;
  onCancel: () => void;
  onSave: (file: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const strokePointerRef = useRef<number | null>(null);
  const [currentFile, setCurrentFile] = useState(image);
  const [imageReady, setImageReady] = useState(false);
  const [imageRevision, setImageRevision] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [tool, setTool] = useState<Tool>("draw");
  const [filter, setFilter] = useState<Filter>("original");
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(7);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [textMarks, setTextMarks] = useState<TextMark[]>([]);
  const [textPanelOpen, setTextPanelOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const loadImageFile = useCallback((file: File) => new Promise<void>((resolve, reject) => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const sourceUrl = URL.createObjectURL(file);
    sourceUrlRef.current = sourceUrl;
    const element = new Image();
    element.onload = () => {
      imageElementRef.current = element;
      const canvas = canvasRef.current;
      if (canvas) {
        const scale = Math.min(1, 1800 / Math.max(element.naturalWidth, element.naturalHeight));
        canvas.width = Math.max(1, Math.round(element.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(element.naturalHeight * scale));
      }
      setCurrentFile(file);
      setImageReady(true);
      setImageRevision((revision) => revision + 1);
      setLoadError(false);
      resolve();
    };
    element.onerror = () => {
      setLoadError(true);
      reject(new Error("Не удалось открыть изображение"));
    };
    element.src = sourceUrl;
  }), []);

  useEffect(() => {
    void loadImageFile(image).catch(() => undefined);
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    };
  }, [image, loadImageFile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const imageElement = imageElementRef.current;
    if (!canvas || !imageElement || !imageReady) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = Math.min(1, 1800 / Math.max(imageElement.naturalWidth, imageElement.naturalHeight));
    const desiredWidth = Math.max(1, Math.round(imageElement.naturalWidth * scale));
    const desiredHeight = Math.max(1, Math.round(imageElement.naturalHeight * scale));
    if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.filter = FILTERS[filter];
    context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    context.filter = "none";

    const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;
    for (const stroke of allStrokes) {
      if (!stroke.points.length) continue;
      context.beginPath();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.size;
      if (stroke.points.length === 1) {
        context.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
        context.fillStyle = stroke.color;
        context.fill();
      } else {
        context.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
        context.stroke();
      }
    }

    for (const mark of textMarks) {
      context.save();
      context.font = `700 ${Math.max(24, canvas.width * 0.04)}px system-ui, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.lineWidth = Math.max(4, canvas.width * 0.004);
      context.strokeStyle = "rgba(0,0,0,0.75)";
      context.fillStyle = mark.color;
      context.strokeText(mark.text, mark.x, mark.y, canvas.width * 0.86);
      context.fillText(mark.text, mark.x, mark.y, canvas.width * 0.86);
      context.restore();
    }
  }, [imageReady, imageRevision, filter, strokes, activeStroke, textMarks]);

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (tool !== "draw" || !imageReady || saving) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    strokePointerRef.current = event.pointerId;
    const point = canvasPoint(event);
    setActiveStroke({ points: [point], color: brushColor, size: brushSize });
  };

  const continueDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (strokePointerRef.current !== event.pointerId || !activeStroke) return;
    event.preventDefault();
    const point = canvasPoint(event);
    setActiveStroke((current) => current ? { ...current, points: [...current.points, point] } : current);
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (strokePointerRef.current !== event.pointerId) return;
    strokePointerRef.current = null;
    setStrokes((current) => activeStroke ? [...current, activeStroke] : current);
    setActiveStroke(null);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture may already be released */ }
  };

  const addText = () => {
    const text = textDraft.trim();
    const canvas = canvasRef.current;
    if (!text || !canvas) return;
    setTextMarks((current) => [...current, {
      id: Date.now() + current.length,
      text: text.slice(0, 140),
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: brushColor,
    }]);
    setTextDraft("");
    setTextPanelOpen(false);
    setTool("draw");
  };

  const rotateRight = () => {
    const canvas = canvasRef.current;
    if (!canvas || saving) return;
    setSaving(true);
    const rotated = document.createElement("canvas");
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const context = rotated.getContext("2d");
    if (!context) {
      setSaving(false);
      return;
    }
    context.translate(rotated.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(canvas, 0, 0);
    const mime = outputMime(currentFile);
    rotated.toBlob((blob) => {
      if (!blob) {
        setSaving(false);
        return;
      }
      const nextMime = blob.type || mime;
      const rotatedFile = new File([blob], outputName(currentFile, nextMime), { type: nextMime, lastModified: Date.now() });
      setFilter("original");
      setStrokes([]);
      setActiveStroke(null);
      setTextMarks([]);
      void loadImageFile(rotatedFile).finally(() => setSaving(false));
    }, mime, 0.93);
  };

  const saveImage = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageReady || saving) return;
    setSaving(true);
    const mime = outputMime(currentFile);
    canvas.toBlob((blob) => {
      if (!blob) {
        setSaving(false);
        alert("Не удалось сохранить изменения изображения.");
        return;
      }
      const nextMime = blob.type || mime;
      const editedFile = new File([blob], outputName(currentFile, nextMime), {
        type: nextMime,
        lastModified: Date.now(),
      });
      setSaving(false);
      onSave(editedFile);
    }, mime, 0.93);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="photo-editor"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.985 }}
        className="fixed inset-0 z-[10060] flex flex-col overflow-hidden text-white"
        style={{
          background: "radial-gradient(ellipse at 50% 28%, rgba(48,48,66,0.94), rgba(12,12,17,0.99) 66%, #050506)",
          backdropFilter: "blur(22px)",
        }}
      >
        <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-3 safe-top">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Вернуться к вложению"
            className="tcy-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/90 backdrop-blur-xl"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold">Редактор фото</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-white/45">Изменения применятся к отправляемому фото</p>
          </div>
          <button
            type="button"
            onClick={saveImage}
            disabled={!imageReady || saving || loadError}
            className="tcy-press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[12.5px] font-extrabold text-[#111117] shadow-lg disabled:opacity-45"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
            Готово
          </button>
        </header>

        <main className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-3 pt-1">
          {imageReady ? (
            <canvas
              ref={canvasRef}
              aria-label="Редактируемое фото"
              className={`max-h-[calc(100dvh-260px)] max-w-full rounded-[20px] shadow-[0_26px_80px_rgba(0,0,0,0.4)] ${tool === "draw" ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={finishDrawing}
              onPointerCancel={finishDrawing}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/70">
              {loadError ? <ImageIcon size={34} /> : <LoaderCircle size={32} className="animate-spin" />}
              <span className="text-[12px]">{loadError ? "Не удалось открыть фото" : "Открываем изображение…"}</span>
            </div>
          )}
        </main>

        <footer className="z-10 shrink-0 rounded-t-[28px] border-t border-white/[0.1] bg-[#09090e]/80 px-4 pb-4 pt-3 shadow-[0_-14px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl safe-bottom">
          <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => { setTool("draw"); setTextPanelOpen(false); }}
              className={`tcy-press flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12px] font-bold ${tool === "draw" ? "border-white/40 bg-white text-[#15151a]" : "border-white/10 bg-white/[0.06] text-white/75"}`}
            >
              <Brush size={15} /> Кисть
            </button>
            <button
              type="button"
              onClick={() => { setTool("text"); setTextPanelOpen((value) => !value); }}
              className={`tcy-press flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[12px] font-bold ${tool === "text" ? "border-white/40 bg-white text-[#15151a]" : "border-white/10 bg-white/[0.06] text-white/75"}`}
            >
              <Type size={15} /> Текст
            </button>
            <button
              type="button"
              onClick={rotateRight}
              disabled={!imageReady || saving}
              className="tcy-press flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-[12px] font-bold text-white/75 disabled:opacity-40"
            >
              <RotateCw size={15} /> Повернуть
            </button>
            <button
              type="button"
              onClick={() => { setStrokes([]); setActiveStroke(null); setTextMarks([]); setFilter("original"); }}
              className="tcy-press flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-[12px] font-bold text-white/75"
            >
              <Undo2 size={15} /> Очистить
            </button>
          </div>

          {textPanelOpen && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(event) => { event.preventDefault(); addText(); }}
            >
              <input
                autoFocus
                value={textDraft}
                onChange={(event) => setTextDraft(event.target.value)}
                maxLength={140}
                placeholder="Введите текст на фото"
                className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.07] px-4 text-[12.5px] text-white outline-none placeholder:text-white/35 focus:border-white/30"
              />
              <button
                type="submit"
                disabled={!textDraft.trim() || !imageReady}
                className="tcy-press rounded-full bg-white px-4 text-[12px] font-extrabold text-[#141419] disabled:opacity-40"
              >
                Добавить
              </button>
            </form>
          )}

          <div className="mb-3 flex items-center gap-2">
            <span className="mr-1 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-white/55">
              <Contrast size={14} /> Фильтры
            </span>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto no-scrollbar">
              {FILTER_LABELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`tcy-press shrink-0 rounded-full border px-3 py-2 text-[10.5px] font-bold transition-colors ${filter === item.id ? "border-white/35 bg-white/15 text-white" : "border-white/[0.08] bg-white/[0.04] text-white/55"}`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 flex items-center gap-3">
            <span className="text-[11px] font-semibold text-white/55">Цвет</span>
            <div className="flex items-center gap-2">
              {BRUSH_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Выбрать цвет ${color}`}
                  onClick={() => setBrushColor(color)}
                  className="tcy-press flex h-7 w-7 items-center justify-center rounded-full border-2"
                  style={{
                    background: color,
                    borderColor: brushColor === color ? "#ffffff" : "rgba(255,255,255,0.18)",
                    boxShadow: brushColor === color ? "0 0 0 2px rgba(255,255,255,0.2)" : "none",
                  }}
                >
                  {brushColor === color && <Check size={13} color={color === "#ffffff" || color === "#ffe65b" ? "#141419" : "#ffffff"} />}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Brush size={13} className="text-white/50" />
              <input
                aria-label="Размер кисти"
                type="range"
                min={2}
                max={32}
                step={1}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-[76px] accent-white"
              />
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
