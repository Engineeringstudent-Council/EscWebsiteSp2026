// Progressive enhancements shared by every page. Each feature checks for
// browser support and does nothing where it isn't available, so the site
// works exactly as before in older browsers.
import { installInstantNavigation } from './instant.js';
import { installOffline } from './offline.js';
import { installNavA11y } from './nav-a11y.js';
import { installA11y } from './a11y.js';

const root = document.documentElement;
root.dataset.escInstant = installInstantNavigation();
// The site root, worked out from this file's own URL (assets/js/site/).
const siteRoot = new URL('../../../', import.meta.url);
root.dataset.escOffline = installOffline({ siteRoot });
installNavA11y();
installA11y();
