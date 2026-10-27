// custom code written by Niraj and maintained by Ethan (surely there has to be a better way of appending HTML to other HTML files, please get rid of this ASAP)
// Previous contact form:
// <li><a href="https://form.typeform.com/to/UTcmX9lD" data-mode="popup">Contact Us </a> <script> (function() { var qs,js,q,s,d=document, gi=d.getElementById, ce=d.createElement, gt=d.getElementsByTagName, id="typef_orm_share", b="https://embed.typeform.com/"; if(!gi.call(d,id)){ js=ce.call(d,"script"); js.id=id; js.src=b+"embed.js"; q=gt.call(d,"script")[0]; q.parentNode.insertBefore(js,q) } })() </script></li>\
//h1 changed to h2 in line 8 by Ethan

// Inserts the shared nav right where this <script> tag sits, so include it as
// the first thing inside <body>. main.js needs #nav to exist when it runs,
// which is why this stays a plain synchronous script.
// A page that still loads this file from <head> can only be served by
// document.write, so that path is kept as a fallback with a nudge to fix it.
function escInsertHere(html) {
	var here = document.currentScript;
	if (here && here.parentNode && here.parentNode !== document.head) {
		here.insertAdjacentHTML('beforebegin', html);
		return;
	}
	if (typeof console !== 'undefined') console.warn('[ESC] Move <script src="assets/js/top-bar.js"> from <head> to the top of <body>.');
	document.write(html);
}

escInsertHere('\
<header id="header">\
<h2 id="logo"><a href="index.html">\
	<span class="image"><img src="images/main_nobckgnd.png" alt="Engineering Student Council Logo"  height="95" width="285" style="vertical-align: top; width:auto;"/></span></a></h1>\
<nav id="nav">\
	<ul>\
		 <li>\
			<a href="about.html">About Us</a>\
			<ul>\
<li><a href="#">Our Team</a>\
  <ul>\
	<li><a href="execs.html">Executive Board</a></li>\
	<li><a href="committees.html">Our Committees</a></li>\
  </ul>\
</li>\
<li><a href="#">Our Finances</a>\
  <ul>\
					<li><a href="https://docs.google.com/spreadsheets/d/1ig6p24CjkC6ggSZPXSRNSclqro15jaI2/edit">Our Budget</a></li>\
	<li><a href="sponsors.html">Our Sponsors</a></li>\
  </ul>\
</li>\
			  <!-- <li><a href="positive_messages.html">Positive Messages Campaign</a></li> -->\
				<li><a href="https://sites.google.com/berkeley.edu/escinternal/" target="_blank">ESC Internal</a></li>\
\
			</ul>\
		</li>\
		<li>\
			<a href="students.html">Students</a>\
			<ul>\
<li><a href="#">Health</a>\
	<ul>\
	  <li><a href="fmpi.html">Free Menstrual Product Initiative</a></li>\
	  <li><a href="https://dac.berkeley.edu/" target="_blank"> Disability Access and Compliance</a></li>\
					  <li><a href="hear.html">HEAR Tool</a></li>\
	</ul>\
</li>\
<li><a href="#">Life Resources</a>\
	<ul>\
			<li><a href="food.html">Food Advice</a></li>\
		<li><a href="housing.html">Housing</a></li>\
		<li><a href="finance.html">Finance Advice</a></li>\
	</ul>\
</li>\
<li><a href="#">Academic Enrichment</a>\
  <ul>\
	<li><a href="academics.html">Academics</a></li>\
	<li><a href="engin_decals.html">Engineering-Focused Decals</a></li>\
	<li><a href="makerspaces.html">Makerspaces</a></li>\
	<li><a href="startups.html">Startups</a></li>\
  </ul>\
</li>\
				<li><a href="https://ophd.berkeley.edu/report" target="_blank">Report Sexual Harassment</a></li>\
				<li><a href="faqs.html">Frequently Asked Questions</a></li>\
			</ul>\
		</li>\
		<li>\
			<a href="organizations-home.html">Organizations</a>\
			<ul>\
\
				<li><a href="blueandgold.html">Blue and Gold Certification Info</a></li>\
				<li><a href="https://sites.google.com/berkeley.edu/blue-and-gold-portal/home">Blue and Gold Portal</a></li>\
				<li><a href="clubs.html">List of Certified Organizations</a></li>\
				<li><a href="fin-decisions.html">Finances</a></li>\
				<li><a href="treasurertrain.html">Treasurer Training</a></li>\
\
			</ul>\
		</li>\
		<li><a href="events.html">Events</a>\
			<ul>\
				<li><a href="events.html">Upcoming Events</a></li>\
				<li><a href="past-events.html">Past Events</a></li>\
				<li><a href="eweek_overview.html">Engineers Week</a></li>\
				<li><a href="https://e4k.berkeley.edu/" target="_blank">Engineering 4 Kids</a></li>\
			</ul>\
\
		</li>\
		<li><a href="https://forms.gle/Q2K6TZySHtWS65ex9" target="_blank">Connect</a>\
			<ul>\
				<li> <!-- <a href="https://forms.gle/7ycA5tAZuPQepzV16" target="_blank">Contact Us</a> --> </li>\
				<li><a href="https://www.facebook.com/ESC.Berkeley/">Facebook</a>\
						<!-- <ul>\
							<li><a href="https://www.facebook.com/eweekberkeley/" target="_blank">EWeek Facebook</a></li>\
							<li><a href="https://www.facebook.com/berkeleye4k/" target="_blank">E4K Facebook</a></li>\
							<li><a href="https://www.facebook.com/ESC.Berkeley/" target="_blank">ESC Facebook</a></li>\
						</ul> -->\
				</li>\
				<li><a href="https://www.instagram.com/berkeleyesc/?hl=en" target="_blank">Instagram</a></li>\
				<li> <!-- <a href="https://berkeley.us19.list-manage.com/subscribe?u=a43b64de9699d450384dc3d04&id=dd45839c09" target="_blank">Sign up for newsletter </a> --> </li>\
				<li><a href="https://forms.gle/Q2K6TZySHtWS65ex9" target="_blank">Join the team </a></li>\
			</ul>\
		</li>\
		<li><a href="https://docs.google.com/forms/d/e/1FAIpQLSfB53XBgch-4JIuCsDZWbMT5zfcz0iiMjOBYyA3ltDSQ-ow-g/viewform?usp=sf_link" target="_blank">Join Our Mailing List</a>\
		<!-- <li><a href="https://ophd.berkeley.edu/report" target="_blank" class="button primary">Report Sexual Harassment</a></li> -->\
	</ul>\
</nav>\
</header>\
');

// Site search (⌘K / Ctrl+K) and progressive enhancements (instant page
// loads and friends). Loaded as modules so they never block the page, and
// older browsers that don't understand modules simply skip them.
(function () {
	var here = document.currentScript;
	['search/ui.js', 'site/enhance.js'].forEach(function (path) {
		var s = document.createElement('script');
		s.type = 'module';
		s.src = here ? new URL(path, here.src).href : 'assets/js/' + path;
		document.head.appendChild(s);
	});
})();
