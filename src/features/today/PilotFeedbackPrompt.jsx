import React, { useEffect, useState } from 'react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { supabase } from '../../lib/supabaseClient';
import {
  PILOT_FEEDBACK_RATINGS,
  buildPilotFeedback,
  createPilotFeedbackId,
  submitPilotFeedback,
} from './pilotFeedback';

const createClientId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function PilotFeedbackPrompt({ confirmed, date, selections, contentVersion }) {
  const [initialClientId] = useState(createClientId);
  const [clientId] = useLocalStorageState('pilot-feedback-client-id', initialClientId);
  const [pending, setPending] = useLocalStorageState('today-plan-feedback-pending', null);
  const [storedSubmittedIds, setSubmittedIds] = useLocalStorageState('today-plan-feedback-submitted', []);
  const [rating, setRating] = useState('');
  const [note, setNote] = useState('');
  const submittedIds = Array.isArray(storedSubmittedIds) ? storedSubmittedIds : [];

  const feedbackId = createPilotFeedbackId({ clientId, date, contentVersion, selections });
  const isQueued = pending?.client_feedback_id === feedbackId;
  const isSubmitted = submittedIds.includes(feedbackId);

  useEffect(() => {
    if (!pending || !supabase) return undefined;
    let cancelled = false;

    submitPilotFeedback(supabase, pending)
      .then(() => {
        if (cancelled) return;
        setSubmittedIds((current) => [...new Set([...(Array.isArray(current) ? current : []), pending.client_feedback_id])]);
        setPending(null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pending, setPending, setSubmittedIds]);

  if (!confirmed) return null;

  async function handleSubmit() {
    const payload = buildPilotFeedback({
      clientFeedbackId: feedbackId,
      rating,
      note,
      selections,
      contentVersion,
      submittedAt: new Date().toISOString(),
    });

    try {
      await submitPilotFeedback(supabase, payload);
      setSubmittedIds((current) => [...new Set([...(Array.isArray(current) ? current : []), feedbackId])]);
      setPending(null);
    } catch {
      setPending(payload);
    }
  }

  if (isSubmitted) return <p className="pilot-feedback-status">谢谢你的反馈，已经收到。</p>;
  if (isQueued) return <p className="pilot-feedback-status">反馈已保存在本机，联网后会自动提交。</p>;

  return (
    <section className="pilot-feedback" aria-labelledby="pilot-feedback-title">
      <h3 id="pilot-feedback-title">这个计划适合你今天吗？</h3>
      <div className="pilot-feedback-options">
        {PILOT_FEEDBACK_RATINGS.map((item) => (
          <button
            className={rating === item ? 'is-active' : ''}
            key={item}
            onClick={() => setRating(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <textarea
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
        placeholder="可以补充一句，选填"
        value={note}
      />
      <button className="pilot-feedback-submit" disabled={!rating} onClick={handleSubmit} type="button">
        提交反馈
      </button>
    </section>
  );
}
