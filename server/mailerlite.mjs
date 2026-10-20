// Server-only. Never publish the API token in browser assets.
export function mailerLite({ token, groupId, request = fetch }) {
  async function call(path, method = 'GET', body) {
    const response = await request(`https://connect.mailerlite.com/api/${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000)
    });
    if (method === 'GET' && response.status === 404) return null;
    if (!response.ok) throw Object.assign(new Error('Newsletter provider unavailable'), { code: `MAILERLITE_${response.status}` });
    return response.status === 204 ? null : (await response.json()).data;
  }
  const get = email => call(`subscribers/${encodeURIComponent(email)}`);
  const subscribed = person => person?.status === 'active' && person.groups?.some(group => String(group.id) === groupId) === true;
  async function apply(email, desired) {
    const person = await get(email);
    if (!desired) {
      if (person?.groups?.some(group => String(group.id) === groupId)) await call(`subscribers/${person.id}/groups/${groupId}`, 'DELETE');
      return 'saved';
    }
    if (person && person.status !== 'active') return 'confirmation_needed';
    await call('subscribers', 'POST', { email, groups: [groupId] });
    return 'saved';
  }
  return { get, subscribed, apply };
}
