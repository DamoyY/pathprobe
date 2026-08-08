import { isIP } from "node:net";
import { hostname, networkInterfaces } from "node:os";

const uncServerSegmentPattern = /^[^\\/:*?"<>|]+$/u;
function normalizeServerName(value: string): string {
  return value.replace(/\.+$/u, "").toLowerCase();
}
function addLocalServerName(names: Set<string>, value: string | undefined): void {
  if (value !== undefined && uncServerSegmentPattern.test(value)) {
    names.add(normalizeServerName(value));
  }
}
function addIpv6LiteralName(names: Set<string>, value: string): void {
  const zoneIndex = value.indexOf("%");
  const address = zoneIndex === -1 ? value : value.slice(0, zoneIndex);
  const zone = zoneIndex === -1 ? "" : `s${value.slice(zoneIndex + 1)}`;
  addLocalServerName(names, `${address.replaceAll(":", "-")}${zone}.ipv6-literal.net`);
}
function collectLocalServerNames(): Set<string> {
  const names = new Set<string>(["localhost"]);
  const computerName = process.env.COMPUTERNAME;
  addLocalServerName(names, hostname());
  addLocalServerName(names, computerName);
  if (computerName !== undefined && process.env.USERDNSDOMAIN !== undefined) {
    addLocalServerName(names, `${computerName}.${process.env.USERDNSDOMAIN}`);
  }
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (isIP(address.address) === 4) {
        addLocalServerName(names, address.address);
      } else if (isIP(address.address) === 6) {
        addIpv6LiteralName(names, address.address);
      }
    }
  }
  addLocalServerName(names, "--1.ipv6-literal.net");
  return names;
}
const localServerNames = collectLocalServerNames();
function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => character.charCodeAt(0) < 32);
}
export function resolveLocalUncPath(value: string): string | undefined {
  if (process.platform !== "win32" || !value.startsWith("\\\\")) {
    return value;
  }
  if (containsControlCharacter(value)) {
    return undefined;
  }
  const extended = value.slice(0, 8).toLowerCase() === "\\\\?\\unc\\";
  if (value.startsWith("\\\\.\\") || (value.startsWith("\\\\?\\") && !extended)) {
    return undefined;
  }
  const serverStart = extended ? 8 : 2;
  const serverSeparator = value.slice(serverStart).search(/[\\/]/u);
  if (serverSeparator <= 0) {
    return undefined;
  }
  const serverEnd = serverStart + serverSeparator;
  const shareStart = serverEnd + 1;
  const shareSeparator = value.slice(shareStart).search(/[\\/]/u);
  const shareEnd = shareSeparator === -1 ? value.length : shareStart + shareSeparator;
  const server = value.slice(serverStart, serverEnd);
  const share = value.slice(shareStart, shareEnd);
  if (
    share.length === 0 ||
    !uncServerSegmentPattern.test(server) ||
    !uncServerSegmentPattern.test(share)
  ) {
    return undefined;
  }
  const normalizedServer = normalizeServerName(server);
  const isLoopback =
    (isIP(server) === 4 && server.split(".")[0] === "127") ||
    normalizedServer === "--1.ipv6-literal.net";
  if (!isLoopback && !localServerNames.has(normalizedServer)) {
    return undefined;
  }
  const prefix = extended ? "\\\\?\\UNC\\" : "\\\\";
  return `${prefix}localhost${value.slice(serverEnd)}`;
}
