const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

function createProxyAgent(proxyUrl) {
  if (proxyUrl.startsWith('socks://') || proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks4://')) {
    return new SocksProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
}

function maskProxyUrl(proxyUrl) {
  return proxyUrl.replace(/:[^:@/]+@/, ':***@');
}

module.exports = {
  createProxyAgent,
  maskProxyUrl,
};
