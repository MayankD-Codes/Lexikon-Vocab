import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Trash2, Users } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";

interface CommunityMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

const ENGLISH_ONLY = /^[\x20-\x7E\n\r\t]+$/;

const messageSchema = z
  .string()
  .trim()
  .min(1, "Write something first")
  .max(500, "Keep it under 500 characters")
  .regex(ENGLISH_ONLY, "English (ASCII) only — no other scripts or emoji");

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
};

const initialsOf = (name: string | null | undefined, fallback = "?") =>
  (name || fallback).trim().slice(0, 2).toUpperCase();

const Community = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    const { data, error } = await supabase.rpc("get_community_messages", {
      _limit: 200,
    });
    if (error) {
      toast.error("Couldn't load messages");
      setLoading(false);
      return;
    }
    // RPC returns newest-first; reverse for chat order (oldest at top)
    const list = (data ?? []).slice().reverse() as CommunityMessage[];
    setMessages(list);
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel("community-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        () => {
          loadMessages();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_messages" },
        (payload) => {
          const removedId = (payload.old as { id?: string })?.id;
          if (!removedId) return;
          setMessages((prev) => prev.filter((m) => m.id !== removedId));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to newest
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onlineCount = useMemo(() => {
    const ids = new Set(messages.map((m) => m.user_id));
    return ids.size;
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to chat");
      return;
    }
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid message");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("community_messages").insert({
      user_id: user.id,
      content: parsed.data,
    });
    setSending(false);
    if (error) {
      toast.error(
        error.message.includes("English")
          ? "Only English (ASCII) characters allowed"
          : "Couldn't send message",
      );
      return;
    }
    setInput("");
  };

  const removeMessage = async (id: string) => {
    const { error } = await supabase
      .from("community_messages")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Couldn't delete message");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Message deleted");
  };

  return (
    <div className="container mx-auto max-w-3xl p-4 sm:p-6">
      <SEO
        title="Community Chat — Lexikon"
        description="Talk with other Lexikon learners in English. Practice, share words, and build your vocabulary together."
      />

      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Community Chat
          </h1>
          <p className="text-sm text-muted-foreground">
            English only. Be kind. Practice together.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {onlineCount} {onlineCount === 1 ? "voice" : "voices"}
        </div>
      </header>

      <Card className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden border-border/60 bg-card/80 shadow-soft">
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">
              Loading conversation…
            </p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Users className="mb-2 h-8 w-8 opacity-60" />
              No messages yet. Say hello 👋
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {m.avatar_url && (
                      <AvatarImage src={m.avatar_url} alt={m.display_name ?? "User"} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {initialsOf(m.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`group max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}
                  >
                    <div
                      className={`mb-0.5 flex items-center gap-2 text-[10px] ${
                        mine
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-medium">
                        {mine ? "You" : m.display_name || "Anonymous"}
                      </span>
                      <span>·</span>
                      <span>{formatTime(m.created_at)}</span>
                      {mine && (
                        <button
                          onClick={() => removeMessage(m.id)}
                          className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Delete message"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={send}
          className="border-t border-border/60 bg-background/60 p-3 sm:p-4"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Type a message in English… (Enter to send, Shift+Enter for newline)"
              className="min-h-[44px] flex-1 resize-none"
              maxLength={500}
              disabled={sending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>English (ASCII) only</span>
            <span>{input.length}/500</span>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Community;
