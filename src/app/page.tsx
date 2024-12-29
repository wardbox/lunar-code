import { getServerSession } from "next-auth";
import AuthButtons from "@/components/AuthButtons";
import LunarStats from "@/components/LunarStats";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default async function Home() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <div className="max-w-xl w-full">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl font-serif">
            Lunar Code
          </h1>
          <p className="text-sm tracking-wide uppercase text-muted-foreground">
            Discover the cosmic patterns in your code through NASA data and git truth.
          </p>
        </div>

        {!session ? (
          <div className="flex flex-col items-center gap-8">
            <AuthButtons isSignedIn={false} />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Connect GitHub to analyze your commit patterns
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader className="space-y-0 pb-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {/* @ts-ignore */}
                  <AvatarImage src={session.user?.image} />
                  {/* @ts-ignore */}
                  <AvatarFallback>{session.user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  {/* @ts-ignore */}
                  <p className="font-serif text-lg leading-none">{session.user?.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>@{session.user?.email?.split('@')[0]}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <AuthButtons isSignedIn={true} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <LunarStats />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
