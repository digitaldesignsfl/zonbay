// aethelarch_neon.c
// Aethelarch Core (Mobile SIMD Execution)
// Authored by Dalton Rosenberg / Project Nexus
// Targeted for ARM64 (Samsung Galaxy via Termux / Raspberry Pi 5)

#include <arm_neon.h>
#include <stddef.h>

// ARM64 NEON optimization for matrix-vector multiplication
void aethelarch_simd_mac(float* result, const float* matrix, const float* vector, size_t dim) {
    for (size_t i = 0; i < dim; i++) {
        float32x4_t sum_vec = vdupq_n_f32(0.0f);
        
        for (size_t j = 0; j < dim; j += 4) {
            float32x4_t mat_vec = vld1q_f32(&matrix[i * dim + j]);
            float32x4_t vec_vec = vld1q_f32(&vector[j]);
            sum_vec = vmlaq_f32(sum_vec, mat_vec, vec_vec);
        }
        
        // Horizontal add to accumulate the SIMD register
        float accumulator = vgetq_lane_f32(sum_vec, 0) + 
                            vgetq_lane_f32(sum_vec, 1) + 
                            vgetq_lane_f32(sum_vec, 2) + 
                            vgetq_lane_f32(sum_vec, 3);
                            
        result[i] = accumulator;
    }
}
