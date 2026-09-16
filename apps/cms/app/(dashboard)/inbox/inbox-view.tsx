'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getToken, getUser, openAuthenticatedFile } from '@/lib/api';
import { stamp } from '@/lib/format';
import { useVisibleInterval } from '@/lib/hooks/use-visible-interval';
import { isAdmin } from '@/lib/roles';
import { StaffName } from '@/lib/staff-name';

const REACTS = ['👍', '✅', '👀', '🎉', '❗'];

function isImage(mime?: string, name?: string) {
  return /^image\//.test(mime || '') || /\.(png|jpe?g|gif|webp)$/i.test(name || '');
}

function unwrap(data: any) {
  if (Array.isArray(data)) return { messages: data, pinned: data.find((m: any) => m.pinned) || null };
  return { messages: data?.messages || [], pinned: data?.pinned || null };
}

export default function InboxView() {
  const me = getUser();
  const admin = isAdmin(me?.role);
  const params = useSearchParams();
  const orgId = params.get('org');
  const [threads, setThreads] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [pinned, setPinned] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [poll, setPoll] = useState({ question: '', options: 'Yes\nNo', multiple: false });
  const [err, setErr] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const searchRef = useRef(search);

  activeRef.current = active;
  searchRef.current = search;

  const loadThreads = useCallback(async () => {
    const q = orgId ? `?ensureOrg=${encodeURIComponent(orgId)}` : '';
    const rows = await api(`/chat/threads${q}`);
    setThreads(rows);
    const wanted = orgId
      ? rows.find((t: any) => t.organizationId === orgId && t.kind !== 'PROJECT') ||
        rows.find((t: any) => t.organizationId === orgId)
      : null;
    if (wanted) setActive(wanted.id);
    else setActive((prev) => prev || rows[0]?.id || null);
  }, [orgId]);

  const loadMessages = useCallback(async (id: string, q?: string) => {
    const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const data = unwrap(await api(`/chat/threads/${id}/messages${query}`));
    setMessages(data.messages);
    setPinned(data.pinned);
    if (!q) await api(`/chat/threads/${id}/read`, { method: 'POST', body: {} }).catch(() => undefined);
  }, []);

  useEffect(() => {
    loadThreads().catch(() => setThreads([]));
  }, [loadThreads]);

  useVisibleInterval(() => {
    loadThreads().catch(() => undefined);
    const id = activeRef.current;
    if (id && !searchRef.current) loadMessages(id).catch(() => undefined);
  }, 3000);

  useEffect(() => {
    if (active) {
      setReplyTo(null);
      setSearch('');
      loadMessages(active).catch(() => setMessages([]));
    }
  }, [active, loadMessages]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e?: FormEvent, textOverride?: string) {
    e?.preventDefault();
    if (!active) return;
    const text = (textOverride ?? body).trim();
    if (!text && !file) {
      setErr('Write a message or attach a file before sending.');
      return;
    }
    setErr('');
    try {
      const fd = new FormData();
      fd.append('body', text);
      if (replyTo) fd.append('replyToId', replyTo.id);
      if (file) fd.append('file', file);
      await api(`/chat/threads/${active}/messages`, { method: 'POST', form: fd });
      setBody('');
      setFile(null);
      setReplyTo(null);
      await loadMessages(active);
      loadThreads();
    } catch (error: any) {
      setErr(error?.message || 'Could not send message');
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Use the live textarea value so Enter never sends a stale empty body.
      void send(undefined, e.currentTarget.value);
    }
  }

  async function sendPoll(e: FormEvent) {
    e.preventDefault();
    if (!active) return;
    setErr('');
    try {
      const fd = new FormData();
      fd.append('kind', 'POLL');
      fd.append('body', poll.question);
      fd.append('pollMultiple', String(poll.multiple));
      fd.append('pollOptions', JSON.stringify(poll.options.split('\n').map((s) => s.trim()).filter(Boolean)));
      await api(`/chat/threads/${active}/messages`, { method: 'POST', form: fd });
      setPoll({ question: '', options: 'Yes\nNo', multiple: false });
      setPollOpen(false);
      await loadMessages(active);
      loadThreads();
    } catch (error: any) {
      setErr(error?.message || 'Could not post poll');
    }
  }

  async function vote(messageId: string, optionId: string) {
    const updated = await api(`/chat/messages/${messageId}/vote`, { method: 'POST', body: { optionId } });
    setMessages((rows) => rows.map((m) => (m.id === messageId ? updated : m)));
  }

  async function react(id: string, emoji: string) {
    const updated = await api(`/chat/messages/${id}/react`, { method: 'POST', body: { emoji } });
    setMessages((rows) => rows.map((m) => (m.id === id ? updated : m)));
  }

  const current = threads.find((t) => t.id === active);
  const visibleThreads = threads.filter((t) => {
    const hay = `${t.title} ${t.clientName || ''} ${t.organization?.name || ''} ${t.lastMessage?.body || ''}`.toLowerCase();
    return hay.includes(filter.toLowerCase());
  });
  const token = getToken() || '';

  function bubble(m: any) {
    return (
      <div key={m.id} className={`bubble ${m.author?.role !== 'CLIENT' ? 'staff' : ''} ${m.authorId === me?.id ? 'mine' : ''}`}>
        <div className="bubble-meta">
          <StaffName name={m.author?.name} role={m.author?.role} jobTitle={m.author?.jobTitle} avatarUrl={m.author?.avatarUrl} avatarPath={m.author?.avatarPath} />
          <span>{stamp(m.createdAt)}{m.editedAt ? ' · edited' : ''}{m.pinned ? ' · pinned' : ''}</span>
        </div>
        {m.replyTo && (
          <div className="quote">
            <StaffName name={m.replyTo.author?.name} role={m.replyTo.author?.role} jobTitle={m.replyTo.author?.jobTitle} avatarUrl={m.replyTo.author?.avatarUrl} avatarPath={m.replyTo.author?.avatarPath} as="span" />
            <div>{m.replyTo.body || m.replyTo.fileName || 'Attachment'}</div>
          </div>
        )}
        {m.kind === 'POLL' && m.poll ? (
          <div className="poll">
            <strong>{m.poll.question}</strong>
            {m.poll.options.map((o: any) => (
              <button key={o.id} type="button" className={`poll-opt ${o.voted ? 'voted' : ''}`} onClick={() => vote(m.id, o.id)} disabled={m.poll.closed}>
                <span>{o.text}</span>
                <span>{o.votes}</span>
              </button>
            ))}
            <small>{m.poll.totalVotes} vote{m.poll.totalVotes === 1 ? '' : 's'}{m.poll.multiple ? ' · multiple choice' : ''}</small>
          </div>
        ) : (
          m.body && <p>{m.body}</p>
        )}
        {m.attachmentUrl && (
          <div className="chat-file">
            {isImage(m.mimeType, m.fileName) && (
              <img alt={m.fileName} src={`${m.attachmentUrl}${m.attachmentUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`} />
            )}
            <button type="button" className="btn sm ghost" onClick={() => openAuthenticatedFile(`/chat/files/${m.id}`, m.fileName).catch((e) => setErr(e.message))}>
              {m.fileName || 'Open file'}
            </button>
          </div>
        )}
        <div className="reacts">
          {REACTS.map((e) => {
            const row = (m.reactions || []).find((r: any) => r.emoji === e);
            return (
              <button key={e} type="button" className={row?.mine ? 'mine' : ''} onClick={() => react(m.id, e)}>
                {e}{row ? ` ${row.count}` : ''}
              </button>
            );
          })}
        </div>
        {m.seenBy?.length > 0 && <div className="seen">Seen by {m.seenBy.join(', ')}</div>}
        <div className="bubble-actions">
          <button type="button" onClick={() => setReplyTo(m)}>Reply</button>
          <button type="button" onClick={() => api(`/chat/messages/${m.id}/pin`, { method: 'POST', body: {} }).then(() => loadMessages(active!))}>
            {m.pinned ? 'Unpin' : 'Pin'}
          </button>
          {admin && (
            <button
              type="button"
              onClick={() => {
                if (!confirm('Delete this message completely? It will disappear for everyone.')) return;
                api(`/chat/messages/${m.id}`, { method: 'DELETE' }).then(() => loadMessages(active!));
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Client chat</h1>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="inbox card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="thread-list">
          <div className="inbox-tools">
            <input placeholder="Find a client or project…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {visibleThreads.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`thread-item ui ${t.id === active ? 'active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              <strong>{t.title}</strong>
              {t.unread > 0 && <span className="unread-dot">{t.unread}</span>}
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                {t.kind === 'PROJECT'
                  ? `Project · ${t.organization?.name || ''}`
                  : `Client · ${t.organization?.name || ''}`}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{t.lastMessage?.body || 'No messages yet'}</div>
            </button>
          ))}
          {visibleThreads.length === 0 && <p style={{ padding: 16, color: 'var(--muted)' }}>No matching conversations.</p>}
        </div>
        <div className="chat-pane">
          {current ? (
            <>
              <div className="chat-head">
                <div>
                  <h3 className="ui" style={{ margin: 0 }}>{current.title}</h3>
                  <span>
                    {current.kind === 'PROJECT'
                      ? `Project · ${current.organization?.name || ''}`
                      : `Client chat · ${current.organization?.name || ''}`}
                  </span>
                </div>
                <input
                  placeholder="Search this chat…"
                  value={search}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearch(v);
                    if (active) loadMessages(active, v);
                  }}
                  style={{ maxWidth: 240 }}
                />
              </div>
              {pinned && (
                <div className="pin-bar ui">
                  Pinned · <StaffName name={pinned.author?.name} role={pinned.author?.role} as="span" />: {pinned.body || pinned.fileName || 'Attachment'}
                </div>
              )}
              <div className="chat-log" ref={logRef}>
                {messages.map(bubble)}
              </div>
              {replyTo && (
                <div className="reply-bar">
                  Replying to <StaffName name={replyTo.author?.name} role={replyTo.author?.role} as="span" />: {replyTo.body || replyTo.fileName}
                  <button type="button" className="btn sm ghost" onClick={() => setReplyTo(null)}>Cancel</button>
                </div>
              )}
              {pollOpen ? (
                <form className="stack composer" onSubmit={sendPoll}>
                  <input required placeholder="Poll question" value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} />
                  <textarea required placeholder="One option per line" value={poll.options} onChange={(e) => setPoll({ ...poll, options: e.target.value })} />
                  <label className="check">
                    <input type="checkbox" checked={poll.multiple} onChange={(e) => setPoll({ ...poll, multiple: e.target.checked })} />
                    Allow more than one answer
                  </label>
                  <div className="row">
                    <button className="btn" type="submit">Post poll</button>
                    <button className="btn ghost" type="button" onClick={() => setPollOpen(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <form className="composer" onSubmit={send}>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} placeholder="Write a reply. Enter to send, Shift+Enter for a new line." />
                  <div className="row">
                    <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button className="btn ghost" type="button" onClick={() => setPollOpen(true)}>Poll</button>
                    <button className="btn" type="submit">Send</button>
                  </div>
                  {file && <small>Attached: {file.name}</small>}
                </form>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--muted)', padding: 16 }}>Select a conversation.</p>
          )}
        </div>
      </div>
    </>
  );
}
