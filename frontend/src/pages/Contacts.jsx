import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Upload, Search, Users, Tag, Trash2, Mail, Bookmark, X } from 'lucide-react';
import {
  useContacts,
  useCreateContact,
  useImportContacts,
  useBulkTagContacts,
  useBulkDeleteContacts,
} from '@/hooks/useContacts';
import { apiErrorMessage } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/store/toast.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { cn } from '@/lib/utils';

const VIEWS_KEY = 'lydia-contact-views';
const loadViews = () => {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]');
  } catch {
    return [];
  }
};

export default function Contacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [views, setViews] = useState(loadViews);
  const [savingView, setSavingView] = useState(false);
  const fileRef = useRef(null);
  const undoTimer = useRef(null);
  const { canDelete } = usePermissions();

  // Open the create form when arriving via the command palette / ⌘N.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: contacts = [], isLoading, isError, error } = useContacts({ search, tag });
  const importContacts = useImportContacts();
  const bulkTag = useBulkTagContacts();
  const bulkDelete = useBulkDeleteContacts();

  const visible = useMemo(() => contacts.filter((c) => !hiddenIds.has(c.id)), [contacts, hiddenIds]);
  const selectedContacts = useMemo(() => visible.filter((c) => selected.has(c.id)), [visible, selected]);
  const allSelected = visible.length > 0 && selected.size === visible.length;

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (file) importContacts.mutate(file);
    e.target.value = '';
  };

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  const handleBulkTag = () => {
    const value = window.prompt('Tag to add to selected contacts:');
    if (!value?.trim()) return;
    bulkTag.mutate({ contacts: selectedContacts, tag: value.trim() }, { onSuccess: clearSelection });
  };

  // Deferred delete with undo: hide the rows immediately, fire the real delete
  // after the toast window, and let Undo cancel it before then.
  const handleBulkDelete = () => {
    const ids = selectedContacts.map((c) => c.id);
    if (ids.length === 0) return;
    setHiddenIds((prev) => new Set([...prev, ...ids]));
    clearSelection();

    undoTimer.current = setTimeout(() => {
      bulkDelete.mutate(ids, {
        onSettled: () => setHiddenIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        }),
      });
      undoTimer.current = null;
    }, 5000);

    toast.action(`${ids.length} contact(s) deleted`, {
      label: 'Undo',
      onClick: () => {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        undoTimer.current = null;
        setHiddenIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      },
    });
  };

  const saveView = (name) => {
    const view = { name: name.trim(), search, tag };
    const next = [...views.filter((v) => v.name !== view.name), view];
    setViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
    setSavingView(false);
    toast.success(`Saved view “${view.name}”`);
  };
  const applyView = (v) => {
    setSearchInput(v.search);
    setSearch(v.search);
    setTag(v.tag);
  };
  const deleteView = (name) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importContacts.isPending}>
            <Upload className="h-4 w-4" />
            {importContacts.isPending ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4" />
            New contact
          </Button>
        </div>
      </div>

      {showCreate && <CreateContactForm onDone={() => setShowCreate(false)} />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Input
          placeholder="Filter by tag"
          className="sm:max-w-[200px]"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      {/* Saved views */}
      <div className="flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <span key={v.name} className="group inline-flex items-center">
            <button
              onClick={() => applyView(v)}
              className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <Bookmark className="h-3 w-3" />
              {v.name}
            </button>
            <button
              onClick={() => deleteView(v.name)}
              className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              aria-label={`Delete view ${v.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {savingView ? (
          <SaveViewInput onSave={saveView} onCancel={() => setSavingView(false)} />
        ) : (
          (search || tag) && (
            <Button variant="ghost" size="sm" onClick={() => setSavingView(true)}>
              <Bookmark className="h-3.5 w-3.5" /> Save view
            </Button>
          )
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 shadow-sm animate-fade-in-down">
          <span className="px-2 text-sm font-medium">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={handleBulkTag} disabled={bulkTag.isPending}>
            <Tag className="h-4 w-4" /> Tag
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/campaigns?new=1')}>
            <Mail className="h-4 w-4" /> Email
          </Button>
          {canDelete && (
            <Button variant="outline" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={clearSelection} className="ml-auto">
            Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <Card>
          <TableSkeleton rows={6} cols={5} />
        </Card>
      ) : isError ? (
        <Card>
          <p className="p-6 text-sm text-destructive">{apiErrorMessage(error, 'Could not load contacts')}</p>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search || tag ? 'No matching contacts' : 'No contacts yet'}
          description={
            search || tag
              ? 'Try a different search or clear your filters.'
              : 'Add your first contact or import a CSV to get started.'
          }
          action={
            !search && !tag ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Add contact
              </Button>
            ) : null
          }
          secondaryAction={
            !search && !tag ? (
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            ) : null
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-primary"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-muted/50',
                    selected.has(c.id) && 'bg-primary/5'
                  )}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-primary"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Select ${c.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.company || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function SaveViewInput({ onSave, onCancel }) {
  const [name, setName] = useState('');
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name);
      }}
    >
      <Input autoFocus placeholder="View name" className="h-8 w-40" value={name} onChange={(e) => setName(e.target.value)} />
      <Button type="submit" size="sm" disabled={!name.trim()}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}

function CreateContactForm({ onDone }) {
  const createContact = useCreateContact();
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', tags: '' });

  const submit = (e) => {
    e.preventDefault();
    const body = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    createContact.mutate(body, { onSuccess: onDone });
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Card className="p-4">
      <form className="grid grid-cols-2 gap-3 md:grid-cols-5" onSubmit={submit}>
        <Input placeholder="Name *" required {...field('name')} />
        <Input placeholder="Email" type="email" {...field('email')} />
        <Input placeholder="Phone" {...field('phone')} />
        <Input placeholder="Company" {...field('company')} />
        <Input placeholder="Tags (comma sep)" {...field('tags')} />
        <div className="col-span-2 flex gap-2 md:col-span-5">
          <Button type="submit" disabled={createContact.isPending}>
            {createContact.isPending ? 'Saving…' : 'Save contact'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
