/**
 * NeuroCalm & Fokus — Procedural Noise DSP Core
 * Production DSP Source of Truth for White, Pink, and Brown Noise Generators.
 *
 * All generators accept an optional deterministic PRNG `randomSource: () => number`
 * returning uniform float values in [0, 1). Default is `Math.random`.
 */

export interface NoiseGenerator {
  reset(): void;
  generateBlock(outputArray: Float32Array | number[], length?: number): void;
}

/**
 * White Noise Generator
 * Bounded white noise in [-0.25, 0.25]
 */
export class WhiteNoiseGenerator implements NoiseGenerator {
  private randomSource: () => number;

  constructor(randomSource: () => number = Math.random) {
    this.randomSource = randomSource;
    this.reset();
  }

  public reset(): void {
    // White noise holds no recursive filter history
  }

  public generateBlock(outputArray: Float32Array | number[], length = 128): void {
    for (let i = 0; i < length; i++) {
      outputArray[i] = (this.randomSource() * 2 - 1) * 0.25;
    }
  }
}

/**
 * Pink Noise Generator
 * Paul Kellet's Refined 6-State (7-Variable) Filter
 * Input bounded to [-0.25, 0.25], linear output scaling 0.04
 */
export class PinkNoiseGenerator implements NoiseGenerator {
  private randomSource: () => number;
  private b0 = 0.0;
  private b1 = 0.0;
  private b2 = 0.0;
  private b3 = 0.0;
  private b4 = 0.0;
  private b5 = 0.0;
  private b6 = 0.0;

  constructor(randomSource: () => number = Math.random) {
    this.randomSource = randomSource;
    this.reset();
  }

  public reset(): void {
    this.b0 = 0.0;
    this.b1 = 0.0;
    this.b2 = 0.0;
    this.b3 = 0.0;
    this.b4 = 0.0;
    this.b5 = 0.0;
    this.b6 = 0.0;
  }

  public generateBlock(outputArray: Float32Array | number[], length = 128): void {
    for (let i = 0; i < length; i++) {
      const white = (this.randomSource() * 2 - 1) * 0.25;
      this.b0 = 0.99886 * this.b0 + white * 0.0555179;
      this.b1 = 0.99332 * this.b1 + white * 0.0750759;
      this.b2 = 0.969 * this.b2 + white * 0.153852;
      this.b3 = 0.8665 * this.b3 + white * 0.3104856;
      this.b4 = 0.55 * this.b4 + white * 0.5329522;
      this.b5 = -0.7616 * this.b5 - white * 0.016898;
      outputArray[i] =
        (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) *
        0.04;
      this.b6 = white * 0.115926;
    }
  }
}

/**
 * Brown Noise Generator
 * First-Order Leaky Integrator: brownY = 0.998 * brownY + 0.05 * white
 * Input bounded to [-0.25, 0.25], linear output scaling 0.12
 */
export class BrownNoiseGenerator implements NoiseGenerator {
  private randomSource: () => number;
  private brownY = 0.0;

  constructor(randomSource: () => number = Math.random) {
    this.randomSource = randomSource;
    this.reset();
  }

  public reset(): void {
    this.brownY = 0.0;
  }

  public generateBlock(outputArray: Float32Array | number[], length = 128): void {
    for (let i = 0; i < length; i++) {
      const white = (this.randomSource() * 2 - 1) * 0.25;
      this.brownY = 0.998 * this.brownY + 0.05 * white;
      outputArray[i] = this.brownY * 0.12;
    }
  }
}

/**
 * Violet (Purple) Noise Generator
 * First-Order High-Pass Differentiator: y[n] = 0.5 * (white[n] - white[n-1])
 * Power Spectral Density: S(f) proportional to f^2 (+6.02 dB/octave slope)
 *
 * Mathematical Bound:
 * For white[n] in [-0.25, 0.25], the theoretical maximum peak is:
 * ||h||_1 = 0.5 * (|1| + |-1|) = 1.0
 * max|y[n]| <= 1.0 * 0.25 = 0.2500 <= 0.7500 (Strictly Bounded)
 */
export class VioletNoiseGenerator implements NoiseGenerator {
  private randomSource: () => number;
  private x1 = 0.0;

  constructor(randomSource: () => number = Math.random) {
    this.randomSource = randomSource;
    this.reset();
  }

  public reset(): void {
    this.x1 = 0.0;
  }

  public generateBlock(outputArray: Float32Array | number[], length = 128): void {
    for (let i = 0; i < length; i++) {
      const rand = this.randomSource();
      const white = (Number.isFinite(rand) ? rand * 2 - 1 : 0) * 0.25;
      const diff = (white - this.x1) * 0.5;
      this.x1 = white;
      outputArray[i] = Number.isFinite(diff) ? diff : 0.0;
    }
  }
}
