class ScrollMAnager {
  constructor() {
    this.scrollContainer = $("#timeline-scroll");
    this.$playhead = $("#playhead");
    this.init();
  }
  init() {
    this.setupEventListener();
  }
  setupEventListener() {
    eventBus.on("AUTO_SCROLL", () => {
      this.autoScrollToPlayhead();
    });
  }
  autoScrollToPlayhead() {
    const playhead = this.$playhead[0];
    const container = this.scrollContainer[0];
    if (!playhead || !container) return;

    const playheadLeft = playhead.offsetLeft;
    const viewWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    if (playheadLeft > scrollLeft + viewWidth - 100) {
      container.scrollLeft = playheadLeft - viewWidth + 150;
    } else if (playheadLeft < scrollLeft + 100) {
      container.scrollLeft = playheadLeft - 150;
    }
  }
}
$(document).ready(() => {
  new ScrollMAnager();
});
