import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Heading, Type, MousePointerClick, Image as ImageIcon, Minus,
  GripVertical, Trash2, Users, Send,
} from 'lucide-react';
import { useCampaign, useCreateCampaign, useUpdateCampaign, useSendCampaign } from '@/hooks/useCampaigns';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/spinner';
import { confirm } from '@/store/confirm.store';
import { compileEmail, parseBlocks, blockDefaults } from '@/lib/emailBlocks';
import { cn } from '@/lib/utils';

const BLOCK_TYPES = [
  { value: 'heading', label: 'Heading', icon: Heading },
  { value: 'text', label: 'Text', icon: Type },
  { value: 'button', label: 'Button', icon: MousePointerClick },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'divider', label: 'Divider', icon: Minus },
];

const DEFAULT_BLOCKS = [
  { type: 'heading', text: 'Hi {{contact.name}},' },
  { type: 'text', text: 'Write your message here.' },
];

export default function CampaignBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { data: existing, isLoading } = useCampaign(isNew ? null : id);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const { data: contacts = [] } = useContacts();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [tag, setTag] = useState('');
  const [blocks, setBlocks] = useState(DEFAULT_BLOCKS);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const locked = existing && existing.status !== 'draft';

  useEffect(() => {
    if (existing) {
      setName(existing.name || '');
      setSubject(existing.subject || '');
      setTag(existing.recipient_filter?.tag || '');
      const parsed = parseBlocks(existing.body_html);
      setBlocks(parsed && parsed.length ? parsed : [{ type: 'text', text: stripHtml(existing.body_html) }]);
    }
  }, [existing]);

  // Audience estimate from the loaded contacts (subscribed, optionally tagged).
  const audienceCount = useMemo(() => {
    const subscribed = contacts.filter((c) => !c.is_unsubscribed);
    if (!tag.trim()) return subscribed.length;
    return subscribed.filter((c) => (c.tags || []).includes(tag.trim())).length;
  }, [contacts, tag]);

  if (!isNew && isLoading) return <PageSpinner label="Loading campaign…" />;

  const addBlock = (type) => setBlocks((arr) => [...arr, blockDefaults(type)]);
  const setBlock = (i, patch) => setBlocks((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeBlock = (i) => setBlocks((arr) => arr.filter((_, idx) => idx !== i));
  const onDrop = (target) => {
    setOverIdx(null);
    if (dragIdx === null || dragIdx === target) return setDragIdx(null);
    setBlocks((arr) => {
      const next = [...arr];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const buildBody = () => ({
    name: name.trim() || 'Untitled campaign',
    subject: subject.trim(),
    body_html: compileEmail(blocks),
    recipient_filter: tag.trim() ? { tag: tag.trim() } : {},
  });

  const saveDraft = (after) => {
    const body = buildBody();
    if (isNew) {
      createCampaign.mutate(body, { onSuccess: (c) => (after ? after(c) : navigate('/campaigns')) });
    } else {
      updateCampaign.mutate({ id, ...body }, { onSuccess: (c) => (after ? after(c) : navigate('/campaigns')) });
    }
  };

  const saveAndSend = async () => {
    if (
      !(await confirm({
        title: 'Send campaign now?',
        description: `This emails ${audienceCount} contact(s)${tag.trim() ? ` tagged "${tag.trim()}"` : ''}. This cannot be undone.`,
        confirmLabel: 'Send now',
        variant: 'default',
      }))
    ) {
      return;
    }
    saveDraft((c) => {
      const cid = c?.id || id;
      sendCampaign.mutate(cid, { onSuccess: () => navigate('/campaigns') });
    });
  };

  const saving = createCampaign.isPending || updateCampaign.isPending;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/campaigns">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
      </Button>

      {locked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This campaign has already been {existing.status}. It’s read-only.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Campaign name"
          className="max-w-sm text-lg font-semibold"
          value={name}
          disabled={locked}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveDraft()} disabled={saving || locked}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={saveAndSend} disabled={saving || sendCampaign.isPending || locked || audienceCount === 0}>
            <Send className="h-4 w-4" /> Save & send
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Composer */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="space-y-1">
                <Label>Subject line</Label>
                <Input value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} placeholder="A subject that gets opened" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Audience tag (blank = all subscribed)</Label>
                  <Input value={tag} disabled={locked} onChange={(e) => setTag(e.target.value)} placeholder="e.g. hot-lead" />
                </div>
                <div className="flex items-end">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {audienceCount} recipient(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {blocks.map((block, idx) => (
              <Card
                key={idx}
                draggable={!locked}
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                onDrop={() => onDrop(idx)}
                className={cn('p-3', dragIdx === idx && 'opacity-50', overIdx === idx && dragIdx !== null && 'ring-2 ring-primary')}
              >
                <div className="mb-2 flex items-center gap-2">
                  {!locked && <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />}
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{block.type}</span>
                  {!locked && (
                    <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => removeBlock(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <BlockEditor block={block} disabled={locked} onChange={(patch) => setBlock(idx, patch)} />
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar: blocks palette + preview */}
        <div className="space-y-4">
          {!locked && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add block</p>
              <div className="grid grid-cols-2 gap-2">
                {BLOCK_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => addBlock(t.value)}
                    className="flex items-center gap-2 rounded-md border bg-card p-2 text-left text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <t.icon className="h-4 w-4 text-muted-foreground" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border bg-white p-1">
                <iframe title="Email preview" className="h-[420px] w-full rounded" srcDoc={compileEmail(blocks)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange, disabled }) {
  switch (block.type) {
    case 'heading':
      return <Input value={block.text || ''} disabled={disabled} onChange={(e) => onChange({ text: e.target.value })} placeholder="Headline" />;
    case 'text':
      return (
        <textarea
          className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={block.text || ''}
          disabled={disabled}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Message (supports {{contact.name}})"
        />
      );
    case 'button':
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input value={block.label || ''} disabled={disabled} onChange={(e) => onChange({ label: e.target.value })} placeholder="Button text" />
          <Input value={block.url || ''} disabled={disabled} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://" />
        </div>
      );
    case 'image':
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input value={block.url || ''} disabled={disabled} onChange={(e) => onChange({ url: e.target.value })} placeholder="Image URL" />
          <Input value={block.alt || ''} disabled={disabled} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Alt text" />
        </div>
      );
    case 'divider':
      return <div className="border-t" />;
    default:
      return null;
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
