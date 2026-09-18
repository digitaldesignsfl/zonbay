use std::sync::atomic::{AtomicU64, Ordering};

#[repr(C, align(64))]
pub struct SeqlockHeader {
    pub sequence: AtomicU64,
}

impl SeqlockHeader {
    pub fn read_begin(&self) -> u64 {
        loop {
            let seq = self.sequence.load(Ordering::Acquire);
            if seq & 1 == 0 {
                return seq;
            }
            std::hint::spin_loop();
        }
    }

    pub fn read_retry(&self, initial: u64) -> bool {
        std::sync::atomic::fence(Ordering::Acquire);
        self.sequence.load(Ordering::Acquire) != initial
    }

    pub fn write_lock(&self) {
        let seq = self.sequence.load(Ordering::Relaxed);
        self.sequence.store(seq + 1, Ordering::Release);
    }

    pub fn write_unlock(&self) {
        let seq = self.sequence.load(Ordering::Relaxed);
        self.sequence.store(seq + 1, Ordering::Release);
    }
}
