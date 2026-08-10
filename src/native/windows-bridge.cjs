const { Buffer } = require("node:buffer");
let connectionApi;
let fileApi;
function getDriveConnection(drive, bufferChars) {
  if (connectionApi === undefined) {
    const koffi = require("koffi");
    const getConnectionW = koffi
      .load("mpr.dll")
      .func(
        "uint32_t WNetGetConnectionW(const char16_t *lpLocalName, _Out_ char16_t *lpRemoteName, _Inout_ uint32_t *lpnLength)",
      );
    connectionApi = { getConnectionW, koffi };
  }
  const buffer = Buffer.alloc(bufferChars * 2);
  const length = [bufferChars];
  const status = connectionApi.getConnectionW(drive, buffer, length);
  const remote =
    status === 0 ? connectionApi.koffi.decode(buffer, "char16_t", bufferChars) : undefined;
  return { remote, status };
}
function getFileAttributes(filePath) {
  if (fileApi === undefined) {
    const koffi = require("koffi");
    const kernel32 = koffi.load("kernel32.dll");
    fileApi = {
      getFileAttributesW: kernel32.func("uint32_t GetFileAttributesW(const char16_t *lpFileName)"),
      getLastError: kernel32.func("uint32_t GetLastError(void)"),
    };
  }
  const attributes = fileApi.getFileAttributesW(filePath);
  const error = attributes === 0xffffffff ? fileApi.getLastError() : 0;
  return { attributes, error };
}
module.exports = { getDriveConnection, getFileAttributes };
