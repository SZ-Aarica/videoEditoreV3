class Timeline {
  constructor() {
    //this.videoPreview = videoPreview;
    this.events = $({});
    this.DURATION_SECONDS = 60;
    this.isPlaying = false;
    this.wasPlaying = false;
    this.currentTime = 0;
    this.animationId = null;
    this.isDraggingPlayhead = false;
    this.isScrubbing = false;

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
    this.scrollContainer = $("#timeline-scroll"); // Reference to scroll container
    this.visibleDuration = 20; // Show 20 seconds at a time
    this.scrollPosition = 0;
    //this.currentVideoDuration = 0;
    this.totalSequenceDuration = 0;
    this.videoSegments = [];
    this.currentSegmentIndex = 0;

    // jQuery event listeners
    this.$videoClipsContainer.on("dragover", this.dragoverHandler);
    this.$videoClipsContainer.on("drop", this.dropHandler);
    this.init();
  }
  init() {
    this.renderLabels();
    this.setPlayheadAt(0);
    this.setupUserInteractions();
    this.setupEventListeners();
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
    //listening for trimmed videos
    eventBus.on("CLIP_TRIMMED", (e, data) => {
      this.handleClipTrimmed(data.clipId, data.startTime, data.duration);
    });

    // Timeline user interactions
    this.setupUserInteractions();
  }

  setupUserInteractions() {
    // Playhead dragging
    const $handle = this.$playhead.find(".playhead-handle");
    $handle.on("mousedown", (e) => {
      e.stopPropagation();
      this.isDraggingPlayhead = true;
      this.wasPlaying = this.isPlaying;
      if (this.isPlaying) this.pause();
      eventBus.emit("TIMELINE_PAUSE");
    });
    $(document).on("mousemove", (e) => {
      if (this.isDraggingPlayhead) {
        const time = this.pixelToTime(e.clientX);
        this.setPlayheadAt(time);
        eventBus.emit("TIMELINE_SEEK", { time });
      }
    });

    $(document).on("mouseup", () => {
      if (this.isDraggingPlayhead) {
        this.isDraggingPlayhead = false;
        if (this.wasPlaying) this.play();
        //eventBus.emit("TIMELINE_PLAY");
      }
    });
  }
  //drag drop
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
    const newId = `timeline-${originalId}`;
    $timelineVideo.attr("id", newId);

    const originalVideo = $draggedElement[0];
    const videoSrc = $draggedElement.attr("src");

    const startTime = this.calculateNextStartTime();
    const duration = originalVideo.duration || 0;

    this.videoSegments.push({
      videoId: newId,
      startTime: startTime,
      duration: duration,
      endTime: startTime + duration,
      element: $timelineVideo[0],
    });

    this.totalSequenceDuration = startTime + duration;
    eventBus.emit("VIDEO_ADDED_TO_TIMELINE", {
      videoId: newId,
      element: $timelineVideo[0], // Pass the actual DOM element
      src: videoSrc,
      duration: duration,
      startTime: startTime,
      endTime: startTime + originalVideo.duration,
    });

    this.loadVideoWithDuration(originalVideo, (duration) => {
      //console.log(duration);
      this.createTimelineClip($timelineVideo, duration, newId);
      // Update VideoManager with actual duration
      //this.updateTotalSequenceDuration();
      eventBus.emit("VIDEO_DURATION_UPDATED", {
        videoId: newId,
        duration: duration,
      });
    });
  }

  calculateNextStartTime() {
    // Calculate where the next video should start in the sequence
    const existingVideos = Array.from(
      this.$videoClipsContainer.find(".video-clip-container")
    );
    let totalDuration = 0;

    existingVideos.forEach((container) => {
      const duration =
        parseFloat($(container).find(".duration-label").text()) || 0;
      totalDuration += duration;
    });
    return totalDuration;
  }
  // Handle video duration loading
  loadVideoWithDuration(videoElement, callback) {
    //console.log(videoElement.duration);
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
    //this.setVideoDuration(duration);
    //console.log("Video duration:", duration, "seconds");
    const clipData = this.calculateClipDimensions(duration);
    const $clipContainer = this.createClipContainer(clipData, clipId);
    const $styledVideo = this.styleVideoElement($videoElement);
    const $durationLabel = this.createDurationLabel(duration);
    //add the button recycle bin
    const deleteButton = this.createRecycleLabel();

    $clipContainer.append($styledVideo, $durationLabel, deleteButton);
    this.setupClipInteractions($clipContainer, clipId, deleteButton);
    this.$videoClipsContainer.append($clipContainer);
  }
  //add the delete button to videos
  createRecycleLabel() {
    const button = $(
      '<button class="recycle-button" title="Remove from timeline" >' +
        '<img src="public/bin.svg" alt="Delete" width="14" style="filter: invert(1)">' +
        "</button>"
    );

    button.hover(
      function () {
        $(this).css({
          opacity: "1",
          background: "rgba(220, 53, 69, 0.9)",
          transform: "scale(1.1)",
        });
      },
      function () {
        $(this).css({
          opacity: "0.6",
          background: "rgba(0, 0, 0, 0.7)",
          transform: "scale(1)",
        });
      }
    );

    return button;
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
    //console.log(maxEndTime);

    return maxEndTime;
  }

  // Create the clip container
  createClipContainer(clipData, clipId) {
    const $clipContainer = $('<div class="video-clip-container"></div>');
    $clipContainer.attr("data-clip-id", clipId);
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
    $clipContainer.attr("data-start-time", clipData.startTime);
    $clipContainer.attr(
      "data-duration",
      clipData.clipWidth / clipData.pixelsPerSecond
    );
    eventBus.emit("CLIP_CREATED", { clip: $clipContainer });
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
  setupClipInteractions($clipContainer, clipId, deleteButton) {
    //drag existing videos in timeline
    //$clipContainer.attr("draggable", "true");

    /* $clipContainer.on("dragstart", (e) => {
      e.originalEvent.dataTransfer.setData("text/plain", clipId);
    });*/

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
    deleteButton.on("click", (e) => {
      // console.log("DELETE BUTTON CLICKED!");
      e.stopPropagation();
      e.preventDefault();
      this.deleteClip($clipContainer, clipId);
    });
  }

  //delete clip
  deleteClip($clipContainer, clipId) {
    Swal.fire({
      html: '<div class="alertify">از حذف ویدیو اطمینان دارید؟</div>',
      title:
        '<div class="title-popup" style="background:#005f6b; text-align: right; color:white;">حذف</div>',
      showCancelButton: true,
      cancelButtonText: "لغو",
      confirmButtonText: "بله",
      customClass: {
        actions: "custom-actions",
      },
    }).then((result) => {
      const message = $("#resultMessage");
      if (result.isConfirmed) {
        /* message
          .removeClass("cancelled")
          .addClass("success")
          .text("✅ Video deleted successfully!")
          .show();*/
        // console.log(45);
        $clipContainer.remove();
        this.videoSegments = this.videoSegments.filter(
          (segment) => segment.videoId !== clipId
        );

        this.recalculateAllClipPositions();
        eventBus.emit("VIDEO_REMOVED_FROM_TIMELINE", { videoId: clipId });
        console.log("Clip deleted:", clipId);
      } else if (result.isDismissed) {
        console.log("Delete cancelled.");
      }
    });
  }
  recalculateAllClipPositions() {
    // Sort by original start time to maintain order
    const sortedSegments = [...this.videoSegments].sort(
      (a, b) => a.startTime - b.startTime
    );

    let currentTime = 0;

    // Reset and rebuild all positions
    sortedSegments.forEach((segment) => {
      // Update segment timing
      segment.startTime = currentTime;
      segment.endTime = currentTime + segment.duration;

      const $clipContainer = this.$videoClipsContainer.find(
        `[data-clip-id="${segment.videoId}"]`
      );
      if ($clipContainer.length) {
        this.updateClipPosition(
          $clipContainer,
          segment.startTime,
          segment.duration
        );
      }
      currentTime += segment.duration;
    });

    // Update videoSegments with new timings
    this.videoSegments = sortedSegments;
    this.updateTotalSequenceDuration();
  }
  // method to update individual clip positions
  updateClipPosition($clipContainer, startTime, duration) {
    const totalWidth = 53 * 37.8;
    const pixelsPerSecond = totalWidth / this.DURATION_SECONDS;

    const clipPosition = startTime * pixelsPerSecond;
    const clipWidth = duration * pixelsPerSecond;

    // Update CSS position and size
    $clipContainer.css({
      left: `${clipPosition}px`,
      width: `${clipWidth}px`,
    });

    // Update data attributes
    $clipContainer.attr("data-start-time", startTime);
    $clipContainer.attr("data-duration", duration);

    // Update duration label
    const $durationLabel = $clipContainer.find(".duration-label");
    $durationLabel.text(`${duration.toFixed(1)}s`);
  }
  // adds the select class to the selected video
  selectClip($clipContainer) {
    // Deselect all other clips
    this.$videoClipsContainer
      .find(".video-clip-container")
      .removeClass("selected");
    // Select this clip
    $clipContainer.addClass("selected");
    /* const startTime = parseFloat($clipContainer.attr("data-start-time"));
    this.setPlayheadAt(startTime);*/
  }

  playFromClip($clipContainer) {
    const startTime = parseFloat($clipContainer.attr("data-start-time"));
    this.setPlayheadAt(startTime);
    this.play();
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

  //place the playhead position
  setPlayheadAt(sequenceTime) {
    const maxTime = Math.max(this.totalSequenceDuration, this.DURATION_SECONDS);
    this.currentTime = Math.max(0, Math.min(maxTime, sequenceTime));
    //console.log(this.currentTime);
    const percentage = (this.currentTime / maxTime) * 100;
    //console.log(percentage);
    this.$playhead.css("left", `${percentage}%`);
    eventBus.emit("AUTO_SCROLL");
    //this.autoScrollToPlayhead();
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
    const maxTime = Math.max(this.totalSequenceDuration, this.DURATION_SECONDS);
    const percentage = Math.max(
      0,
      Math.min(100, (absoluteX / totalWidth) * 100)
    );
    return (percentage / 100) * maxTime;
  }

  // Convert time to pixel position
  timeToPixel(seconds) {
    const timelineRect = this.$timeline[0].getBoundingClientRect();
    const percentage = (seconds / this.DURATION_SECONDS) * 100;
    return (percentage / 100) * timelineRect.width;
  }

  // Play/pause animation
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const animate = () => {
      if (!this.isPlaying) return;
      const sequenceTime = this.getCurrentSequenceTime();

      this.setPlayheadAt(sequenceTime);
      eventBus.emit("SEQUENCE_TIME_UPDATE", {
        sequenceTime: sequenceTime,
        totalDuration: this.totalSequenceDuration,
      });
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

  getCurrentSequenceTime() {
    const previewVideo = document.getElementById("previewVideo");
    //console.log(previewVideo);
    if (!previewVideo) return this.currentTime;

    const currentVideoTime = previewVideo.currentTime;
    const currentVideoSrc = previewVideo.src;
    const currentSegment = this.videoSegments.find(
      (segement) =>
        segement.element.src.includes(currentVideoSrc) ||
        segement.element === previewVideo
    );

    if (currentSegment) {
      /* if (
        currentSegment.startTime + currentVideoTime <
        currentSegment.endTime
      ) {*/
      //console.log(currentSegment);
      return currentSegment.startTime + currentVideoTime;
    }
    return this.currentTime;
  }
  getPixelsPerSecond() {
    const totalWidth = 53 * 37.8;
    return totalWidth / this.DURATION_SECONDS;
  }
  handleClipTrimmed(clipId, newStartTime, newDuration) {
    console.log(
      `Clip ${clipId} trimmed: start=${newStartTime}s, duration=${newDuration}s`
    );

    // Update video segments in timeline
    const segmentIndex = this.videoSegments.findIndex(
      (seg) => seg.videoId === clipId
    );
    if (segmentIndex !== -1) {
      this.videoSegments[segmentIndex].startTime = newStartTime;
      this.videoSegments[segmentIndex].duration = newDuration;
      this.videoSegments[segmentIndex].endTime = newStartTime + newDuration;
      // console.log(this.videoSegments[segmentIndex]);
    }
    //console.log(this.videoSegments);
    eventBus.emit("VIDEO_TRIMMED", {
      videoId: clipId,
      startTime: newStartTime,
      duration: newDuration,
      endTime: newStartTime + newDuration,
    });

    // Update total sequence duration
    //this.updateTotalSequenceDuration();
    this.recalculateAllClipPositions();

    //console.log(this.totalSequenceDuration);
  }

  updateTotalSequenceDuration() {
    //
    this.totalSequenceDuration = this.videoSegments.reduce(
      (max, segment) => max + segment.duration,
      0
    );
    console.log("Updated total sequence duration:", this.totalSequenceDuration);
  }
}

// Initialize timeline when page loads
$(document).ready(() => {
  //const timeline = new Timeline();
});
