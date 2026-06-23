import React, { useEffect, useState } from 'react';
import { userApi, type ApiKey, type CreatedApiKey } from '../../lib/api';

const clip = { clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)' };

const formatDate = (value?: string | null): string => {
  if (!value) return 'NEVER';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const ApiKeysWidget: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        setKeys(await userApi.getApiKeys());
      } catch (err) {
        console.error('Failed to load API keys:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError('Name is required');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const created = await userApi.createApiKey(name);
      setCreatedKey(created);
      setKeys((prev) => [{ ...created }, ...prev]);
      setNewName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Revoke API key "${name}"? Any agent using it will immediately lose access.`)) {
      return;
    }
    try {
      await userApi.revokeApiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      console.error('Failed to revoke API key:', err);
      setError('Failed to revoke API key');
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context); user can still select manually
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">
        API KEYS · AGENT ACCESS
      </h2>
      <p className="text-cyber-text-dim text-sm font-mono mb-4">
        Generate read-only keys so LLM agents (e.g. via the MCP server) can query your library,
        ratings, watchlist, and tag preferences. Keys cannot modify any data.
      </p>

      {/* One-time reveal of a newly created key */}
      {createdKey && (
        <div className="mb-4 p-4 border border-cyber-accent bg-cyber-bg-elevated" style={clip}>
          <p className="text-cyber-accent text-sm font-mono uppercase tracking-wide mb-2">
            ⚠ COPY THIS KEY NOW — IT WON'T BE SHOWN AGAIN
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-cyber-bg border border-cyber-border text-cyber-text-bright font-mono text-sm break-all">
              {createdKey.key}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-xs font-medium uppercase tracking-wide transition-all whitespace-nowrap"
              style={clip}
            >
              {copied ? 'COPIED!' : 'COPY'}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-cyber-text-dim hover:text-cyber-text text-xs uppercase tracking-wide transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          maxLength={100}
          placeholder="Key name (e.g. my-laptop-agent)"
          disabled={isCreating}
          className="flex-1 px-3 py-1.5 bg-cyber-bg border border-cyber-border text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-accent font-mono"
        />
        <div className="inline-flex" style={clip}>
          <div className="bg-cyber-accent p-[1px]" style={clip}>
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="px-4 py-1.5 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg text-sm font-medium transition-all disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:cursor-not-allowed uppercase tracking-wide whitespace-nowrap"
              style={clip}
            >
              {isCreating ? 'GENERATING...' : 'GENERATE KEY'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm font-mono uppercase tracking-wide mb-2">{error}</p>}

      {/* Existing keys */}
      {isLoading ? (
        <p className="text-cyber-text-dim text-sm font-mono uppercase tracking-wide mt-4">LOADING...</p>
      ) : keys.length === 0 ? (
        <p className="text-cyber-text-dim text-sm font-mono uppercase tracking-wide mt-4">
          NO API KEYS YET.
        </p>
      ) : (
        <div className="space-y-2 mt-4">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between py-2 px-3 bg-cyber-bg-elevated border border-cyber-border gap-3"
            >
              <div className="min-w-0">
                <div className="text-cyber-text font-mono text-sm truncate">
                  {key.name} <span className="text-cyber-text-dim">· {key.keyPrefix}…</span>
                </div>
                <div className="text-cyber-text-dim text-xs font-mono uppercase tracking-wide mt-0.5">
                  CREATED {formatDate(key.createdAt)} · LAST USED {formatDate(key.lastUsedAt)}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(key.id, key.name)}
                className="px-3 py-1 border border-red-500/60 text-red-400 hover:bg-red-500 hover:text-cyber-bg text-xs font-medium uppercase tracking-wide transition-all whitespace-nowrap"
                style={clip}
              >
                REVOKE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
