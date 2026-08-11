const { Buffer } = require("node:buffer");

let connectionApi, fileApi;
function getDriveConnection(drive, bufferChars) {
  if (connectionApi === undefined) {
    const koffi = require("koffi"),
      getConnectionW = koffi
        .load("mpr.dll")
        .func(
          "uint32_t WNetGetConnectionW(const char16_t *lpLocalName, _Out_ char16_t *lpRemoteName, _Inout_ uint32_t *lpnLength)",
        );
    connectionApi = { getConnectionW, koffi };
  }
  const buffer = Buffer.alloc(bufferChars * 2),
    length = [bufferChars],
    status = connectionApi.getConnectionW(drive, buffer, length),
    remote = status === 0 ? connectionApi.koffi.decode(buffer, "char16_t", bufferChars) : undefined;
  return { remote, status };
}
function getFileAttributes(filePath) {
  if (fileApi === undefined) {
    const koffi = require("koffi"),
      kernel32 = koffi.load("kernel32.dll"),
      fileTime = koffi.struct({
        highDateTime: "uint32_t",
        lowDateTime: "uint32_t",
      }),
      findData = koffi.struct({
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
      findClose: kernel32.func("FindClose", "bool", ["void *"]),
      findFirstFileW: kernel32.func("FindFirstFileW", "void *", [
        "const char16_t *",
        koffi.out(koffi.pointer(findData)),
      ]),
      getLastError: kernel32.func("uint32_t GetLastError(void)"),
    };
  }
  const data = {},
    handle = fileApi.findFirstFileW(filePath, data);
  if (
    handle === null ||
    handle === undefined ||
    handle === -1 ||
    handle === -1n ||
    handle === 0xff_ff_ff_ffn ||
    handle === 0xff_ff_ff_ff_ff_ff_ff_ffn
  ) {
    return { attributes: 0xff_ff_ff_ff, error: fileApi.getLastError() };
  }
  const closed = fileApi.findClose(handle);
  if (!closed) {
    throw new Error(`FindClose failed with error ${fileApi.getLastError()}`);
  }
  return { attributes: data.fileAttributes, error: 0 };
}
module.exports = { getDriveConnection, getFileAttributes };
