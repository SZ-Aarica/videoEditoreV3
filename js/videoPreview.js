class VideoPreview {
  constructor() {
    this.events = $({});
    this.$playButton = $("#playButton");
    this.$pauseButton = $("#pauseButton");
    this.$buttonSection = $("#controls");
    this.$hiddenVideo = $("#previewVideo");
    this.videoClipContainer = $(".video-clips-container");
    this.$canvas = $("#canvasPreview"); // Keep as jQuery object
    this.canvas = this.$canvas[0];
    this.ctx = this.canvas.getContext("2d");
    this.drawFrame = this.drawFrame.bind(this);
    this.isDrawing = false;
    this.videos = [];

    // this.onPlaybackChange = null;
    this.setupEventListeners();
    this.init();
  }

  init() {
    this.controllButton();
  }
  //video events
  /*setupVideoEvents() {
    // Native video events → custom events
    this.$hiddenVideo.on("play", () => {
      this.events.trigger("playbackStateChanged", { playing: true });
    });

    this.$hiddenVideo.on("pause", () => {
      this.events.trigger("playbackStateChanged", { playing: false });
    });

    this.$hiddenVideo.on("seeked", () => {
      this.events.trigger("seeked", { time: this.$hiddenVideo[0].currentTime });
    });
  }*/
  setupEventListeners() {
    eventBus.on("TIMELINE_SEEK", (e, data) => {
      this.seekTo(data.time);
    });
    eventBus.on("TIMELINE_PLAY", () => {
      this.playVideo();
    });
    eventBus.on("TIMELINE_PAUSE", () => {
      this.pauseVideo;
    });
    eventBus.on("VIDEO_LOAD_REQUEST", (e, data) => {
      this.hiddenVideoSrc(data.src);
    });
    this.$hiddenVideo.on("play", () => {
      //sconsole.log("video playing----");
      eventBus.emit("VIDEO_PLAYING", {
        currentTime: this.$hiddenVideo[0].currentTime,
      });
    });
    this.$hiddenVideo.on("pause", () => {
      eventBus.emit("VIDEO_PAUSED", {
        currentTime: this.$hiddenVideo[0].currentTime,
      });
    });
    this.$hiddenVideo.on("seeked", () => {
      eventBus.emit("VIDEO_SEEKED", {
        time: this.$hiddenVideo[0].currentTime,
      });
    });
    this.$hiddenVideo.on("timeupdate", () => {
      eventBus.emit("VIDEO_TIME_UPDATE", {
        currentTime: this.$hiddenVideo[0].currentTime,
        duration: this.$hiddenVideo[0].duration,
      });
    });
  }
  getVideos() {
    this.videos = this.videoClipContainer.find("video");
  }

  controllButton() {
    this.$playButton.on("click", () => {
      //this.$playButton.addClass("hidden");
      this.playVideo();
    });
    this.$pauseButton.on("click", () => {
      //this.$pauseButton.addClass("hidden");
      this.pauseVideo();
    });
  }

  async playVideo() {
    // First, ensure any previous playback is properly stopped.
    this.getVideos();
    //this.$hiddenVideo[0].pause(); // This is okay here, as we are starting a new play request.

    try {
      await this.$hiddenVideo[0].play(); // this starts the video
      // Only proceed if play() was successful
      this.isDrawing = true;
      this.drawFrame();
      this.$playButton.addClass("hidden");
      this.$pauseButton.removeClass("hidden");
    } catch (error) {
      // Handle errors that prevent playback from starting
      if (error.name !== "AbortError") {
        console.log("Play failed:", error);
      }
    }
  }
  seekTo(time) {
    this.$hiddenVideo[0].currentTime = time;
    this.events.trigger("seeked", { time });
  }

  pauseVideo() {
    this.$hiddenVideo[0].pause(); //pause the video
    this.$playButton.removeClass("hidden");
    this.$pauseButton.addClass("hidden");
  }

  drawFrame() {
    const video = this.$hiddenVideo[0];

    //  match canvas to video resolution
    if (
      this.canvas.width !== video.videoWidth ||
      this.canvas.height !== video.videoHeight
    ) {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
    }
    // High-quality rendering settings
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";

    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    // console.log("drawframe" + video.currentTime);

    // Use RVFC if available, otherwise fallback
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(this.drawFrame);
    } else if (this.isDrawing) {
      requestAnimationFrame(this.drawFrame);
    }
  }

  hiddenVideoSrc(src) {
    // Pause current video first
    this.$hiddenVideo[0].pause();
    this.$hiddenVideo.attr("src", src);
    // Load video
    this.$hiddenVideo[0].load();

    eventBus.emit("VIDEO_LOADED", { src });
  }
}
$(document).ready(() => {
  //const time = new Timeline();
  window.VideoPreview = new VideoPreview();
});
