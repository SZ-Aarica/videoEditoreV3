class Timeline {
  constructor() {
    //this.videoPreview = videoPreview;
    this.events = $({});
    this.DURATION_SECONDS = 60;
    this.FPS = 24;
    this.isPlaying = false;
    this.currentTime = 0;
    this.animationId = null;
    this.isDraggingPlayhead = false;

    // jQuery element references
    this.$timeline = $("#timeline");
    this.$labels = $("#labels");
    this.$playhead = $("#playhead");
    this.$marker = $("#marker");
    this.$timelineDropZone = $("#timelineDropZone");
    this.$videoClipsContainer = $("#videoClipsContainer");
    this.$hiddenVideo = $("#previewVideo");

    // Bind event handlers
    this.dragoverHandler = this.dragoverHandler.bind(this);
    this.dropHandler = this.dropHandler.bind(this);

    //scrolling
    this.scrollContainer = $(".col-6.overflow-x-scroll"); // Reference to scroll container
    this.visibleDuration = 20; // Show 20 seconds at a time
    this.scrollPosition = 0;
    this.currentVideoDuration = 0;

    // jQuery event listeners
    this.$videoClipsContainer.on("dragover", this.dragoverHandler);
    this.$videoClipsContainer.on("drop", this.dropHandler);

    this.init();
  }
  setupEventListeners() {
    // Listen to video events
    eventBus.on("VIDEO_PLAYING", () => {
      this.play();
    });

    eventBus.on("VIDEO_PAUSED", () => {
      this.pause();
    });

    eventBus.on("VIDEO_TIME_UPDATE", (e, data) => {
      this.setPlayheadAt(data.currentTime);
    });

    eventBus.on("VIDEO_SEEKED", (e, data) => {
      if (!this.isDraggingPlayhead) {
        this.setPlayheadAt(data.time);
      }
    });

    // Timeline user interactions
    this.setupUserInteractions();
  }

  dragoverHandler(event) {
    const originalEvent = event.originalEvent || event;
    originalEvent.preventDefault();
    originalEvent.dataTransfer.dropEffect = "copy";
    // $(event.currentTarget).addClass("drag-over");
  }

  dropHandler(event) {
    const originalEvent = event.originalEvent || event;
    originalEvent.preventDefault();

    const id = originalEvent.dataTransfer.getData("text/plain");
    const $draggedElement = $(`#${id}`);

    if (this.isValidVideoElement($draggedElement)) {
      this.processDroppedVideo($draggedElement, id);
    } else {
      console.log("No valid video element found to drop");
    }
  }

  // Validation method
  isValidVideoElement($element) {
    return $element.length && $element[0].tagName === "VIDEO";
  }

  // Main processing method
  processDroppedVideo($draggedElement, originalId) {
    const $timelineVideo = $draggedElement.clone();
    const newId = `timeline-${Date.now()}-${originalId}`;
    $timelineVideo.attr("id", newId);

    const originalVideo = $draggedElement[0];
    const videoSrc = $draggedElement.attr("src");

    eventBus.emit("VIDEO_LOAD_REQUEST", {
      src: videoSrc,
      videoId: newId,
      element: $timelineVideo[0],
    });
    this.loadVideoWithDuration(originalVideo, (duration) => {
      this.createTimelineClip($timelineVideo, duration, newId);
      eventBus.emit("VIDEO_ADDED_TO_TIMELINE", {
        videoId: newId,
        duration: duration,
        src: videoSrc,
      });
    });
  }

  // Handle video duration loading
  loadVideoWithDuration(videoElement, callback) {
    if (videoElement.duration && videoElement.duration > 0) {
      callback(videoElement.duration);
    } else {
      const onLoaded = () => {
        callback(videoElement.duration);
        videoElement.removeEventListener("loadedmetadata", onLoaded);
      };

      videoElement.addEventListener("loadedmetadata", onLoaded);
      // Fallback
      setTimeout(() => {
        if (videoElement.duration > 0) {
          callback(videoElement.duration);
        } else {
          console.warn("Could not load video duration, using default");
          callback(10); // Default 10 seconds
        }
      }, 1000);
    }
  }

  // Create timeline clip element
  createTimelineClip($videoElement, duration, clipId) {
    this.setVideoDuration(duration);
    //console.log("Video duration:", duration, "seconds");
    const clipData = this.calculateClipDimensions(duration);
    const $clipContainer = this.createClipContainer(clipData, clipId);
    const $styledVideo = this.styleVideoElement($videoElement);
    const $durationLabel = this.createDurationLabel(duration);

    $clipContainer.append($styledVideo, $durationLabel);
    this.setupClipInteractions($clipContainer, clipId);
    this.$videoClipsContainer.append($clipContainer);

    console.log(
      "Video successfully added to timeline with proper duration sizing"
    );
  }

  // Calculate clip position and size
  calculateClipDimensions(duration) {
    const totalWidth = 53 * 37.8;
    const pixelsPerSecond = totalWidth / this.DURATION_SECONDS;

    // Find the next available position (after existing clips)
    const nextPosition = this.findNextAvailablePosition();
    const clipPosition = nextPosition * pixelsPerSecond;
    const clipWidth = duration * pixelsPerSecond;

    console.log(`Timeline width: ${totalWidth}px, Clip width: ${clipWidth}px`);

    return {
      totalWidth,
      pixelsPerSecond,
      clipWidth,
      clipPosition,
      startTime: nextPosition,
    };
  }

  // Find position for new clip (after existing clips)
  findNextAvailablePosition() {
    const existingClips = this.$videoClipsContainer.find(
      ".video-clip-container"
    );
    //console.log(existingClips.children());
    let maxEndTime = this.scrollPosition; // Start from current view

    existingClips.each((index, clip) => {
      const $clip = $(clip);
      const clipLeft = parseFloat($clip.css("left"));
      const clipWidth = parseFloat($clip.css("width"));
      const totalWidth = 53 * 37.8;
      const pixelsPerSecond = totalWidth / this.DURATION_SECONDS;

      const clipEndTime = (clipLeft + clipWidth) / pixelsPerSecond;
      maxEndTime = Math.max(maxEndTime, clipEndTime);
    });

    // Add a small gap between clips (0.5 seconds)
    return maxEndTime;
  }

  // Create the clip container
  createClipContainer(clipData, clipId) {
    const $clipContainer = $('<div class="video-clip-container"></div>');

    $clipContainer.css({
      position: "absolute",
      left: `${clipData.clipPosition}px`,
      width: `${clipData.clipWidth}px`,
      height: "75px",
      backgroundColor: "rgba(102, 126, 234, 0.3)",
      border: "2px solid #667eea",
      borderRadius: "4px",
      overflow: "hidden",
      cursor: "move",
    });

    $clipContainer.attr("data-clip-id", clipId);
    $clipContainer.attr("data-start-time", clipData.startTime);
    $clipContainer.attr(
      "data-duration",
      clipData.clipWidth / clipData.pixelsPerSecond
    );

    return $clipContainer;
  }

  // Style the video element
  styleVideoElement($videoElement) {
    return $videoElement.css({
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none",
    });
  }

  // Create duration label
  createDurationLabel(duration) {
    return $(`<div class="duration-label">${duration.toFixed(1)}s</div>`).css({
      position: "absolute",
      bottom: "2px",
      right: "2px",
      background: "rgba(0,0,0,0.7)",
      color: "white",
      fontSize: "10px",
      padding: "1px 4px",
      borderRadius: "2px",
    });
  }

  // Setup drag and other interactions
  setupClipInteractions($clipContainer, clipId) {
    $clipContainer.attr("draggable", "true");

    $clipContainer.on("dragstart", (e) => {
      e.originalEvent.dataTransfer.setData("text/plain", clipId);
    });

    // Add click to select/preview
    $clipContainer.on("click", (e) => {
      e.stopPropagation();
      this.selectClip($clipContainer);
    });

    // Add double-click to play from this point
    $clipContainer.on("dblclick", (e) => {
      e.stopPropagation();
      this.playFromClip($clipContainer);
    });
  }

  // Additional helper methods
  selectClip($clipContainer) {
    // Deselect all other clips
    this.$videoClipsContainer
      .find(".video-clip-container")
      .removeClass("selected");
    // Select this clip
    $clipContainer.addClass("selected");

    const startTime = parseFloat($clipContainer.attr("data-start-time"));
    this.setPlayheadAt(startTime);

    console.log("Clip selected:", $clipContainer.attr("data-clip-id"));
  }

  playFromClip($clipContainer) {
    const startTime = parseFloat($clipContainer.attr("data-start-time"));
    this.setPlayheadAt(startTime);
    this.play();
  }

  setVideoDuration(duration) {
    this.currentVideoDuration += duration;
    console.log(this.currentVideoDuration);
  }

  init() {
    this.renderLabels();
    this.setPlayheadAt(0);
    this.setupUserInteractions();
    this.setupEventListeners();
  }

  // Format time as MM:SS
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  renderLabels() {
    const stepSec = 1;
    const totalSlots = this.DURATION_SECONDS / stepSec;

    this.$labels.empty();

    for (let i = 0; i <= totalSlots; i++) {
      const time = i * stepSec;
      const $label = $('<div class="label"></div>');
      const leftPercentage = (time / this.DURATION_SECONDS) * 100;

      $label.css("left", `${leftPercentage}%`);
      $label.text(this.formatTime(time));
      this.$labels.append($label);
    }
  }

  getVisibleArea() {
    const timelineWidth = this.$timeline.width();
    const totalWidth = 53 * 37.8;
    const pixelsPerSecond = totalWidth / this.DURATION_SECONDS;
    console.log(timelineWidth + " " + totalWidth);
    return {
      timelineWidth,
      totalWidth,
      pixelsPerSecond,
      visibleStart: this.scrollPosition,
      visibleEnd: this.scrollPosition + this.visibleDuration,
    };
  }

  setPlayheadAt(seconds) {
    this.currentTime = Math.max(0, Math.min(this.DURATION_SECONDS, seconds));
    //console.log(this.currentTime);
    const percentage = (this.currentTime / this.DURATION_SECONDS) * 100;
    this.$playhead.css("left", `${percentage}%`);

    //console.log(this.currentTime + " " + percentage);
    //this.events.trigger("playheadMoved", { time: seconds });
    this.autoScrollToPlayhead();
  }

  autoScrollToPlayhead() {
    const containerWidth = this.scrollContainer.width();
    const totalWidth = 53 * 37.8; // 53cm in pixels
    const pixelsPerSecond = totalWidth / this.DURATION_SECONDS;

    const playheadPixel = this.currentTime * pixelsPerSecond;
    const bufferPixels = 100; // 100px buffer from edges

    // Check if playhead is near the edge
    const scrollLeft = this.scrollContainer.scrollLeft();
    const scrollRight = scrollLeft + containerWidth;

    if (playheadPixel > scrollRight - bufferPixels) {
      // Scroll to show playhead with buffer
      const targetScroll = playheadPixel - containerWidth + bufferPixels;
      this.scrollContainer.animate({ scrollLeft: targetScroll }, 300);
    } else if (playheadPixel < scrollLeft + bufferPixels) {
      // Scroll to show playhead with buffer
      const targetScroll = playheadPixel - bufferPixels;
      this.scrollContainer.animate({ scrollLeft: targetScroll }, 300);
    }
  }
  getScrollInfo() {
    const visible = this.getVisibleArea();
    return {
      visibleStart: this.scrollPosition,
      visibleEnd: this.scrollPosition + this.visibleDuration,
      currentTime: this.currentTime,
      isPlayheadVisible:
        this.currentTime >= this.scrollPosition &&
        this.currentTime <= this.scrollPosition + this.visibleDuration,
    };
  }

  scrollTo(targetTime) {
    this.isScrolling = true;

    // Calculate new scroll position
    this.scrollPosition = Math.max(
      0,
      Math.min(this.DURATION_SECONDS - this.visibleDuration, targetTime)
    );

    // Calculate scroll pixels
    const visible = this.getVisibleArea();
    const scrollPixels =
      (this.scrollPosition / this.DURATION_SECONDS) * visible.totalWidth;

    // Animate the scroll
    this.$timeline.animate(
      {
        scrollLeft: scrollPixels,
      },
      300,
      () => {
        this.isScrolling = false;
      }
    );

    console.log(`Scrolled to: ${this.scrollPosition.toFixed(1)}s`);
  }
  // Convert pixel position to time
  pixelToTime(pixelX) {
    // Get the scroll container's position and scroll
    const scrollContainerRect = this.scrollContainer[0].getBoundingClientRect();
    const scrollLeft = this.scrollContainer.scrollLeft();
    const totalWidth = 53 * 37.8; // Total timeline width in pixels

    // Calculate absolute position within the entire timeline
    const absoluteX = pixelX - scrollContainerRect.left + scrollLeft;

    // Convert to time
    const percentage = Math.max(
      0,
      Math.min(100, (absoluteX / totalWidth) * 100)
    );
    return (percentage / 100) * this.DURATION_SECONDS;
  }

  // Convert time to pixel position
  timeToPixel(seconds) {
    const timelineRect = this.$timeline[0].getBoundingClientRect();
    const percentage = (seconds / this.DURATION_SECONDS) * 100;
    return (percentage / 100) * timelineRect.width;
  }

  showTimeMarker(clientX, time) {
    const timelineRect = this.$timeline[0].getBoundingClientRect();
    const relativeX = clientX - timelineRect.left;
    const percentage = (relativeX / timelineRect.width) * 100;

    this.$marker.text(this.formatTime(time));
    this.$marker.css({
      left: `${percentage}%`,
      display: "block",
    });
  }

  hideTimeMarker() {
    this.$marker.hide();
  }

  // Play/pause animation

  setupUserInteractions() {
    // Playhead dragging
    const $handle = this.$playhead.find(".playhead-handle");

    $handle.on("mousedown", (e) => {
      e.stopPropagation();
      this.isDraggingPlayhead = true;

      // Notify video to pause during scrubbing
      eventBus.emit("TIMELINE_PAUSE");
    });

    $(document).on("mousemove", (e) => {
      if (this.isDraggingPlayhead) {
        const time = this.pixelToTime(e.clientX);
        this.setPlayheadAt(time);
        // Notify video to seek
        eventBus.emit("TIMELINE_SEEK", { time });
      }
    });

    $(document).on("mouseup", () => {
      if (this.isDraggingPlayhead) {
        this.isDraggingPlayhead = false;
        // User might want to continue playing after scrubbing
        eventBus.emit("TIMELINE_PLAY");
      }
    });
  }
  play() {
    if (this.isPlaying) return;

    this.isPlaying = true;

    const animate = () => {
      if (!this.isPlaying) return;

      // Sync with video's actual currentTime
      const previewVideo = $("#previewVideo");
      if (previewVideo) {
        const videoTime = previewVideo.currentTime;
        this.setPlayheadAt(videoTime);
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
    eventBus.emit("TIMELINE_PLAY");
  }

  pause() {
    this.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
      eventBus.emit("TIMELINE_PAUSE");
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
}

// Initialize timeline when page loads
$(document).ready(() => {
  //  const videoPreview = new VideoPreview();
  const timeline = new Timeline();
  //timeline.getVisibleArea();
});
