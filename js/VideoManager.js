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
    eventBus.on("VIDEO_TRIMMED", (e, data) => {
      const video = this.videos.get(data.videoId);
      if (video) {
        video.startTime = data.startTime;
        video.duration = data.duration;
        video.endTime = data.startTime + data.duration;

        const segment = this.videoSegments.find(
          (s) => s.videoId === data.videoId
        );
        if (segment) {
          Object.assign(segment, {
            startTime: data.startTime,
            duration: data.duration,
            endTime: video.endTime,
          });
        }

        //this.videoSegments.sort((a, b) => a.startTime - b.startTime);
        this.getVideosSortedByTime();
        eventBus.emit("VIDEO_SEGMENTS_UPDATED", {
          segments: this.videoSegments,
        });
        // till here we got start and end time of the trimmed videos
      }
    });
    eventBus.on("VIDEO_REMOVED_FROM_TIMELINE", (e, data) => {
      this.removeVideo(data.videoId);
    });
    // Handle sequence playback requests
    eventBus.on("GET_VIDEO_AT_TIME", (e, data) => {
      const videoAtTime = this.getVideoAtTime(data.time);
      //console.log("videomanager sending video at time", videoAtTime);
      if (data._callbackId) {
        eventBus.sendCallback(data._callbackId, videoAtTime);
      }
    });

    eventBus.on("PLAY_SPECIFIC_VIDEO", (e, data) => {
      this.playSpecificVideo(data.videoId, data.time);
    });
    // Provide video segments to anyone who needs them
    eventBus.on("GET_VIDEO_SEGMENTS", (e, data, callback) => {
      if (callback) callback(this.videoSegments);
    });
    eventBus.on("GET_VIDEO_BY_ID", (e, data) => {
      const video = this.getVideoById(data.videoId);
      if (data._callbackId) {
        eventBus.sendCallback(data._callbackId, video);
      }
    });
  }

  addVideo(videoId, element, src, duration, startTime) {
    //videoId is being set as key while other data are values
    this.videos.set(videoId, {
      videoId: videoId,
      element: element,
      src: src,
      duration: duration,
      startTime: startTime,
      endTime: startTime + duration,
      loaded: false,
    });
    //
    this.addVideoSegment({
      videoId: videoId,
      startTime: startTime,
      duration: duration,
      endTime: startTime + duration,
      src: src,
    });
   /* console.log(
      `Video added to the timeline from videomanager : ${videoId}`,
      this.getAllVideos()
    );*/
    const sortedVideos = this.getVideosSortedByTime();
    //console.log(sortedVideos[0].element);
    //new videos added to the timeline
    eventBus.emit("VIDEOS_UPDATED", {
      videos: sortedVideos,
      totalDuration: this.getTotalDuration(),
    });
    eventBus.emit("VIDEO_SEGMENTS_UPDATED", {
      segments: this.videoSegments,
    });
  }
  getVideosSortedByTime() {
    //we are using the values of the object not the key and we dont return the keys
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
    eventBus.emit("VIDEO_SEGMENTS_UPDATED", {
      segments: this.videoSegments,
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
    const seqSec = sequenceTime;

    for (const segment of this.videoSegments) {
      const startSec = segment.startTime.toFixed(1);
      const endSec = segment.endTime.toFixed(1);
      //console.log(startSec, endSec);

      if (seqSec >= startSec && seqSec < endSec) {
        return {
          videoId: segment.videoId,
          timeInVideo: sequenceTime - segment.startTime, // Keep float for video
          segment,
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
    return this.getAllVideos().filter(
      (video) => time >= video.startTime && time <= video.endTime
    );
  }
}
window.videoManager = new VideoManager();
