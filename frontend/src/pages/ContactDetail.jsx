import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  ArrowLeft, Mail, Phone, Building2, MessageSquare, KanbanSquare, Calendar,
  StickyNote, Send, User, Pencil, FileText, Zap,
} from 'lucide-react';
import { useContact, useContactTimeline } from '@/hooks/useContacts';
import { useComposeToContact } from '@/hooks/useConversations';
import { useTeam } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageSpinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Icon + color per timeline event type, so the feed scans at a glance.
const TYPE_META = {
  message: { icon: MessageSquare, color: 'bg-blue-100 text-blue-700' },
  note: { icon: StickyNote, color: 'bg-amber-100 text-amber-700' },
  deal: { icon: KanbanSquare, color: 'bg-violet-100 text-violet-700' },
  appointment: { icon: Calendar, color: 'bg-emerald-100 text-emerald-700' },
  form: { icon: FileText, color: 'bg-pink-100 text-pink-700' },
  automation: { icon: Zap, color: 'bg-orange-100 text-orange-700' },
};

function metaFor(event) {
  if (event.type === 'message' && event.subtype === 'note') return TYPE_META.note;
  return TYPE_META[event.type] || TYPE_META.message;
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

export default function ContactDetail() {
  const { id } = useParams();
  const { data: contact, isLoading } = useContact(id);
  const { data: timeline = [], isLoading: timelineLoading } = useContactTimeline(id);
  const { data: team = [] } = useTeam();

  if (isLoading) return <PageSpinner label="Loading contact…" />;
  if (!contact) return <p className="text-sm text-destructive">Contact not found.</p>;

  const owner = team.find((m) => m.id === contact.assigned_to);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/contacts">
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </Link>
      </Button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Summary card */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {initials(contact.name)}
                </div>
                <div>
                  <h1 className="text-lg font-semibold leading-tight">{contact.name}</h1>
                  {contact.company && <p className="text-sm text-muted-foreground">{contact.company}</p>}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <Detail icon={Mail} value={contact.email} href={contact.email ? `mailto:${contact.email}` : null} />
                <Detail icon={Phone} value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : null} />
                <Detail icon={Building2} value={contact.company} />
                <Detail icon={User} value={owner ? `Owner: ${owner.name}` : 'Unassigned'} />
              </div>

              {contact.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {contact.notes && <p className="border-t pt-3 text-sm text-muted-foreground">{contact.notes}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Activity timeline with sticky composer */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle>Activity timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="sticky top-0 z-10 border-b bg-card p-4">
              <Composer contactId={contact.id} />
            </div>
            <div className="p-4">
              {timelineLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timeline.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No activity yet. Add a note or send a message to get started.
                </p>
              ) : (
                <ol className="space-y-1">
                  {timeline.map((e, i) => {
                    const meta = metaFor(e);
                    const Icon = meta.icon;
                    return (
                      <li key={`${e.type}-${e.ref_id}-${i}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', meta.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {i < timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                        </div>
                        <div className="flex-1 pb-5">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="text-sm font-medium capitalize">
                              {e.subtype === 'note' ? 'Note' : `${e.type} · ${e.subtype}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {dayjs(e.timestamp).format('MMM D, YYYY h:mm A')}
                            </span>
                          </div>
                          {e.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{e.detail}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Composer({ contactId }) {
  const compose = useComposeToContact();
  const [channel, setChannel] = useState('note');
  const [content, setContent] = useState('');

  const send = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    compose.mutate(
      { contactId, channel, content: content.trim() },
      { onSuccess: () => setContent('') }
    );
  };

  const tabs = [
    { key: 'note', label: 'Note', icon: StickyNote },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'sms', label: 'SMS', icon: Phone },
  ];

  return (
    <form onSubmit={send} className="space-y-2">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setChannel(t.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              channel === t.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60'
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={channel === 'note' ? 'Add an internal note…' : `Send ${channel === 'sms' ? 'an SMS' : 'an email'}…`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button type="submit" disabled={compose.isPending || !content.trim()}>
          {channel === 'note' ? <Pencil className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {compose.isPending ? '…' : channel === 'note' ? 'Add' : 'Send'}
        </Button>
      </div>
    </form>
  );
}

function Detail({ icon: Icon, value, href }) {
  if (!value) return null;
  const body = (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{value}</span>
    </div>
  );
  return href ? (
    <a href={href} className="block transition-colors hover:text-foreground">
      {body}
    </a>
  ) : (
    body
  );
}
