"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AI_PROVIDERS, type AiKeyStatus, type AiProviderId } from "@/lib/ai-shared";

/* The teacher's own model for the deck builder. Saving replaces any previous
 * key; the key itself is never shown again, only its last four characters. */
export function AiKeyForm({ status }: { status: AiKeyStatus }) {
  const router = useRouter();
  const [provider, setProvider] = useState<AiProviderId>(status.own?.provider ?? "openrouter");
  const [model, setModel] = useState(status.own?.model ?? "");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(status.own?.baseUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/ai-key", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ provider, model, key, baseUrl }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Could not save." });
      else {
        setKey("");
        setMsg({ ok: true, text: method === "POST" ? "Saved. The builder now uses your key." : "Removed." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Network error — try again." });
    }
    setBusy(false);
  }

  const p = AI_PROVIDERS[provider];
  return (
    <form
      className="teach-form"
      data-testid="ai-key-form"
      onSubmit={(e) => {
        e.preventDefault();
        call("POST");
      }}
    >
      <label>
        Provider
        <select value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)} name="provider">
          {(Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => (
            <option key={id} value={id}>
              {AI_PROVIDERS[id].label}
            </option>
          ))}
        </select>
      </label>
      {provider === "custom" && (
        <label>
          Endpoint (OpenAI-compatible, https)
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" name="baseUrl" />
        </label>
      )}
      <label>
        Model
        <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={p.modelHint} name="model" />
      </label>
      <label>
        API key{" "}
        {p.keyUrl && (
          <a href={p.keyUrl} target="_blank" rel="noopener noreferrer" className="muted">
            (get one)
          </a>
        )}
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status.own ? `saved key ends in …${status.own.hint}; type a new one to replace it` : ""}
          autoComplete="off"
          name="key"
        />
      </label>
      <div className="report-actions">
        <button type="submit" className="class-present-btn" disabled={busy || !model.trim() || key.trim().length < 8}>
          {busy ? "Saving…" : "Save key"}
        </button>
        {status.own && (
          <button type="button" className="bt-clear-btn danger" disabled={busy} onClick={() => call("DELETE")}>
            Remove my key
          </button>
        )}
      </div>
      {msg && <p className={msg.ok ? "class-join-ok" : "class-join-err"}>{msg.text}</p>}
    </form>
  );
}
