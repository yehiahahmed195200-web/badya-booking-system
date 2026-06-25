/**
 * Analytics Service for tracking Terms & Conditions page interactions.
 * In a future version, these logs can be routed to a REST API.
 */
class AnalyticsService {
  constructor() {
    this.sessionStartTime = null;
    this.userId = null;
  }

  init(userId = null) {
    this.userId = userId;
    this.sessionStartTime = Date.now();
    this.trackEvent("Terms Page Opened", {
      userId: this.userId || "anonymous",
      timestamp: new Date().toISOString()
    });
  }

  endSession() {
    if (this.sessionStartTime) {
      const durationSeconds = Math.round((Date.now() - this.sessionStartTime) / 1000);
      this.trackEvent("Terms Reading Session Ended", {
        userId: this.userId || "anonymous",
        readingTimeSeconds: durationSeconds,
        timestamp: new Date().toISOString()
      });
      this.sessionStartTime = null;
    }
  }

  trackSearch(query) {
    if (!query || query.trim() === "") return;
    this.trackEvent("Terms Searched", {
      userId: this.userId || "anonymous",
      keyword: query.trim().toLowerCase(),
      timestamp: new Date().toISOString()
    });
  }

  trackTabChange(category) {
    this.trackEvent("Terms Tab Switched", {
      userId: this.userId || "anonymous",
      activeCategory: category,
      timestamp: new Date().toISOString()
    });
  }

  trackAcceptance(userId, version) {
    this.trackEvent("Terms Accepted", {
      userId,
      version,
      timestamp: new Date().toISOString()
    });
  }

  trackEvent(eventName, payload) {
    // Elegant, structured console logging representing standard analytics telemetry
    console.log(
      `%c[TELEMETRY] ${eventName}`, 
      "color: #12adbe; font-weight: bold; background: rgba(18, 173, 190, 0.1); padding: 2px 6px; border-radius: 4px;",
      payload
    );
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
