// Offline support: registers the service worker (/sw.js), links the web app
// manifest, and tells visitors when they are reading a saved copy.
//
// The worker only registers on the real site and Cloudflare previews, so
// local development never fights a cache. Set localStorage 'esc-sw' to 'on'
// to try it on localhost.

/** Emergency off switch: false makes every page unregister the worker. */
export const ENABLED = true;

const PRODUCTION_HOSTS = [
  'esc.studentorg.berkeley.edu',
  'esc.berkeley.edu',
  'esc-berkeley.pages.dev',
];

/** Whether this host should run the service worker. */
export function shouldRegister(location, storage) {
  if (!ENABLED) return false;
  const host = location.hostname;
  if (PRODUCTION_HOSTS.includes(host) || host.endsWith('.esc-berkeley.pages.dev')) return true;
  try {
    return storage?.getItem('esc-sw') === 'on';
  } catch {
    return false;
  }
}

function addHeadLink(rel, href, extra = {}) {
  if (document.head.querySelector(`link[rel="${rel}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  Object.assign(link, extra);
  document.head.append(link);
}

function linkManifest(siteRoot) {
  addHeadLink('manifest', new URL('manifest.webmanifest', siteRoot).href);
  addHeadLink('apple-touch-icon', new URL('images/icons/apple-touch-icon.png', siteRoot).href);
  if (!document.head.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#002676';
    document.head.append(meta);
  }
}

let toast;
function showStatus(message) {
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'esc-net-toast';
    toast.setAttribute('role', 'status');
    const style = document.createElement('style');
    style.textContent = `
      .esc-net-toast { position: fixed; left: 50%; bottom: 1.25rem; z-index: 10001;
        transform: translate(-50%, 1rem); opacity: 0; pointer-events: none;
        max-width: calc(100vw - 2rem); padding: 0.7rem 1.1rem; border-radius: 999px;
        background: #002676; color: #fff; font: 600 0.9rem/1.3 system-ui, sans-serif;
        box-shadow: 0 10px 30px rgb(0 20 70 / 0.3); border: 1px solid rgb(253 181 21 / 0.6);
        transition: opacity 200ms ease, transform 200ms ease; }
      .esc-net-toast.is-shown { opacity: 1; transform: translate(-50%, 0); }
      @media (prefers-reduced-motion: reduce) { .esc-net-toast { transition: none; } }`;
    document.head.append(style);
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-shown');
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => toast.classList.remove('is-shown'), 5000);
}

/** Install offline support. Returns 'registered', 'unregistered', or 'off'. */
export function installOffline({ siteRoot }) {
  if (!('serviceWorker' in navigator)) return 'off';
  linkManifest(siteRoot);
  if (!shouldRegister(location, globalThis.localStorage)) {
    if (!ENABLED) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()));
      return 'unregistered';
    }
    return 'off';
  }
  const register = () =>
    navigator.serviceWorker
      .register(new URL('sw.js', siteRoot), { scope: new URL('./', siteRoot).pathname })
      .catch(() => {});
  // Wait until the page has finished loading so the worker never competes
  // with what the visitor is looking at.
  if (document.readyState === 'complete') register();
  else addEventListener('load', register, { once: true });

  // Browsers sometimes fire these spuriously (for example mid-navigation),
  // so trust navigator.onLine over the event name.
  addEventListener('offline', () => {
    if (!navigator.onLine) showStatus('You’re offline. Pages you’ve visited are still here.');
  });
  addEventListener('online', () => {
    if (navigator.onLine) showStatus('Back online ✓');
  });
  return 'registered';
}
