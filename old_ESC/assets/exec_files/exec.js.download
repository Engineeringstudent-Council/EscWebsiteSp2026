$(document).ready(function() {
    $(".officer").click(function(){
        var $this = $(this);
        var $arrow = $this.find(".arrow");
        if($this.css("max-height") == "320px") { //.css("height") uses px, so 20 * 16 = 320
            $arrow.css({"bottom": "1em"});
            $arrow.find("img").css({"transform": "rotate(180deg)"});
            $this.css("max-height", "45em"); //Increase if box does not open is not big enough
        } else {   
            $this.css("max-height", "20em");
            $arrow.css({"bottom": "0"});
            $arrow.find("img").css({"transform": "rotate(0)"});
        }
    });
});