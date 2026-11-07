// Shared header for the current pages (index.html, execs.html) -- not the
// legacy mega-menu top-bar.js still serves everywhere else. Reuses the same
// pieces every other page's nav runs on (jQuery + dropotron for the hover
// menu, main.js for the phone title bar/off-canvas panel, nav-a11y.js for
// keyboard and screen-reader access, loaded via assets/js/site/enhance.js),
// but the markup here is new and deliberately small: just the logo and one
// real destination, not the old site's full link tree.
//
// Include this as the first thing inside <body>, same as top-bar.js.
function escInsertHere(html) {
	var here = document.currentScript;
	if (here && here.parentNode && here.parentNode !== document.head) {
		here.insertAdjacentHTML('beforebegin', html);
		return;
	}
	if (typeof console !== 'undefined') console.warn('[ESC] Move <script src="assets/js/main-header.js"> from <head> to the top of <body>.');
	document.write(html);
}

escInsertHere('\
<header id="header">\
<div id="logo"><a href="index.html">\
	<span class="image"><img src="images/MAIN_long_nobackground.png" alt="Engineering Student Council home" height="90" width="244" style="width:auto;"/></span></a></div>\
<nav id="nav">\
	<ul>\
		<li>\
			<a href="execs.html">Our Team</a>\
			<ul>\
				<li><a href="https://docs.google.com/forms/d/e/1FAIpQLSekmRMjn2weQUrBLl4xukqHT9f-0daD28Pufqyeu30jSc1oHA/viewform?usp=sharing&ouid=108883144436249446366" target="_blank">Join Us</a></li>\
			</ul>\
		</li>\
	</ul>\
</nav>\
</header>\
');
