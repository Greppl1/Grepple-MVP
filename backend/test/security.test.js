const { ethers } = require('ethers');
const app = require('../src/app');
const http = require('http');

// Lightweight supertest-style helper (no extra dependency)
function request(app) {
  const server = http.createServer(app);

  function makeRequest(method, path) {
    return {
      _headers: {},
      _body: null,
      set(key, value) {
        this._headers[key] = value;
        return this;
      },
      send(body) {
        this._body = body;
        return this;
      },
      then(resolve, reject) {
        server.listen(0, () => {
          const port = server.address().port;
          const bodyStr = this._body ? JSON.stringify(this._body) : null;
          const headers = { ...this._headers };
          if (bodyStr) {
            headers['Content-Type'] = 'application/json';
          }

          const options = {
            hostname: '127.0.0.1',
            port,
            path,
            method: method.toUpperCase(),
            headers,
          };

          const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              let body;
              try {
                body = JSON.parse(data);
              } catch {
                body = data;
              }
              server.close();
              resolve({ status: res.statusCode, body });
            });
          });

          req.on('error', (err) => {
            server.close();
            reject(err);
          });

          if (bodyStr) req.write(bodyStr);
          req.end();
        });
      },
    };
  }

  return {
    post: (path) => makeRequest('POST', path),
    get: (path) => makeRequest('GET', path),
  };
}

// -- agentAuth middleware unit tests --

const agentAuth = require('../src/middleware/agentAuth');

function mockReqRes(overrides = {}) {
  const req = {
    method: 'POST',
    originalUrl: '/api/rewards/mint',
    headers: {},
    ...overrides,
  };
  const res = {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(obj) {
      this._json = obj;
      return this;
    },
  };
  return { req, res };
}

describe('agentAuth middleware', () => {
  const wallet = ethers.Wallet.createRandom();

  function signRequest(method, path, timestamp, body) {
    const bodyHash = body && Object.keys(body).length > 0
      ? ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(body)))
      : '0x';
    const message = `${method}:${path}:${timestamp}:${bodyHash}`;
    return wallet.signMessageSync(message);
  }

  test('valid signature passes auth', async () => {
    const ts = Date.now().toString();
    const body = { agent_wallet: wallet.address, task_id: 'test' };
    const sig = signRequest('POST', '/api/rewards/mint', ts, body);

    const { req, res } = mockReqRes({
      body,
      headers: {
        'x-agent-wallet': wallet.address,
        'x-agent-signature': sig,
        'x-agent-timestamp': ts,
      },
    });

    let nextCalled = false;
    agentAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.agentWallet).toBe(wallet.address);
  });

  test('invalid signature returns 401', () => {
    const ts = Date.now().toString();

    const { req, res } = mockReqRes({
      headers: {
        'x-agent-wallet': wallet.address,
        'x-agent-signature': '0x' + 'ab'.repeat(65), // garbage signature
        'x-agent-timestamp': ts,
      },
    });

    let nextCalled = false;
    agentAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
  });

  test('wrong wallet returns 401 (signature mismatch)', () => {
    const ts = Date.now().toString();
    const sig = signRequest('POST', '/api/rewards/mint', ts);
    const otherWallet = ethers.Wallet.createRandom();

    const { req, res } = mockReqRes({
      headers: {
        'x-agent-wallet': otherWallet.address,
        'x-agent-signature': sig,
        'x-agent-timestamp': ts,
      },
    });

    let nextCalled = false;
    agentAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Signature mismatch');
  });

  test('missing signature headers returns 401', () => {
    const { req, res } = mockReqRes({ headers: {} });

    let nextCalled = false;
    agentAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Missing authentication headers');
  });

  test('expired timestamp (>5 min) returns 401', () => {
    const ts = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago
    const sig = signRequest('POST', '/api/rewards/mint', ts);

    const { req, res } = mockReqRes({
      headers: {
        'x-agent-wallet': wallet.address,
        'x-agent-signature': sig,
        'x-agent-timestamp': ts,
      },
    });

    let nextCalled = false;
    agentAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Timestamp expired');
  });

  test('modified body after signing causes auth failure', () => {
    const ts = Date.now().toString();
    const originalBody = { agent_wallet: wallet.address, task_id: 'test_task' };
    const sig = signRequest('POST', '/api/rewards/mint', ts, originalBody);

    // Tamper with the body after signing
    const tamperedBody = { agent_wallet: wallet.address, task_id: 'evil_task' };

    const { req, res } = mockReqRes({
      body: tamperedBody,
      headers: {
        'x-agent-wallet': wallet.address,
        'x-agent-signature': sig,
        'x-agent-timestamp': ts,
      },
    });

    let nextCalled = false;
    agentAuth(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
  });
});

// -- webhookAuth middleware unit tests --

const webhookAuth = require('../src/middleware/webhookAuth');

