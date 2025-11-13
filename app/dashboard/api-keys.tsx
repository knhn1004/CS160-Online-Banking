"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Copy, CheckCircle2, AlertCircle } from "lucide-react";

interface InternalAccount {
  id: number;
  account_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
}

interface ApiKey {
  id: number;
  key_prefix: string;
  account_id: number;
  account_number: string;
  account_type: "checking" | "savings";
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function ApiKeys() {
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | "">("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [neverExpires, setNeverExpires] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchAccounts(), fetchApiKeys()]);
  };

  const fetchAccounts = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: { message: string } };
        throw new Error(data.error?.message || "Failed to fetch accounts");
      }

      const data = (await response.json()) as { accounts: InternalAccount[] };
      const activeAccounts = (data.accounts || []).filter(
        (acc) => acc.is_active,
      );
      setAccounts(activeAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    }
  };

  const fetchApiKeys = async () => {
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

      const response = await fetch("/api/api-keys", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error || "Failed to fetch API keys");
      }

      const data = (await response.json()) as { api_keys: ApiKey[] };
      setApiKeys(data.api_keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAccountId) {
      setError("Please select an account");
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const requestBody: {
        account_id: number;
        expires_at?: string | null;
      } = {
        account_id: Number(selectedAccountId),
      };

      if (!neverExpires && expiresAt) {
        requestBody.expires_at = new Date(expiresAt).toISOString();
      } else if (neverExpires) {
        requestBody.expires_at = null;
      }

      const response = await fetch("/api/api-keys/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error || "Failed to generate API key");
      }

      const data = (await response.json()) as { api_key: string };
      setGeneratedKey(data.api_key);
      setShowKeyDialog(true);
      setSuccess("API key generated successfully");

      // Reset form
      setSelectedAccountId("");
      setExpiresAt("");
      setNeverExpires(false);

      // Refresh API keys list
      await fetchApiKeys();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate API key",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: number) => {
    if (
      !confirm(
        "Are you sure you want to revoke this API key? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setRevokingId(keyId);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error || "Failed to revoke API key");
      }

      setSuccess("API key revoked successfully");
      await fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never expires";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p>Loading API keys...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500 bg-green-50 p-4 text-green-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* Generate New API Key Form */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account">Account</Label>
            <Select
              value={selectedAccountId.toString()}
              onValueChange={(value) => setSelectedAccountId(Number(value))}
            >
              <SelectTrigger id="account">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.account_type.charAt(0).toUpperCase() +
                      account.account_type.slice(1)}{" "}
                    - ****{account.account_number.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="never-expires"
                checked={neverExpires}
                onChange={(e) => setNeverExpires(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="never-expires" className="cursor-pointer">
                Never expires
              </Label>
            </div>
          </div>

          {!neverExpires && (
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expiration Date & Time</Label>
              <Input
                id="expires-at"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedAccountId}
          >
            {generating ? "Generating..." : "Generate API Key"}
          </Button>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-muted-foreground">No API keys found</p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-sm">
                        {key.key_prefix}...
                      </code>
                      {!key.is_active && (
                        <Badge variant="destructive">Revoked</Badge>
                      )}
                      {key.expires_at &&
                        new Date(key.expires_at) < new Date() && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Account:{" "}
                        {key.account_type.charAt(0).toUpperCase() +
                          key.account_type.slice(1)}{" "}
                        - ****{key.account_number.slice(-4)}
                      </p>
                      <p>Expires: {formatDate(key.expires_at)}</p>
                      {key.last_used_at && (
                        <p>Last used: {formatDate(key.last_used_at)}</p>
                      )}
                      <p>Created: {formatDate(key.created_at)}</p>
                    </div>
                  </div>
                  {key.is_active && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(key.id)}
                      disabled={revokingId === key.id}
                    >
                      {revokingId === key.id ? (
                        "Revoking..."
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Revoke
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Your API key has been generated. Copy it now - you won&apos;t be
              able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedKey || ""}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    generatedKey && copyToClipboard(generatedKey, "api-key")
                  }
                >
                  {copiedField === "api-key" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              <p className="font-semibold">Important:</p>
              <p>
                Store this API key securely. You won&apos;t be able to view it
                again after closing this dialog.
              </p>
            </div>
            <Button onClick={() => setShowKeyDialog(false)} className="w-full">
              I&apos;ve copied the key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
