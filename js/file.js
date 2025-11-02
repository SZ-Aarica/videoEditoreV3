class File {
  constructor() {
    this.mediaFiles = [];
    this.currentProject = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    //this.setupFileHandling();
  }

  createURL(file) {
    const url = URL.createObjectURL(file);
    return url;
  }

  setupEventListeners() {
    //bind clicking the import button to trigger file input
    $("#import-btn").on("click", () => {
      $("#file-input").trigger("click");
    });

    // Bind file input change to handle upload
    $("#file-input").on("change", (e) => {
      this.handleFileUpload(e.target.files);
    });
  }

  handleFileUpload(files) {
    Array.from(files).forEach((file) => {
      if (file.type.startsWith("video/")) {
        this.addMediaToBin(file);
      }
    });
  }

  addMediaToBin(file) {
    this.mediaFiles.push(file);
    this.updateMediaBin();
  }

  previewVideo(video) {
    video.play();
  }

  stopPreviewVideo(video) {
    video.pause();
    video.currentTime = 0;
  }

  updateMediaBin() {
    const $mediaList = $("#media-list");
    $mediaList.empty();
    $mediaList.addClass("row");

    this.mediaFiles.forEach((file, index) => {
      const $li = $("<span>").addClass("media-item col-4 p-0");
      const $mediaItem = $("<video>")
        .attr("id", `media-${index}`)
        .attr("src", this.createURL(file))
        .addClass(" img-fluid")
        .css({ width: "180px", height: "100px" });

      // Make draggable
      this.addDraggable($mediaItem);

      // Hover previews
      $li.on("mouseenter", () => {
        this.previewVideo($mediaItem[0]);
      });
      $li.on("mouseleave", () => {
        this.stopPreviewVideo($mediaItem[0]);
      });

      $li.append($mediaItem);
      $mediaList.append($li);
    });
  }

  addDraggable($element) {
    // $element is a jQuery object; get DOM node for drag events
    $element.attr("draggable", "true");
    // Bind dragstart with proper this context
    $element[0].addEventListener("dragstart", this.dragstartHandler);
  }

  dragstartHandler = (event) => {
    console.log("Drag started");
    event.dataTransfer.setData("text/plain", event.target.id);
    event.dataTransfer.effectAllowed = "copy";
  };

  // Optional: if you want a dropHandler in this class, uncomment and adapt
  /*
  dropHandler(event) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    event.currentTarget.appendChild(document.getElementById(id));
  }
  */

  // Helper (example)
  addToTimeline(file) {
    console.log("Adding to timeline:", file.name);
  }
}

// Initialize after DOM is ready
$(document).ready(() => {
  new File();
});
