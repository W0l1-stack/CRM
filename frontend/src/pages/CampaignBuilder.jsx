import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Heading, Type, MousePointerClick, Image as ImageIcon, Minus,
  GripVertical, Trash2, Copy, ArrowUp, ArrowDown, Users, Send, Mail, MessageSquare, GitBranch, Tag,
} from 'lucide-react';
import { useCampaign, useCreateCampaign, useUpdateCampaign, useSendCampaign } from '@/hooks/useCampaigns';
import { useContacts } from '@/hooks/useContacts';
import { useAutomations } from '@/hooks/useAutomations';
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

const SMS_VARS = [
  { label: 'Name', token: '{{name}}' },
  { label: 'Email', token: '{{email}}' },
  { label: 'Phone', token: '{{phone}}' },
  { label: 'Company', token: '{{company_name}}' },
];
const SAMPLE = { name: 'there', full_name: 'there', email: 'sam@example.com', phone: '+1 555-0100', company: 'Acme Co', company_name: 'Acme Co' };
const sampleRender = (t) =>
  String(t || '').replace(/\{\{\s*(?:contact\.)?(\w+)\s*\}\}/g, (_m, k) => SAMPLE[k] ?? k);

export default function CampaignBuilder() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: existing, isLoading } = useCampaign(isNew ? null : id);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const { data: contacts = [] } = useContacts();
  const { data: automations = [] } = useAutomations();

  const initialType = searchParams.get('type');
  const [channel, setChannel] = useState(initialType === 'sms' || initialType === 'journey' ? initialType : 'email');
  const [automationId, setAutomationId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [tag, setTag] = useState('');
  const [blocks, setBlocks] = useState(DEFAULT_BLOCKS);
  const [smsText, setSmsText] = useState('Hi {{name}},\n');
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const smsRef = useRef(null);

  // Insert a {{variable}} token at the caret in the SMS box.
  const insertVar = (token) => {
    const el = smsRef.current;
    if (!el) return setSmsText((t) => t + token);
    const start = el.selectionStart ?? smsText.length;
    const end = el.selectionEnd ?? smsText.length;
    setSmsText(smsText.slice(0, start) + token + smsText.slice(end));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const locked = existing && existing.status !== 'draft';
  const isSms = channel === 'sms';
  const isJourney = channel === 'journey';

  useEffect(() => {
    if (existing) {
      setChannel(existing.channel || 'email');
      setName(existing.name || '');
      setSubject(existing.subject || '');
      setTag(existing.recipient_filter?.tag || '');
      setAutomationId(existing.automation_id || '');
      if ((existing.channel || 'email') === 'sms') {
        setSmsText(existing.body_html || '');
      } else {
        const parsed = parseBlocks(existing.body_html);
        setBlocks(parsed && parsed.length ? parsed : [{ type: 'text', text: stripHtml(existing.body_html) }]);
      }
    }
  }, [existing]);

  // Audience estimate: email needs an address, SMS needs a phone.
  const audienceCount = useMemo(() => {
    const base = contacts.filter((c) => !c.is_unsubscribed && (isJourney ? true : isSms ? c.phone : c.email));
    if (!tag.trim()) return base.length;
    return base.filter((c) => (c.tags || []).includes(tag.trim())).length;
  }, [contacts, tag, isSms, isJourney]);

  const allTags = useMemo(() => {
    const set = new Set();
    contacts.forEach((c) => (c.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [contacts]);

  if (!isNew && isLoading) return <PageSpinner label="Loading campaign…" />;

  const addBlock = (type) => setBlocks((arr) => [...arr, blockDefaults(type)]);
  const setBlock = (i, patch) => setBlocks((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeBlock = (i) => setBlocks((arr) => arr.filter((_, idx) => idx !== i));
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

  const buildBody = () => {
    const base = { name: name.trim() || 'Untitled campaign', channel, recipient_filter: tag.trim() ? { tag: tag.trim() } : {} };
    if (isJourney) return { ...base, automation_id: automationId || null, subject: '', body_html: '' };
    return { ...base, subject: isSms ? '' : subject.trim(), body_html: isSms ? smsText : compileEmail(blocks) };
  };

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
      title: `Send ${isSms ? 'SMS' : 'email'} campaign now?`,
      description: `This sends to ${audienceCount} contact(s)${tag.trim() ? ` tagged "${tag.trim()}"` : ''}. This cannot be undone.`,
      confirmLabel: 'Send now',
      variant: 'default',
    }))) return;
    saveDraft((c) => sendCampaign.mutate(c?.id || id, { onSuccess: () => navigate('/campaigns') }));
  };

  const saving = createCampaign.isPending || updateCampaign.isPending;
  const ChannelIcon = isJourney ? GitBranch : isSms ? MessageSquare : Mail;
  const segments = Math.max(1, Math.ceil((smsText.length || 1) / 160));
  const cantSend = saving || sendCampaign.isPending || locked || audienceCount === 0 || (isJourney && !automationId);

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
          <Badge variant="outline" className="gap-1 uppercase">
            <ChannelIcon className="h-3 w-3" /> {channel}
          </Badge>
          {existing && <Badge variant="secondary" className="capitalize">{existing.status}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveDraft()} disabled={saving || locked}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button onClick={saveAndSend} disabled={cantSend}>
            <Send className="h-4 w-4" /> {isJourney ? 'Save & enroll' : 'Save & send'}
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
            {!isSms && !isJourney && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Subject line</Label>
                <Input value={subject} disabled={locked} onChange={(e) => setSubject(e.target.value)} placeholder="A subject that gets opened" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Audience</Label>
              <div className="flex items-center gap-2">
                <Input
                  list="campaign-tags"
                  value={tag}
                  disabled={locked}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder={isSms ? 'All contacts with a phone (or type a tag)' : 'All subscribed contacts (or type a tag)'}
                />
                <datalist id="campaign-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
                <Badge variant="secondary" className="shrink-0 gap-1 px-3 py-1.5">
                  <Users className="h-3.5 w-3.5" /> {audienceCount}
                </Badge>
              </div>
            </div>
          </Card>

          {isJourney ? (
            <Card className="space-y-2 p-4">
              <Label className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Automation to enroll into</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={automationId}
                disabled={locked}
                onChange={(e) => setAutomationId(e.target.value)}
              >
                <option value="">Select an automation…</option>
                {automations.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Each contact in the audience starts this automation as a journey (its waits, branches and replies apply per contact).
                {automations.length === 0 && ' Create an automation first.'}
              </p>
            </Card>
          ) : isSms ? (
            <Card className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</Label>
                <div className="flex flex-wrap gap-1">
                  {SMS_VARS.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      disabled={locked}
                      onClick={() => insertVar(v.token)}
                      className="rounded-full border bg-secondary px-2 py-0.5 text-xs font-medium transition-colors hover:bg-secondary/70 disabled:opacity-50"
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={smsRef}
                className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
                value={smsText}
                disabled={locked}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder={'Hello {{name}},\nThis SMS is from {{company_name}}. We have an update…'}
              />
              <p className="text-xs text-muted-foreground">
                {smsText.length} characters · {segments} SMS segment{segments > 1 ? 's' : ''} · press Enter for a new paragraph
              </p>
            </Card>
          ) : (
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
                      className={cn('p-3 transition-all', dragIdx === idx && 'opacity-50', overIdx === idx && dragIdx !== null && 'ring-2 ring-primary')}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        {!locked && <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />}
                        <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', meta.color)}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        {!locked && (
                          <div className="ml-auto flex items-center">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(idx, -1)} disabled={idx === 0}><ArrowUp className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(idx, 1)} disabled={idx === blocks.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateBlock(idx)}><Copy className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBlock(idx)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </div>
                      <BlockEditor block={block} disabled={locked} onChange={(patch) => setBlock(idx, patch)} />
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
          {isJourney ? (
            <div className="rounded-xl border bg-muted/40 p-6 text-center">
              <GitBranch className="mx-auto mb-2 h-8 w-8 text-cyan-600" />
              <p className="text-sm font-medium">
                Enrolls {audienceCount} contact(s){tag.trim() ? ` tagged "${tag.trim()}"` : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                into {automations.find((a) => a.id === automationId)?.name || '— pick an automation —'}
              </p>
            </div>
          ) : isSms ? (
            <div className="rounded-xl border bg-muted/40 p-6">
              <div className="mx-auto max-w-xs space-y-2">
                <div className="whitespace-pre-line rounded-2xl rounded-bl-sm bg-emerald-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow">
                  {sampleRender(smsText) || 'Your message preview…'}
                </div>
                <p className="text-center text-[11px] text-muted-foreground">SMS preview</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-muted/40 shadow-sm">
              <div className="border-b bg-card px-4 py-3">
                <p className="text-sm font-semibold">{subject || 'No subject'}</p>
                <p className="text-xs text-muted-foreground">From your workspace · to {audienceCount} recipient(s)</p>
              </div>
              <iframe title="Email preview" className="h-[520px] w-full bg-white" srcDoc={compileEmail(blocks)} />
            </div>
          )}
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
