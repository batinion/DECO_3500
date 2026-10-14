import { Platform } from "react-native";

// Where the server lives.
//  - Web, opened from the server itself (http://<laptop-ip>:4000): same origin. This is the
//    normal case — nobody types an IP or port.
//  - Web during development (expo start --web, port 8081/19006): ?server=ip:port or the
//    last address used, falling back to localhost:4000.
//  - Native (Expo Go): typed once under "Server address" on the join screen, then remembered.
const DEV_PORTS = ["8081", "19006", "19000"];

export function sameOriginServer() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const { hostname, port, protocol } = window.location;
  if (DEV_PORTS.includes(port)) return null;
  return { origin: `${protocol}//${window.location.host}`, ip: hostname, port: port || (protocol === "https:" ? "443" : "80") };
}

/** True once the address looks complete (not a half-typed IP). */
export function isUsableServer(server) {
  if (server?.origin) return true;
  if (!server?.ip || !server?.port) return false;
  const ip = String(server.ip).trim();
  return ip.length > 2 && !ip.endsWith(".") && /^\d{2,5}$/.test(String(server.port).trim());
}

export const httpUrl = (server) => (server.origin ? server.origin : `http://${String(server.ip).trim()}:${String(server.port).trim()}`);
export const sceneUrl = (server, code) => `${httpUrl(server)}/scene?role=participant${code ? `&code=${encodeURIComponent(code)}` : ""}`;

/** Web only: `?server=ip:port` in the page URL. */
export function serverFromUrlParam() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("server");
  if (!raw) return null;
  const [ip, port] = raw.split(":");
  const server = { ip, port: port || "4000" };
  return isUsableServer(server) ? server : null;
}

/** Web only: `?join=CODE` from an invite link. */
export function joinCodeFromUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("join") || "").toUpperCase();
}

/** The link a crewmate shares so friends land straight on the join form with the code filled in. */
export function inviteLink(server, code) {
  if (!server) return "";
  return `${httpUrl(server)}/?join=${encodeURIComponent(code)}`;
}
