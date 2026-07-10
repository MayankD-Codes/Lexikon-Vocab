import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { lexiChatStream, type LexiMsg } from "@/lib/lexi";

const STORAGE_KEY = "lexi-chat-history";
const MAX_HISTORY = 50;

const loadHistory = (): LexiMsg[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
};

const LexiChat = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<LexiMsg[]>(loadHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    }
  }, [open, messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (text.length > 1000) {
      toast.error("Message too long (max 1000 chars)");
      return;
    }
    const userMsg: LexiMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    let acc = "";
    try {
      await lexiChatStream(next, {
        onDelta: (chunk) => {
          acc += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
            }
            return [...prev, { role: "assistant", content: acc }];
          });
        },
        onDone: () => setBusy(false),
      });
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Lexi could not respond");
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "user" && m.content === text) ? true : true));
    }
  };

  const clear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      {/* Floating bubble */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Lexi" : "Open Lexi"}
        className={cn(
          "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50",
          "h-14 w-14 rounded-full bg-gradient-warm text-primary-foreground shadow-lg",
          "flex items-center justify-center transition-transform hover:scale-105 active:scale-95",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 bg-card border border-border/60 shadow-xl flex flex-col",
            "inset-x-2 bottom-20 top-16 rounded-2xl",
            "sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-24 sm:w-[380px] sm:h-[560px]",
          )}
          role="dialog"
          aria-label="Lexi chat"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-warm flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-semibold leading-none">Lexi</div>
                <div className="text-xs text-muted-foreground">Your vocab coach</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={clear} className="text-xs">
              Clear
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8 space-y-2">
                <p>Hi! I'm Lexi 👋</p>
                <p className="text-xs">Ask me about meanings, usage, etymology, or grammar.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-secondary text-secondary-foreground",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            ))}
            {busy && messages[messages.length - 1]?.role === "user" && (
              <div className="mr-auto bg-secondary text-secondary-foreground rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Lexi is thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-border/60 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Lexi about a word…"
              maxLength={1000}
              disabled={busy}
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default LexiChat;
