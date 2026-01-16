/**
 * @hotosm/hanko-auth Web Component (Lit Version)
 *
 * Smart authentication component that handles:
 * - Hanko SSO (Google, GitHub, Email)
 * - Optional OSM connection
 * - Session management
 * - Event dispatching
 * - URL fallback chain for production builds
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { register } from "@teamhanko/hanko-elements";
import "@awesome.me/webawesome";

// Module-level singleton state - shared across all instances
const sharedAuth = {
  primary: null as any, // The primary instance that makes API calls
  user: null as any,
  osmConnected: false,
  osmData: null as any,
  loading: true,
  hanko: null as any,
  initialized: false,
  instances: new Set<any>(),
  profileDisplayName: "", // Shared profile display name
};

// Session storage key generators to avoid duplication
const getSessionVerifyKey = (hostname: string) => `hanko-verified-${hostname}`;
const getSessionOnboardingKey = (hostname: string) => `hanko-onboarding-${hostname}`;

interface UserState {
  id: string;
  email: string | null;
  username: string | null;
  emailVerified: boolean;
}

interface OSMData {
  osm_username?: string;
  connected: boolean;
}

@customElement("hotosm-auth")
export class HankoAuth extends LitElement {
  // Properties (from attributes)
  @property({ type: String, attribute: "hanko-url" }) hankoUrlAttr = "";
  @property({ type: String, attribute: "base-path" }) basePath = "";
  @property({ type: String, attribute: "auth-path" }) authPath =
    "/api/auth/osm";
  @property({ type: Boolean, attribute: "osm-required" }) osmRequired = false;
  @property({ type: String, attribute: "osm-scopes" }) osmScopes = "read_prefs";
  @property({ type: Boolean, attribute: "show-profile" }) showProfile = false;
  @property({ type: String, attribute: "redirect-after-login" })
  redirectAfterLogin = "";
  @property({ type: Boolean, attribute: "auto-connect" }) autoConnect = false;
  @property({ type: Boolean, attribute: "verify-session" }) verifySession =
    false;
  @property({ type: String, attribute: "redirect-after-logout" })
  redirectAfterLogout = "";
  @property({ type: String, attribute: "display-name" })
  displayNameAttr = "";
  // URL to check if user has app mapping (for cross-app auth scenarios)
  @property({ type: String, attribute: "mapping-check-url" }) mappingCheckUrl = "";
  // App identifier for onboarding redirect
  @property({ type: String, attribute: "app-id" }) appId = "";
  // Custom login page URL (for standalone mode - overrides ${hankoUrl}/app)
  @property({ type: String, attribute: "login-url" }) loginUrl = "";

  // Internal state
  @state() private user: UserState | null = null;
  @state() private osmConnected = false;
  @state() private osmData: OSMData | null = null;
  @state() private osmLoading = false;
  @state() private loading = true;
  @state() private error: string | null = null;
  @state() private profileDisplayName: string = "";
  @state() private hasAppMapping = false; // True if user has mapping in the app

  // Private fields
  private _trailingSlashCache: Record<string, boolean> = {};
  private _debugMode = false;
  private _lastSessionId: string | null = null;
  private _hanko: any = null;
  private _isPrimary = false; // Is this the primary instance?

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .container {
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .osm-connecting {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #d73f3f;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .connecting-text {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .error {
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      padding: 12px;
      color: #c33;
      margin-bottom: 16px;
    }

    .profile {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .profile-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      color: #666;
    }

    .profile-info {
      padding: 8px 16px;
    }

    .profile-name {
      font-weight: 600;
    }

    .profile-email {
      font-size: 14px;
      color: #666;
    }

    .osm-section {
      border-top: 1px solid #e5e5e5;
      padding-top: 16px;
      padding-bottom: 16px;
      margin-top: 16px;
      margin-bottom: 16px;
      text-align: center;
    }

    .osm-connected {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      background: linear-gradient(135deg, #e8f5e8 0%, #f0f9f0 100%);
      border-radius: 8px;
      border: 1px solid #c3e6c3;
    }

    .osm-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #2d7a2d;
      font-weight: 500;
      font-size: 14px;
      text-align: left;
    }

    .osm-badge-icon {
      font-size: 18px;
    }

    .osm-username {
      font-size: 13px;
      color: #5a905a;
      margin-top: 4px;
    }

    button {
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #d73f3f;
      color: white;
    }

    .btn-primary:hover {
      background: #c23535;
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #333;
      margin-top: 8px;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
    }

    .osm-prompt {
      background: #fff8e6;
      border: 1px solid #ffe066;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      text-align: center;
    }

    .osm-prompt-title {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      color: #333;
      text-align: center;
    }

    .osm-prompt-text {
      font-size: 14px;
      color: #666;
      margin-bottom: 16px;
      line-height: 1.5;
      text-align: center;
    }

    .osm-status-badge {
      position: absolute;
      top: -4px;
      right: 10px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      color: white;
      font-weight: bold;
    }

    .osm-status-badge.connected {
      background-color: #10b981;
    }

    .osm-status-badge.required {
      background-color: #f59e0b;
    }
    .header-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #515057;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: white;
    }

    /* Remove hover styles from the dropdown trigger button */
    wa-button.no-hover::part(base) {
      transition: none;
    }
    wa-button.no-hover::part(base):hover,
    wa-button.no-hover::part(base):focus,
    wa-button.no-hover::part(base):active {
      background: transparent !important;
      box-shadow: none !important;
    }
  `;

  // Get computed hankoUrl (priority: attribute > meta tag > window.HANKO_URL > origin)
  get hankoUrl(): string {
    if (this.hankoUrlAttr) {
      return this.hankoUrlAttr;
    }

    const metaTag = document.querySelector('meta[name="hanko-url"]');
    if (metaTag) {
      const content = metaTag.getAttribute("content");
      if (content) {
        this.log("🔍 hanko-url auto-detected from <meta> tag:", content);
        return content;
      }
    }

    if ((window as any).HANKO_URL) {
      this.log(
        "🔍 hanko-url auto-detected from window.HANKO_URL:",
        (window as any).HANKO_URL
      );
      return (window as any).HANKO_URL;
    }

    const origin = window.location.origin;
    this.log("🔍 hanko-url auto-detected from window.location.origin:", origin);
    return origin;
  }

  connectedCallback() {
    super.connectedCallback();
    this._debugMode = this._checkDebugMode();
    this.log("🔌 hanko-auth connectedCallback called");

    // Register this instance
    sharedAuth.instances.add(this);

    // Listen for page visibility changes to re-check session
    // This handles the case where user logs in on /login and comes back
    document.addEventListener("visibilitychange", this._handleVisibilityChange);
    window.addEventListener("focus", this._handleWindowFocus);

    // Listen for login events from other components (e.g., login page)
    document.addEventListener("hanko-login", this._handleExternalLogin);
  }

  // Use firstUpdated instead of connectedCallback to ensure React props are set
  firstUpdated() {
    this.log("🔌 hanko-auth firstUpdated called");
    this.log("  hankoUrl:", this.hankoUrl);
    this.log("  basePath:", this.basePath);

    // If already initialized or being initialized by another instance, sync state and skip init
    if (sharedAuth.initialized || sharedAuth.primary) {
      this.log("🔄 Using shared state from primary instance");
      this._syncFromShared();
      this._isPrimary = false;
    } else {
      // This is the first/primary instance - claim it immediately to prevent race conditions
      this.log("👑 This is the primary instance");
      this._isPrimary = true;
      sharedAuth.primary = this;
      sharedAuth.initialized = true; // Mark as initialized immediately to prevent other instances from also initializing
      this.init();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(
      "visibilitychange",
      this._handleVisibilityChange
    );
    window.removeEventListener("focus", this._handleWindowFocus);
    document.removeEventListener("hanko-login", this._handleExternalLogin);

    // Unregister this instance
    sharedAuth.instances.delete(this);

    // If this was the primary and there are other instances, promote one
    if (this._isPrimary && sharedAuth.instances.size > 0) {
      const newPrimary = sharedAuth.instances.values().next().value;
      if (newPrimary) {
        this.log("👑 Promoting new primary instance");
        newPrimary._isPrimary = true;
        sharedAuth.primary = newPrimary;
      }
    }

    // If no instances left, reset shared state
    if (sharedAuth.instances.size === 0) {
      sharedAuth.initialized = false;
      sharedAuth.primary = null;
    }
  }

  // Sync local state from shared state (only if values changed to prevent render loops)
  private _syncFromShared() {
    if (this.user !== sharedAuth.user) this.user = sharedAuth.user;
    if (this.osmConnected !== sharedAuth.osmConnected) this.osmConnected = sharedAuth.osmConnected;
    if (this.osmData !== sharedAuth.osmData) this.osmData = sharedAuth.osmData;
    if (this.loading !== sharedAuth.loading) this.loading = sharedAuth.loading;
    if (this._hanko !== sharedAuth.hanko) this._hanko = sharedAuth.hanko;
    if (this.profileDisplayName !== sharedAuth.profileDisplayName) this.profileDisplayName = sharedAuth.profileDisplayName;
  }

  // Update shared state and broadcast to all instances
  private _broadcastState() {
    sharedAuth.user = this.user;
    sharedAuth.osmConnected = this.osmConnected;
    sharedAuth.osmData = this.osmData;
    sharedAuth.loading = this.loading;
    sharedAuth.profileDisplayName = this.profileDisplayName;

    // Sync to all other instances
    sharedAuth.instances.forEach((instance) => {
      if (instance !== this) {
        instance._syncFromShared();
      }
    });
  }

  private _handleVisibilityChange = () => {
    // Only primary instance should handle visibility changes to prevent race conditions
    if (!this._isPrimary) return;

    if (!document.hidden && !this.showProfile && !this.user) {
      // Page became visible, we're in header mode, and no user is logged in
      // Re-check session in case user logged in elsewhere
      this.log("👁️ Page visible, re-checking session...");
      this.checkSession();
    }
  };

  private _handleWindowFocus = () => {
    // Only primary instance should handle window focus to prevent race conditions
    if (!this._isPrimary) return;

    if (!this.showProfile && !this.user) {
      // Window focused, we're in header mode, and no user is logged in
      // Re-check session in case user logged in
      this.log("🎯 Window focused, re-checking session...");
      this.checkSession();
    }
  };

  private _handleExternalLogin = (event: Event) => {
    // Only primary instance should handle external login events to prevent race conditions
    if (!this._isPrimary) return;

    const customEvent = event as CustomEvent;
    if (!this.showProfile && !this.user && customEvent.detail?.user) {
      // Another component (e.g., login page) logged in
      this.log("🔔 External login detected, updating user state...");
      this.user = customEvent.detail.user;
      this._broadcastState();
      // Also re-check OSM connection (only if required)
      if (this.osmRequired) {
        this.checkOSMConnection();
      }
    }
  };

  private _checkDebugMode(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("debug") === "true") {
      return true;
    }

    try {
      return localStorage.getItem("hanko-auth-debug") === "true";
    } catch (e) {
      return false;
    }
  }

  private log(...args: any[]) {
    if (this._debugMode) {
      console.log(...args);
    }
  }

  private warn(...args: any[]) {
    console.warn(...args);
  }

  private logError(...args: any[]) {
    console.error(...args);
  }

  private getBasePath(): string {
    // Use basePath property directly (works with both attribute and React props)
    if (this.basePath) {
      this.log("🔍 getBasePath() using basePath:", this.basePath);
      return this.basePath;
    }

    // For single-page apps (like Portal), default to empty base path
    // The authPath already contains the full API path
    this.log("🔍 getBasePath() using default: empty string");
    return "";
  }

  private addTrailingSlash(path: string, basePath: string): string {
    const needsSlash = this._trailingSlashCache[basePath];
    if (needsSlash !== undefined && needsSlash && !path.endsWith("/")) {
      return path + "/";
    }
    return path;
  }

  private async init() {
    // Only primary instance should initialize
    if (!this._isPrimary) {
      this.log("⏭️ Not primary, skipping init...");
      return;
    }

    try {
      await register(this.hankoUrl, {
        enablePasskeys: false,
        hidePasskeyButtonOnLogin: true,
      });

      // Create persistent Hanko instance and set up session event listeners
      const { Hanko } = await import("@teamhanko/hanko-elements");

      // Configure cookie domain for cross-subdomain SSO
      const hostname = window.location.hostname;
      const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
      const cookieOptions = isLocalhost
        ? {}
        : {
            cookieDomain: ".hotosm.org",
            cookieName: "hanko",
            cookieSameSite: "lax",
          };

      this._hanko = new Hanko(this.hankoUrl, cookieOptions);
      sharedAuth.hanko = this._hanko;

      // Set up session lifecycle event listeners (these persist across the component lifecycle)
      this._hanko.onSessionExpired(() => {
        this.log("🕒 Hanko session expired event received");
        this.handleSessionExpired();
      });

      this._hanko.onUserLoggedOut(() => {
        this.log("🚪 Hanko user logged out event received");
        this.handleUserLoggedOut();
      });

      await this.checkSession();
      // Only check OSM and fetch profile if we have a logged-in user
      if (this.user) {
        if (this.osmRequired) {
          await this.checkOSMConnection();
        }
        await this.fetchProfileDisplayName();
      }
      this.loading = false;

      // Broadcast final state to other instances
      this._broadcastState();

      this.setupEventListeners();
    } catch (error: any) {
      this.logError("Failed to initialize hanko-auth:", error);
      this.error = error.message;
      this.loading = false;
      this._broadcastState();
    }
  }

  private async checkSession() {
    this.log("🔍 Checking for existing Hanko session...");

    if (!this._hanko) {
      this.log("⚠️ Hanko instance not initialized yet");
      return;
    }

    try {
      this.log("📡 Checking session validity via cookie...");

      // First, try to validate the session cookie directly with Hanko
      // This works across subdomains because the cookie has domain: .hotosm.test
      try {
        const validateResponse = await fetch(
          `${this.hankoUrl}/sessions/validate`,
          {
            method: "GET",
            credentials: "include", // Include httpOnly cookies
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (validateResponse.ok) {
          const sessionData = await validateResponse.json();

          // Check if session is actually valid (endpoint returns 200 with is_valid:false when no session)
          if (sessionData.is_valid === false) {
            this.log(
              "ℹ️ Session validation returned is_valid:false - no valid session"
            );
            return;
          }

          this.log("✅ Valid Hanko session found via cookie");
          this.log("📋 Session data:", sessionData);

          // Now get the full user data from the login backend /me endpoint
          // This endpoint validates the JWT and returns complete user info
          try {
            const meResponse = await fetch(`${this.hankoUrl}/me`, {
              method: "GET",
              credentials: "include", // Include httpOnly cookies
              headers: {
                "Content-Type": "application/json",
              },
            });

            let needsSdkFallback = true;
            if (meResponse.ok) {
              const userData = await meResponse.json();
              this.log("👤 User data retrieved from /me:", userData);

              // Only use /me if it has email (login.hotosm.org has it, Hanko vanilla doesn't)
              if (userData.email) {
                this.user = {
                  id: userData.user_id || userData.id,
                  email: userData.email,
                  username: userData.username || null,
                  emailVerified: userData.email_verified || userData.verified || false,
                };
                needsSdkFallback = false;
              } else {
                this.log("⚠️ /me has no email, will use SDK fallback");
              }
            }

            if (needsSdkFallback) {
              this.log("🔄 Using SDK to get user with email");
              // Fallback to SDK method which has email
              const user = await this._hanko.user.getCurrent();
              this.user = {
                id: user.id,
                email: user.email,
                username: user.username,
                emailVerified: user.email_verified || false,
              };
            }
          } catch (userError) {
            this.log("⚠️ Failed to get user data:", userError);
            // Last resort: use session data if available
            if (sessionData.user_id) {
              this.user = {
                id: sessionData.user_id,
                email: sessionData.email || null,
                username: null,
                emailVerified: false,
              };
            }
          }

          if (this.user) {
            // If verify-session is enabled and we have a redirect URL,
            // redirect to the callback so the app can verify the user mapping
            // Use sessionStorage to avoid redirect loops
            const verifyKey = getSessionVerifyKey(window.location.hostname);
            const alreadyVerified = sessionStorage.getItem(verifyKey);

            if (
              this.verifySession &&
              this.redirectAfterLogin &&
              !alreadyVerified
            ) {
              this.log(
                "🔄 verify-session enabled, redirecting to callback for app verification..."
              );
              sessionStorage.setItem(verifyKey, "true");
              window.location.href = this.redirectAfterLogin;
              return;
            }

            // Silent app mapping check (for cross-app auth scenarios)
            // If app-status-url is configured, check if user needs onboarding
            const mappingOk = await this.checkAppMapping();
            if (!mappingOk) {
              // Redirect to onboarding in progress, don't proceed
              return;
            }

            this.dispatchEvent(
              new CustomEvent("hanko-login", {
                detail: { user: this.user },
                bubbles: true,
                composed: true,
              })
            );

            this.dispatchEvent(
              new CustomEvent("auth-complete", {
                bubbles: true,
                composed: true,
              })
            );

            // Also check if we need to auto-connect to OSM
            if (this.osmRequired) {
              await this.checkOSMConnection();
            }
            // Fetch profile display name
            await this.fetchProfileDisplayName();
            if (this.osmRequired && this.autoConnect && !this.osmConnected) {
              this.log(
                "🔄 Auto-connecting to OSM (from existing session)..."
              );
              this.handleOSMConnect();
            }
          }
        } else {
          this.log("ℹ️ No valid session cookie found - user needs to login");
        }
      } catch (validateError) {
        this.log("⚠️ Session validation failed:", validateError);
        this.log("ℹ️ No valid session - user needs to login");
      }
    } catch (error) {
      this.log("⚠️ Session check error:", error);
      this.log("ℹ️ No existing session - user needs to login");
    } finally {
      // Broadcast state changes to other instances
      if (this._isPrimary) {
        this._broadcastState();
      }
    }
  }

  private async checkOSMConnection() {
    if (this.osmConnected) {
      this.log("⏭️ Already connected to OSM, skipping check");
      return;
    }

    // Don't set osmLoading during init - keep component in loading state
    // Only set osmLoading when user manually triggers OSM check after initial load
    const wasLoading = this.loading;
    if (!wasLoading) {
      this.osmLoading = true;
    }

    try {
      const basePath = this.getBasePath();
      const authPath = this.authPath;

      // Simple path construction without trailing slash detection
      // The backend should handle both with/without trailing slash
      const statusPath = `${basePath}${authPath}/status`;
      const statusUrl = `${statusPath}`; // Relative URL for proxy

      this.log("🔍 Checking OSM connection at:", statusUrl);
      this.log("  basePath:", basePath);
      this.log("  authPath:", authPath);
      this.log("🍪 Current cookies:", document.cookie);

      const response = await fetch(statusUrl, {
        credentials: "include",
        redirect: "follow",
      });

      this.log("📡 OSM status response:", response.status);
      this.log("📡 Final URL after redirects:", response.url);
      this.log("📡 Response headers:", [...response.headers.entries()]);

      if (response.ok) {
        const text = await response.text();
        this.log("📡 OSM raw response:", text.substring(0, 200));

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          this.logError(
            "Failed to parse OSM response as JSON:",
            text.substring(0, 500)
          );
          throw new Error("Invalid JSON response from OSM status endpoint");
        }

        this.log("📡 OSM status data:", data);

        if (data.connected) {
          this.log("✅ OSM is connected:", data.osm_username);
          this.osmConnected = true;
          this.osmData = data;

          this.dispatchEvent(
            new CustomEvent("osm-connected", {
              detail: { osmData: data },
              bubbles: true,
              composed: true,
            })
          );

          // Dispatch event so parent components can handle the connection
          // Note: We don't auto-redirect here because that would cause loops
          // The Login page's onboarding flow listens for 'osm-connected' event
          // and handles the redirect to the app's onboarding endpoint
        } else {
          this.log("❌ OSM is NOT connected");
          this.osmConnected = false;
          this.osmData = null;
        }
      }
    } catch (error) {
      this.logError("OSM connection check failed:", error);
    } finally {
      if (!wasLoading) {
        this.osmLoading = false;
      }
      // Broadcast state changes to other instances
      if (this._isPrimary) {
        this._broadcastState();
      }
    }
  }

  // Check app mapping status (for cross-app auth scenarios)
  // Only used when mapping-check-url is configured
  private async checkAppMapping(): Promise<boolean> {
    // Only check if mapping-check-url is configured
    if (!this.mappingCheckUrl || !this.user) {
      return true; // No check needed, proceed normally
    }

    // Prevent redirect loops - if we already tried onboarding this session, don't redirect again
    const onboardingKey = getSessionOnboardingKey(window.location.hostname);
    const alreadyTriedOnboarding = sessionStorage.getItem(onboardingKey);

    this.log("🔍 Checking app mapping at:", this.mappingCheckUrl);

    try {
      const response = await fetch(this.mappingCheckUrl, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.log("📡 Mapping check response:", data);

        if (data.needs_onboarding) {
          if (alreadyTriedOnboarding) {
            this.log("⚠️ Already tried onboarding this session, skipping redirect");
            return true; // Don't loop, let user continue
          }
          // User has Hanko session but no app mapping - redirect to onboarding
          this.log("⚠️ User needs onboarding, redirecting...");
          sessionStorage.setItem(onboardingKey, "true");
          const returnTo = encodeURIComponent(window.location.origin);
          const appParam = this.appId ? `onboarding=${this.appId}` : "";
          window.location.href = `${this.hankoUrl}/app?${appParam}&return_to=${returnTo}`;
          return false; // Redirect in progress, don't proceed
        }

        // User has mapping - clear the onboarding flag
        sessionStorage.removeItem(onboardingKey);
        this.hasAppMapping = true;
        this.log("✅ User has app mapping");
        return true;
      } else if (response.status === 401 || response.status === 403) {
        if (alreadyTriedOnboarding) {
          this.log("⚠️ Already tried onboarding this session, skipping redirect");
          return true;
        }
        // Needs onboarding
        this.log("⚠️ 401/403 - User needs onboarding, redirecting...");
        sessionStorage.setItem(onboardingKey, "true");
        const returnTo = encodeURIComponent(window.location.origin);
        const appParam = this.appId ? `onboarding=${this.appId}` : "";
        window.location.href = `${this.hankoUrl}/app?${appParam}&return_to=${returnTo}`;
        return false;
      }

      // Other status codes - proceed without blocking
      this.log("⚠️ Unexpected status from mapping check:", response.status);
      return true;
    } catch (error) {
      this.log("⚠️ App mapping check failed:", error);
      // Don't block the user, just log the error
      return true;
    }
  }

  // Fetch profile display name from login backend
  private async fetchProfileDisplayName() {
    try {
      const profileUrl = `${this.hankoUrl}/api/profile/me`;
      this.log("👤 Fetching profile from:", profileUrl);

      const response = await fetch(profileUrl, {
        credentials: "include",
      });

      if (response.ok) {
        const profile = await response.json();
        this.log("👤 Profile data:", profile);

        if (profile.first_name || profile.last_name) {
          this.profileDisplayName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
          this.log("👤 Display name set to:", this.profileDisplayName);
        }
      }
    } catch (error) {
      this.log("⚠️ Could not fetch profile:", error);
    }
  }

  private setupEventListeners() {
    // Use updateComplete to ensure DOM is ready
    this.updateComplete.then(() => {
      const hankoAuth = this.shadowRoot?.querySelector("hanko-auth");

      if (hankoAuth) {
        hankoAuth.addEventListener("onSessionCreated", (e: any) => {
          this.log(`🎯 Hanko event: onSessionCreated`, e.detail);

          const sessionId = e.detail?.claims?.session_id;
          if (sessionId && this._lastSessionId === sessionId) {
            this.log("⏭️ Skipping duplicate session event");
            return;
          }
          this._lastSessionId = sessionId;

          this.handleHankoSuccess(e);
        });

        hankoAuth.addEventListener("hankoAuthLogout", () =>
          this.handleLogout()
        );
      }
    });
  }

  private async handleHankoSuccess(event: any) {
    this.log("Hanko auth success:", event.detail);

    if (!this._hanko) {
      this.logError("Hanko instance not initialized");
      return;
    }

    // Try to get user info from /me endpoint first (preferred)
    // If that fails (e.g., NetworkError on first cross-origin request with mkcert),
    // fall back to the Hanko SDK method
    let userInfoRetrieved = false;

    try {
      // Use AbortController with 5 second timeout to fail fast on connection issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const meResponse = await fetch(`${this.hankoUrl}/me`, {
        method: "GET",
        credentials: "include", // Include httpOnly cookies
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (meResponse.ok) {
        const userData = await meResponse.json();
        this.log("👤 User data retrieved from /me:", userData);

        // Only use /me if it has email (login.hotosm.org has it, Hanko vanilla doesn't)
        if (userData.email) {
          this.user = {
            id: userData.user_id || userData.id,
            email: userData.email,
            username: userData.username || null,
            emailVerified: userData.email_verified || userData.verified || false,
          };
          userInfoRetrieved = true;
        } else {
          this.log("⚠️ /me has no email, will try SDK fallback");
        }
      } else {
        this.log("⚠️ /me endpoint returned non-OK status, will try SDK fallback");
      }
    } catch (error) {
      // NetworkError or timeout on cross-origin fetch is common with mkcert certs
      this.log("⚠️ /me endpoint fetch failed (timeout or cross-origin TLS issue):", error);
    }

    // Fallback to SDK method if /me didn't work
    if (!userInfoRetrieved) {
      try {
        this.log("🔄 Trying SDK fallback for user info...");
        // Add timeout to SDK call in case it hangs
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SDK timeout")), 5000)
        );
        const user = await Promise.race([
          this._hanko.user.getCurrent(),
          timeoutPromise,
        ]) as any;
        this.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.email_verified || false,
        };
        userInfoRetrieved = true;
        this.log("✅ User info retrieved via SDK fallback");
      } catch (sdkError) {
        this.log("⚠️ SDK fallback failed, trying JWT claims:", sdkError);
        // Last resort: extract user info from JWT claims in the event
        try {
          const claims = event.detail?.claims;
          if (claims?.sub) {
            this.user = {
              id: claims.sub,
              email: claims.email || null,
              username: null,
              emailVerified: claims.email_verified || false,
            };
            userInfoRetrieved = true;
            this.log("✅ User info extracted from JWT claims");
          } else {
            this.logError("No user claims available in event");
            this.user = null;
            return;
          }
        } catch (claimsError) {
          this.logError("Failed to extract user info from claims:", claimsError);
          this.user = null;
          return;
        }
      }
    }

    this.log("✅ User state updated:", this.user);

    // Broadcast state changes to other instances
    if (this._isPrimary) {
      this._broadcastState();
    }

    this.dispatchEvent(
      new CustomEvent("hanko-login", {
        detail: { user: this.user },
        bubbles: true,
        composed: true,
      })
    );

    // Check OSM connection only if required
    if (this.osmRequired) {
      await this.checkOSMConnection();
    }
    // Fetch profile display name (only works with login.hotosm.org backend)
    await this.fetchProfileDisplayName();

    // Auto-connect to OSM if required and auto-connect is enabled
    if (this.osmRequired && this.autoConnect && !this.osmConnected) {
      this.log("🔄 Auto-connecting to OSM...");
      this.handleOSMConnect();
      return; // Exit early - redirect will happen after OSM OAuth callback
    }

    // Only redirect if OSM is not required OR if OSM is connected
    const canRedirect = !this.osmRequired || this.osmConnected;

    this.log(
      "🔄 Checking redirect-after-login:",
      this.redirectAfterLogin,
      "showProfile:",
      this.showProfile,
      "canRedirect:",
      canRedirect
    );

    if (canRedirect) {
      this.dispatchEvent(
        new CustomEvent("auth-complete", {
          bubbles: true,
          composed: true,
        })
      );

      if (this.redirectAfterLogin) {
        this.log("✅ Redirecting to:", this.redirectAfterLogin);
        window.location.href = this.redirectAfterLogin;
      } else {
        this.log("❌ No redirect (redirectAfterLogin not set)");
      }
    } else {
      this.log("⏸️ Waiting for OSM connection before redirect");
    }
  }

  private async handleOSMConnect() {
    const scopes = this.osmScopes.split(" ").join("+");
    const basePath = this.getBasePath();
    const authPath = this.authPath;

    // Simple path construction
    const loginPath = `${basePath}${authPath}/login`;
    const fullUrl = `${loginPath}?scopes=${scopes}`;

    this.log("🔗 OSM Connect clicked!");
    this.log("  basePath:", basePath);
    this.log("  authPath:", authPath);
    this.log("  Login path:", fullUrl);
    this.log("  Fetching redirect URL from backend...");

    try {
      // Use fetch with credentials to get the redirect URL
      // The backend will return a RedirectResponse which fetch will follow
      const response = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
        redirect: "manual", // Don't follow redirect, we'll do it manually
      });

      this.log("  Response status:", response.status);
      this.log("  Response type:", response.type);

      if (response.status === 0 || response.type === "opaqueredirect") {
        // This is a redirect response
        const redirectUrl = response.headers.get("Location") || response.url;
        this.log("  ✅ Got redirect URL:", redirectUrl);
        window.location.href = redirectUrl;
      } else if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("Location");
        this.log("  ✅ Got redirect URL from header:", redirectUrl);
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      } else {
        this.logError("  ❌ Unexpected response:", response.status);
        const text = await response.text();
        this.logError("  Response body:", text.substring(0, 200));
      }
    } catch (error) {
      this.logError("  ❌ Failed to fetch redirect URL:", error);
    }
  }

  private async handleLogout() {
    this.log("🚪 Logout initiated");
    this.log("📊 Current state before logout:", {
      user: this.user,
      osmConnected: this.osmConnected,
      osmData: this.osmData,
    });
    this.log("🍪 Cookies before logout:", document.cookie);

    try {
      const basePath = this.getBasePath();
      const authPath = this.authPath;
      const disconnectPath = `${basePath}${authPath}/disconnect`;
      // If basePath is already a full URL, use it directly; otherwise prepend origin
      const disconnectUrl = disconnectPath.startsWith("http")
        ? disconnectPath
        : `${window.location.origin}${disconnectPath}`;
      this.log("🔌 Calling OSM disconnect:", disconnectUrl);

      const response = await fetch(disconnectUrl, {
        method: "POST",
        credentials: "include",
      });

      this.log("📡 Disconnect response status:", response.status);
      const data = await response.json();
      this.log("📡 Disconnect response data:", data);
      this.log("✅ OSM disconnected");
    } catch (error) {
      this.logError("❌ OSM disconnect failed:", error);
    }

    if (this._hanko) {
      try {
        await this._hanko.user.logout();
        this.log("✅ Hanko logout successful");
      } catch (error) {
        this.logError("Hanko logout failed:", error);
      }
    }

    // Use shared cleanup method
    this._clearAuthState();

    this.log(
      "✅ Logout complete - component will re-render with updated state"
    );

    // Redirect after logout if configured
    if (this.redirectAfterLogout) {
      this.log("🔄 Redirecting after logout to:", this.redirectAfterLogout);
      window.location.href = this.redirectAfterLogout;
    }
    // Otherwise let Lit's reactivity handle the re-render
  }

  /**
   * Clear all auth state - shared between logout and session expired handlers
   */
  private _clearAuthState() {
    // Clear cookies
    const hostname = window.location.hostname;
    document.cookie = `hanko=; path=/; domain=${hostname}; max-age=0`;
    document.cookie = "hanko=; path=/; max-age=0";
    document.cookie = `osm_connection=; path=/; domain=${hostname}; max-age=0`;
    document.cookie = "osm_connection=; path=/; max-age=0";
    this.log("🍪 Cookies cleared");

    // Clear session verification and onboarding flags
    const verifyKey = getSessionVerifyKey(hostname);
    const onboardingKey = getSessionOnboardingKey(hostname);
    sessionStorage.removeItem(verifyKey);
    sessionStorage.removeItem(onboardingKey);
    this.log("🔄 Session flags cleared");

    // Reset state
    this.user = null;
    this.osmConnected = false;
    this.osmData = null;
    this.hasAppMapping = false;

    // Broadcast state changes to other instances
    if (this._isPrimary) {
      this._broadcastState();
    }

    // Dispatch logout event
    this.dispatchEvent(
      new CustomEvent("logout", {
        bubbles: true,
        composed: true,
      })
    );
  }

  private async handleSessionExpired() {
    this.log("🕒 Session expired event received");
    this.log("📊 Current state:", {
      user: this.user,
      osmConnected: this.osmConnected,
    });

    // If we have an active user, the session is still valid
    // The SDK may fire this event for old/stale sessions while a new session exists
    if (this.user) {
      this.log("✅ User is logged in, ignoring stale session expired event");
      return;
    }

    this.log("🧹 No active user - cleaning up state");

    // Call OSM disconnect endpoint to clear httpOnly cookie
    try {
      const basePath = this.getBasePath();
      const authPath = this.authPath;
      const disconnectPath = `${basePath}${authPath}/disconnect`;
      // If basePath is already a full URL, use it directly; otherwise prepend origin
      const disconnectUrl = disconnectPath.startsWith("http")
        ? disconnectPath
        : `${window.location.origin}${disconnectPath}`;
      this.log(
        "🔌 Calling OSM disconnect (session expired):",
        disconnectUrl
      );

      const response = await fetch(disconnectUrl, {
        method: "POST",
        credentials: "include",
      });

      this.log("📡 Disconnect response status:", response.status);
      const data = await response.json();
      this.log("📡 Disconnect response data:", data);
      this.log("✅ OSM disconnected");
    } catch (error) {
      this.logError("❌ OSM disconnect failed:", error);
    }

    // Use shared cleanup method
    this._clearAuthState();

    this.log("✅ Session cleanup complete");

    // Redirect after session expired if configured
    if (this.redirectAfterLogout) {
      this.log(
        "🔄 Redirecting after session expired to:",
        this.redirectAfterLogout
      );
      window.location.href = this.redirectAfterLogout;
    }
    // Otherwise component will re-render and show login button
  }

  private handleUserLoggedOut() {
    this.log("🚪 User logged out in another window/tab");
    // Same cleanup as session expired
    this.handleSessionExpired();
  }

  private handleDropdownSelect(event: CustomEvent) {
    const selectedValue = event.detail.item.value;
    this.log("🎯 Dropdown item selected:", selectedValue);

    if (selectedValue === "profile") {
      // Profile page lives on the login site
      // Pass return URL so profile can navigate back to the app
      const baseUrl = this.hankoUrl;
      const returnTo = this.redirectAfterLogin || window.location.origin;
      window.location.href = `${baseUrl}/app/profile?return_to=${encodeURIComponent(returnTo)}`;
    } else if (selectedValue === "connect-osm") {
      // Smart return_to: if already on a login page, redirect to home instead
      const currentPath = window.location.pathname;
      const isOnLoginPage = currentPath.includes("/app");
      const returnTo = isOnLoginPage
        ? window.location.origin
        : window.location.href;

      // Use the getter which handles all fallbacks correctly
      const baseUrl = this.hankoUrl;
      window.location.href = `${baseUrl}/app?return_to=${encodeURIComponent(
        returnTo
      )}&osm_required=true`;
    } else if (selectedValue === "logout") {
      this.handleLogout();
    }
  }

  private handleSkipOSM() {
    this.dispatchEvent(new CustomEvent("osm-skipped"));
    this.dispatchEvent(new CustomEvent("auth-complete"));
    if (this.redirectAfterLogin) {
      window.location.href = this.redirectAfterLogin;
    }
  }

  render() {
    this.log(
      "🎨 RENDER - showProfile:",
      this.showProfile,
      "user:",
      !!this.user,
      "loading:",
      this.loading
    );

    if (this.loading) {
      return html`
        <wa-button appearance="plain" size="small" disabled>Log in</wa-button>
      `;
    }

    if (this.error) {
      return html`
        <div class="container">
          <div class="error">${this.error}</div>
        </div>
      `;
    }

    if (this.user) {
      // User is logged in
      const needsOSM =
        this.osmRequired && !this.osmConnected && !this.osmLoading;
      const displayName = this.displayNameAttr || this.profileDisplayName || this.user.username || this.user.email || this.user.id;
      const initial = displayName ? displayName[0].toUpperCase() : "U";

      if (this.showProfile) {
        // Show full profile view
        return html`
          <div class="container">
            <div class="profile">
              <div class="profile-header">
                <div class="profile-avatar">${initial}</div>
                <div class="profile-info">
                  <div class="profile-name">
                    ${displayName}
                  </div>
                  <div class="profile-email">
                    ${this.user.email || this.user.id}
                  </div>
                </div>
              </div>

              ${this.osmRequired && this.osmLoading
                ? html`
                    <div class="osm-section">
                      <div class="loading">Checking OSM connection...</div>
                    </div>
                  `
                : this.osmRequired && this.osmConnected
                ? html`
                    <div class="osm-section">
                      <div class="osm-connected">
                        <div class="osm-badge">
                          <span class="osm-badge-icon">🗺️</span>
                          <div>
                            <div>Connected to OpenStreetMap</div>
                            ${this.osmData?.osm_username
                              ? html`
                                  <div class="osm-username">
                                    @${this.osmData.osm_username}
                                  </div>
                                `
                              : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  `
                : ""}
              ${needsOSM
                ? html`
                    <div class="osm-section">
                      ${this.autoConnect
                        ? html`
                            <div class="osm-connecting">
                              <div class="spinner"></div>
                              <div class="connecting-text">
                                🗺️ Connecting to OpenStreetMap...
                              </div>
                            </div>
                          `
                        : html`
                            <div class="osm-prompt-title">🌍 OSM Required</div>
                            <div class="osm-prompt-text">
                              This endpoint requires OSM connection.
                            </div>
                            <button
                              @click=${this.handleOSMConnect}
                              class="btn-primary"
                            >
                              Connect OSM Account
                            </button>
                          `}
                    </div>
                  `
                : ""}

              <button @click=${this.handleLogout} class="btn-logout">
                Logout
              </button>
            </div>
          </div>
        `;
      } else {
        // Logged in, show-profile=false: render dropdown with WebAwesome
        return html`
          <wa-dropdown
            placement="bottom-start"
            distance="4"
            @wa-select=${this.handleDropdownSelect}
          >
            <wa-button
              slot="trigger"
              class="no-hover"
              appearance="plain"
              size="small"
              style="position: relative;"
            >
              <span class="header-avatar">${initial}</span>
              ${this.osmConnected
                ? html`
                    <span
                      class="osm-status-badge connected"
                      title="Connected to OSM as @${this.osmData?.osm_username}"
                      >✓</span
                    >
                  `
                : this.osmRequired
                ? html`
                    <span
                      class="osm-status-badge required"
                      title="OSM connection required"
                      >!</span
                    >
                  `
                : ""}
            </wa-button>
            <div class="profile-info">
              <div class="profile-name">${displayName}</div>
              <div class="profile-email">
                ${this.user.email || this.user.id}
              </div>
            </div>
            <wa-dropdown-item value="profile">
              <wa-icon slot="icon" name="user"></wa-icon>
              My Profile
            </wa-dropdown-item>
            ${this.osmRequired
              ? this.osmConnected
                ? html`
                    <wa-dropdown-item value="osm-connected" disabled>
                      <wa-icon slot="icon" name="check"></wa-icon>
                      Connected to OSM (@${this.osmData?.osm_username})
                    </wa-dropdown-item>
                  `
                : html`
                    <wa-dropdown-item value="connect-osm">
                      <wa-icon slot="icon" name="map"></wa-icon>
                      Connect OSM
                    </wa-dropdown-item>
                  `
              : ""}
            <wa-dropdown-item value="logout" variant="danger">
              <wa-icon slot="icon" name="right-from-bracket"></wa-icon>
              Sign Out
            </wa-dropdown-item>
          </wa-dropdown>
        `;
      }
    } else {
      // Not logged in
      if (this.showProfile) {
        // On login page - show full Hanko auth form
        return html`
          <div class="container">
            <hanko-auth></hanko-auth>
          </div>
        `;
      } else {
        // In header - show login link
        // Use redirectAfterLogin if set, otherwise use current URL
        // Smart return_to: if already on a login page, redirect to home instead
        const currentPath = window.location.pathname;
        const isOnLoginPage = currentPath.includes("/app");
        const returnTo =
          this.redirectAfterLogin ||
          (isOnLoginPage ? window.location.origin : window.location.href);

        const urlParams = new URLSearchParams(window.location.search);
        const autoConnectParam =
          urlParams.get("auto_connect") === "true" ? "&auto_connect=true" : "";

        // Use the getter which handles all fallbacks correctly
        const baseUrl = this.hankoUrl;
        this.log("🔗 Login URL base:", baseUrl);

        // Use custom loginUrl if provided (for standalone mode), otherwise use ${hankoUrl}/app
        const loginBase = this.loginUrl || `${baseUrl}/app`;
        const loginUrl = `${loginBase}?return_to=${encodeURIComponent(
          returnTo
        )}${this.osmRequired ? "&osm_required=true" : ""}${autoConnectParam}`;

        return html`<wa-button
          appearance="plain"
          size="small"
          href="${loginUrl}"
          >Log in
        </wa-button> `;
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hotosm-auth": HankoAuth;
  }
}
