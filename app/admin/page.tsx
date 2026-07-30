"use client";

import { useEffect, useState } from "react";
import { adminCreateClient, adminDeleteClient, adminListClients } from "@/lib/api";
import type { AdminClient } from "@/lib/types";

const SESSION_KEY = "u7_admin_secret";

function portalUrl(token: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/aprovar/?token=${token}`;
}

export default function AdminPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [name, setName] = useState("");
  const [boardCode, setBoardCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [lastImportedCount, setLastImportedCount] = useState<number | null>(null);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [lastDebug, setLastDebug] = useState<unknown>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    async function init() {
      if (stored) {
        await tryLogin(stored);
      }
      setCheckingAuth(false);
    }
    init();
  }, []);

  async function tryLogin(candidateSecret: string) {
    setAuthError(null);
    try {
      const list = await adminListClients(candidateSecret);
      setClients(list);
      setSecret(candidateSecret);
      sessionStorage.setItem(SESSION_KEY, candidateSecret);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      setAuthError("Senha incorreta.");
    } finally {
      setCheckingAuth(false);
    }
  }

  async function refreshClients(currentSecret: string) {
    setLoadingClients(true);
    try {
      const list = await adminListClients(currentSecret);
      setClients(list);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao atualizar lista.");
    } finally {
      setLoadingClients(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!secret) return;
    setFormError(null);
    setLastCreatedUrl(null);
    setLastImportedCount(null);
    setLastWarning(null);
    setLastDebug(null);

    if (!name.trim() || !boardCode.trim()) {
      setFormError("Preencha o nome do cliente e o código do board.");
      return;
    }

    setSubmitting(true);
    try {
      const { client, importedCount, webhookWarning, debugFirstCard } = await adminCreateClient(secret, {
        name: name.trim(),
        trelloBoardShortLink: boardCode.trim(),
      });
      setLastCreatedUrl(portalUrl(client.access_token));
      setLastImportedCount(importedCount);
      setLastWarning(webhookWarning);
      setLastDebug(debugFirstCard);
      setName("");
      setBoardCode("");
      await refreshClients(secret);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao cadastrar cliente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy(token: string) {
    navigator.clipboard.writeText(portalUrl(token)).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    });
  }

  async function handleDelete(client: AdminClient) {
    if (!secret) return;
    const confirmed = window.confirm(
      `Excluir "${client.name}"? Isso apaga o cliente e todos os posts dele. Não tem como desfazer.`,
    );
    if (!confirmed) return;

    setDeletingId(client.id);
    setFormError(null);
    try {
      await adminDeleteClient(secret, client.id);
      await refreshClients(secret);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao excluir cliente.");
    } finally {
      setDeletingId(null);
    }
  }

  if (checkingAuth) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
        Carregando...
      </main>
    );
  }

  if (!secret) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin(passwordInput.trim());
          }}
          className="w-full max-w-xs"
        >
          <h1 className="mb-4 text-lg font-semibold">Painel interno</h1>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            autoFocus
          />
          {authError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{authError}</p>}
          <button
            type="submit"
            className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4 sm:p-8">
      <h1 className="mb-6 text-xl font-semibold">Cadastrar cliente</h1>

      <form onSubmit={handleCreate} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="block text-sm font-medium">Nome do cliente</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Seu Chico"
          className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />

        <label className="mt-3 block text-sm font-medium">Código do board no Trello</label>
        <input
          value={boardCode}
          onChange={(e) => setBoardCode(e.target.value)}
          placeholder="Ex: AbCd1234"
          className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        />
        <p className="mt-1 text-xs text-neutral-500">
          É o código que aparece na URL do board, em{" "}
          <code>trello.com/b/<b>AbCd1234</b>/nome-do-board</code>.
        </p>

        {formError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>

      {lastCreatedUrl && (
        <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
          <p className="font-medium text-green-800 dark:text-green-200">Cliente cadastrado!</p>
          {lastImportedCount !== null && (
            <p className="mt-1 text-green-700 dark:text-green-300">
              {lastImportedCount} post{lastImportedCount === 1 ? "" : "s"} importado
              {lastImportedCount === 1 ? "" : "s"} do Trello.
            </p>
          )}
          <p className="mt-1 break-all text-green-700 dark:text-green-300">{lastCreatedUrl}</p>
          {lastWarning && (
            <p className="mt-2 text-amber-700 dark:text-amber-400">{lastWarning}</p>
          )}
        </div>
      )}

      {lastDebug !== null && (
        <div className="mt-4 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <p className="mb-1 font-medium text-neutral-600 dark:text-neutral-300">
            Debug — dados brutos do 1º post importado (temporário):
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap text-neutral-500 dark:text-neutral-400">
            {JSON.stringify(lastDebug, null, 2)}
          </pre>
        </div>
      )}

      <h2 className="mb-2 mt-8 text-sm font-medium text-neutral-500">
        Clientes cadastrados {loadingClients && "(atualizando...)"}
      </h2>
      <div className="flex flex-col gap-2">
        {clients.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhum cliente cadastrado ainda.</p>
        )}
        {clients.map((client) => (
          <div
            key={client.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
          >
            <div>
              <p className="font-medium">{client.name}</p>
              <p className="text-xs text-neutral-500">
                {client.is_active ? "Ativo" : "Inativo"} · board {client.trello_board_id}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleCopy(client.access_token)}
                className="rounded-lg border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {copiedToken === client.access_token ? "Copiado!" : "Copiar link"}
              </button>
              <button
                onClick={() => handleDelete(client)}
                disabled={deletingId === client.id}
                className="rounded-lg border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                {deletingId === client.id ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
