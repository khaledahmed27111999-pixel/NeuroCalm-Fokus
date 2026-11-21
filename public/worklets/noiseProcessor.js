"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/audio/dsp/noiseGenerators.ts
  var WhiteNoiseGenerator = class {
    constructor(randomSource = Math.random) {
      __publicField(this, "randomSource");
      this.randomSource = randomSource;
      this.reset();
    }
    reset() {
    }
    generateBlock(outputArray, length = 128) {
      for (let i = 0; i < length; i++) {
        outputArray[i] = (this.randomSource() * 2 - 1) * 0.25;
      }
    }
  };
  var PinkNoiseGenerator = class {
    constructor(randomSource = Math.random) {
      __publicField(this, "randomSource");
      __publicField(this, "b0", 0);
      __publicField(this, "b1", 0);
      __publicField(this, "b2", 0);
      __publicField(this, "b3", 0);
      __publicField(this, "b4", 0);
      __publicField(this, "b5", 0);
      __publicField(this, "b6", 0);
      this.randomSource = randomSource;
      this.reset();
    }
    reset() {
      this.b0 = 0;
      this.b1 = 0;
      this.b2 = 0;
      this.b3 = 0;
      this.b4 = 0;
      this.b5 = 0;
      this.b6 = 0;
    }
    generateBlock(outputArray, length = 128) {
      for (let i = 0; i < length; i++) {
        const white = (this.randomSource() * 2 - 1) * 0.25;
        this.b0 = 0.99886 * this.b0 + white * 0.0555179;
        this.b1 = 0.99332 * this.b1 + white * 0.0750759;
        this.b2 = 0.969 * this.b2 + white * 0.153852;
        this.b3 = 0.8665 * this.b3 + white * 0.3104856;
        this.b4 = 0.55 * this.b4 + white * 0.5329522;
        this.b5 = -0.7616 * this.b5 - white * 0.016898;
        outputArray[i] = (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) * 0.04;
        this.b6 = white * 0.115926;
      }
    }
  };
  var BrownNoiseGenerator = class {
    constructor(randomSource = Math.random) {
      __publicField(this, "randomSource");
      __publicField(this, "brownY", 0);
      this.randomSource = randomSource;
      this.reset();
    }
    reset() {
      this.brownY = 0;
    }
    generateBlock(outputArray, length = 128) {
      for (let i = 0; i < length; i++) {
        const white = (this.randomSource() * 2 - 1) * 0.25;
        this.brownY = 0.998 * this.brownY + 0.05 * white;
        outputArray[i] = this.brownY * 0.12;
      }
    }
  };

  // src/audio/worklets/noiseProcessor.ts
  if (typeof registerProcessor === "function") {
    class NoiseProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        __publicField(this, "whiteGen");
        __publicField(this, "pinkGen");
        __publicField(this, "brownGen");
        __publicField(this, "activeType", 0);
        this.whiteGen = new WhiteNoiseGenerator(Math.random);
        this.pinkGen = new PinkNoiseGenerator(Math.random);
        this.brownGen = new BrownNoiseGenerator(Math.random);
        this.port.onmessage = (event) => {
          if (event.data && typeof event.data.type === "string") {
            if (event.data.type === "white") this.activeType = 0;
            else if (event.data.type === "pink") this.activeType = 1;
            else if (event.data.type === "brown") this.activeType = 2;
          }
        };
      }
      static get parameterDescriptors() {
        return [
          {
            name: "noiseType",
            defaultValue: 0,
            // 0: White, 1: Pink, 2: Brown
            minValue: 0,
            maxValue: 2,
            automationRate: "k-rate"
          }
        ];
      }
      process(_inputs, outputs, parameters) {
        const output = outputs[0];
        if (!output || output.length === 0) return true;
        const channel0 = output[0];
        const length = channel0.length;
        const paramNoiseType = parameters.noiseType;
        const type = paramNoiseType && paramNoiseType.length > 0 ? Math.round(paramNoiseType[0]) : this.activeType;
        if (type === 1) {
          this.pinkGen.generateBlock(channel0, length);
        } else if (type === 2) {
          this.brownGen.generateBlock(channel0, length);
        } else {
          this.whiteGen.generateBlock(channel0, length);
        }
        for (let c = 1; c < output.length; c++) {
          output[c].set(channel0);
        }
        return true;
      }
    }
    registerProcessor("noise-processor", NoiseProcessor);
  }
})();
