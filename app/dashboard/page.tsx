"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Profile } from "./profile";
import { AccountManagement } from "./account-management";
import { AtmLocator } from "./atm-locator";
import { DashboardOverview } from "./dashboard-overview";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>

      {/* Quick Actions */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h3 className="mb-2 text-lg font-semibold">Money Transfers</h3>
          <p className="mb-4 text-sm text-gray-600">
            Transfer money between your accounts or to external accounts
          </p>
          <Button
            onClick={() => router.push("/dashboard/transfers")}
            className="w-full"
          >
            Make Transfer
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <div className="rounded-lg border p-6">
          <h3 className="mb-2 text-lg font-semibold">Transfer History</h3>
          <p className="mb-4 text-sm text-gray-600">
            View your recent transfer history and transaction details
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/transfers/history")}
            className="w-full"
          >
            View History
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account Management</TabsTrigger>
          <TabsTrigger value="atm">ATM Near Me</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <DashboardOverview
            onNavigateToAccounts={() => setActiveTab("account")}
          />
        </TabsContent>
        <TabsContent value="profile">
          <Profile />
        </TabsContent>
        <TabsContent value="account">
          <AccountManagement />
        </TabsContent>
        <TabsContent value="atm">
          <AtmLocator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
