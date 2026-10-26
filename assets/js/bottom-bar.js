// custom code written by Niraj
// Inserts the shared footer right where this <script> tag sits.
// From inside <body> that is done with insertAdjacentHTML. Most pages load
// this file from <head>, though, and only document.write can synchronously
// place markup into <body> from there (main.js needs #nav to exist when it
// runs). Moving those script tags into <body> lets every page use the
// modern path.
//
// One footer serves every screen size: real headings and lists so screen
// readers can skim it, named icon links, and a layout in main.css
// ("Accessible footer") that goes from four columns to two to one instead of
// squeezing four columns onto a phone.
function escInsertHere(html) {
	var here = document.currentScript;
	if (here && here.parentNode && here.parentNode !== document.head) here.insertAdjacentHTML('beforebegin', html);
	else document.write(html);
}

escInsertHere('\
<footer id="footer" class="esc-footer">\
	<div class="esc-footer__grid">\
		<div class="esc-footer__col esc-footer__col--about">\
			<a class="esc-footer__logo" href="index.html"><img src="images/main_nobckgnd.png" alt="Engineering Student Council home" height="95" width="285" /></a>\
			<h2 class="esc-footer__heading">About us</h2>\
			<p>Our mission is to represent the engineering student body; support engineering societies in reaching their full potential; and promote a diverse community through successful collaboration between students, faculty, societies, and the College of Engineering.</p>\
			<ul class="icons esc-footer__social">\
				<li><a href="https://www.facebook.com/ESC.Berkeley" class="icon brands alt fa-facebook-f"><span class="label">ESC on Facebook</span></a></li>\
				<li><a href="https://www.instagram.com/berkeleyesc/" class="icon brands alt fa-instagram"><span class="label">ESC on Instagram</span></a></li>\
				<li><a href="mailto:communications@esc.berkeley.edu?subject=WEB%20-%20" class="icon solid alt fa-envelope"><span class="label">Email ESC communications</span></a></li>\
			</ul>\
		</div>\
		<div class="esc-footer__col">\
			<h2 class="esc-footer__heading">Frequently visited pages</h2>\
			<ul class="esc-footer__links">\
				<li><a href="clubs.html">Certified Organizations</a></li>\
				<li><a href="applyfunding.html">Apply for Funding</a></li>\
				<li><a href="fin-decisions.html">Finance Decisions</a></li>\
				<li><a href="treasurertrain.html">Treasurer Trainings</a></li>\
				<li><a href="fmpi.html">Free Menstrual Product Initiative</a></li>\
			</ul>\
			<h2 class="esc-footer__heading">Portals</h2>\
			<ul class="esc-footer__links">\
				<li><a href="https://sites.google.com/berkeley.edu/escinternal/">ESC Internal</a></li>\
				<li><a href="https://sites.google.com/berkeley.edu/blue-and-gold-portal/home">Blue and Gold Certification</a></li>\
			</ul>\
		</div>\
		<div class="esc-footer__col">\
			<h2 class="esc-footer__heading">Contacting us</h2>\
			<p>For general inquiries about the ESC, or if you are part of a company interested in partnering with the ESC, please email our <a href="mailto:president@esc.berkeley.edu?subject=General Inquiry">presidents</a>.</p>\
			<p>This website is managed by the ESC Technical Team. For issues and errors on this site, please contact this <a href="mailto:technical@esc.berkeley.edu?subject=Issues on ESC Main Website">webmaster email</a>.</p>\
			<p><a href="accessibility.html">Accessibility</a>: tell us about any barrier you hit on this site.</p>\
		</div>\
		<div class="esc-footer__col">\
			<p><a href="https://ophd.berkeley.edu/report" target="_blank" class="button primary esc-footer__report">Report Sexual Harassment</a></p>\
			<h2 class="esc-footer__heading">Address</h2>\
			<address>\
				Engineering Student Council<br />\
				Previously 120 A/B/C Bechtel<br />\
				Temporarily located in McLaughlin<br />\
				University of California, Berkeley<br />\
				Berkeley, California, 94704\
			</address>\
			<a class="esc-footer__ocf" href="https://ocf.berkeley.edu" target="_blank"><img src="images/ocfbadge.png" alt="Hosted by the OCF" width="98" height="39" /></a>\
		</div>\
	</div>\
	<p class="copyright esc-footer__copyright">&copy; 2020&ndash;' + new Date().getFullYear() + '. All rights reserved | <a href="https://esc.berkeley.edu">Engineering Student Council</a> takes responsibility for this website and its content.</p>\
</footer>\
');
