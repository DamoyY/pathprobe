import nodePath from "node:path";
import nativeBridge from "./windows-bridge.cjs";

const fileAttributeHidden = 0x2,
  invalidFileAttributes = 0xff_ff_ff_ff;
const missingPathErrors = new Set([2, 3]);
export function hasWindowsHiddenAttribute(filePath: string): boolean {
  if (process.platform !== "win32") {
    throw new Error("Windows file attributes are unavailable on this platform");
  }
  const { attributes, error } = nativeBridge.getFileAttributes(nodePath.toNamespacedPath(filePath));
  if (!Number.isInteger(attributes) || !Number.isInteger(error)) {
    throw new TypeError("Windows file attribute lookup returned an invalid result");
  }
  if (attributes !== invalidFileAttributes) {
    if (error !== 0) {
      throw new Error(`Windows file attribute lookup returned attributes with error ${error}`);
    }
    return (attributes & fileAttributeHidden) !== 0;
  }
  if (missingPathErrors.has(error)) {
    return false;
  }
  throw new Error(`Windows file attribute lookup failed for ${filePath} with error ${error}`);
}
