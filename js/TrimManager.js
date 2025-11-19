class TrimManager {
  constructor(timeline) {
    this.timeline = timeline;
    this.isTrimming = false;
    this.currentTrimHandle = null;
    this.currentTrimClip = null;
    this.trimStartX = 0;
    this.originalClipWidth = 0;
    this.OroginalClipLeft = 0;
    this.originalDuration = 0;
    this.setupEventListeners();
  }
  setupEventListeners() {
    //listen for new clips
    eventBus.on("CLIP_CREATED", (e, data) => {
      this.initializeClip(data.clip);
    });
    eventBus.on("CLIP_REMOVED", (e, data) => {
      this.cleanupClip(data.clipId);
    });
  }
  initializeClip($clipContainer) {
    const clipId = $clipContainer.attr("data-clip-id");
    if (!clipId) return;
    this.originalDuration = this.calculateClipDuration($clipContainer);
    //console.log(this.originalDuration);
    //avoid double handles
    if ($clipContainer.find(".trim-handle").length > 0) return;
    this.addTrimHandles($clipContainer);
  }
  addTrimHandles($clipContainer) {
    const clipId = $clipContainer.attr("data-clip-id");

    const $leftHandle = $(
      '<div class="trim-handle left" title="Trim start"></div>'
    );
    $leftHandle.on("mousedown", (e) => this.startTrimming(e, "left", clipId));

    const $rightHandle = $(
      '<div class="trim-handle right" title="Trim end"></div>'
    );
    $rightHandle.on("mousedown", (e) => this.startTrimming(e, "right", clipId));

    $clipContainer.append($leftHandle, $rightHandle);
  }
  startTrimming(e, handleType, clipId) {
    e.preventDefault();
    e.stopPropagation();

    this.isTrimming = true;
    this.currentTrimHandle = handleType;
    this.currentTrimClip = clipId;

    const $clipContainer = $(`[data-clip-id="${clipId}"]`);
    //console.log($clipContainer[0].dataset);
    this.trimStartX = e.clientX;
    //console.log(this.trimStartX);
    this.originalClipWidth = parseFloat($clipContainer.css("width"));
    this.originalClipLeft = parseFloat($clipContainer.css("left"));

    $clipContainer.addClass("trimming");
    $(document).on("mousemove.trim", (e) => this.handleTrimming(e));
    $(document).on("mouseup.trim", () => this.stopTrimming());
  }
  handleTrimming(e) {
    if (!this.isTrimming) return;

    const $clipContainer = $(`[data-clip-id="${this.currentTrimClip}"]`);
    const deltaX = e.clientX - this.trimStartX;
    //console.log(deltaX);
    //const pixelsPerSecond = this.timeline.getPixelsPerSecond();

    let newWidth = this.originalClipWidth;
    let newLeft = this.originalClipLeft;
    let d = this.calculateClipDuration($clipContainer);
    //console.log(d);

    if (this.currentTrimHandle === "left") {
      newWidth = Math.max(20, this.originalClipWidth - deltaX);
      newLeft = this.originalClipLeft + deltaX;
    } else {
      if (d < this.originalDuration) {
        newWidth = Math.max(20, this.originalClipWidth + deltaX);
      }
    }

    $clipContainer.css({
      width: `${newWidth}px`,
      left: `${newLeft}px`,
    });
  }
  stopTrimming() {
    if (!this.isTrimming) return;

    const $clipContainer = $(`[data-clip-id="${this.currentTrimClip}"]`);
    $clipContainer.removeClass("trimming");
    const newDuration = this.calculateClipDuration($clipContainer);
    const newStartTime = this.calculateClipStartTime($clipContainer);
    //console.log("new duration:", newDuration, "new start time", newStartTime);
    //
    eventBus.emit("CLIP_TRIMMED", {
      clipId: this.currentTrimClip,
      startTime: newStartTime,
      duration: newDuration,
    });

    this.destroy();

    this.isTrimming = false;
    this.currentTrimHandle = null;
    this.currentTrimClip = null;
  }
  calculateClipDuration($clipContainer) {
    const width = parseFloat($clipContainer.css("width"));
    const pixelsPerSecond = this.timeline.getPixelsPerSecond();
    return width / pixelsPerSecond;
  }

  calculateClipStartTime($clipContainer) {
    const left = parseFloat($clipContainer.css("left"));
    const pixelsPerSecond = this.timeline.getPixelsPerSecond();
    return left / pixelsPerSecond;
  }

  destroy() {
    // Cleanup
    $(document).off("mousemove.trim");
    $(document).off("mouseup.trim");
  }
}
