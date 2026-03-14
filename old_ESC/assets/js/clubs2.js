function filterCategory(input) {
    // Change if categories change
    var categories = ["Academic and Professional", "Competition/Project Teams", "Culture and Identity", 
            "Design, Make, Hack", "Entrepreneurship/Consulting", "Fraternities and Sororities", "School, Community and Global Outreach"];

    // Declare variables
    var filter, cat;
    filter = categories[input];
    cat = document.getElementsByClassName("category")


    // Loop through all list items, and hide those who don't match the search query
    for (var category of cat) {
    	if ($(category).find(".title").text() == filter) {
    		$('html,body').animate({
		        scrollTop: $(category).offset().top - 180},
		        'slow');
    	}
    }
}