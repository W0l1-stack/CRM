import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, Send, Zap, Mail, FileText } from 'lucide-react';
import { useAssist } from '@/hooks/useAI';
import { apiErrorMessage } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Build a follow-up automation for new hot leads',
  'Draft an SMS to re-engage cold contacts',
  'Create a contact form with name, email and budget',
  'What deals need attention in my pipeline?',
];

const createdMeta = {
  automation: { icon: Zap, to: (c) => `/automations/${c.id}` },
  campaign: { icon: Mail, to: (c) => `/campaigns/${c.id}/edit` },
  form: { icon: FileText, to: (c) => `/forms/${c.id}` },
};

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role, text, created? }
  const [input, setInput] = useState('');
  const assist = useAssist();
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, assist.isPending]);

  const send = (text) => {
    const content = (text ?? input).trim();
    if (!content || assist.isPending) return;
    const history = [...messages, { role: 'user', text: content }];
    setMessages(history);
    setInput('');
    assist.mutate(
      history.map((m) => ({ role: m.role, text: m.text })),
      {
        onSuccess: (res) =>
          setMessages((m) => [...m, { role: 'assistant', text: res.reply || 'Done.', created: res.created || [] }]),
        onError: (e) =>
          setMessages((m) => [...m, { role: 'assistant', text: apiErrorMessage(e, 'Something went wrong.'), error: true }]),
      }
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[560px] w-[min(92vw,400px)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI Assistant</span>
        <button className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-secondary" onClick={() => setOpen(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask me to build automations, campaigns or forms, or to analyze your pipeline.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full rounded-md border bg-background p-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm',
                m.role === 'user' ? 'bg-primary text-primary-foreground' : m.error ? 'bg-destructive/10 text-destructive' : 'bg-muted'
              )}
            >
              {m.text}
              {Array.isArray(m.created) && m.created.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.created.map((c) => {
                    const meta = createdMeta[c.type];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <Link
                        key={c.id}
                        to={meta.to(c)}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                      >
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        Open {c.type}: {c.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {assist.isPending && <div className="text-sm text-muted-foreground">Thinking…</div>}
      </div>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <input
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Ask the assistant…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" size="icon" disabled={assist.isPending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
