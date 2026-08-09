interface DriveConnection {
  remote: unknown;
  status: number;
}
interface NativeBridge {
  getDriveConnection(drive: string, bufferChars: number): DriveConnection;
}
declare const nativeBridge: NativeBridge;
export = nativeBridge;
