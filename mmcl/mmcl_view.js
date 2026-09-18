/**
 * MMCL Zero-Copy Memory View for Node.js
 * Implements the 64-byte aligned cache-line layout specified by Sentinel AURA.
 */

const OFFSETS = {
    SEQLOCK_SEQ: 0,        // 0x00: 8 bytes (AtomicU64)
    RING_HEAD: 64,         // 0x40: 8 bytes (AtomicUsize)
    RING_TAIL: 72,         // 0x48: 8 bytes (AtomicUsize)
    RING_CAPACITY: 80,     // 0x50: 8 bytes (usize)
    SLAB_ACTIVE: 128,      // 0x80: 8 bytes (AtomicUsize)
    SLAB_FREE: 136,        // 0x88: 8 bytes (AtomicUsize)
    DATA_PAYLOAD: 192      // 0xC0: Data Payload Area
};

class MmclMemoryView {
    constructor(buffer) {
        if (!buffer || buffer.length < OFFSETS.DATA_PAYLOAD) {
            throw new Error(`Buffer size too small for MMCL header (must be >= ${OFFSETS.DATA_PAYLOAD} bytes)`);
        }
        this.buffer = buffer;
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    // 1. Seqlock Synchronization (Optimistic Concurrency)
    getSequence() {
        return this.dataView.getBigUint64(OFFSETS.SEQLOCK_SEQ, true);
    }

    setSequence(val) {
        this.dataView.setBigUint64(OFFSETS.SEQLOCK_SEQ, BigInt(val), true);
    }

    isWriteLocked() {
        return (this.getSequence() & 1n) === 1n;
    }

    // 2. Ring Buffer Control
    getRingHead() {
        return this.dataView.getBigUint64(OFFSETS.RING_HEAD, true);
    }

    setRingHead(val) {
        this.dataView.setBigUint64(OFFSETS.RING_HEAD, BigInt(val), true);
    }

    getRingTail() {
        return this.dataView.getBigUint64(OFFSETS.RING_TAIL, true);
    }

    setRingTail(val) {
        this.dataView.setBigUint64(OFFSETS.RING_TAIL, BigInt(val), true);
    }

    getCapacity() {
        return this.dataView.getBigUint64(OFFSETS.RING_CAPACITY, true);
    }

    setCapacity(val) {
        this.dataView.setBigUint64(OFFSETS.RING_CAPACITY, BigInt(val), true);
    }

    // 3. Slab Allocation Tracking
    getActiveSlabs() {
        return this.dataView.getBigUint64(OFFSETS.SLAB_ACTIVE, true);
    }

    setActiveSlabs(val) {
        this.dataView.setBigUint64(OFFSETS.SLAB_ACTIVE, BigInt(val), true);
    }

    getFreeSlabs() {
        return this.dataView.getBigUint64(OFFSETS.SLAB_FREE, true);
    }

    setFreeSlabs(val) {
        this.dataView.setBigUint64(OFFSETS.SLAB_FREE, BigInt(val), true);
    }

    // 4. Zero-Copy Data Payload Access
    writePayload(offset, data) {
        const target = OFFSETS.DATA_PAYLOAD + offset;
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (target + buf.length > this.buffer.length) {
            throw new RangeError("Payload exceeds mapped MMCL buffer capacity");
        }
        buf.copy(this.buffer, target);
        return buf.length;
    }

    readPayload(offset, length) {
        const target = OFFSETS.DATA_PAYLOAD + offset;
        return this.buffer.subarray(target, target + length);
    }

    // Snapshot layout state
    getLayoutState() {
        return {
            sequence: this.getSequence().toString(),
            writeLocked: this.isWriteLocked(),
            ringHead: this.getRingHead().toString(),
            ringTail: this.getRingTail().toString(),
            ringCapacity: this.getCapacity().toString(),
            activeSlabs: this.getActiveSlabs().toString(),
            freeSlabs: this.getFreeSlabs().toString(),
            payloadOffset: OFFSETS.DATA_PAYLOAD,
            totalBufferSize: this.buffer.length
        };
    }
}

module.exports = { MmclMemoryView, OFFSETS };
