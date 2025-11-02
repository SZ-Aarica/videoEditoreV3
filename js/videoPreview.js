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

    this.videoPlaylist = []; // Array of videos to play in sequence
    this.currentVideoIndex = 0;
    this.currentSequenceTime = 0;
    this.isSequencing = false;

    this.sequenceStartOffset = 0;

    // this.onPlaybackChange = null;
    this.setupEventListeners();
    this.init();
  }

  init() {
    this.controllButton();
  }
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
    eventBus.on("SEQUENCE_TIME_UPDATE", (e, data) => {
      this.currentSequenceTime = data.sequenceTime;
      this.handleSequencePlayback(data.sequenceTime);
    });
    // Load specific video for preview
    eventBus.on("PREVIEW_VIDEO_LOAD", (e, data) => {
      this.loadPreviewVideo(data.src, data.autoPlay || false);
    });
    this.$hiddenVideo.on("ended", () => {
      this.handleVideoEnded();
    });
    eventBus.on("PLAY_SPECIFIC_VIDEO", (e, data) => {
      this.playSpecificVideo(data.videoId, data.time);
    });

    // Multi-video rendering
    eventBus.on("VIDEOS_UPDATED", (e, data) => {
      // Optionally update multi-canvas view here
      // console.log("video updated VP:" + data.videos[0] + data.totalDuration);
      this.updateMultiVideoView(data.videos);
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
        currentTime:
          this.$hiddenVideo[0].currentTime + this.sequenceStartOffset,
        duration: this.$hiddenVideo[0].duration,
      });
    });
  }
  //"VIDEOS_UPDATED" event
  updateMultiVideoView(videos) {
    this.videoPlaylist = videos;

    //console.log("playlist updateed", this.videoPlaylist); && !this.isSequencing
    if (this.videoPlaylist.length > 0) {
      this.playVideoSequence();
      console.log("length is more that 0 " + this.videoPlaylist);
    } else {
      //console.log("length " + this.videoPlaylist.length + this.isSequencing);
      this.hiddenVideoSrc("");
    }
    //this.hiddenVideoSrc(videos[0].src);
  }
  playVideoSequence() {
    this.isSequencing = true;
    this.currentVideoIndex = 0;
    this.loadAndPlayCurrentVideo();
  }
  handleSequencePlayback(sequenceTime) {
    if (!this.isSequencing) return;
    // Get which video should be playing at this sequence time
    eventBus.emit(
      "GET_VIDEO_AT_TIME",
      {
        time: sequenceTime,
      },
      (videoData) => {
        if (videoData && videoData.videoId) {
          this.playVideoAtTime(videoData.videoId, videoData.timeInVideo);
        }
      }
    );
  }
  playVideoAtTime(videoId, timeInVideo) {
    console.log("Playing video", videoId, "at time", timeInVideo);
    eventBus.emit("PLAY_SPECIFIC_VIDEO", {
      videoId: videoId,
      time: timeInVideo,
    });
  }
  playSpecificVideo(videoId, timeInVideo) {
    const videoData = videoManager.getVideoById(videoId);
    if (videoData) {
      console.log("Switching to video:", videoId);
      this.loadAndPlayVideo(videoData, timeInVideo);
    }
  }
  loadAndPlayCurrentVideo() {
    if (this.currentVideoIndex >= this.videoPlaylist.length) {
      //end
      this.isSequencing = false;
      console.log("finished playing");
      return;
    }
    const currentVideoData = this.videoPlaylist[this.currentVideoIndex];
    this.sequenceStartOffset = currentVideoData.startTime || 0;

    //console.log(`playing video ${currentVideoData.src}`);
    //load the current video
    this.hiddenVideoSrc(currentVideoData.src);
    //event to play the next when video is ended
    this.$hiddenVideo.off("ended");
    this.$hiddenVideo.on("ended", () => {
      // console.log("video ended " + this.currentVideoIndex + 1);
      this.playNextVideo();
    });
    this.loadAndPlayVideo(currentVideoData, 0);
  }
  handleVideoEnded() {
    if (this.isSequencing) {
      console.log("video ended moving to the next");
      this.playNextVideo();
    }
  }
  loadAndPlayVideo(videoData, startTime = 0) {
    // Load the video
    this.hiddenVideoSrc(videoData.src);

    // Wait for video to load, then seek and play
    this.$hiddenVideo.one("loadeddata", () => {
      this.$hiddenVideo[0].currentTime = startTime;
      if (this.currentVideoIndex > 0) {
        this.playVideo().then(() => {
          console.log("Video playing from time:", startTime);
        });
      }
    });
  }
  playNextVideo() {
    this.currentVideoIndex++;
    if (this.currentVideoIndex < this.videoPlaylist.length) {
      this.loadAndPlayCurrentVideo();
    } else {
      this.isSequencing = false;
      console.log("playlist done");
      eventBus.emit("TIMELINE_SEEK", { time: 0 });
    }
  }
  loadPreviewVideo(src, autoPlay = false) {}
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
    //this.$hiddenVideo[0].pause(); // This is okay here, as we are starting a new play request
    if (this.videoPlaylist.length > 0 && !this.isSequencing) {
      // If we have a playlist but not sequencing, start sequence
      console.log("Starting video sequence");
      this.playVideoSequence();
      return;
    } else {
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
  }
  seekTo(time) {
    this.$hiddenVideo[0].currentTime = time;
    //this.events.trigger("seeked", { time });
  }

  pauseVideo() {
    // this.isSequencing = false;
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
    //console.log(src);
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
  const videoPreview = new VideoPreview();
});
