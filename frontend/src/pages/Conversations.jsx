import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Send, Circle, MessageSquare } from 'lucide-react';
import { useConversations, useMessages, useSendMessage } from '@/hooks/useConversations';
import { useContacts } from '@/hooks/useContacts';
import { getSocket } from '@/lib/socket';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { toast } from '@/store/toast.store';
import { cn } from '@/lib/utils';

export default function Conversations() {
  const qc = useQueryClient();
  const { data: conversations = [], isLoading } = useConversations();
  const { data: contacts = [] } = useContacts();
  const [selectedId, setSelectedId] = useState(null);
  const [live, setLive] = useState(false);

  const contactName = useMemo(() => {
    const map = {};
    contacts.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [contacts]);

  // Live updates: refresh the open thread and the list when events arrive.
  useEffect(() => {
    const socket = getSocket();
    setLive(socket.connected);
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onCreated = (payload) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (payload?.conversation_id) {
        qc.invalidateQueries({ queryKey: ['messages', payload.conversation_id] });
      }
      // Notify on inbound messages the user isn't currently looking at.
      if (payload?.direction === 'inbound' && payload.conversation_id !== selectedId) {
        toast.info('New message received');
      }
    };
    const onUpdated = (payload) => {
      if (payload?.conversation_id) {
        qc.invalidateQueries({ queryKey: ['messages', payload.conversation_id] });
      }
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:created', onCreated);
    socket.on('message:updated', onUpdated);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:created', onCreated);
      socket.off('message:updated', onUpdated);
    };
  }, [qc, selectedId]);

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <Card className="flex w-80 shrink-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b p-4 font-semibold">
          <span>Inbox</span>
          <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', live ? 'bg-green-500' : 'bg-muted-foreground/40')} />
            {live ? 'Live' : 'Offline'}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex w-full flex-col gap-1 border-b p-4 text-left transition-colors hover:bg-muted/50',
                  selectedId === c.id && 'bg-muted'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{contactName[c.contact_id] || 'Unknown contact'}</span>
                  <Badge variant="secondary">{c.channel}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {c.last_message_at ? dayjs(c.last_message_at).format('MMM D, h:mm A') : 'No messages'}
                </span>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="flex flex-1 flex-col overflow-hidden">
        {selected ? (
          <Thread conversation={selected} title={contactName[selected.contact_id] || 'Conversation'} />
        ) : conversations.length === 0 ? (
          <EmptyState
            className="m-auto border-0 bg-transparent"
            icon={MessageSquare}
            title="No conversations yet"
            description="Send an email or SMS to a contact, or wait for an inbound message — every thread lands here."
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view the thread.
          </div>
        )}
      </Card>
    </div>
  );
}

function Thread({ conversation, title }) {
  const { data: messages = [] } = useMessages(conversation.id);
  const sendMessage = useSendMessage();
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage.mutate(
      { conversationId: conversation.id, direction: 'outbound', channel: conversation.channel, content: text.trim() },
      { onSuccess: () => setText('') }
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b p-4">
        <Circle className="h-2 w-2 fill-primary text-primary" />
        <span className="font-semibold">{title}</span>
        <Badge variant="outline" className="ml-auto">
          {conversation.status}
        </Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                  m.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                <p>{m.content}</p>
                <p className={cn('mt-1 text-[10px]', m.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {dayjs(m.created_at).format('MMM D, h:mm A')} · {m.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="flex gap-2 border-t p-4" onSubmit={submit}>
        <Input placeholder={`Reply via ${conversation.channel}…`} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
