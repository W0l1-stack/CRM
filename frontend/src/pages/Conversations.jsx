import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Conversations() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <Card>
        <CardHeader>
          <CardTitle>Unified inbox — coming in Week 5–6</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The backend conversations/messages API is ready. The real-time inbox UI (email + SMS,
          live updates via the Node service) lands in the next milestone.
        </CardContent>
      </Card>
    </div>
  );
}
