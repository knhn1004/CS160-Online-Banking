"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function TransfersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const tabParam = searchParams.get("tab");
  const editRuleParam = searchParams.get("editRule");
  const parsedEditRuleId = editRuleParam ? Number(editRuleParam) : undefined;
  const editRuleId =
    typeof parsedEditRuleId === "number" && !Number.isNaN(parsedEditRuleId)
      ? parsedEditRuleId
      : undefined;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() =>
    tabParam && TAB_NAMES[tabParam] ? tabParam : "internal",
  );

  useEffect(() => {
    if (tabParam && TAB_NAMES[tabParam] && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const replaceWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.replace(
        query ? `/dashboard/transfers?${query}` : "/dashboard/transfers",
      );
    },
    [router],
  );

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value);
      const params = new URLSearchParams(searchString);
      if (value === "internal") {
        params.delete("tab");
      } else {
        params.set("tab", value);
      }
      replaceWithParams(params);
    },
    [searchString, replaceWithParams],
  );

  const handleEditRuleConsumed = useCallback(() => {
    const params = new URLSearchParams(searchString);
    params.delete("editRule");
    replaceWithParams(params);
  }, [searchString, replaceWithParams]);

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
        onValueChange={handleTabChange}
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
          <BillPay
            initialEditRuleId={editRuleId}
            onEditRuleConsumed={handleEditRuleConsumed}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TransfersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p>Loading transfers…</p>
        </div>
      }
    >
      <TransfersPageInner />
    </Suspense>
  );
}
