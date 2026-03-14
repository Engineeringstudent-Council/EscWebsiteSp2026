function myFunction() {
    // Declare variables
    var input, filter, ul, li, a, i, header;
    input = document.getElementById('input');
    filter = input.value.toUpperCase();
    ul = document.getElementById("clubUL");
    li = ul.getElementsByTagName('li');

    // Loop through all list items, and hide those who don't match the search query
    for (i = 0; i < li.length; i++) {
        a = li[i].getElementsByTagName("a")[0];

        if (a.getAttribute('class') == "header") {
            header = li[i];
            li[i].style.display = "none";
        } else if (a.innerHTML.toUpperCase().indexOf(filter) > -1) {
            header.style.display = "";
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

function filterCategory(input) {
    // Change if categories change
    var categories = ["Academic and Professional", "Competition/Project Teams", "Culture and Identity", 
            "Design, Make, Hack", "Entrepreneurship/Consulting", "Fraternities and Sororities", "School, Community and Global Outreach"];

    // Declare variables
    var filter, ul, li, a, i, header, toggle;
    filter = categories[input];
    ul = document.getElementById("clubUL");
    li = ul.getElementsByTagName('li');
    toggle = false;

    // Loop through all list items, and hide those who don't match the search query
    for (i = 0; i < li.length; i++) {
        a = li[i].getElementsByTagName("a")[0];

        if (a.getAttribute('class') == "header") {
            toggle = a.innerHTML.indexOf(filter) > -1;
        }
        if (toggle) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
    console.log(categories[input]);
}