// mmcl_core.rs
// Silicon Engine & MMCL (Rust IPC & Memory Management)
// Authored by Dalton Rosenberg / Project Nexus

use std::sync::atomic::{AtomicUsize, AtomicBool, Ordering};
use std::cell::UnsafeCell;

// Cache-line aligned for zero-contention
#[repr(C, align(64))]
pub struct CacheAlignedSlab<T> {
    pub data: UnsafeCell<T>,
    pub sequence: AtomicUsize,
    pub locked: AtomicBool,
}

impl<T> CacheAlignedSlab<T> {
    pub fn new(initial: T) -> Self {
        Self {
            data: UnsafeCell::new(initial),
            sequence: AtomicUsize::new(0),
            locked: AtomicBool::new(false),
        }
    }
}

unsafe impl<T: Send> Send for CacheAlignedSlab<T> {}
unsafe impl<T: Sync> Sync for CacheAlignedSlab<T> {}

pub struct MemoryMappedCausalLattice {
    // Pointer to mmap'd shared memory region
    pub base_ptr: *mut u8,
    pub capacity: usize,
}

impl MemoryMappedCausalLattice {
    pub fn new(capacity: usize) -> Self {
        Self {
            base_ptr: std::ptr::null_mut(),
            capacity,
        }
    }

    // Seqlock read implementation for zero-copy IPC
    pub fn read_seqlock<T>(&self, slab: &CacheAlignedSlab<T>) -> Option<T> where T: Copy {
        let seq1 = slab.sequence.load(Ordering::Acquire);
        if seq1 % 2 != 0 {
            return None; // Currently being written
        }
        
        let data = unsafe { *slab.data.get() };
        
        let seq2 = slab.sequence.load(Ordering::Acquire);
        if seq1 == seq2 {
            Some(data)
        } else {
            None // Data changed during read
        }
    }

    // Seqlock write implementation
    pub fn write_seqlock<T>(&self, slab: &CacheAlignedSlab<T>, value: T) where T: Copy {
        let seq = slab.sequence.load(Ordering::Relaxed);
        slab.sequence.store(seq.wrapping_add(1), Ordering::Release);
        
        unsafe {
            *slab.data.get() = value;
        }

        slab.sequence.store(seq.wrapping_add(2), Ordering::Release);
    }
}
