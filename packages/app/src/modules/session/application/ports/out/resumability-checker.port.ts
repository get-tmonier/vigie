import { ServiceMap } from 'effect';

export interface ResumabilityCheckerShape {
  isResumable(claudeSessionId: string, cwd: string): boolean;
}

export class ResumabilityChecker extends ServiceMap.Service<
  ResumabilityChecker,
  ResumabilityCheckerShape
>()('@vigie/ResumabilityChecker') {}
