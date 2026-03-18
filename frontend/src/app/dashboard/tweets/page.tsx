"use client";

import { useState } from "react";
import { useBots } from "@/hooks/use-bots";
import { useTweets, useApproveTweet } from "@/hooks/use-tweets";
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
import { Check, Heart, Repeat2, Eye, ExternalLink } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { Tweet } from "@/types";

const STATUS_OPTIONS: { value: TweetStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
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

  const { data: bots } = useBots();
  const { data: tweets, isLoading } = useTweets({
    status: statusFilter === "all" ? undefined : statusFilter,
    botId: botFilter === "all" ? undefined : botFilter,
  });
  const approveTweet = useApproveTweet();

  const sortedTweets = tweets
    ?.slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

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
            <SelectValue placeholder="Filter by bot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bots</SelectItem>
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
          <DialogFooter>
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
    </div>
  );
}
