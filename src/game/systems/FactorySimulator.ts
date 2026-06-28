import { MACHINE_CATALOG, getMachineSpeedMultiplier } from '../data/catalog';
import { GameState } from '../state/GameState';

export interface ProductionEvent {
  machineId: string;
  message: string;
}

export class FactorySimulator {
  constructor(private readonly state: GameState) {}

  tick(deltaSeconds: number): ProductionEvent[] {
    const events: ProductionEvent[] = [];

    for (const machine of this.state.data.machines) {
      const definition = MACHINE_CATALOG[machine.type];

      if (!machine.running && machine.progress <= 0) {
        const started = this.state.consumeInputs(definition.input);

        if (!started) {
          machine.starved = true;
          machine.lastMessage = 'Sem insumo';
          continue;
        }

        machine.running = true;
        machine.starved = false;
        machine.lastMessage = 'Produzindo';
      }

      const speed = getMachineSpeedMultiplier(machine.level);
      machine.progress += (deltaSeconds * speed) / definition.cycleSeconds;

      if (machine.progress >= 1) {
        machine.progress = 0;
        machine.running = false;
        machine.starved = false;
        this.state.addOutputs(definition.output);

        const outputText = Object.entries(definition.output)
          .map(([item, amount]) => `${amount}x ${item}`)
          .join(', ');

        machine.lastMessage = `Produziu ${outputText}`;
        events.push({
          machineId: machine.id,
          message: `${definition.shortName}: ${outputText}`
        });
      }
    }

    return events;
  }
}
