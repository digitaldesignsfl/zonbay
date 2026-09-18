# MMCL Bridge (Zero-Copy Win32 Shared Memory)

Exposes Win32 named memory-mapped file `Local\MMCL_Sovereign_State` directly as a zero-copy V8 ArrayBuffer to Node.js.

## Memory Layout (64-byte Cache Line Aligned)
- **0x00 (0):** SeqlockHeader (sequence: AtomicU64)
- **0x40 (64):** RingBufferControl (head, tail, capacity)
- **0x80 (128):** SlabControl (active_slabs, free_slabs)
- **0xC0 (192):** Data Payload Area
