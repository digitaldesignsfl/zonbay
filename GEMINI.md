# Project Nexus & Sovereign Hive — Architectural Directives

## 1. System Identity & Mission
* **Lead Architect:** Dalton Rosenberg
* **Role:** Antigravity AI Co-Architect & Systems Engineer
* **Operating Paradigm:** Independent systems architecture, ultra-high-performance systems programming (Rust, C++, Node.js), and autonomous multi-agent AI orchestration.
* **Target Hardware Array:** Cross-platform distributed edge topology spanning:
  - Windows Host Workstation (x86_64, HP EliteBook / Lenovo Yoga 7)
  - Mobile Edge Nodes (Samsung Galaxy running Termux / Sentinel-AURA)
  - Edge Compute Nodes (Raspberry Pi 5, Dell Wyse thin clients)

---

## 2. IPC & Compute Infrastructure: MMCL & Silicon Engine
* **Memory-Mapped Causal Lattice (MMCL):**
  - Ultra-low latency, zero-copy Inter-Process Communication (IPC) protocol.
  - **Shared Memory Region:** Windows Named File Mapping `Local\MMCL_Sovereign_State` (16 MB default capacity), POSIX `shm_open` on Linux/Android.
  - **Cache Line Alignment:** Strict 64-byte alignment (`#[repr(C, align(64))]`) to eliminate false sharing and cache-line bouncing across CPU cores.
  - **Seqlock Protocol:** Lock-free, multi-reader single-writer synchronization using atomic sequence counters. Odd sequence = write in progress; even sequence = stable state.
  - **Layout Specification:**
    - `0x00 - 0x3F` (64 bytes): Seqlock Header (sequence counter, lock state, epoch)
    - `0x40 - 0x7F` (64 bytes): Ring Buffer Control (write pointer, read pointer, mask)
    - `0x80 - 0xBF` (64 bytes): Slab Allocator Control (free list head, slab count)
    - `0xC0+`: Zero-copy ring buffer data & payload slabs

* **Silicon Engine:**
  - SIMD-accelerated data filtering, vector transformations, and memory-mapped slab structures.
  - Pure zero-copy V8 buffer bridging into Node.js runtime (`mmcl/mmcl_view.js` and `mmcl_bridge`).

---

## 3. Autonomous Agent Swarm Protocols
* **Peer Node Identity:** `Sentinel-AURA` (Dalton's agent on Android Termux).
* **Host Node Identity:** `Zonbay-Antigravity` (Windows host).
* **Communication Channel:** Authenticated Swarm Gateway via Cloudflare Tunnel QUIC protocol and local LAN.
* **Security Constraints:**
  - Authentication enforced via `X-Swarm-Secret` header or `?secret=` query parameter.
  - Strict path traversal prevention: all crate integrations confined strictly to `mmcl/` or `swarm_crates/`.
  - Source-only crate handoffs: dynamic compilation or inspection; no arbitrary precompiled executable execution.

---

## 4. Development & Engineering Standards
* On Windows, invoke scripts via `npm.cmd` and `npx.cmd`.
* Keep shared memory offsets strictly synchronized across Rust (`mmcl/src/*.rs`) and Node.js (`mmcl/mmcl_view.js`).
* All unit tests must pass deterministically without network or hardware assumptions (`node test_run.js`).
