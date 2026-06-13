import { Buffer } from 'node:buffer';
export * from 'node:buffer';

const BufferShim = Buffer;
(BufferShim as any).Buffer = BufferShim;

export default BufferShim;
