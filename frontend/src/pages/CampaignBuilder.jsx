import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Heading, Type, MousePointerClick, Image as ImageIcon, Minus,
  GripVertical, Trash2, Copy, ArrowUp, ArrowDown, Users, Send, Mail, Tag,
} from 'lucide-react';
import { useCampaign, useCreateCampaign, useUpdateCampaign, useSendCampaign } from '@/hooks/useCampaigns';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSpinner } from '@/components/ui/spinner';
import { confirm } from '@/store/confirm.store';
import { compileEmail, parseBlocks, blockDefaults } from '@/lib/emailBlocks';
import { cn } from '@/lib/utils';

const BLOCK_TYPES = [
  { value: 'heading', label: 'Heading', icon: Heading, color: 'bg-blue-100 text-blue-700' },
  { value: 'text', label: 'Text', icon: Type, color: 'bg-slate-100 text-slate-700' },
  { value: 'button', label: 'Button', icon: MousePointerClick, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'image', label: 'Image', icon: ImageIcon, color: 'bg-violet-100 text-violet-700' },
  { value: 'divider', label: 'Divider', icon: Minus, color: 'bg-amber-100 text-amber-700' },
];
const blockMeta = (t) => BLOCK_TYPES.find((b) => b.value === t) || BLOCK_TYPES[1];

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
  const [selected, setSelected] = useState(0);
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

  const audienceCount = useMemo(() => {
    const subscribed = contacts.filter((c) => !c.is_unsubscribed);
    if (!tag.trim()) return subscribed.length;
    return subscribed.filter((c) => (c.tags || []).includes(tag.trim())).length;
  }, [contacts, tag]);

  const allTags = useMemo(() => {
    const set = new Set();
    contacts.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [contacts]);

  if (!isNew && isLoading) return <PageSpinner label="Loading campaign…" />;

  const addBlock = (type) => setBlocks((arr) => { setSelected(arr.length); return [...arr, blockDefaults(type)]; });
  const setBlock = (i, patch) => setBlocks((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeBlock = (i) => { setBlocks((arr) => arr.filter((_, idx) => idx !== i)); setSelected(-1); };
  const duplicateBlock = (i) => setBlocks((arr) => [...arr.slice(0, i + 1), { ...arr[i] }, ...arr.slice(i + 1)]);
  const moveBlock = (i, dir) => setBlocks((arr) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
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
    if (!(await confirm({
      title: 'Send campaign now?',
      description: `This emails ${audienceCount} contact(s)${tag.trim() ? ` tagged "${tag.trim()}"` : ''}. This cannot be undone.`,
      confirmLabel: 'Send now',
      variant: 'default',
    }))) return;
    saveDraft((c) => sendCampaign.mutate(c?.id || id, { onSuccess: () => navigate('/campaigns') }));
  };

  const saving = createCampaign.isPending || updateCampaign.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <Input
            placeholder="Untitled campaign"
            className="w-64 text-lg font-semibold"
            value={name}
            disabled={locked}
            onChange={(e) => setName(e.target.value)}
          />
          {existing && <Badge variant="secondary" className="capitalize">{existing.status}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveDraft()} disabled={saving || locked}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={saveAndSend} disabled={saving || sendCampaign.isPending || locked || audienceCount === 0}>
            <Send className="h-4 w-4" /> Save & send
          </Button>
        </div>
      </div>

      {locked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This campaign was already {existing.status} — it’s read-only.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: setup + composer */}
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Subject line</Label>
              <Input value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} placeholder="A subject that gets opened" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Audience</Label>
              <div className="flex items-center gap-2">
                <Input
                  list="campaign-tags"
                  value={tag}
                  disabled={locked}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="All subscribed contacts (or type a tag)"
                />
                <datalist id="campaign-tags">
                  {allTags.map((t) => <option key={t} value={t} />)}
                </datalist>
                <Badge variant="secondary" className="shrink-0 gap-1 px-3 py-1.5">
                  <Users className="h-3.5 w-3.5" /> {audienceCount}
                </Badge>
              </div>
            </div>
          </Card>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Content blocks</p>
              {!locked && (
                <div className="flex gap-1">
                  {BLOCK_TYPES.map((t) => (
                    <Button key={t.value} type="button" variant="outline" size="icon" className="h-8 w-8" title={`Add ${t.label}`} onClick={() => addBlock(t.value)}>
                      <t.icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {blocks.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Add a content block to start composing.
                </div>
              )}
              {blocks.map((block, idx) => {
                const meta = blockMeta(block.type);
                const Icon = meta.icon;
                return (
                  <Card
                    key={idx}
                    draggable={!locked}
                    onDragStart={() => setDragIdx(idx)}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                    onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                    onDrop={() => onDrop(idx)}
                    className={cn(
                      'p-3 transition-all',
                      selected === idx && 'border-primary/50',
                      dragIdx === idx && 'opacity-50',
                      overIdx === idx && dragIdx !== null && 'ring-2 ring-primary'
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {!locked && <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />}
                      <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', meta.color)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      {!locked && (
                        <div className="ml-auto flex items-center">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateBlock(idx)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBlock(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <BlockEditor block={block} disabled={locked} onChange={(patch) => setBlock(idx, patch)} />
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: email-client style preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          <div className="overflow-hidden rounded-xl border bg-muted/40 shadow-sm">
            <div className="border-b bg-card px-4 py-3">
              <p className="text-sm font-semibold">{subject || 'No subject'}</p>
              <p className="text-xs text-muted-foreground">From your workspace · to {audienceCount} recipient(s)</p>
            </div>
            <iframe title="Email preview" className="h-[520px] w-full bg-white" srcDoc={compileEmail(blocks)} />
          </div>
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
      return <p className="text-xs text-muted-foreground">A horizontal divider line.</p>;
    default:
      return null;
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
