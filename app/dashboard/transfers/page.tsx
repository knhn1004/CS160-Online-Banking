"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InternalTransfer } from "./internal-transfer";
import { ExternalTransfer } from "./external-transfer";
import { BillPay } from "./billpay";
import { Breadcrumbs } from "./breadcrumbs";

const TAB_NAMES: Record<string, string> = {
  internal: "Internal Transfer",
  external: "External Transfer",
  billpay: "Bill Pay",
};

export default function TransfersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("internal");

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
      <Breadcrumbs currentPage={TAB_NAMES[activeTab]} />
      <h1 className="mb-6 text-3xl font-bold">Money Transfers</h1>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        defaultValue="internal"
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="internal">Internal Transfer</TabsTrigger>
          <TabsTrigger value="external">External Transfer</TabsTrigger>
          <TabsTrigger value="billpay">Bill Pay</TabsTrigger>
        </TabsList>
        <TabsContent value="internal">
          <InternalTransfer />
        </TabsContent>
        <TabsContent value="external">
          <ExternalTransfer />
        </TabsContent>
        <TabsContent value="billpay">
          <BillPay />
        </TabsContent>
      </Tabs>
    </div>
  );
}
