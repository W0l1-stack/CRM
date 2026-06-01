import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Search } from 'lucide-react';
import { useContacts, useCreateContact, useImportContacts } from '@/hooks/useContacts';
import { apiErrorMessage } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Contacts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const fileRef = useRef(null);

  const { data: contacts = [], isLoading, isError, error } = useContacts({ search, tag });
  const importContacts = useImportContacts();

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (file) importContacts.mutate(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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

      {importContacts.isSuccess && (
        <p className="text-sm text-muted-foreground">
          Imported {importContacts.data.created} contact(s)
          {importContacts.data.failed > 0 ? `, ${importContacts.data.failed} failed` : ''}.
        </p>
      )}

      {showCreate && <CreateContactForm onDone={() => setShowCreate(false)} />}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          placeholder="Filter by tag"
          className="max-w-[200px]"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="p-6 text-sm text-destructive">{apiErrorMessage(error, 'Could not load contacts')}</p>
        ) : contacts.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No contacts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
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
        )}
      </Card>
    </div>
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
