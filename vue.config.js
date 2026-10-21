const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-var-requires

// Development only: with AL_LOCAL_API set (e.g. http://host.docker.internal:18090), the dev
// server sends the Audit Loupe service-proxy path to that backend instead of Rancher; every
// other path still goes to Rancher (API). Off by default; production builds never read it.
const AL_PROXY = '/k8s/clusters/local/api/v1/namespaces/audit-loupe-system/services/http:audit-loupe:8080/proxy';
const local = process.env.AL_LOCAL_API;
const proxy = {};

if (local) {
  console.log(`Audit Loupe: ${ AL_PROXY } -> ${ local }`); // eslint-disable-line no-console
  proxy[AL_PROXY] = {
    target:       local,
    changeOrigin: true,
    pathRewrite:  (path) => path.slice(AL_PROXY.length) || '/',
    // The local backend has no Rancher login; do not hand it Rancher's session.
    onProxyReq(proxyReq) {
      proxyReq.removeHeader('cookie');
      proxyReq.removeHeader('authorization');
    },
  };
}

module.exports = config(__dirname, {
  excludes: [],
  proxy,
  // excludes: ['fleet', 'example']
});
