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
    this.isScrubbing = false;
    this.setupEventListeners();
    this.init();
  }

  init() {
    this.controllButton();
  }
  controllButton() {
    this.$playButton.on("click", () => {
      //this.$playButton.addClass("hidden");
      this.playVideo();
    });
    this.$pauseButton.on("click", () => {
      this.pauseVideo();
    });
  }
  setupEventListeners() {
    eventBus.on("TIMELINE_SEEK", (e, data) => {
      //console.log("timeline seek to", data.time);
      this.seekToSequenceTime(data.time);
    });
    eventBus.on("TIMELINE_PLAY", () => {
      this.playVideo();
      //console.log("playvideo");
    });
    eventBus.on("TIMELINE_PAUSE", () => {
      this.pauseVideo();
    });
    eventBus.on("SEQUENCE_TIME_UPDATE", (e, data) => {
      this.currentSequenceTime = data.sequenceTime;
      //console.log(this.videoPlaylist); //we have end and start
      this.handleSequencePlayback(data.sequenceTime);
    });
    // Load specific video for preview
    eventBus.on("PREVIEW_VIDEO_LOAD", (e, data) => {
      //this.loadPreviewVideo(data.src, data.autoPlay || false);
    });
    //scrubbing
    this.$hiddenVideo.on("ended", () => {
      this.handleVideoEnded();
    });

    eventBus.on("VIDEO_SEGMENTS_UPDATED", (e, data) => {
      this.videoSegments = data.segments;
      //console.log("Video segments updated:", ); we have the start and duration and end time on end videos
    });
    // Multi-video rendering
    eventBus.on("VIDEOS_UPDATED", (e, data) => {
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
  reset() {
    this.isSequencing = true;
    this.$playButton.removeClass("hidden");
    this.$pauseButton.addClass("hidden");
  }
  //plauback handle
  seekToSequenceTime(sequenceTime) {
    eventBus.emit(
      "GET_VIDEO_AT_TIME",
      { time: sequenceTime },
      (videoAtTime) => {
        if (videoAtTime) {
          // console.log(videoAtTime);
          this.loadVideoForTime(
            videoAtTime.videoId,
            videoAtTime.timeInVideo,
            sequenceTime
          );
        } else {
          console.log("No video found at sequence time:", sequenceTime);
          this.pauseVideo();
          this.clearCanvas();
        }
      }
    );
  }
  loadVideoForTime(videoId, timeInVideo, sequenceTime) {
    // Get video data from VideoManager
    eventBus.emit("GET_VIDEO_BY_ID", { videoId: videoId }, (videoData) => {
      if (!videoData) {
        console.error("Video not found:", videoId);
        return;
      }
      // console.log(this.currentVideoIndex);
      const isDifferentVideo = this.$hiddenVideo[0].src !== videoData.src;

      if (isDifferentVideo) {
        console.log(`Switching to video: ${videoId}`);

        const wasPlaying = !this.$hiddenVideo[0].paused;

        this.hiddenVideoSrc(videoData.src);

        this.$hiddenVideo.one("loadeddata", () => {
          this.$hiddenVideo[0].currentTime = sequenceTime;
          this.updateCurrentVideoIndex(videoId);
          this.sequenceStartOffset = videoData.startTime || 0;

          this.$hiddenVideo.one("seeked", () => {
            this.updateCanvasFrame();

            if (wasPlaying) {
              this.playVideo();
            }
          });
        });
      } else {
        console.log(`Seeking within current video to: ${timeInVideo}`);
        this.$hiddenVideo[0].currentTime = timeInVideo;
        this.updateCurrentVideoIndex(videoId);
        this.sequenceStartOffset = videoData.startTime || 0;
        this.updateCanvasFrame();
      }
    });
  }
  handleSequencePlayback(sequenceTime) {
    /* console.log(
            videoAtTime.videoId,
            " ",
            currentVideoId,
            "videoindex",
            this.currentVideoIndex
          );*/
    // console.log(sequenceTime);
    if (!this.isSequencing) return;
    eventBus.emit(
      "GET_VIDEO_AT_TIME",
      { time: sequenceTime },
      (videoAtTime) => {
        // console.log(videoAtTime);
        if (videoAtTime) {
          const currentVideoId = this.videoPlaylist[this.currentVideoIndex];

          if (videoAtTime.videoId !== currentVideoId.videoId) {
            console.log(`Auto-switching to video: ${videoAtTime.videoId}`);
            this.loadVideoForTime(
              videoAtTime.videoId,
              videoAtTime.timeInVideo,
              sequenceTime
            );
          } else if (videoAtTime.timeInVideo >= currentVideoId.duration) {
            console.log(`Current time in video: ${videoAtTime.timeInVideo}`);
            this.playNextVideo();
          }
        } else {
          this.playNextVideo();
        }
      }
    );
  }
  //moving to next video
  playNextVideo() {
    this.currentVideoIndex++;
    //this.debugPlaylist();

    if (this.currentVideoIndex < this.videoPlaylist.length) {
      console.log(`Moving to video index: ${this.currentVideoIndex}`);
      this.loadAndPlayCurrentVideo();
    } else {
      this.isSequencing = false;
      //this.reset();
      console.log("playlist done");
      eventBus.emit("TIMELINE_SEEK", { time: 0 });
      this.pauseVideo();
    }
  }
  updateCurrentVideoIndex(videoId) {
    this.currentVideoIndex = this.videoPlaylist.findIndex(
      (video) => video.videoId === videoId
    );
    // console.log(`Updated current video index to: ${this.currentVideoIndex}`);
  }

  //"VIDEOS_UPDATED" event
  updateMultiVideoView(videos) {
    this.videoPlaylist = videos;
    //console.log(videos);

    //console.log("playlist updateed", this.videoPlaylist); && !this.isSequencing
    if (this.videoPlaylist.length > 0) {
      this.playVideoSequence();
    } else {
      //console.log("length " + this.videoPlaylist.length + this.isSequencing);
      this.hiddenVideoSrc("");
      this.clearCanvas();
    }
    //this.hiddenVideoSrc(videos[0].src);
  }
  playVideoSequence() {
    this.isSequencing = true;
    this.currentVideoIndex = 0;
    this.loadAndPlayCurrentVideo();
  }

  loadAndPlayCurrentVideo() {
    if (this.currentVideoIndex >= this.videoPlaylist.length) {
      //end
      this.isSequencing = false;

      console.log("finished playing");
      return;
    }
    const currentVideoData = this.videoPlaylist[this.currentVideoIndex];
    //console.log(this.currentVideoIndex + "lengh " + this.videoPlaylist);
    this.sequenceStartOffset = currentVideoData.startTime || 0;

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
    this.hiddenVideoSrc(videoData.src);

    this.$hiddenVideo.one("loadeddata", () => {
      this.$hiddenVideo[0].currentTime = startTime;

      // Only auto-play if it's NOT the first video
      if (this.currentVideoIndex > 0) {
        this.playVideo();
      } else {
        // Just load + seek, wait for user to press Play
        this.updateCanvasFrame();
      }
    });
  }

  //play and pause
  async playVideo() {
    //this.$hiddenVideo[0].pause(); // This is okay here, as we are starting a new play request
    //this.playVideoSequence();
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

  pauseVideo() {
    // this.isSequencing = false;
    this.$hiddenVideo[0].pause(); //pause the video
    this.$playButton.removeClass("hidden");
    this.$pauseButton.addClass("hidden");
    this.isDrawing = false;

    // if (this.currentVideoIndex === this.videoPlaylist.length) {
    // console.log(this.currentVideoIndex, this.videoPlaylist.length - 1);
  }
  seekTo(time) {
    this.$hiddenVideo[0].currentTime = time;
  }
  //canvas update
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  updateCanvasFrame() {
    // Force immediate canvas update
    if (this.$hiddenVideo[0].readyState >= 2) {
      const video = this.$hiddenVideo[0];

      if (
        this.canvas.width !== video.videoWidth ||
        this.canvas.height !== video.videoHeight
      ) {
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
      }

      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
    }
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
  //give video src
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
