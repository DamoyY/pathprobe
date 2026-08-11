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
    const fileTime = koffi.struct({
      lowDateTime: "uint32_t",
      highDateTime: "uint32_t",
    });
    const findData = koffi.struct({
      fileAttributes: "uint32_t",
      creationTime: fileTime,
      lastAccessTime: fileTime,
      lastWriteTime: fileTime,
      fileSizeHigh: "uint32_t",
      fileSizeLow: "uint32_t",
      reserved0: "uint32_t",
      reserved1: "uint32_t",
      fileName: koffi.array("char16_t", 260, "String"),
      alternateFileName: koffi.array("char16_t", 14, "String"),
    });
    fileApi = {
      findFirstFileW: kernel32.func("FindFirstFileW", "void *", [
        "const char16_t *",
        koffi.out(koffi.pointer(findData)),
      ]),
      findClose: kernel32.func("FindClose", "bool", ["void *"]),
      getLastError: kernel32.func("uint32_t GetLastError(void)"),
    };
  }
  const data = {};
  const handle = fileApi.findFirstFileW(filePath, data);
  if (
    handle === null ||
    handle === undefined ||
    handle === -1 ||
    handle === -1n ||
    handle === 0xffffffffn ||
    handle === 0xffffffffffffffffn
  ) {
    return { attributes: 0xffffffff, error: fileApi.getLastError() };
  }
  const closed = fileApi.findClose(handle);
  if (!closed) {
    throw new Error(`FindClose failed with error ${fileApi.getLastError()}`);
  }
  return { attributes: data.fileAttributes, error: 0 };
}
module.exports = { getDriveConnection, getFileAttributes };