describe('webhookAuth middleware', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  function mockWebhookReqRes(authHeader) {
    const req = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    const res = {
      _status: null,
      _json: null,
      status(code) { this._status = code; return this; },
      json(obj) { this._json = obj; return this; },
    };
    return { req, res };
  }

  function loadWebhookAuth(envKey) {
    let mod;
    const prevKey = process.env.WEBHOOK_API_KEY;
    if (envKey === undefined) {
      delete process.env.WEBHOOK_API_KEY;
    } else {
      process.env.WEBHOOK_API_KEY = envKey;
    }
    jest.isolateModules(() => {
      mod = require('../src/middleware/webhookAuth');
    });
    // Restore
    if (prevKey === undefined) {
      delete process.env.WEBHOOK_API_KEY;
    } else {
      process.env.WEBHOOK_API_KEY = prevKey;
    }
    return mod;
  }

  test('valid API key passes auth', () => {
    const freshWebhookAuth = loadWebhookAuth('test-secret-key-123');
    const { req, res } = mockWebhookReqRes('Bearer test-secret-key-123');

    let nextCalled = false;
    freshWebhookAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  test('invalid API key returns 403', () => {
    const freshWebhookAuth = loadWebhookAuth('correct-key');
    const { req, res } = mockWebhookReqRes('Bearer wrong-key');

    let nextCalled = false;
    freshWebhookAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
    expect(res._json.error).toBe('Invalid API key');
  });

  test('missing Authorization header returns 401', () => {
    const freshWebhookAuth = loadWebhookAuth('some-key');
    const { req, res } = mockWebhookReqRes(null);

    let nextCalled = false;
    freshWebhookAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Missing or invalid Authorization header');
  });

  test('malformed Authorization header (no Bearer prefix) returns 401', () => {
    const freshWebhookAuth = loadWebhookAuth('some-key');
    const { req, res } = mockWebhookReqRes('Basic some-key');

    let nextCalled = false;
    freshWebhookAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res._status).toBe(401);
  });

  test('no WEBHOOK_API_KEY set in dev mode allows requests through', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const freshWebhookAuth = loadWebhookAuth(undefined);
    process.env.NODE_ENV = prevEnv;

    const { req, res } = mockWebhookReqRes(null);

    let nextCalled = false;
    freshWebhookAuth(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });
});

// -- rateLimiter middleware unit tests --

const createRateLimiter = require('../src/middleware/rateLimiter');

describe('rateLimiter middleware', () => {
  test('allows requests within limit', () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    clearInterval(limiter._cleanup);

    const results = [];
    for (let i = 0; i < 3; i++) {
      const req = { headers: { 'x-agent-wallet': '0xAAA' }, ip: '127.0.0.1' };
      const res = {
        _status: null,
        status(code) { this._status = code; return this; },
        json() {},
      };
      let passed = false;
      limiter(req, res, () => { passed = true; });
      results.push({ passed, status: res._status });
    }

    expect(results.every((r) => r.passed)).toBe(true);
  });

  test('blocks requests exceeding limit', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    clearInterval(limiter._cleanup);

    const results = [];
    for (let i = 0; i < 4; i++) {
      const req = { headers: { 'x-agent-wallet': '0xBBB' }, ip: '127.0.0.1' };
      const res = {
        _status: null,
        _json: null,
        status(code) { this._status = code; return this; },
        json(obj) { this._json = obj; },
      };
      let passed = false;
      limiter(req, res, () => { passed = true; });
      results.push({ passed, status: res._status });
    }

    // First 2 pass, next 2 blocked
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
    expect(results[2].passed).toBe(false);
    expect(results[2].status).toBe(429);
    expect(results[3].passed).toBe(false);
    expect(results[3].status).toBe(429);
  });

  test('resets after window expires', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 50 });
    clearInterval(limiter._cleanup);

    const makeReq = () => {
      const req = { headers: { 'x-agent-wallet': '0xCCC' }, ip: '127.0.0.1' };
      const res = {
        _status: null,
        status(code) { this._status = code; return this; },
        json() {},
      };
      let passed = false;
      limiter(req, res, () => { passed = true; });
      return { passed, status: res._status };
    };

    // First request passes
    expect(makeReq().passed).toBe(true);
    // Second immediately blocked
    expect(makeReq().passed).toBe(false);

    // Wait for window to expire
    return new Promise((resolve) => {
      setTimeout(() => {
        // After window, should pass again
        expect(makeReq().passed).toBe(true);
        resolve();
      }, 100);
    });
  });
});

// -- Integration: middleware applied to routes --

describe('route-level middleware integration', () => {
  test('POST /api/rewards/mint without auth headers returns 401', async () => {
    const res = await request(app)
      .post('/api/rewards/mint')
      .send({ agent_wallet: '0x123', task_id: 'task_1', tier: 'FULL' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Missing authentication headers');
  });

  test('POST /api/agents/register without rate limit key still works (no auth required)', async () => {
    // This should NOT return 401 (no agentAuth on register)
    // It will fail with a contract error or similar, but NOT 401
    const res = await request(app)
      .post('/api/agents/register')
      .send({ wallet_address: '0x1234567890abcdef1234567890abcdef12345678', agent_id: 'agent_001' });

    // Should not be 401 — registration does not require signature auth
    expect(res.status).not.toBe(401);
  });
});
