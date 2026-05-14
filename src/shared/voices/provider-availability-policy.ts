import type { TargetLanguageCode } from '@/shared/constants/languages';
import type { ProjectExperience } from '@/shared/constants/project-experience';
import type { VoiceProviderId } from '@/shared/constants/voice-providers';

export type ScriptInputMode = 'idea' | 'script';

export type VoiceProviderAvailabilityContext = {
  projectExperience: ProjectExperience;
  mode: ScriptInputMode;
  languageCode: TargetLanguageCode;
};

export type VoiceProviderAvailabilityRuleDTO = {
  projectExperiences: readonly ProjectExperience[] | 'any';
  modes: readonly ScriptInputMode[] | 'any';
  languages: readonly TargetLanguageCode[] | 'any';
  providers: readonly VoiceProviderId[];
};

export const VOICE_PROVIDER_AVAILABILITY_RULES: readonly VoiceProviderAvailabilityRuleDTO[] = [
  {
    projectExperiences: ['character'],
    modes: ['idea'],
    languages: ['ru'],
    providers: ['inworld'],
  },
];

function matchesRule<T extends string>(value: T, matcher: readonly T[] | 'any'): boolean {
  if (matcher === 'any') return true;
  return matcher.includes(value);
}

export function getExcludedVoiceProvidersFromRules(
  rules: readonly VoiceProviderAvailabilityRuleDTO[],
  context: VoiceProviderAvailabilityContext,
): Set<VoiceProviderId> {
  const excluded = new Set<VoiceProviderId>();
  for (const rule of rules) {
    if (!matchesRule(context.projectExperience, rule.projectExperiences)) continue;
    if (!matchesRule(context.mode, rule.modes)) continue;
    if (!matchesRule(context.languageCode, rule.languages)) continue;
    for (const provider of rule.providers) {
      excluded.add(provider);
    }
  }
  return excluded;
}

export function isVoiceProviderExcludedFromRules(
  provider: string | null | undefined,
  rules: readonly VoiceProviderAvailabilityRuleDTO[],
  context: VoiceProviderAvailabilityContext,
): boolean {
  if (!provider) return false;
  const normalized = provider.trim().toLowerCase() as VoiceProviderId;
  return getExcludedVoiceProvidersFromRules(rules, context).has(normalized);
}

export function getExcludedVoiceProviders(context: VoiceProviderAvailabilityContext): Set<VoiceProviderId> {
  return getExcludedVoiceProvidersFromRules(VOICE_PROVIDER_AVAILABILITY_RULES, context);
}

export function isVoiceProviderExcluded(provider: string | null | undefined, context: VoiceProviderAvailabilityContext): boolean {
  return isVoiceProviderExcludedFromRules(provider, VOICE_PROVIDER_AVAILABILITY_RULES, context);
}
