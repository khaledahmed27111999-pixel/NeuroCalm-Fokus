/**
 * NeuroCalm & Fokus — Procedural Noise AudioWorklet Processor
 * Runs inside AudioWorkletGlobalScope.
 */

import {
  WhiteNoiseGenerator,
  PinkNoiseGenerator,
  BrownNoiseGenerator,
} from '../dsp/noiseGenerators';

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor
): void;

if (typeof registerProcessor === 'function') {
  class NoiseProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        {
          name: 'noiseType',
          defaultValue: 0, // 0: White, 1: Pink, 2: Brown
          minValue: 0,
          maxValue: 2,
          automationRate: 'k-rate',
        },
      ];
    }

    private whiteGen: WhiteNoiseGenerator;
    private pinkGen: PinkNoiseGenerator;
    private brownGen: BrownNoiseGenerator;
    private activeType = 0;

    constructor() {
      super();
      this.whiteGen = new WhiteNoiseGenerator(Math.random);
      this.pinkGen = new PinkNoiseGenerator(Math.random);
      this.brownGen = new BrownNoiseGenerator(Math.random);

      this.port.onmessage = (event: MessageEvent) => {
        if (event.data && typeof event.data.type === 'string') {
          if (event.data.type === 'white') this.activeType = 0;
          else if (event.data.type === 'pink') this.activeType = 1;
          else if (event.data.type === 'brown') this.activeType = 2;
        }
      };
    }

    public process(
      _inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ): boolean {
      const output = outputs[0];
      if (!output || output.length === 0) return true;

      const channel0 = output[0];
      const length = channel0.length;

      // Determine active noise type (parameter override or port state)
      const paramNoiseType = parameters.noiseType;
      const type =
        paramNoiseType && paramNoiseType.length > 0
          ? Math.round(paramNoiseType[0])
          : this.activeType;

      if (type === 1) {
        this.pinkGen.generateBlock(channel0, length);
      } else if (type === 2) {
        this.brownGen.generateBlock(channel0, length);
      } else {
        this.whiteGen.generateBlock(channel0, length);
      }

      // If stereo output requested, copy channel 0 to channel 1
      for (let c = 1; c < output.length; c++) {
        output[c].set(channel0);
      }

      return true;
    }
  }

  registerProcessor('noise-processor', NoiseProcessor);
}
