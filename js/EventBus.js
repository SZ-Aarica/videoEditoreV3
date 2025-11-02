// eventBus.js
class EventBus {
  constructor() {
    this.events = $({});
  }

  on(eventName, callback) {
    this.events.on(eventName, callback);
  }

  off(eventName, callback) {
    this.events.off(eventName, callback);
  }

  emit(eventName, data) {
    this.events.trigger(eventName, data);
  }

  once(eventName, callback) {
    this.events.one(eventName, callback);
  }
}

// Create global instance
window.eventBus = new EventBus();
