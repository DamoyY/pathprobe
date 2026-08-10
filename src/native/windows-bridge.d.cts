interface DriveConnection {
  remote: unknown;
  status: number;
}
interface FileAttributes {
  attributes: number;
  error: number;
}
interface NativeBridge {
  getDriveConnection(drive: string, bufferChars: number): DriveConnection;
  getFileAttributes(filePath: string): FileAttributes;
}
declare const nativeBridge: NativeBridge;
export = nativeBridge;
