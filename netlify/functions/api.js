// Netlify Function: Generic API proxy
// Proxies /api/* to an external PHP backend defined by env API_ORIGIN
// Preserves method, headers, body, and session cookies (Set-Cookie passthrough)

export default async function handler(event, context) {
  const origin = process.env.API_ORIGIN;
  if (!origin) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'missing_api_origin' }),
    };
  }

  // Handle CORS preflight if needed
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      },
      body: '',
    };
  }

  try {
    // Build target URL by mapping /.netlify/functions/api to /api/*
    const url = new URL(event.rawUrl);
    const path = url.pathname.replace(/^\/\.netlify\/functions\/api/, '/api');
    const target = origin.replace(/\/$/, '') + path + (url.search || '');

    // Prepare headers
    const headers = new Headers();
    // Copy incoming headers selectively (avoid host mismatch)
    const incoming = event.headers || {};
    for (const [k, v] of Object.entries(incoming)) {
      const key = k.toLowerCase();
      if (['host', 'content-length'].includes(key)) continue;
      headers.set(k, v);
    }
    // Ensure content type for JSON pass-through
    if (!headers.has('content-type') && event.body && !event.isBase64Encoded) {
      headers.set('Content-Type', 'application/json');
    }

    // Body
    let bodyInit = undefined;
    if (event.body) {
      bodyInit = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    }

    const resp = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: bodyInit,
      redirect: 'follow',
    });

    // Read response body (as text to pass through JSON or SSE)
    const buf = await resp.arrayBuffer();
    const text = Buffer.from(buf).toString('utf-8');

    // Collect headers and pass Set-Cookie through
    const outHeaders = {};
    resp.headers.forEach((val, key) => {
      // Netlify requires multi-value cookies via array header
      if (key.toLowerCase() === 'set-cookie') {
        // Node Fetch flattens set-cookie; handle get-set-cookie if present
        const cookies = resp.headers.get('set-cookie');
        if (cookies) outHeaders['Set-Cookie'] = cookies;
      } else {
        outHeaders[key] = val;
      }
    });

    return {
      statusCode: resp.status,
      headers: outHeaders,
      body: text,
      isBase64Encoded: false,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'proxy_error', message: String(err && err.message || err) }),
    };
  }
}
