const fs = require('fs'); // eslint-disable-line @typescript-eslint/no-require-imports
const path = require('path'); // eslint-disable-line @typescript-eslint/no-require-imports
const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-require-imports

// Development only. With AL_LOCAL_API set, the dev server answers the Audit Loupe service-proxy
// path itself instead of sending it to Rancher; every other path still goes to Rancher (API).
// Off by default; production builds never read it.
//   AL_LOCAL_API=http://host.docker.internal:18090  a backend running on this Mac
//   AL_LOCAL_API=/some/dir                           saved responses, fixture-<day>-<tab>.json
const AL_PROXY = '/k8s/clusters/local/api/v1/namespaces/audit-loupe-system/services/http:audit-loupe:8080/proxy';
const local = process.env.AL_LOCAL_API;
const proxy = {};
const fixtures = local && !/^https?:\/\//.test(local) ? local : '';

if (local && !fixtures) {
  console.log(`Audit Loupe: ${ AL_PROXY } -> ${ local }`); // eslint-disable-line no-console
  proxy[AL_PROXY] = {
    target:       local,
    changeOrigin: true,
    pathRewrite:  (p) => p.slice(AL_PROXY.length) || '/',
    // The local backend has no Rancher login; do not hand it Rancher's session.
    onProxyReq(proxyReq) {
      proxyReq.removeHeader('cookie');
      proxyReq.removeHeader('authorization');
    },
  };
}

// Saved /api/changemap responses. Only day and tab pick the file; other parameters (cluster,
// select, ...) are ignored, so the screen shows the defaults the files were saved with.
function serveFixtures(req, res) {
  const url = new URL(req.url, 'http://x');
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };

  if (url.pathname !== '/api/changemap') {
    return send(404, { error: `not in fixtures: ${ url.pathname }` });
  }
  const day = url.searchParams.get('day') || '';
  const tab = url.searchParams.get('tab') || 'overview';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[a-z]+$/.test(tab)) {
    return send(400, { error: 'day and tab are required' });
  }
  const file = path.join(fixtures, `fixture-${ day }-${ tab }.json`);

  if (url.searchParams.get('cursor')) {
    return send(200, { rows: [], next: null });
  }
  fs.readFile(file, 'utf8', (err, body) => (err ? send(404, { error: `no fixture for ${ day } ${ tab }` }) : send(200, body)));
}

const out = config(__dirname, {
  excludes: [],
  proxy,
  // excludes: ['fleet', 'example']
});

if (fixtures) {
  console.log(`Audit Loupe: ${ AL_PROXY } -> fixtures in ${ fixtures }`); // eslint-disable-line no-console
  const setup = out.devServer.setupMiddlewares;

  // Ahead of the shell's proxies, so this path never reaches Rancher.
  out.devServer.setupMiddlewares = (middlewares, devServer) => {
    devServer?.app?.use(AL_PROXY, serveFixtures);

    return setup(middlewares, devServer);
  };
}

module.exports = out;
