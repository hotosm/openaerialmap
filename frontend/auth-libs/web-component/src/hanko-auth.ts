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

  // Internal state
  @state() private user: UserState | null = null;
  @state() private osmConnected = false;
  @state() private osmData: OSMData | null = null;
  @state() private osmLoading = false;
  @state() private loading = true;
  @state() private error: string | null = null;

  // Private fields
  private _trailingSlashCache: Record<string, boolean> = {};
  private _debugMode = false;
  private _sessionJWT: string | null = null;
  private _lastSessionId: string | null = null;
  private _hanko: any = null;

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
    this.log("  hankoUrl:", this.hankoUrl);
    this.init();

    // Listen for page visibility changes to re-check session
    // This handles the case where user logs in on /login and comes back
    document.addEventListener("visibilitychange", this._handleVisibilityChange);
    window.addEventListener("focus", this._handleWindowFocus);

    // Listen for login events from other components (e.g., login page)
    document.addEventListener("hanko-login", this._handleExternalLogin);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(
      "visibilitychange",
      this._handleVisibilityChange
    );
    window.removeEventListener("focus", this._handleWindowFocus);
    document.removeEventListener("hanko-login", this._handleExternalLogin);
  }

  private _handleVisibilityChange = () => {
    if (!document.hidden && !this.showProfile && !this.user) {
      // Page became visible, we're in header mode, and no user is logged in
      // Re-check session in case user logged in elsewhere
      this.log("👁️ Page visible, re-checking session...");
      this.checkSession();
    }
  };

  private _handleWindowFocus = () => {
    if (!this.showProfile && !this.user) {
      // Window focused, we're in header mode, and no user is logged in
      // Re-check session in case user logged in
      this.log("🎯 Window focused, re-checking session...");
      this.checkSession();
    }
  };

  private _handleExternalLogin = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (!this.showProfile && !this.user && customEvent.detail?.user) {
      // Another component (e.g., login page) logged in
      this.log("🔔 External login detected, updating user state...");
      this.user = customEvent.detail.user;
      // Also re-check OSM connection
      this.checkOSMConnection();
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
    // If base-path attribute is explicitly set (even if empty string), use it
    if (this.hasAttribute("base-path")) {
      this.log("🔍 getBasePath() using attribute:", this.basePath);
      return this.basePath || "";
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

  private async detectTrailingSlash(
    basePath: string,
    endpoint: string
  ): Promise<boolean> {
    if (this._trailingSlashCache[basePath] !== undefined) {
      this.log(
        `🔍 Using cached trailing slash preference for ${basePath}: ${this._trailingSlashCache[basePath]}`
      );
      return this._trailingSlashCache[basePath];
    }

    const origin = window.location.origin;
    const pathWithoutSlash = `${basePath}${endpoint}`;

    this.log("🔍 Auto-detecting trailing slash preference...");
    this.log(`  Testing: ${origin}${pathWithoutSlash}`);

    try {
      const response = await fetch(`${origin}${pathWithoutSlash}`, {
        method: "GET",
        credentials: "include",
        redirect: "follow",
      });

      const finalUrl = new URL(response.url);
      const finalPath = finalUrl.pathname;

      this.log(`  Original path: ${pathWithoutSlash}`);
      this.log(`  Final path: ${finalPath}`);

      if (!pathWithoutSlash.endsWith("/") && finalPath.endsWith("/")) {
        this.log(
          `  ✅ Detected trailing slash needed (redirected to ${finalPath})`
        );
        this._trailingSlashCache[basePath] = true;
        return true;
      }

      this.log("  ✅ Detected no trailing slash needed");
      this._trailingSlashCache[basePath] = false;
      return false;
    } catch (error) {
      console.error("  ❌ Error during trailing slash detection:", error);
      this._trailingSlashCache[basePath] = false;
      return false;
    }
  }

  private async init() {
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
      await this.checkOSMConnection();
      this.loading = false;
      this.setupEventListeners();
    } catch (error: any) {
      console.error("Failed to initialize hanko-auth:", error);
      this.error = error.message;
      this.loading = false;
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

            if (meResponse.ok) {
              const userData = await meResponse.json();
              this.log("👤 User data retrieved from /me:", userData);

              this.user = {
                id: userData.user_id,
                email: userData.email || null,
                username: userData.username || null,
                emailVerified: false,
              };
            } else {
              this.log("⚠️ /me endpoint failed, trying SDK fallback");
              // Fallback to SDK method
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
            const verifyKey = `hanko-verified-${window.location.hostname}`;
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
            await this.checkOSMConnection();
            if (this.osmRequired && this.autoConnect && !this.osmConnected) {
              console.log(
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
    }
  }

  private async syncJWTToCookie() {
    try {
      const jwt = this._sessionJWT;

      if (jwt) {
        const hostname = window.location.hostname;
        const isLocalhost =
          hostname === "localhost" || hostname === "127.0.0.1";
        const domainPart = isLocalhost
          ? `; domain=${hostname}`
          : `; domain=.hotosm.org`;

        document.cookie = `hanko=${jwt}; path=/${domainPart}; max-age=86400; SameSite=Lax; Secure`;
        console.log(
          `🔐 JWT synced to cookie for SSO${
            isLocalhost ? ` (domain=${hostname})` : " (domain=.hotosm.org)"
          }`
        );
      } else {
        console.log("⚠️ No JWT found in session event");
      }
    } catch (error) {
      console.error("Failed to sync JWT to cookie:", error);
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

      console.log("🔍 Checking OSM connection at:", statusUrl);
      console.log("  basePath:", basePath);
      console.log("  authPath:", authPath);
      console.log("🍪 Current cookies:", document.cookie);

      const response = await fetch(statusUrl, {
        credentials: "include",
        redirect: "follow",
      });

      console.log("📡 OSM status response:", response.status);
      console.log("📡 Final URL after redirects:", response.url);
      console.log("📡 Response headers:", [...response.headers.entries()]);

      if (response.ok) {
        const text = await response.text();
        this.log("📡 OSM raw response:", text.substring(0, 200));

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error(
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
      console.error("OSM connection check failed:", error);
    } finally {
      if (!wasLoading) {
        this.osmLoading = false;
      }
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

    this._sessionJWT = event.detail?.jwt || null;

    if (!this._hanko) {
      console.error("Hanko instance not initialized");
      return;
    }

    // Try to get user info from /me endpoint first (preferred)
    try {
      const meResponse = await fetch(`${this.hankoUrl}/me`, {
        method: "GET",
        credentials: "include", // Include httpOnly cookies
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (meResponse.ok) {
        const userData = await meResponse.json();
        this.log("👤 User data retrieved from /me:", userData);

        this.user = {
          id: userData.user_id,
          email: userData.email || null,
          username: userData.username || null,
          emailVerified: false,
        };
      } else {
        this.log("⚠️ /me endpoint failed, trying SDK fallback");
        // Fallback to SDK method
        const user = await this._hanko.user.getCurrent();
        this.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          emailVerified: user.email_verified || false,
        };
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      // If both fail, we can't get user data
      this.user = null;
      return;
    }

    this.log("✅ User state updated:", this.user);

    this.dispatchEvent(
      new CustomEvent("hanko-login", {
        detail: { user: this.user },
        bubbles: true,
        composed: true,
      })
    );

    // Check OSM connection before deciding redirect
    await this.checkOSMConnection();

    // Auto-connect to OSM if required and auto-connect is enabled
    if (this.osmRequired && this.autoConnect && !this.osmConnected) {
      console.log("🔄 Auto-connecting to OSM...");
      this.handleOSMConnect();
      return; // Exit early - redirect will happen after OSM OAuth callback
    }

    // Only redirect if OSM is not required OR if OSM is connected
    const canRedirect = !this.osmRequired || this.osmConnected;

    console.log(
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

      if (this.redirectAfterLogin && this.showProfile) {
        console.log("✅ Redirecting to:", this.redirectAfterLogin);
        window.location.href = this.redirectAfterLogin;
      } else {
        console.log(
          "❌ No redirect (redirectAfterLogin:",
          this.redirectAfterLogin,
          "showProfile:",
          this.showProfile,
          ")"
        );
      }
    } else {
      console.log("⏸️ Waiting for OSM connection before redirect");
    }
  }

  private async handleOSMConnect() {
    const scopes = this.osmScopes.split(" ").join("+");
    const basePath = this.getBasePath();
    const authPath = this.authPath;

    // Simple path construction
    const loginPath = `${basePath}${authPath}/login`;
    const fullUrl = `${loginPath}?scopes=${scopes}`;

    console.log("🔗 OSM Connect clicked!");
    console.log("  basePath:", basePath);
    console.log("  authPath:", authPath);
    console.log("  Login path:", fullUrl);
    console.log("  Fetching redirect URL from backend...");

    try {
      // Use fetch with credentials to get the redirect URL
      // The backend will return a RedirectResponse which fetch will follow
      const response = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
        redirect: "manual", // Don't follow redirect, we'll do it manually
      });

      console.log("  Response status:", response.status);
      console.log("  Response type:", response.type);

      if (response.status === 0 || response.type === "opaqueredirect") {
        // This is a redirect response
        const redirectUrl = response.headers.get("Location") || response.url;
        console.log("  ✅ Got redirect URL:", redirectUrl);
        window.location.href = redirectUrl;
      } else if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get("Location");
        console.log("  ✅ Got redirect URL from header:", redirectUrl);
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      } else {
        console.error("  ❌ Unexpected response:", response.status);
        const text = await response.text();
        console.error("  Response body:", text.substring(0, 200));
      }
    } catch (error) {
      console.error("  ❌ Failed to fetch redirect URL:", error);
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
      const origin = window.location.origin;
      const disconnectPath = this.addTrailingSlash(
        `${basePath}${authPath}/disconnect`,
        basePath
      );
      const disconnectUrl = `${origin}${disconnectPath}`;
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
      console.error("❌ OSM disconnect failed:", error);
    }

    if (this._hanko) {
      try {
        await this._hanko.user.logout();
        this.log("✅ Hanko logout successful");
      } catch (error) {
        console.error("Hanko logout failed:", error);
      }
    }

    const hostname = window.location.hostname;
    document.cookie = `hanko=; path=/; domain=${hostname}; max-age=0`;
    document.cookie = "hanko=; path=/; max-age=0";
    document.cookie = `osm_connection=; path=/; domain=${hostname}; max-age=0`;
    document.cookie = "osm_connection=; path=/; max-age=0";

    this.log("🍪 Cookies cleared");

    // Clear session verification flag so next login triggers verification
    const verifyKey = `hanko-verified-${window.location.hostname}`;
    sessionStorage.removeItem(verifyKey);
    this.log("🔄 Session verification flag cleared");

    this.user = null;
    this.osmConnected = false;
    this.osmData = null;

    this.dispatchEvent(
      new CustomEvent("logout", {
        bubbles: true,
        composed: true,
      })
    );

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

  private async handleSessionExpired() {
    console.log("🆕🆕🆕 NEW CODE RUNNING - handleSessionExpired v3.0 🆕🆕🆕");
    console.log("🕒 Session expired - cleaning up state");
    console.log("📊 State before cleanup:", {
      user: this.user,
      osmConnected: this.osmConnected,
    });

    // Call OSM disconnect endpoint to clear httpOnly cookie
    try {
      const basePath = this.getBasePath();
      const authPath = this.authPath;
      const origin = window.location.origin;
      const disconnectPath = this.addTrailingSlash(
        `${basePath}${authPath}/disconnect`,
        basePath
      );
      const disconnectUrl = `${origin}${disconnectPath}`;
      console.log(
        "🔌 Calling OSM disconnect (session expired):",
        disconnectUrl
      );

      const response = await fetch(disconnectUrl, {
        method: "POST",
        credentials: "include",
      });

      console.log("📡 Disconnect response status:", response.status);
      const data = await response.json();
      console.log("📡 Disconnect response data:", data);
      console.log("✅ OSM disconnected");
    } catch (error) {
      console.error("❌ OSM disconnect failed:", error);
    }

    // Clear user state
    this.user = null;
    this.osmConnected = false;
    this.osmData = null;

    // Clear cookies
    const hostname = window.location.hostname;
    document.cookie = `hanko=; path=/; domain=${hostname}; max-age=0`;
    document.cookie = "hanko=; path=/; max-age=0";
    document.cookie = `osm_connection=; path=/; domain=${hostname}; max-age=0`;
    document.cookie = "osm_connection=; path=/; max-age=0";

    console.log("🍪 Cookies cleared after session expiration");

    // Clear session verification flag so next login triggers verification
    const verifyKey = `hanko-verified-${window.location.hostname}`;
    sessionStorage.removeItem(verifyKey);
    console.log("🔄 Session verification flag cleared");

    // Dispatch logout event
    this.dispatchEvent(
      new CustomEvent("logout", {
        bubbles: true,
        composed: true,
      })
    );

    console.log("✅ Session cleanup complete");

    // Redirect after session expired if configured
    if (this.redirectAfterLogout) {
      console.log(
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
      window.location.href = "/profile";
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
    console.log(
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
      const displayName = this.user.username || this.user.email || this.user.id;
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
                    ${this.user.username || this.user.email || "User"}
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
              <div class="profile-name">${this.user.username || "User"}</div>
              <div class="profile-email">
                ${this.user.email || this.user.id}
              </div>
            </div>
            <wa-dropdown-item value="profile">
              <wa-icon slot="icon" name="user"></wa-icon>
              My Profile
            </wa-dropdown-item>
            ${this.osmConnected
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
                `}
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
        console.log("🔗 Login URL base:", baseUrl);
        const loginUrl = `${baseUrl}/app?return_to=${encodeURIComponent(
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
