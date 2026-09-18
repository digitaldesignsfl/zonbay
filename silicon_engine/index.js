/**
 * Silicon Engine — Fast Vector Math & Context Lattice Operations
 * Implements high-throughput matrix-vector operations and cosine similarity
 * designed to align with Dalton Rosenberg's Aethelarch Core.
 */

function dotProduct(a, b) {
    const len = Math.min(a.length, b.length);
    let sum = 0.0;
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

function magnitude(vec) {
    let sum = 0.0;
    for (let i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}

function cosineSimilarity(a, b) {
    const magA = magnitude(a);
    const magB = magnitude(b);
    if (magA === 0 || magB === 0) return 0.0;
    return dotProduct(a, b) / (magA * magB);
}

function matrixVectorMultiply(matrix, vector, dim) {
    const result = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
        let acc = 0.0;
        const rowOffset = i * dim;
        for (let j = 0; j < dim; j++) {
            acc += matrix[rowOffset + j] * vector[j];
        }
        result[i] = acc;
    }
    return result;
}

module.exports = {
    dotProduct,
    magnitude,
    cosineSimilarity,
    matrixVectorMultiply
};
