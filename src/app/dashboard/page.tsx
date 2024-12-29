import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import LunarStats from "@/components/LunarStats";
import AuthButtons from "@/components/AuthButtons";

export default async function Dashboard() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Lunar Code Stats</h1>
          <AuthButtons isSignedIn={true} />
        </div>
        
        {/* Profile Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            {/* @ts-ignore */}
            <img src={session.user?.image} alt="Profile" className="w-16 h-16 rounded-full" />
            <div>
              {/* @ts-ignore */}
              <p className="text-xl font-semibold">{session.user?.name}</p>
              {/* @ts-ignore */}
              <p className="text-gray-600 dark:text-gray-300">{session.user?.email}</p>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Lunar Phase Stats */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6">Lunar Phase Activity</h2>
            <LunarStats />
          </section>

          {/* Weather Stats */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Weather Impact</h2>
            <p className="text-gray-600 dark:text-gray-300">
              Coming soon: Weather impact analysis for your coding patterns.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
} 
