"use client";

import { useBots } from "@/hooks/use-bots";
import { useTweets } from "@/hooks/use-tweets";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, MessageSquare, Zap, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: bots, isLoading: botsLoading } = useBots();
  const { data: tweets, isLoading: tweetsLoading } = useTweets();

  const isLoading = botsLoading || tweetsLoading;

  const activeBots = bots?.filter((b) => b.isActive).length ?? 0;
  const totalBots = bots?.length ?? 0;
  const totalTweets = tweets?.length ?? 0;
  const postedTweets = tweets?.filter((t) => t.status === "posted").length ?? 0;
  const pendingTweets = tweets?.filter(
    (t) => t.status === "draft" || t.status === "approved" || t.status === "scheduled",
  ).length ?? 0;
  const totalEngagement = tweets?.reduce(
    (sum, t) => sum + t.likes + t.retweets,
    0,
  ) ?? 0;

  const recentTweets = tweets
    ?.slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your AI Twitter bot platform.
        </p>
      </div>

      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Bots"
            value={totalBots}
            description={`${activeBots} active`}
            icon={Bot}
          />
          <StatCard
            title="Tweets Posted"
            value={postedTweets}
            description={`of ${totalTweets} total`}
            icon={MessageSquare}
          />
          <StatCard
            title="Pending"
            value={pendingTweets}
            description="Draft, approved & scheduled"
            icon={Zap}
          />
          <StatCard
            title="Engagement"
            value={totalEngagement.toLocaleString()}
            description="Total likes + retweets"
            icon={TrendingUp}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active bots card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Bots</CardTitle>
            <CardDescription>Quick view of all bots</CardDescription>
          </CardHeader>
          <CardContent>
            {botsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !bots?.length ? (
              <p className="text-sm text-muted-foreground">
                No bots yet.{" "}
                <Link
                  href="/dashboard/bots/new"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Create your first bot
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {bots.slice(0, 5).map((bot) => (
                  <Link
                    key={bot.id}
                    href={`/dashboard/bots/${bot.id}`}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {bot.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{bot.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bot.tone} &middot; {bot.postingFrequency}/day
                        </p>
                      </div>
                    </div>
                    <Badge variant={bot.isActive ? "default" : "secondary"}>
                      {bot.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tweets card */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Tweets</CardTitle>
            <CardDescription>Latest generated content</CardDescription>
          </CardHeader>
          <CardContent>
            {tweetsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !recentTweets?.length ? (
              <p className="text-sm text-muted-foreground">
                No tweets yet. Start a bot to generate content.
              </p>
            ) : (
              <div className="space-y-3">
                {recentTweets.map((tweet) => (
                  <div
                    key={tweet.id}
                    className="rounded-md border p-3 space-y-1"
                  >
                    <p className="text-sm line-clamp-2">{tweet.content}</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          tweet.status === "posted"
                            ? "default"
                            : tweet.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {tweet.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(tweet.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
