import type { ResourceDefinition } from '../types';

export const resourceDefinitions: ResourceDefinition[] = [
  { code: 'HDF', label: 'M001-HDF HD Fitter', capacity: 4, colour: '#155e75' },
  {
    code: 'AUT',
    label: 'M001-AUT Auto Electrician',
    capacity: 2,
    colour: '#1d4ed8',
  },
  {
    code: 'BLM',
    label: 'M001-BLM Boilermaker',
    capacity: 2,
    colour: '#7e22ce',
  },
  {
    code: 'TYR',
    label: 'M001-TYR Tyre Fitter',
    capacity: 2,
    colour: '#ea580c',
  },
];
