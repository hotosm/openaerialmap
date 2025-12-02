import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface HankoUser {
  id: string;
  email: string | null;
  username: string | null;
  emailVerified: boolean;
}

interface OSMConnection {
  osm_username: string;
  osm_user_id: number;
  connected: boolean;
}

interface AuthContextType {
  user: HankoUser | null;
  osmConnection: OSMConnection | null;
  isLogin: boolean; // Computed from user !== null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// OSM routes are centralized in Login service
const LOGIN_SERVICE_URL = import.meta.env.VITE_LOGIN_URL || "https://login.hotosm.test";

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<HankoUser | null>(null);
  const [osmConnection, setOsmConnection] = useState<OSMConnection | null>(
    null
  );

  useEffect(() => {
    // Check initial OSM connection status from Login service
    const checkOsmStatus = async () => {
      try {
        const response = await fetch(`${LOGIN_SERVICE_URL}/api/auth/osm/status`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.connected) {
            console.log("AuthContext: Initial OSM status - connected", data);
            setOsmConnection({
              osm_username: data.osm_username,
              osm_user_id: data.osm_user_id,
              connected: true,
            });
          }
        }
      } catch (error) {
        console.error("AuthContext: Failed to check OSM status", error);
      }
    };

    // Check OSM status on mount
    checkOsmStatus();

    // Listen to hanko-login event from web component
    const handleLogin = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("AuthContext: hanko-login event received", customEvent.detail);
      setUser(customEvent.detail.user);
      // Re-check OSM status after login
      checkOsmStatus();
    };

    // Listen to logout event from web component
    const handleLogout = () => {
      console.log("AuthContext: logout event received");
      setUser(null);
      setOsmConnection(null);
    };

    // Listen to osm-connected event from web component
    const handleOsmConnected = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(
        "AuthContext: osm-connected event received",
        customEvent.detail
      );
      setOsmConnection(customEvent.detail.osmData);
    };

    // Add event listeners
    document.addEventListener("hanko-login", handleLogin);
    document.addEventListener("logout", handleLogout);
    document.addEventListener("osm-connected", handleOsmConnected);

    // Cleanup
    return () => {
      document.removeEventListener("hanko-login", handleLogin);
      document.removeEventListener("logout", handleLogout);
      document.removeEventListener("osm-connected", handleOsmConnected);
    };
  }, []);

  const value = {
    user,
    osmConnection,
    isLogin: user !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
