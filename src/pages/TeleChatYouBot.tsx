import { useEffect, useRef, useState } from "react";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { useNavigate } from "react-router";

type BotMessage = {
  id: string;
  sender: "user" | "bot";
  text: string;
  createdAt: number;
};

const STORAGE_KEY = "tcy-telechatyou-bot-messages";
const BOT_REPLY =
  "Привет! Это официальный бот TeleChatYou. Следите за сообщениями и обновлениями тут!";

function loadMessages(): BotMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BotMessage =>
      !!item &&
      typeof item.id === "string" &&
      (item.sender === "user" || item.sender === "bot") &&
      typeof item.text === "string" &&
      typeof item.createdAt === "number"
    );
  } catch {
    return [];
  }
}

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TeleChatYouBot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<BotMessage[]>(loadMessages);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // The chat still works in private browsing even if storage is unavailable.
    }
  }, [messages]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;

    const now = Date.now();
    const next: BotMessage[] = [
      ...messages,
      { id: messageId(), sender: "user", text: body, createdAt: now },
    ];

    // The bot intentionally responds to the exact command "start" only.
    if (body === "start") {
      next.push({
        id: messageId(),
        sender: "bot",
        text: BOT_REPLY,
        createdAt: now + 1,
      });
    }

    setMessages(next);
    setText("");
  };

  return (
    <div className="relative h-full flex flex-col">
      <header className="relative z-10 px-3 pt-2 safe-top pb-2 border-b tcy-line tcy-header-blur">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Назад к чатам"
            className="tcy-press w-10 h-10 rounded-full flex items-center justify-center tcy-dim shrink-0"
          >
            <ArrowLeft size={21} />
          </button>
          <img
            src="/telechatyou-bot-avatar.svg"
            alt=""
            draggable={false}
            className="w-[42px] h-[42px] rounded-[30%] object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15.5px] tcy-text truncate">TeleChatYou</div>
            <div className="text-[12px] font-semibold tcy-accent">официальный бот</div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3 py-4">
        {messages.length === 0 ? (
          <div className="h-full min-h-[180px] flex items-center justify-center">
            <div className="max-w-[260px] text-center text-[13px] tcy-dim leading-relaxed">
              Напишите <span className="font-bold tcy-accent">start</span> и отправьте сообщение, чтобы получить приветствие от бота.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.sender === "bot" && (
                  <img
                    src="/telechatyou-bot-avatar.svg"
                    alt=""
                    draggable={false}
                    className="w-7 h-7 rounded-[30%] object-cover shrink-0"
                  />
                )}
                <div
                  className={`max-w-[84%] rounded-[19px] px-3.5 py-2.5 ${message.sender === "bot" ? "border tcy-line" : ""}`}
                  style={message.sender === "user"
                    ? { background: "var(--tcy-accent)", color: "var(--tcy-on-accent)" }
                    : { background: "var(--tcy-card)", color: "var(--tcy-text)" }}
                >
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.4]">{message.text}</p>
                  <div className="mt-1 text-right text-[10px] opacity-65 tabular-nums">
                    {timeLabel(message.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="px-3 pb-3 pt-1.5 safe-bottom">
        <div className="flex items-center gap-2 rounded-[26px] border tcy-line tcy-header-blur px-2 py-2 tcy-shadow-soft">
          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="start"
            autoComplete="off"
            aria-label="Сообщение боту"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] tcy-text placeholder:text-[color:var(--tcy-faint)] px-2 py-2"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Отправить"
            className="tcy-press w-11 h-11 rounded-full tcy-gradient-accent tcy-shadow-accent flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ color: "var(--tcy-on-accent)" }}
          >
            <SendHorizontal size={19} />
          </button>
        </div>
      </form>
    </div>
  );
}
