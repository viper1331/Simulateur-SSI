import { Scenario } from '@ssi/shared-models';

export interface AssignationSummary {
  zdId: string;
  zfIds: string[];
  dasIds: string[];
  ugaChannels: string[];
}

export const buildAssignations = (scenario: Scenario): AssignationSummary[] => {
  return scenario.zd.map((zone) => {
    const zfIds = zone.linkedZoneIds;
    const dasIds = scenario.das
      .filter((das) => zfIds.includes(das.zoneId))
      .map((das) => das.id);
    const ugaChannels = scenario.zf
      .filter((zf) => zfIds.includes(zf.id) && zf.ugaChannel)
      .map((zf) => zf.ugaChannel!)
      .filter(Boolean);

    return {
      zdId: zone.id,
      zfIds,
      dasIds,
      ugaChannels
    };
  });
};
