// Miss-Woo configuration. Contains NO keys.
// WooCommerce and Katana keys live only in the Miss-Woo API (Cloudflare Worker).
// The access pass comes from the Missive integration link, e.g.
//   https://bryanquikrstuff.github.io/Miss-Woo/?token=YOUR_PASS
(function () {
  let token = '';
  try {
    token = new URLSearchParams(window.location.search).get('token') || '';
  } catch (e) {
    token = '';
  }

  window.config = {
    api: {
      baseUrl: "https://miss-woo-api.bryan-df4.workers.dev",
      token: token
    },
    siteUrl: "https://quikrstuff.com"
  };
})();
