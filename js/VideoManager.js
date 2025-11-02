class VideoManager {
  constructor() {
    this.videos = new Map();
    this.setupEventListeners();
    this.videoSegments = [];
  }

  setupEventListeners() {
    eventBus.on("VIDEO_ADDED_TO_TIMELINE", (e, data) => {
      console.log("VideoManager: Adding video with startTime", data.startTime);
      this.addVideo(
        data.videoId,
        data.element,
        data.src,
        data.duration,
        data.startTime
      );
    });
    eventBus.on("VIDEO_REMOVED_FROM_TIMELINE", (e, data) => {
      this.removeVideo(data.videoId);
    });
    // Handle sequence playback requests
    eventBus.on("GET_VIDEO_AT_TIME", (e, data, callback) => {
      const videoAtTime = this.getVideoAtTime(data.time);
      if (callback) callback(videoAtTime);
      // callback(videoAtTime);
    });

    eventBus.on("PLAY_SPECIFIC_VIDEO", (e, data) => {
      this.playSpecificVideo(data.videoId, data.time);
    });
  }
  addVideo(videoId, element, src, duration, startTime) {
    this.videos.set(videoId, {
      element: element,
      src: src,
      duration: duration,
      startTime: startTime,
      endTime: startTime + duration,
      loaded: false,
    });
    this.addVideoSegment({
      videoId: videoId,
      startTime: startTime,
      duration: duration,
      endTime: startTime + duration,
      src: src,
    });
    console.log(
      `Video added to the timeline from videomanager : ${videoId}`,
      this.getAllVideos()
    );
    const sortedVideos = this.getVideosSortedByTime();
    //new videos added to the timeline
    eventBus.emit("VIDEOS_UPDATED", {
      videos: sortedVideos,
      totalDuration: this.getTotalDuration(),
    });
  }
  getVideosSortedByTime() {
    return Array.from(this.videos.values()).sort(
      (a, b) => a.startTime - b.startTime
    );
  }

  getTotalDuration() {
    return Array.from(this.videos.values()).reduce(
      (total, video) => total + video.duration,
      0
    );
  }
  removeVideo(videoId) {
    this.videos.delete(videoId);
    this.videoSegments = this.videoSegments.filter(
      (segment) => segment.videoId !== videoId
    );

    // Re-sort and update
    const sortedVideos = this.getVideosSortedByTime();
    //console.log(sortedVideos);
    eventBus.emit("VIDEOS_UPDATED", {
      videos: sortedVideos,
      totalDuration: this.getTotalDuration(),
    });
    // console.log(this.getTotalDuration());
  }

  addVideoSegment(data) {
    this.videoSegments.push({
      videoId: data.videoId,
      startTime: data.startTime,
      duration: data.duration,
      endTime: data.endTime,
      src: data.src,
    });

    // Sort by start time
    this.videoSegments.sort((a, b) => a.startTime - b.startTime);
  }

  getVideoAtTime(sequenceTime) {
    for (const segment of this.videoSegments) {
      if (
        sequenceTime >= segment.startTime &&
        sequenceTime <= segment.endTime
      ) {
        return {
          videoId: segment.videoId,
          timeInVideo: sequenceTime - segment.startTime,
          segment: segment,
        };
      }
    }
    return null;
  }

  playSpecificVideo(videoId, timeInVideo) {
    const videoData = this.videos.get(videoId);
    if (videoData && videoData.element) {
      // Switch to this video and play from specific time
      eventBus.emit("PREVIEW_VIDEO_LOAD", {
        src: videoData.src,
        startTime: timeInVideo,
        autoPlay: true,
      });
    }
  }
  getAllVideos() {
    return Array.from(this.videos.values());
  }
  getVideoById(videoId) {
    return this.videos.get(videoId);
  }
  getVideosByTime(time) {
    // Get videos that are active at this timeline position
    return this.getAllVideos().filter(
      (video) => time >= video.startTime && time <= video.endTime
    );
  }
}
window.videoManager = new VideoManager();
