// aethelarch_avx2.c
// Aethelarch Core (Host x86_64 AVX2 / FMA Acceleration)
// Counterpart to Dalton Rosenberg's Aethelarch NEON engine for Windows x86_64
// Targeted for Intel Core i7 / AMD Ryzen (HP EliteBook / Lenovo Yoga 7)

#include <immintrin.h>
#include <stddef.h>

// x86_64 AVX2 / FMA3 optimization for matrix-vector multiplication (8 floats per vector)
void aethelarch_simd_avx2(float* result, const float* matrix, const float* vector, size_t dim) {
    for (size_t i = 0; i < dim; i++) {
        __m256 sum_vec = _mm256_setzero_ps();

        size_t j = 0;
        for (; j + 8 <= dim; j += 8) {
            __m256 mat_vec = _mm256_loadu_ps(&matrix[i * dim + j]);
            __m256 vec_vec = _mm256_loadu_ps(&vector[j]);
            sum_vec = _mm256_fmadd_ps(mat_vec, vec_vec, sum_vec);
        }

        // Horizontal accumulation across 256-bit AVX2 register
        __m128 hi = _mm256_extractf128_ps(sum_vec, 1);
        __m128 lo = _mm256_castps256_ps128(sum_vec);
        __m128 sum128 = _mm_add_ps(lo, hi);
        sum128 = _mm_hadd_ps(sum128, sum128);
        sum128 = _mm_hadd_ps(sum128, sum128);

        float accumulator = _mm_cvtss_f32(sum128);

        // Process scalar remainder
        for (; j < dim; j++) {
            accumulator += matrix[i * dim + j] * vector[j];
        }

        result[i] = accumulator;
    }
}
