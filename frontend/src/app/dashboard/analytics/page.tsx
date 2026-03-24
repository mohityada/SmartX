"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useBots } from "@/hooks/use-bots";
import { useBotAnalytics, useBotAnalyticsActivity } from "@/hooks/use-analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { Eye, Heart, Repeat2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
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
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const initialBotId = searchParams.get("botId") ?? "";
  const [selectedBotId, setSelectedBotId] = useState(initialBotId);

  const { data: bots, isLoading: botsLoading } = useBots();
  const { data: summary, isLoading: summaryLoading } =
    useBotAnalytics(selectedBotId);
  const { data: activity } = useBotAnalyticsActivity(selectedBotId);

  useEffect(() => {
    if (!selectedBotId && bots && bots.length > 0) {
      setSelectedBotId(bots[0].id);
    }
  }, [selectedBotId, bots]);

  const statusData = summary?.tweetsByStatus
    ? Object.entries(summary.tweetsByStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          name: status.charAt(0).toUpperCase() + status.slice(1),
          value: count,
        }))
    : [];

  const engagementData = summary
    ? [
        { name: "Avg Impressions", value: Math.round(summary.avgImpressions) },
        { name: "Avg Likes", value: Math.round(summary.avgLikes) },
        { name: "Avg Retweets", value: Math.round(summary.avgRetweets) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Performance metrics and engagement insights for your bots.
          </p>
        </div>
        {botsLoading ? (
          <Skeleton className="h-10 w-56" />
        ) : (
          <Select value={selectedBotId} onValueChange={(v) => setSelectedBotId(v ?? "")}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a bot">
                {bots?.find((b) => b.id === selectedBotId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bots?.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  {bot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedBotId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg text-muted-foreground">
              Select a bot to view analytics
            </p>
          </CardContent>
        </Card>
      ) : summaryLoading || botsLoading ? (
        <div className="space-y-6">
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
        </div>
      ) : !summary ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No analytics data available yet for this bot.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Tweets"
              value={summary.totalTweets}
              subtitle="Generated tweets"
              icon={MessageSquare}
            />
            <MetricCard
              title="Total Impressions"
              value={summary.totalImpressions.toLocaleString()}
              subtitle={`~${Math.round(summary.avgImpressions)} avg per tweet`}
              icon={Eye}
            />
            <MetricCard
              title="Total Likes"
              value={summary.totalLikes.toLocaleString()}
              subtitle={`~${Math.round(summary.avgLikes)} avg per tweet`}
              icon={Heart}
            />
            <MetricCard
              title="Total Retweets"
              value={summary.totalRetweets.toLocaleString()}
              subtitle={`~${Math.round(summary.avgRetweets)} avg per tweet`}
              icon={Repeat2}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tweets by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Tweets by Status</CardTitle>
                <CardDescription>
                  Distribution of tweet statuses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No data yet
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Avg Engagement */}
            <Card>
              <CardHeader>
                <CardTitle>Average Engagement</CardTitle>
                <CardDescription>
                  Average metrics per tweet
                </CardDescription>
              </CardHeader>
              <CardContent>
                {engagementData.every((d) => d.value === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No engagement data yet
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={engagementData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          fill="hsl(var(--chart-1))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          {activity && activity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest bot actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activity.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.action}</Badge>
                        {item.metadata && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">
                            {JSON.stringify(item.metadata)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
