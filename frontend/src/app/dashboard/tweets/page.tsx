"use client";

import { useState } from "react";
import { useBots } from "@/hooks/use-bots";
import {
  useTweets,
  useApproveTweet,
  useEditTweet,
  usePostNow,
  useScheduleTweet,
} from "@/hooks/use-tweets";
import type { TweetStatus } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Heart,
  Repeat2,
  Eye,
  ExternalLink,
  Pencil,
  Send,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Tweet } from "@/types";

const STATUS_OPTIONS: { value: TweetStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
  { value: "failed", label: "Failed" },
];

function statusVariant(status: TweetStatus) {
  switch (status) {
    case "posted":
      return "default" as const;
    case "failed":
      return "destructive" as const;
    case "draft":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export default function TweetsPage() {
  const [statusFilter, setStatusFilter] = useState<TweetStatus | "all">("all");
  const [botFilter, setBotFilter] = useState<string>("all");
  const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null);

  // Edit dialog state
  const [editingTweet, setEditingTweet] = useState<Tweet | null>(null);
  const [editContent, setEditContent] = useState("");

  // Schedule dialog state
  const [schedulingTweet, setSchedulingTweet] = useState<Tweet | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");

  const { data: bots } = useBots();
  const { data: tweets, isLoading } = useTweets({
    status: statusFilter === "all" ? undefined : statusFilter,
    botId: botFilter === "all" ? undefined : botFilter,
  });
  const approveTweet = useApproveTweet();
  const editTweet = useEditTweet();
  const postNow = usePostNow();
  const scheduleTweet = useScheduleTweet();

  const sortedTweets = tweets
    ?.slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const canEdit = (status: TweetStatus) =>
    status === "draft" || status === "approved";

  const canPostNow = (status: TweetStatus) =>
    status === "draft" || status === "approved";

  const canSchedule = (status: TweetStatus) =>
    status === "draft" || status === "approved";

  function openEdit(tweet: Tweet) {
    setEditContent(tweet.content);
    setEditingTweet(tweet);
  }

  function openSchedule(tweet: Tweet) {
    // Default to 1 hour from now
    const now = new Date();
    const dt = new Date(now.getTime() + 60 * 60 * 1000);
    setScheduleDate(dt.toISOString().slice(0, 16));
    setSchedulingTweet(tweet);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tweets</h1>
        <p className="text-muted-foreground">
          View and manage all generated tweets across your bots.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as TweetStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={botFilter} onValueChange={(v) => setBotFilter(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by bot">
              {botFilter === "all" ? "All Bots" : bots?.find((b) => b.id === botFilter)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Bots</SelectItem>
            {bots?.map((bot) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tweet History</CardTitle>
          <CardDescription>
            {sortedTweets?.length ?? 0} tweets found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !sortedTweets?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No tweets found matching your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[300px]">Content</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTweets.map((tweet) => {
                    const botName =
                      tweet.bot?.name ??
                      bots?.find((b) => b.id === tweet.botId)?.name ??
                      "—";

                    return (
                      <TableRow key={tweet.id}>
                        <TableCell>
                          <button
                            className="text-left line-clamp-2 text-sm hover:underline underline-offset-4"
                            onClick={() => setSelectedTweet(tweet)}
                          >
                            {tweet.content}
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{botName}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(tweet.status)}>
                            {tweet.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {tweet.impressions}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {tweet.likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat2 className="h-3 w-3" />
                              {tweet.retweets}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(tweet.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {tweet.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveTweet.mutate(tweet.id)}
                                disabled={approveTweet.isPending}
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Approve
                              </Button>
                            )}
                            {canEdit(tweet.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(tweet)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {canPostNow(tweet.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => postNow.mutate(tweet.id)}
                                disabled={postNow.isPending}
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            )}
                            {canSchedule(tweet.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openSchedule(tweet)}
                              >
                                <Clock className="h-3 w-3" />
                              </Button>
                            )}
                            {tweet.xTweetId && (
                              <a
                                href={`https://x.com/i/status/${tweet.xTweetId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                View
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tweet detail dialog */}
      <Dialog
        open={!!selectedTweet}
        onOpenChange={(open) => !open && setSelectedTweet(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tweet Details</DialogTitle>
            <DialogDescription>
              {selectedTweet &&
                format(new Date(selectedTweet.createdAt), "PPpp")}
            </DialogDescription>
          </DialogHeader>
          {selectedTweet && (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <p className="text-sm whitespace-pre-wrap">
                  {selectedTweet.content}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant={statusVariant(selectedTweet.status)}>
                    {selectedTweet.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Bot:</span>{" "}
                  {selectedTweet.bot?.name ??
                    bots?.find((b) => b.id === selectedTweet.botId)?.name ??
                    "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Impressions:</span>{" "}
                  {selectedTweet.impressions.toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground">Likes:</span>{" "}
                  {selectedTweet.likes.toLocaleString()}
                </div>
                <div>
                  <span className="text-muted-foreground">Retweets:</span>{" "}
                  {selectedTweet.retweets.toLocaleString()}
                </div>
                {selectedTweet.postedAt && (
                  <div>
                    <span className="text-muted-foreground">Posted:</span>{" "}
                    {format(new Date(selectedTweet.postedAt), "PPpp")}
                  </div>
                )}
              </div>

              {selectedTweet.errorMessage && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {selectedTweet.errorMessage}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {selectedTweet && canEdit(selectedTweet.status) && (
              <Button
                variant="outline"
                onClick={() => {
                  openEdit(selectedTweet);
                  setSelectedTweet(null);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {selectedTweet?.status === "draft" && (
              <Button
                onClick={() => {
                  approveTweet.mutate(selectedTweet.id, {
                    onSuccess: () => setSelectedTweet(null),
                  });
                }}
                disabled={approveTweet.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
            {selectedTweet && canPostNow(selectedTweet.status) && (
              <Button
                variant="secondary"
                onClick={() => {
                  postNow.mutate(selectedTweet.id, {
                    onSuccess: () => setSelectedTweet(null),
                  });
                }}
                disabled={postNow.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Post Now
              </Button>
            )}
            {selectedTweet && canSchedule(selectedTweet.status) && (
              <Button
                variant="secondary"
                onClick={() => {
                  openSchedule(selectedTweet);
                  setSelectedTweet(null);
                }}
              >
                <Clock className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            )}
            {selectedTweet?.xTweetId && (
              <Button
                variant="outline"
                render={
                  <a
                    href={`https://x.com/i/status/${selectedTweet.xTweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View on X
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tweet Dialog */}
      <Dialog
        open={!!editingTweet}
        onOpenChange={(open) => !open && setEditingTweet(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Tweet</DialogTitle>
            <DialogDescription>
              Modify the tweet content. Max 280 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              maxLength={280}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {editContent.length}/280
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTweet(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingTweet) {
                  editTweet.mutate(
                    { id: editingTweet.id, content: editContent },
                    { onSuccess: () => setEditingTweet(null) },
                  );
                }
              }}
              disabled={editTweet.isPending || !editContent.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Tweet Dialog */}
      <Dialog
        open={!!schedulingTweet}
        onOpenChange={(open) => !open && setSchedulingTweet(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Tweet</DialogTitle>
            <DialogDescription>
              Choose when this tweet should be posted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="schedule-datetime">Date &amp; Time</Label>
            <Input
              id="schedule-datetime"
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulingTweet(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (schedulingTweet && scheduleDate) {
                  scheduleTweet.mutate(
                    {
                      id: schedulingTweet.id,
                      scheduledFor: new Date(scheduleDate).toISOString(),
                    },
                    { onSuccess: () => setSchedulingTweet(null) },
                  );
                }
              }}
              disabled={scheduleTweet.isPending || !scheduleDate}
            >
              <Clock className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
