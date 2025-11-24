"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getUserById,
  getUserTransactions,
  openAccountForUser,
  closeAccountForUser,
  type DetailedUser,
  type ManagerTransaction,
} from "./actions";
import { AlertCircle, X } from "lucide-react";

interface UserDetailsModalProps {
  userId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserDetailsModal({
  userId,
  isOpen,
  onClose,
}: UserDetailsModalProps) {
  const [user, setUser] = useState<DetailedUser | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<
    ManagerTransaction[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [showOpenAccountDialog, setShowOpenAccountDialog] = useState(false);
  const [showCloseAccountDialog, setShowCloseAccountDialog] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [accountType, setAccountType] = useState<"checking" | "savings">(
    "checking",
  );
  const [initialDeposit, setInitialDeposit] = useState<string>("0");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadUserDetails = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [userData, transactions] = await Promise.all([
        getUserById(userId),
        getUserTransactions(userId, 5),
      ]);
      setUser(userData);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error("Failed to load user details:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [isOpen, userId, loadUserDetails]);

  const handleOpenAccount = async () => {
    if (!userId) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const depositAmount =
        initialDeposit && initialDeposit !== ""
          ? parseFloat(initialDeposit)
          : undefined;

      if (
        depositAmount !== undefined &&
        (isNaN(depositAmount) || depositAmount < 0)
      ) {
        setActionError("Initial deposit must be a valid non-negative number");
        setActionLoading(false);
        return;
      }

      const result = await openAccountForUser(
        userId,
        accountType,
        depositAmount,
      );

      if (result.success) {
        setActionSuccess("Account opened successfully");
        setShowOpenAccountDialog(false);
        setAccountType("checking");
        setInitialDeposit("0");
        // Reload user details to show new account
        await loadUserDetails();
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setActionError(result.error || "Failed to open account");
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to open account",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseAccount = async () => {
    if (!selectedAccountId) return;

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const result = await closeAccountForUser(selectedAccountId);

      if (result.success) {
        setActionSuccess("Account closed successfully");
        setShowCloseAccountDialog(false);
        setSelectedAccountId(null);
        // Reload user details to show updated account status
        await loadUserDetails();
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setActionError(result.error || "Failed to close account");
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to close account",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseAccountClick = (accountId: number) => {
    const account = user?.internal_accounts?.find((a) => a.id === accountId);
    if (account && Number(account.balance) !== 0) {
      setActionError(
        "Account must have zero balance before closing. Current balance: " +
          formatCurrency(Number(account.balance)),
      );
      return;
    }
    setSelectedAccountId(accountId);
    setShowCloseAccountDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getRoleBadgeVariant = (role: "customer" | "bank_manager") => {
    return role === "bank_manager" ? "default" : "secondary";
  };

  const getStatusBadgeVariant = (status: "approved" | "denied") => {
    return status === "approved" ? "default" : "destructive";
  };

  const getTransactionTypeBadgeVariant = (
    type:
      | "internal_transfer"
      | "external_transfer"
      | "billpay"
      | "deposit"
      | "withdrawal",
  ) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      internal_transfer: "default",
      external_transfer: "secondary",
      billpay: "outline",
      deposit: "default",
      withdrawal: "secondary",
    };
    return variants[type] || "outline";
  };

  const totalBalance =
    user?.internal_accounts.reduce(
      (sum, account) => sum + Number(account.balance),
      0,
    ) || 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[640px] h-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User Details</SheetTitle>
          <SheetDescription>
            View detailed information about the selected user including profile,
            accounts, and recent transactions.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* User Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Profile Information</span>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role.replace("_", " ").toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Name
                    </label>
                    <p className="text-lg">
                      {user.first_name} {user.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Username
                    </label>
                    <p className="text-lg">{user.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Email
                    </label>
                    <p className="text-lg">{user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Phone
                    </label>
                    <p className="text-lg">{user.phone_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Address
                    </label>
                    <p className="text-lg">
                      {user.street_address}
                      {user.address_line_2 && (
                        <>
                          <br />
                          {user.address_line_2}
                        </>
                      )}
                      <br />
                      {user.city}, {user.state_or_territory} {user.postal_code}
                      <br />
                      {user.country}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Member Since
                    </label>
                    <p className="text-lg">{formatDate(user.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Account Summary</CardTitle>
                  <Button
                    onClick={() => {
                      setShowOpenAccountDialog(true);
                      setActionError(null);
                      setActionSuccess(null);
                    }}
                    size="sm"
                  >
                    Open New Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {actionSuccess && (
                  <div className="mb-4 rounded-md border border-success bg-success/10 p-3">
                    <p className="text-sm text-success">{actionSuccess}</p>
                  </div>
                )}
                {actionError && (
                  <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                    <p className="text-sm text-destructive">{actionError}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">
                      {formatCurrency(totalBalance)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Balance
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {user.internal_accounts.filter((a) => a.is_active).length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Active Accounts
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {user._count.internal_accounts}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total Transactions
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Accounts</h4>
                  {user.internal_accounts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No accounts found
                    </p>
                  ) : (
                    user.internal_accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            ****{account.account_number.slice(-4)}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {account.account_type.replace("_", " ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(Number(account.balance))}
                            </p>
                            <Badge
                              variant={
                                account.is_active ? "default" : "secondary"
                              }
                            >
                              {account.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {account.is_active && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleCloseAccountClick(account.id)
                              }
                              disabled={actionLoading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {recentTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {formatCurrency(Number(transaction.amount))}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {transaction.transaction_type
                              .replace("_", " ")
                              .toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-2 mb-1">
                            <Badge
                              variant={getStatusBadgeVariant(
                                transaction.status,
                              )}
                            >
                              {transaction.status.toUpperCase()}
                            </Badge>
                            <Badge
                              variant={getTransactionTypeBadgeVariant(
                                transaction.transaction_type,
                              )}
                            >
                              {transaction.direction.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No recent transactions
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">User not found</p>
          </div>
        )}
      </SheetContent>

      {/* Open Account Dialog */}
      <Dialog
        open={showOpenAccountDialog}
        onOpenChange={setShowOpenAccountDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open New Account</DialogTitle>
            <DialogDescription>
              Create a new account for {user?.first_name} {user?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="account-type">Account Type</Label>
              <Select
                value={accountType}
                onValueChange={(value) =>
                  setAccountType(value as "checking" | "savings")
                }
              >
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="initial-deposit">
                Initial Deposit (optional)
              </Label>
              <Input
                id="initial-deposit"
                type="number"
                min="0"
                step="0.01"
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {actionError && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                <p className="text-sm text-destructive">{actionError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOpenAccountDialog(false);
                setActionError(null);
                setInitialDeposit("0");
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleOpenAccount} disabled={actionLoading}>
              {actionLoading ? "Opening..." : "Open Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Account Dialog */}
      <Dialog
        open={showCloseAccountDialog}
        onOpenChange={setShowCloseAccountDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to close this account? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {selectedAccountId && (
            <div className="space-y-2">
              {user?.internal_accounts?.find((a) => a.id === selectedAccountId)
                ?.balance !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Account Balance:{" "}
                  {formatCurrency(
                    Number(
                      user?.internal_accounts?.find(
                        (a) => a.id === selectedAccountId,
                      )?.balance,
                    ),
                  )}
                </p>
              )}
            </div>
          )}
          {actionError && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
              <p className="text-sm text-destructive">{actionError}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCloseAccountDialog(false);
                setSelectedAccountId(null);
                setActionError(null);
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseAccount}
              disabled={actionLoading}
            >
              {actionLoading ? "Closing..." : "Close Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
