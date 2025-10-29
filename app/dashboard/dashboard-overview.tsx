"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

interface Account {
  id: number;
  account_number: string;
  routing_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: number;
  amount: number;
  transaction_type: string;
  direction: "inbound" | "outbound";
  status: "approved" | "denied" | "pending";
  created_at: string;
  internal_account_id: number;
}

interface DashboardData {
  accounts: Account[];
  transactions: Transaction[];
  totalBalance: number;
}

interface DashboardOverviewProps {
  onNavigateToAccounts?: () => void;
}

export function DashboardOverview({
  onNavigateToAccounts,
}: DashboardOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      // // Fetch accounts from the internal accounts API
      const accountsResponse = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!accountsResponse.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const accountsData = (await accountsResponse.json()) as {
        accounts: Account[];
      };

      // mock data until internals accounts GET API is implemented
      // const mockAccounts: Account[] = [
      //   {
      //     id: 1,
      //     account_number: "12345678901234567",
      //     routing_number: "12345678901234445",
      //     account_type: "checking",
      //     balance: 1000.0,
      //     is_active: true,
      //     created_at: "2024-01-01T00:00:00Z",
      //     updated_at: "2024-01-01T00:00:00Z",
      //   },
      //   {
      //     id: 2,
      //     account_number: "98765432109876543",
      //     routing_number: "12345678901234445",
      //     account_type: "savings",
      //     balance: 5000.0,
      //     is_active: true,
      //     created_at: "2024-01-01T00:00:00Z",
      //     updated_at: "2024-01-01T00:00:00Z",
      //   },
      // ];

      // const accountsData = { accounts: mockAccounts };

      // Fetch recent transactions
      const transactionsResponse = await fetch("/api/transactions", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!transactionsResponse.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const transactionsData = (await transactionsResponse.json()) as {
        transactions: Transaction[];
      };

      // Calculate total balance
      const totalBalance = accountsData.accounts.reduce(
        (sum: number, account: Account) => sum + account.balance,
        0,
      );

      const dashboardData = {
        accounts: accountsData.accounts ?? [],
        transactions: transactionsData.transactions ?? [],
        totalBalance,
      };

      setData(dashboardData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getCensoredAccountId = (accountNumber: string) => {
    return `****${accountNumber.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="rounded-lg border p-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border p-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border p-6">
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Total Balance
          </h3>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(data.totalBalance)}
          </p>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            Active Accounts
          </h3>
          <p className="text-3xl font-bold text-blue-600">
            {data.accounts.filter((account) => account.is_active).length}
          </p>
        </div>
      </div>

      {/* Accounts Overview */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Your Accounts</h2>
          {onNavigateToAccounts && (
            <Button variant="outline" size="sm" onClick={onNavigateToAccounts}>
              Manage Accounts
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
        {data.accounts.length === 0 ? (
          <p className="text-gray-500">No accounts found</p>
        ) : (
          <div className="space-y-4">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium capitalize whitespace-nowrap">
                      {account.account_type} Account
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                        account.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    ****{account.account_number.slice(-4)}
                  </p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-lg font-semibold whitespace-nowrap">
                    {formatCurrency(account.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        {data.transactions.length === 0 ? (
          <p className="text-gray-500">No recent transactions</p>
        ) : (
          <div className="space-y-3">
            {data.transactions.slice(0, 5).map((transaction) => {
              // Find the account for this transaction
              const account = data.accounts.find(
                (acc) => acc.id === transaction.internal_account_id,
              );
              const censoredAccountId = account
                ? getCensoredAccountId(account.account_number)
                : "****";

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">
                        Account: {censoredAccountId}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-1">
                      <span className="whitespace-nowrap">
                        Transaction Type:{" "}
                        {transaction.transaction_type.replace("_", " ")}
                      </span>
                      <span className="whitespace-nowrap">
                        Status: {transaction.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDate(transaction.created_at)}
                    </p>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <p
                      className={`text-lg font-semibold whitespace-nowrap ${
                        transaction.direction === "inbound"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.direction === "inbound" ? "+" : "-"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
