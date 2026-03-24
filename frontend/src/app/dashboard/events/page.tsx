"use client";

import { useState } from "react";
import { useEventCategories, useEvents, useForwardEvent } from "@/hooks/use-events";
import { useBots } from "@/hooks/use-bots";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Clock } from "lucide-react";

export default function EventsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [forwardTarget, setForwardTarget] = useState<string | null>(null); // holds eventId
  const [selectedBot, setSelectedBot] = useState<string>("");

  const { data: categories, isLoading: categoriesLoading } = useEventCategories();
  const { data: eventsData, isLoading: eventsLoading } = useEvents(
    selectedCategory ? { category: selectedCategory } : {}
  );
  const { data: bots, isLoading: botsLoading } = useBots();
  const forwardEvent = useForwardEvent();

  function handleForward() {
    if (!forwardTarget || !selectedBot) return;
    forwardEvent.mutate(
      { id: forwardTarget, botId: selectedBot },
      {
        onSuccess: () => {
          setForwardTarget(null);
          setSelectedBot("");
        },
      }
    );
  }

  // Auto-select first bot if not set
  if (bots && bots.length > 0 && !selectedBot) {
    setSelectedBot(bots[0].id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Feed</h1>
          <p className="text-muted-foreground">
            View the ingested events across your system and manually forward them to your bots.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Categories</h3>
        <div className="w-full overflow-x-auto whitespace-nowrap pb-4">
          <div className="flex space-x-2 px-1 flex-nowrap">
            <Badge
              variant={selectedCategory === undefined ? "default" : "outline"}
              className="cursor-pointer text-sm px-4 py-1"
              onClick={() => setSelectedCategory(undefined)}
            >
              All Events
            </Badge>
            {categoriesLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              categories?.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer text-sm px-4 py-1 flex items-center space-x-2"
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      {eventsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !eventsData?.events?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold">No active events ingested yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Please wait for your ingestion adapters to pull down external data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {eventsData.events.map((event) => (
            <Card key={event.id} className="flex flex-col">
              <CardHeader className="pb-3 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="text-xs uppercase tracking-wider">
                    {event.source}
                  </Badge>
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(event.occurredAt).toLocaleDateString()}
                  </span>
                </div>
                <CardTitle className="text-base leading-tight">
                  <a
                    href={event.sourceUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {event.title}
                  </a>
                </CardTitle>
                {event.description && (
                  <CardDescription className="line-clamp-3 mt-1 text-sm">
                    {event.description.replace(/<[^>]*>?/gm, "")}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  className="w-full font-medium"
                  onClick={() => setForwardTarget(event.id)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Forward to Bot
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Forward Modal */}
      <Dialog
        open={!!forwardTarget}
        onOpenChange={(open) => {
          if (!open) {
            setForwardTarget(null);
            setSelectedBot("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Event for Tweet Generation</DialogTitle>
            <DialogDescription>
              Select which bot should use this event context to generate a tweet. 
              The bot will write the tweet according to its assigned persona and active topics.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {botsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : bots && bots.length > 0 ? (
              <select
                value={selectedBot}
                onChange={(e) => setSelectedBot(e.target.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bots.filter((b) => b.isActive).map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} {bot.persona ? `(${bot.persona.slice(0, 30)}...)` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-destructive">
                You do not have any active bots to forward this event to. Please create one.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleForward}
              disabled={forwardEvent.isPending || !selectedBot}
            >
              {forwardEvent.isPending ? "Forwarding..." : "Forward to Bot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
