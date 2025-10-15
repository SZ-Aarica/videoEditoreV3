$(document).ready(function () {
  $("#themeButton").click(function () {
    $("#sunSvg").toggleClass("hidden");
    $("#theme").toggleClass("themeBlack");
    $("#theme").toggleClass("themeLight");
    $("#moonSvg").toggleClass("hidden");
  });
});
