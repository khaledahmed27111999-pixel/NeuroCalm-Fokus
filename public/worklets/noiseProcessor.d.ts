export type RandomSource = () => number;

export class WhiteNoiseGenerator {
  randomSource: RandomSource;
  constructor(randomSource?: RandomSource);
  reset(): void;
  generateBlock(outputArray: Float32Array | number[], length?: number): void;
}

export class PinkNoiseGenerator {
  randomSource: RandomSource;
  b0: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;
  b5: number;
  b6: number;
  constructor(randomSource?: RandomSource);
  reset(): void;
  generateBlock(outputArray: Float32Array | number[], length?: number): void;
}

export class BrownNoiseGenerator {
  randomSource: RandomSource;
  brownY: number;
  constructor(randomSource?: RandomSource);
  reset(): void;
  generateBlock(outputArray: Float32Array | number[], length?: number): void;
}
