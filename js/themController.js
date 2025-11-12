/*$(document).ready(function () {
  $("#themeButton").click(function () {
    $("#sunSvg").toggleClass("hidden");
    $("#theme").toggleClass("themeBlack");
    $("#theme").toggleClass("themeLight");
    $("#moonSvg").toggleClass("hidden");
  });
});*/
$(document).ready(function () {
  $("#themeButton").click(function () {
    const $theme = $("#theme");
    const isLight = $theme.hasClass("themeLight");

    $("#sunSvg").toggleClass("hidden", isLight);
    $("#moonSvg").toggleClass("hidden", !isLight);

    $theme.toggleClass("themeLight");
  });
});
