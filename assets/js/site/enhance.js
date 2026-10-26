// Progressive enhancements shared by every page. Each feature checks for
// browser support and does nothing where it isn't available, so the site
// works exactly as before in older browsers.
import { installInstantNavigation } from './instant.js';

const root = document.documentElement;
root.dataset.escInstant = installInstantNavigation();
