import { createFakeSorobanPort } from './fakes.js';
import { runSorobanPortContract } from './soroban-port.contract.js';

runSorobanPortContract('fake', (rods) => createFakeSorobanPort(rods));
