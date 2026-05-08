export const publicationRecencyRules = {
  maxAgeDays: 2,
};

export const scoringWeights = {
  titleBase: 6,
  titleAdditional: 2,
  location: 3,
  experience: 2,
  education: 2,
  modality: 1,
  recency: 1,
};

export const priorityThresholds = {
  high: 12,
  medium: 8,
};

export const filterRequirements = {
  minTitleMatches: 1,
  minDescriptionSignalGroups: 1,
};
