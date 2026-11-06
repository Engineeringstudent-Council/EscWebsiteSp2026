// Shared footer for the current pages (index.html, execs.html) -- the
// legacy bottom-bar.js footer (with the old site's full link tree, the
// address, and the Report Sexual Harassment button) still serves every
// other page. This is index.html's original trimmed footer, now shared so
// execs.html matches it, with the OCF badge restored.
//
// Include this as the last thing inside <body>, same as bottom-bar.js.
function escInsertHere(html) {
	var here = document.currentScript;
	if (here && here.parentNode && here.parentNode !== document.head) here.insertAdjacentHTML('beforebegin', html);
	else document.write(html);
}

escInsertHere('\
<footer id="footer" style="margin-top:2em;background:#f4f4f4;">\
	<div style="max-width:1100px;margin:0 auto;padding:3.5em 1.5em 1.5em;">\
\
		<div class="esc-home-footer-grid">\
			<div style="display:flex;gap:1.3em;align-items:flex-start;">\
				<span class="image" style="flex:0 0 auto;margin-top:0.15em;"><img src="images/MAIN_nobackground.png" alt="Engineering Student Council" height="120" style="width:auto;"/></span>\
				<div>\
					<h2 class="esc-home-footer-heading">About Us</h2>\
					<p style="margin:0 0 1em;">Our mission is to represent the engineering student body; support engineering societies in reaching their full potential; and promote a diverse community through successful collaboration between students, faculty, societies, and the College of Engineering.</p>\
					<ul class="icons" style="margin:0;">\
						<li><a href="https://www.facebook.com/ESC.Berkeley" class="icon brands alt fa-facebook-f" target="_blank"><span class="label">Facebook</span></a></li>\
						<li><a href="https://www.instagram.com/berkeleyesc/" class="icon brands alt fa-instagram" target="_blank"><span class="label">Instagram</span></a></li>\
					</ul>\
				</div>\
			</div>\
			<div>\
				<h2 class="esc-home-footer-heading">Join the Team</h2>\
				<p style="margin:0 0 1em;">Interested in getting involved with ESC? Fill out the application form to get started.</p>\
				<a href="https://docs.google.com/forms/d/e/1FAIpQLSekmRMjn2weQUrBLl4xukqHT9f-0daD28Pufqyeu30jSc1oHA/viewform?usp=sharing&ouid=108883144436249446366" target="_blank" class="button primary" style="height:2.4em;line-height:2.4em;padding:0 1.5em;font-size:14px;">Application Form</a>\
			</div>\
			<div>\
				<h2 class="esc-home-footer-heading">Contacting Us</h2>\
				<p style="margin:0 0 1em;">For general inquiries about the ESC, or if you are part of a company interested in partnering with the ESC, please email our presidents at, <a href="mailto:president@esc.studentorg.berkeley.edu">president@esc.studentorg.berkeley.edu</a>.</p>\
				<p style="margin:0;"><a href="accessibility.html">Accessibility</a>: tell us about any barrier you hit on this site.</p>\
			</div>\
		</div>\
\
		<p style="text-align:center;margin:1.8em 0 0;">\
			<a href="https://ocf.berkeley.edu" target="_blank"><img src="images/ocfbadge.png" alt="Hosted by the OCF" width="98" height="39" /></a>\
		</p>\
\
		<ul class="copyright" style="padding-top:1.2em;text-align:center;">\
			<li style="display:block;">&copy; 2026. All rights reserved | <a href="https://esc.berkeley.edu">Engineering Student Council</a> takes responsibility for this website and its content.</li>\
		</ul>\
	</div>\
</footer>\
');
