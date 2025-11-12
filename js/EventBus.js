// eventBus.js - ENHANCED VERSION
class EventBus {
  constructor() {
    this.events = $({});
    this.callbackEvents = new Map(); // Store callback events separately
  }

  on(eventName, callback) {
    this.events.on(eventName, callback);
  }

  off(eventName, callback) {
    this.events.off(eventName, callback);
  }

  emit(eventName, data, callback) {
    if (callback) {
      // Handle callback events differently
      this.emitWithCallback(eventName, data, callback);
    } else {
      // Normal event - works exactly as before
      this.events.trigger(eventName, data);
    }
  }

  // NEW METHOD: Handle events with callbacks
  emitWithCallback(eventName, data, callback) {
    const callbackId = `callback_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store the callback
    this.callbackEvents.set(callbackId, callback);

    // Add callback ID to data
    const enhancedData = {
      ...data,
      _callbackId: callbackId,
    };

    // Trigger the event
    this.events.trigger(eventName, enhancedData);
  }

  // NEW METHOD: Send callback response
  sendCallback(callbackId, result) {
    if (this.callbackEvents.has(callbackId)) {
      const callback = this.callbackEvents.get(callbackId);
      callback(result);
      this.callbackEvents.delete(callbackId);
    }
  }

  once(eventName, callback) {
    this.events.one(eventName, callback);
  }
}

// Create global instance
window.eventBus = new EventBus();
