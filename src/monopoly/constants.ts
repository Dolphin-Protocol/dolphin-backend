import { SharedObjectInput } from '@sui-dolphin/monopoly-sdk';

export const packageId =
  '0xec7627b98bf9bb171f28e089546f007f76e9f7aedacddf8d93e89ea75f8cb721';
export const upgradedPackageId =
  '0x827549ecf9fa8f3a08c331babbd0fca2236a20f8719cb0199fe229947d257043';

export const houseRegistryConfig = {
  objectId:
    '0xcc0f76b05ed305bb65bf015ceaac4adf15463d6740d0dddca232649798071352',
  initialSharedVersion: 390467302,
} as SharedObjectInput;

// chanceRegistry
export const chanceRegistryConfig = {
  objectId:
    '0x0503cf72f4d0d7919f63c5e12ece7c197ea18e76c74838785397a6cca9c14d27',
  initialSharedVersion: 390467302,
} as SharedObjectInput;

export const HOUSE_CELL_SIZE = 20;
