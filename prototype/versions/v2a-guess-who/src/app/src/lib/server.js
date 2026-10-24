import { Platform } from "react-native";

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

/** True once ip/port look like a real Mission Control address (not a half-typed IP). */
export function isUsableServer(server) {
  if (!server?.ip || !server?.port) return false;
  const ip = String(server.ip).trim();
  return (IPV4.test(ip) || ip === "localhost") && /^\d{2,5}$/.test(String(server.port).trim());
}

export const httpUrl = ({ ip, port }) => `http://${String(ip).trim()}:${String(port).trim()}`;
export const sceneUrl = (server) => `${httpUrl(server)}/scene?role=participant`;

/** Web only: `?server=ip:port` in the page URL (e.g. a link from Mission Control). */
export function serverFromUrlParam() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("server");
  if (!raw) return null;
  const [ip, port] = raw.split(":");
  const server = { ip, port: port || "4000" };
  return isUsableServer(server) ? server : null;
}
