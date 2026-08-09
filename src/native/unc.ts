import { isIP } from "node:net";
import { hostname, networkInterfaces } from "node:os";
import nodePath from "node:path";

interface DriveConnection {
  remote: unknown;
  status: number;
}
interface NativeBridge {
  getDriveConnection(drive: string, bufferChars: number): DriveConnection;
}
const moduleApi = globalThis.process.getBuiltinModule("node:module");
const runtimeRequire = moduleApi.createRequire(import.meta.url);
const native =
  process.platform === "win32"
    ? (runtimeRequire("pathprobe/native-loader") as NativeBridge)
    : undefined;
const uncServerSegmentPattern = /^[^\\/:*?"<>|]+$/u;
const unmappedDriveErrors = new Set([1200, 1201, 1203, 1222, 2250]);
const errorMoreData = 234;
const mappingBufferChars = 32_768;
interface UncPath {
  canonical: string;
  server: string;
  share: string;
  suffix: string;
}
interface DriveMapping {
  drive: string;
  remote: string;
}
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
const localServerNames =
  process.platform === "win32" ? collectLocalServerNames() : new Set<string>();
let driveMappings: DriveMapping[] | undefined;
function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => character.charCodeAt(0) < 32);
}
function normalizeUncRoot(value: string): string {
  return value.replaceAll("/", "\\").replace(/\\+$/u, "").toLowerCase();
}
function parseUncPath(value: string): UncPath | undefined {
  const normalized = value.replaceAll("/", "\\");
  const extended = normalized.slice(0, 8).toLowerCase() === "\\\\?\\unc\\";
  if (normalized.startsWith("\\\\.\\") || (normalized.startsWith("\\\\?\\") && !extended)) {
    return undefined;
  }
  const serverStart = extended ? 8 : 2;
  const serverSeparator = normalized.slice(serverStart).indexOf("\\");
  if (serverSeparator <= 0) {
    return undefined;
  }
  const serverEnd = serverStart + serverSeparator;
  const shareStart = serverEnd + 1;
  const shareSeparator = normalized.slice(shareStart).indexOf("\\");
  const shareEnd = shareSeparator === -1 ? normalized.length : shareStart + shareSeparator;
  const server = normalized.slice(serverStart, serverEnd);
  const share = normalized.slice(shareStart, shareEnd);
  if (
    share.length === 0 ||
    !uncServerSegmentPattern.test(server) ||
    !uncServerSegmentPattern.test(share)
  ) {
    return undefined;
  }
  const suffix = normalized.slice(shareEnd);
  return {
    canonical: `\\\\${server}\\${share}${suffix}`,
    server,
    share,
    suffix,
  };
}
function queryDriveMapping(drive: string): string | undefined {
  if (native === undefined) {
    return undefined;
  }
  const { remote, status } = native.getDriveConnection(drive, mappingBufferChars);
  if (status === errorMoreData) {
    throw new Error(`WNetGetConnectionW returned an oversized mapping for ${drive}`);
  }
  if (unmappedDriveErrors.has(status)) {
    return undefined;
  }
  if (status !== 0) {
    throw new Error(`WNetGetConnectionW failed for ${drive} with error ${status}`);
  }
  if (typeof remote !== "string" || !remote.startsWith("\\\\")) {
    throw new TypeError(`WNetGetConnectionW returned an invalid mapping for ${drive}`);
  }
  return normalizeUncRoot(remote);
}
function queryDriveMappings(): DriveMapping[] {
  if (driveMappings !== undefined) {
    return driveMappings;
  }
  const result: DriveMapping[] = [];
  for (let code = "A".charCodeAt(0); code <= "Z".charCodeAt(0); code += 1) {
    const drive = `${String.fromCharCode(code)}:`;
    const remote = queryDriveMapping(drive);
    if (remote !== undefined) {
      result.push({ drive, remote });
    }
  }
  driveMappings = result.toSorted((left, right) => right.remote.length - left.remote.length);
  return driveMappings;
}
function resolveMappedUncPath(path: UncPath): string | undefined {
  const canonical = normalizeUncRoot(path.canonical);
  const mapping = queryDriveMappings().find(
    ({ remote }) => canonical === remote || canonical.startsWith(`${remote}\\`),
  );
  if (mapping === undefined) {
    return undefined;
  }
  const relative = path.canonical.slice(mapping.remote.length);
  return nodePath.win32.normalize(`${mapping.drive}${relative}`);
}
function isLocalServer(value: string): boolean {
  const normalized = normalizeServerName(value);
  return (
    localServerNames.has(normalized) ||
    (isIP(value) === 4 && value.split(".")[0] === "127") ||
    normalized === "--1.ipv6-literal.net"
  );
}
function resolveLocalAdministrativeShare(path: UncPath): string | undefined {
  const match = /^([A-Za-z])\$$/u.exec(path.share);
  if (match === null || !isLocalServer(path.server)) {
    return undefined;
  }
  return nodePath.win32.normalize(`${match[1]}:${path.suffix || "\\"}`);
}
export function resolveUncPath(value: string): string | undefined {
  if (process.platform !== "win32" || (!value.startsWith("\\\\") && !value.startsWith("//"))) {
    return value;
  }
  if (containsControlCharacter(value)) {
    return undefined;
  }
  const path = parseUncPath(value);
  if (path === undefined) {
    return undefined;
  }
  return resolveMappedUncPath(path) ?? resolveLocalAdministrativeShare(path);
}
