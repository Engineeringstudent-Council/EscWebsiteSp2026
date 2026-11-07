(function () {
	'use strict';

	var daysElement = document.getElementById('calendar-days');
	if (!daysElement) return;

	var monthElement = document.getElementById('calendar-month');
	var selectedDateElement = document.getElementById('calendar-selected-date');
	var dayEventsElement = document.getElementById('calendar-day-events');
	var upcomingEventsElement = document.getElementById('calendar-upcoming-events');
	var today = new Date();
	var shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	var selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	var activeFilter = 'all';
	var eventExamples = [
		{ day: 4, title: 'Engineering community meetup', time: '12:00–1:00 PM', place: 'Bechtel Engineering Center', category: 'community', label: 'Community' },
		{ day: 9, title: 'Design thinking workshop', time: '3:00–4:30 PM', place: 'College of Engineering', category: 'workshop', label: 'Workshop' },
		{ day: 15, title: 'Careers in engineering panel', time: '5:00–6:00 PM', place: 'Bechtel Engineering Center', category: 'professional', label: 'Professional' },
		{ day: 21, title: 'Student org social', time: '4:00–5:30 PM', place: 'Engineering Plaza', category: 'community', label: 'Community' },
		{ day: 26, title: 'Build your project portfolio', time: '2:00–3:00 PM', place: 'College of Engineering', category: 'workshop', label: 'Workshop' }
	];
	var monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
	var dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
	var shortDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

	function dateKey(date) {
		return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
	}

	function getMonthEvents() {
		var daysInMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
		return eventExamples
			.filter(function (event) { return event.day <= daysInMonth; })
			.map(function (event) {
				return Object.assign({}, event, {
					date: new Date(shownMonth.getFullYear(), shownMonth.getMonth(), event.day)
				});
			})
			.filter(function (event) { return activeFilter === 'all' || event.category === activeFilter; });
	}

	function createEventCard(event, includeDate) {
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'calendar-event-card';
		button.setAttribute('aria-label', event.title + ', ' + dateFormatter.format(event.date) + ', ' + event.time);

		var title = document.createElement('strong');
		title.textContent = event.title;
		button.appendChild(title);

		var details = document.createElement('span');
		details.textContent = (includeDate ? shortDateFormatter.format(event.date) + ' · ' : '') + event.time + ' · ' + event.place;
		button.appendChild(details);

		var category = document.createElement('span');
		category.className = 'calendar-event-category';
		category.textContent = 'Sample · ' + event.label;
		button.appendChild(category);

		button.addEventListener('click', function () {
			selectedDate = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate());
			render();
		});
		return button;
	}

	function renderDayEvents(events) {
		dayEventsElement.replaceChildren();
		if (!events.length) {
			var empty = document.createElement('p');
			empty.className = 'calendar-agenda-empty';
			empty.textContent = activeFilter === 'all'
				? 'No sample events on this day. A live event feed will be added after the calendar is connected.'
				: 'No sample events in this category on this day.';
			dayEventsElement.appendChild(empty);
			return;
		}

		var list = document.createElement('div');
		list.className = 'calendar-event-list';
		events.forEach(function (event) { list.appendChild(createEventCard(event, false)); });
		dayEventsElement.appendChild(list);
	}

	function renderUpcomingEvents(events) {
		upcomingEventsElement.replaceChildren();
		if (!events.length) {
			var empty = document.createElement('p');
			empty.className = 'calendar-agenda-empty';
			empty.textContent = 'No sample events to show for this month.';
			upcomingEventsElement.appendChild(empty);
			return;
		}

		var list = document.createElement('div');
		list.className = 'calendar-event-list';
		events.slice(0, 3).forEach(function (event) { list.appendChild(createEventCard(event, true)); });
		upcomingEventsElement.appendChild(list);
	}

	function render() {
		monthElement.textContent = monthFormatter.format(shownMonth);
		selectedDateElement.textContent = dateFormatter.format(selectedDate);

		var events = getMonthEvents();
		var eventsByDate = new Map();
		events.forEach(function (event) {
			var key = dateKey(event.date);
			if (!eventsByDate.has(key)) eventsByDate.set(key, []);
			eventsByDate.get(key).push(event);
		});

		var firstDay = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), 1).getDay();
		var daysInMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 0).getDate();
		var cellCount = Math.ceil((firstDay + daysInMonth) / 7) * 7;
		daysElement.replaceChildren();

		for (var index = 0; index < cellCount; index += 1) {
			var dayNumber = index - firstDay + 1;
			var date = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), dayNumber);
			var key = dateKey(date);
			var dayEvents = eventsByDate.get(key) || [];
			var button = document.createElement('button');
			button.type = 'button';
			button.className = 'calendar-day';
			button.setAttribute('aria-pressed', String(key === dateKey(selectedDate)));
			button.setAttribute('aria-label', dateFormatter.format(date) + (dayEvents.length ? ', ' + dayEvents.length + ' sample event' + (dayEvents.length > 1 ? 's' : '') : ''));
			if (date.getMonth() !== shownMonth.getMonth()) button.classList.add('is-outside');
			if (key === dateKey(today)) {
				button.classList.add('is-today');
				button.setAttribute('aria-current', 'date');
			}
			if (key === dateKey(selectedDate)) button.classList.add('is-selected');

			var number = document.createElement('span');
			number.className = 'calendar-day-number';
			number.textContent = date.getDate();
			button.appendChild(number);

			if (dayEvents.length) {
				var dots = document.createElement('span');
				dots.className = 'calendar-day-dots';
				dots.setAttribute('aria-hidden', 'true');
				for (var dotIndex = 0; dotIndex < Math.min(dayEvents.length, 3); dotIndex += 1) {
					dots.appendChild(document.createElement('span'));
				}
				button.appendChild(dots);
			}

			button.addEventListener('click', function (clickedDate) {
				return function () {
					selectedDate = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), clickedDate.getDate());
					if (clickedDate.getMonth() !== shownMonth.getMonth()) {
						shownMonth = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
					}
					render();
				};
			}(date));
			daysElement.appendChild(button);
		}

		renderDayEvents(eventsByDate.get(dateKey(selectedDate)) || []);
		renderUpcomingEvents(events.filter(function (event) { return event.date >= today; }));
	}

	document.getElementById('calendar-previous').addEventListener('click', function () {
		shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() - 1, 1);
		render();
	});

	document.getElementById('calendar-next').addEventListener('click', function () {
		shownMonth = new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 1);
		render();
	});

	document.getElementById('calendar-today').addEventListener('click', function () {
		shownMonth = new Date(today.getFullYear(), today.getMonth(), 1);
		selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		render();
	});

	document.querySelectorAll('[data-calendar-filter]').forEach(function (button) {
		button.addEventListener('click', function () {
			activeFilter = button.getAttribute('data-calendar-filter');
			document.querySelectorAll('[data-calendar-filter]').forEach(function (filterButton) {
				var isActive = filterButton === button;
				filterButton.classList.toggle('is-active', isActive);
				filterButton.setAttribute('aria-pressed', String(isActive));
			});
			render();
		});
	});

	render();
}());
