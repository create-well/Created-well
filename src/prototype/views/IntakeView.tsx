import React, { useEffect, useState } from 'react';
import { formatTimestamp, optionsOf, source, str, titleOf } from '../lib/data';
import { Chip, EmptyState, Panel } from '../components/ui';

const QUEUE_KEY = 'sfp-intake-queue';

interface QueueItem {
  kind: string;
  payload: Record<string, string>;
  queuedAt: string;
  status: string;
}

function loadQueue(): QueueItem[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueueItem[]) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* local staging only; storage may be unavailable */
  }
}

const KIND_LABEL: Record<string, string> = {
  content: 'Content submission',
  survey: 'Survey response',
  event: 'Event update',
};

export default function IntakeView() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [contentForm, setContentForm] = useState({ title: '', contentType: '', audience: 'Public', link: '' });
  const [surveyForm, setSurveyForm] = useState({ name: '', type: '', source: 'Guest', body: '' });
  const [eventForm, setEventForm] = useState({ event: '', date: '', location: '', status: '' });

  useEffect(() => {
    setQueue(loadQueue());
  }, []);

  const contentTypeOptions = optionsOf('CONTENT', 'Content Type');
  const feedbackTypeOptions = optionsOf('FEEDBACK', 'Type');
  const feedbackSourceOptions = optionsOf('FEEDBACK', 'Source');
  const eventStatusOptions = optionsOf('EVENTS', 'Status');

  function enqueue(kind: string, payload: Record<string, string>) {
    const item: QueueItem = {
      kind,
      payload,
      queuedAt: new Date().toISOString(),
      status: 'New',
    };
    const next = [item, ...queue];
    setQueue(next);
    saveQueue(next);
  }

  function removeAt(index: number) {
    const next = queue.filter((_, i) => i !== index);
    setQueue(next);
    saveQueue(next);
  }

  const feedbackRows = source('FEEDBACK').rows;

  return (
    <div>
      <h2 className="view-title">Intake — the return</h2>
      <p className="view-sub">
        What gathers here flows back down and replenishes the source. Forms mirror the Notion
        schemas; submissions stage in this browser only, for review, as overflow on its way
        back.
      </p>

      <div className="intake-forms">
        <Panel title="Content submission">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enqueue('content', {
                Title: contentForm.title,
                'Content Type': contentForm.contentType,
                Audience: contentForm.audience,
                Link: contentForm.link,
              });
              setContentForm({ title: '', contentType: '', audience: 'Public', link: '' });
            }}
          >
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                required
                value={contentForm.title}
                onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Content Type</span>
              <select
                value={contentForm.contentType}
                onChange={(e) => setContentForm({ ...contentForm, contentType: e.target.value })}
              >
                <option value="">Select…</option>
                {contentTypeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Audience</span>
              <select
                value={contentForm.audience}
                onChange={(e) => setContentForm({ ...contentForm, audience: e.target.value })}
              >
                <option value="Public">Public</option>
                <option value="Team">Team</option>
              </select>
            </label>
            <label className="field">
              <span>Link</span>
              <input
                type="url"
                placeholder="https://"
                value={contentForm.link}
                onChange={(e) => setContentForm({ ...contentForm, link: e.target.value })}
              />
            </label>
            <button type="submit" className="submit-button">
              Stage content submission
            </button>
          </form>
        </Panel>

        <Panel title="Survey response">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enqueue('survey', {
                Name: surveyForm.name,
                Type: surveyForm.type,
                Source: surveyForm.source,
                Body: surveyForm.body,
              });
              setSurveyForm({ name: '', type: '', source: 'Guest', body: '' });
            }}
          >
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                required
                value={surveyForm.name}
                onChange={(e) => setSurveyForm({ ...surveyForm, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Type</span>
              <select
                value={surveyForm.type}
                onChange={(e) => setSurveyForm({ ...surveyForm, type: e.target.value })}
              >
                <option value="">Select…</option>
                {feedbackTypeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Source</span>
              <select
                value={surveyForm.source}
                onChange={(e) => setSurveyForm({ ...surveyForm, source: e.target.value })}
              >
                {(feedbackSourceOptions.length ? feedbackSourceOptions : ['Guest', 'Team']).map(
                  (o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              <span>Body</span>
              <textarea
                rows={4}
                value={surveyForm.body}
                onChange={(e) => setSurveyForm({ ...surveyForm, body: e.target.value })}
              />
            </label>
            <button type="submit" className="submit-button">
              Stage survey response
            </button>
          </form>
        </Panel>

        <Panel title="Event update">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enqueue('event', {
                Event: eventForm.event,
                Date: eventForm.date,
                Location: eventForm.location,
                Status: eventForm.status,
              });
              setEventForm({ event: '', date: '', location: '', status: '' });
            }}
          >
            <label className="field">
              <span>Event</span>
              <input
                type="text"
                required
                value={eventForm.event}
                onChange={(e) => setEventForm({ ...eventForm, event: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={eventForm.date}
                onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Location</span>
              <input
                type="text"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={eventForm.status}
                onChange={(e) => setEventForm({ ...eventForm, status: e.target.value })}
              >
                <option value="">Select…</option>
                {eventStatusOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="submit-button">
              Stage event update
            </button>
          </form>
        </Panel>
      </div>

      <Panel title="Review queue — overflow on its way back">
        <p className="standing-note">Staged locally only — nothing was sent to Notion or Sheets.</p>
        {queue.length ? (
          <ul className="row-list">
            {queue.map((item, i) => {
              const entries = Object.entries(item.payload).filter(([, v]) => v !== '');
              const headline =
                item.payload.Title || item.payload.Name || item.payload.Event || KIND_LABEL[item.kind];
              return (
                <li key={`${item.queuedAt}-${i}`} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{headline}</span>
                    <span className="list-row-meta">
                      {entries.map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </span>
                    <span className="list-row-meta">Queued {formatTimestamp(item.queuedAt)}</span>
                  </div>
                  <div className="chip-row">
                    <Chip label={KIND_LABEL[item.kind] || item.kind} />
                    <Chip label={item.status} />
                    <button type="button" className="chip chip-link" onClick={() => removeAt(i)}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Nothing staged yet. Submissions from the forms above land here.</EmptyState>
        )}
      </Panel>

      <Panel title="Already returned — feedback in the source (FEEDBACK)" source="FEEDBACK">
        {feedbackRows.length ? (
          <ul className="row-list">
            {feedbackRows.map((r) => {
              const type = str(r, 'Type');
              const status = str(r, 'Status');
              const body = str(r, 'Body');
              return (
                <li key={r.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('FEEDBACK', r)}</span>
                    {body ? <span className="clamp-3 body-text">{body}</span> : null}
                  </div>
                  <div className="chip-row">
                    {type ? <Chip label={type} /> : null}
                    {status ? <Chip label={status} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No feedback rows in Notion yet.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
