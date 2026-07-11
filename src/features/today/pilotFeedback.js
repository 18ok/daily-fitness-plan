export const PILOT_FEEDBACK_RATINGS = ['适合', '太难', '不符合状态'];

export function createPilotFeedbackId({ clientId, date, contentVersion, selections }) {
  return [clientId, date, contentVersion, selections.time, selections.status, selections.condition].join('|');
}

export function buildPilotFeedback({
  clientFeedbackId,
  rating,
  note = '',
  selections,
  contentVersion,
  submittedAt,
}) {
  if (!PILOT_FEEDBACK_RATINGS.includes(rating)) throw new Error('Unsupported feedback rating');

  const normalizedNote = note.trim();
  if (normalizedNote.length > 200) throw new Error('Feedback note is too long');
  if (!clientFeedbackId || clientFeedbackId.length > 180) throw new Error('Invalid feedback identity');
  if (!selections?.time || !selections?.status || !selections?.condition) throw new Error('Incomplete feedback selections');

  return {
    client_feedback_id: clientFeedbackId,
    rating,
    note: normalizedNote || null,
    time_choice: selections.time,
    status_choice: selections.status,
    condition_choice: selections.condition,
    content_version: contentVersion,
    submitted_at: submittedAt,
  };
}

export async function submitPilotFeedback(client, payload) {
  if (!client) throw new Error('Feedback service unavailable');
  const { error } = await client.from('experience_feedback').insert(payload);
  if (error && error.code !== '23505') throw error;
}
