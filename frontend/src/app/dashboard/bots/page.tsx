"use client";

import Link from "next/link";
import { useBots, useToggleBot, useDeleteBot } from "@/hooks/use-bots";
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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

export default function BotsPage() {
  const { data: bots, isLoading } = useBots();
  const toggleBot = useToggleBot();
  const deleteBot = useDeleteBot();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteBot.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bots</h1>
          <p className="text-muted-foreground">
            Create and manage your AI-powered Twitter bots.
          </p>
        </div>
        <Button render={<Link href="/dashboard/bots/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Bot
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !bots?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No bots yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first bot to start generating tweets.
            </p>
            <Button render={<Link href="/dashboard/bots/new" />}>
              Create Bot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <Card key={bot.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <Link
                        href={`/dashboard/bots/${bot.id}`}
                        className="hover:underline underline-offset-4"
                      >
                        {bot.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {bot.persona || "No persona set"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        render={<Link href={`/dashboard/bots/${bot.id}`} />}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={<Link href={`/dashboard/analytics?botId=${bot.id}`} />}
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setDeleteTarget({ id: bot.id, name: bot.name })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{bot.tone}</Badge>
                    <Badge variant="outline">{bot.postingFrequency}/day</Badge>
                    {bot.xAccount ? (
                      <Badge variant="secondary">
                        @{bot.xAccount.xUsername}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        No X account
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={bot.isActive}
                    onCheckedChange={() =>
                      toggleBot.mutate({
                        id: bot.id,
                        isActive: bot.isActive,
                      })
                    }
                    disabled={toggleBot.isPending}
                  />
                </div>
                {bot.topics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {bot.topics.slice(0, 3).map((t) => (
                      <Badge key={t.id} variant="secondary" className="text-xs">
                        {t.topic}
                      </Badge>
                    ))}
                    {bot.topics.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{bot.topics.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone and will remove all associated tweets
              and activity logs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBot.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBot.isPending}
            >
              {deleteBot.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
