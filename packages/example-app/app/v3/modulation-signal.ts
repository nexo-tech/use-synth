import { SynthNode } from "./base";
import { SynthEngine } from "./engine";

export class ModulationSignal {
  ctx: SynthEngine;
  gain: GainNode;
  multiplier: number;
  note: number;
  constructor(ctx: SynthEngine, note: number, multiplier: number = 1) {
    this.ctx = ctx;
    this.gain = ctx.ctx.createGain();
    this.multiplier = multiplier;
    this.note = note;
    this.gain.gain.value = this.multiplier;
  }
  inputs: Map<string, GainNode> = new Map();

  getOutput(): AudioNode {
    return this.gain;
  }

  setAmount(node: SynthNode, amount: number) {
    const nodeOutput = node.getNodeOutput();
    if (nodeOutput instanceof Map) {
      const nodeOutputValue = nodeOutput.get(this.note);
      if (nodeOutputValue) {
        let res = this.inputs.get(node.id);
        if (!res) {
          res = this.ctx.ctx.createGain();
          nodeOutputValue.connect(res);
          this.inputs.set(node.id, res);
          res.connect(this.gain);
        }
        res!.gain.value = amount;
      }
    }
  }

  disconnect() {
    this.inputs.forEach((input) => {
      input.disconnect();
    });
    for (const input of this.inputs.keys()) {
      this.inputs.delete(input);
    }
    this.gain.disconnect();
  }
}
