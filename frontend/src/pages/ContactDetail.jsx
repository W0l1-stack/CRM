import { useParams, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { ArrowLeft, Mail, Phone, Building2, MessageSquare, KanbanSquare, Calendar } from 'lucide-react';
import { useContact, useContactTimeline } from '@/hooks/useContacts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const eventIcon = { message: MessageSquare, deal: KanbanSquare, appointment: Calendar };

export default function ContactDetail() {
  const { id } = useParams();
  const { data: contact, isLoading } = useContact(id);
  const { data: timeline = [] } = useContactTimeline(id);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!contact) return <p className="text-sm text-destructive">Contact not found.</p>;

  return (
    <div className="space-y-4">
      <Link to="/contacts">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </Button>
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{contact.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Detail icon={Mail} value={contact.email} />
            <Detail icon={Phone} value={contact.phone} />
            <Detail icon={Building2} value={contact.company} />
            {contact.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {contact.tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
            {contact.notes && <p className="pt-2 text-muted-foreground">{contact.notes}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-4">
                {timeline.map((e) => {
                  const Icon = eventIcon[e.type] || MessageSquare;
                  return (
                    <li key={`${e.type}-${e.ref_id}`} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {e.type} · {e.subtype}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {dayjs(e.timestamp).format('MMM D, YYYY h:mm A')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{e.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-4 w-4" />
      <span>{value}</span>
    </div>
  );
}
