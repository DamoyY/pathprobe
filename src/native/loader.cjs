const { Buffer } = require("node:buffer");
const koffi = require("koffi");

const getConnectionW = koffi
  .load("mpr.dll")
  .func(
    "uint32_t WNetGetConnectionW(const char16_t *lpLocalName, _Out_ char16_t *lpRemoteName, _Inout_ uint32_t *lpnLength)",
  );
function getDriveConnection(drive, bufferChars) {
  const buffer = Buffer.alloc(bufferChars * 2);
  const length = [bufferChars];
  const status = getConnectionW(drive, buffer, length);
  const remote = status === 0 ? koffi.decode(buffer, "char16_t", bufferChars) : undefined;
  return { remote, status };
}
module.exports = { getDriveConnection };
