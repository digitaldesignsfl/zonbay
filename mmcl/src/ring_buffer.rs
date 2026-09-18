use std::sync::atomic::{AtomicUsize};

#[repr(C, align(64))]
pub struct RingBufferControl {
    pub head: AtomicUsize,
    pub tail: AtomicUsize,
    pub capacity: usize,
}

#[repr(C, align(64))]
pub struct SlabControl {
    pub active_slabs: AtomicUsize,
    pub free_slabs: AtomicUsize,
}
