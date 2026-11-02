const api = (u) => `${API_BASE_URL}${u}`;

const parse = async (res) => {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || 'Request failed');
  return payload;
};

async function get(u) {
  const res = await fetch(api(u));
  return parse(res);
}

async function send(method, u, b = {}) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (method !== 'DELETE') options.body = JSON.stringify(b);
  const res = await fetch(api(u), options);
  return parse(res);
}
