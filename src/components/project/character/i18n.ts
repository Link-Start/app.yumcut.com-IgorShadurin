import { ProjectStatus } from '@/shared/constants/status';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import type { ContentTone } from '@/shared/constants/content-tone';

type StatusInfo = { label: string; description: string };

type CharacterProjectCopy = {
  projectPreview: string;
  projectActions: string;
  delete: string;
  downloadVideo: string;
  selectedCharacter: string;
  character: string;
  mode: string;
  modeScript: string;
  modeIdea: string;
  modeScriptDescription: string;
  modeIdeaDescription: string;
  languagesAndVoices: string;
  provider: string;
  unknownProvider: string;
  female: string;
  male: string;
  fast: string;
  slow: string;
  autoVoice: string;
  showLess: string;
  showMoreLanguages: (count: number) => string;
  expectedDuration: string;
  emotion: string;
  tokensSpent: string;
  tokensUnit: string;
  yourPrompt: string;
  generatedText: string;
  generatedAudio: string;
  copy: string;
  copied: string;
  deleteProjectTitle: string;
  deleteProjectDescription: string;
  deleteProjectWarning: string;
  cancel: string;
  processingError: string;
  projectRunInterrupted: string;
  projectFailedDetails: string;
  errorDetails: string;
  close: string;
  statusUpdating: string;
  openCharacter: (name: string) => string;
  characterBackgroundAlt: (name: string) => string;
};

const STATUS_INFO: Record<AppLanguageCode, Record<ProjectStatus, StatusInfo>> = {
  en: {
    [ProjectStatus.New]: {
      label: 'Queued',
      description: 'Project is queued and waiting to start.',
    },
    [ProjectStatus.ProcessScript]: {
      label: 'Generating script',
      description: 'Generating script from your prompt.',
    },
    [ProjectStatus.ProcessScriptValidate]: {
      label: 'Script review',
      description: 'Script is ready and waiting for review.',
    },
    [ProjectStatus.ProcessAudio]: {
      label: 'Generating audio',
      description: 'Generating voiceover from the approved script.',
    },
    [ProjectStatus.ProcessAudioValidate]: {
      label: 'Audio review',
      description: 'Audio is ready and waiting for review.',
    },
    [ProjectStatus.ProcessTranscription]: {
      label: 'Transcription',
      description: 'Creating transcript from generated audio.',
    },
    [ProjectStatus.ProcessMetadata]: {
      label: 'Metadata',
      description: 'Generating project metadata.',
    },
    [ProjectStatus.ProcessCaptionsVideo]: {
      label: 'Captions',
      description: 'Rendering captions layer for the final video.',
    },
    [ProjectStatus.ProcessImagesGeneration]: {
      label: 'Preparing video',
      description: 'Preparing the character video route.',
    },
    [ProjectStatus.ProcessVideoPartsGeneration]: {
      label: 'Video parts',
      description: 'Rendering separate video segments.',
    },
    [ProjectStatus.ProcessVideoMain]: {
      label: 'Rendering final video',
      description: 'Composing final video from all assets.',
    },
    [ProjectStatus.Done]: {
      label: 'Done',
      description: 'Final video is ready for preview and download.',
    },
    [ProjectStatus.Error]: {
      label: 'Error',
      description: 'Processing failed. You can retry or regenerate.',
    },
    [ProjectStatus.Cancelled]: {
      label: 'Cancelled',
      description: 'Project processing was cancelled.',
    },
  },
  ru: {
    [ProjectStatus.New]: {
      label: 'В очереди',
      description: 'Проект в очереди и скоро начнет обрабатываться.',
    },
    [ProjectStatus.ProcessScript]: {
      label: 'Генерация сценария',
      description: 'Создаем сценарий по вашему запросу.',
    },
    [ProjectStatus.ProcessScriptValidate]: {
      label: 'Проверка сценария',
      description: 'Сценарий готов и ждет проверки.',
    },
    [ProjectStatus.ProcessAudio]: {
      label: 'Генерация озвучки',
      description: 'Создаем озвучку по утвержденному сценарию.',
    },
    [ProjectStatus.ProcessAudioValidate]: {
      label: 'Проверка озвучки',
      description: 'Озвучка готова и ждет проверки.',
    },
    [ProjectStatus.ProcessTranscription]: {
      label: 'Транскрибация',
      description: 'Создаем транскрибацию по сгенерированной озвучке.',
    },
    [ProjectStatus.ProcessMetadata]: {
      label: 'Метаданные',
      description: 'Генерируем метаданные проекта.',
    },
    [ProjectStatus.ProcessCaptionsVideo]: {
      label: 'Субтитры',
      description: 'Рендерим слой субтитров для финального видео.',
    },
    [ProjectStatus.ProcessImagesGeneration]: {
      label: 'Подготовка видео',
      description: 'Подготавливаем видеосцену с персонажем.',
    },
    [ProjectStatus.ProcessVideoPartsGeneration]: {
      label: 'Части видео',
      description: 'Рендерим отдельные части видео.',
    },
    [ProjectStatus.ProcessVideoMain]: {
      label: 'Финальный рендер',
      description: 'Собираем финальное видео из всех материалов.',
    },
    [ProjectStatus.Done]: {
      label: 'Готово',
      description: 'Финальное видео готово к просмотру и скачиванию.',
    },
    [ProjectStatus.Error]: {
      label: 'Ошибка',
      description: 'Во время обработки произошла ошибка. Можно повторить или пересоздать.',
    },
    [ProjectStatus.Cancelled]: {
      label: 'Отменено',
      description: 'Обработка проекта была отменена.',
    },
  },
};

const COPY: Record<AppLanguageCode, CharacterProjectCopy> = {
  en: {
    projectPreview: 'Project preview',
    projectActions: 'Project actions',
    delete: 'Delete',
    downloadVideo: 'Download video',
    selectedCharacter: 'Selected character',
    character: 'Character',
    mode: 'Mode',
    modeScript: 'Script',
    modeIdea: 'Idea',
    modeScriptDescription: 'Script mode: we use your text directly and generate audio/video from it.',
    modeIdeaDescription: 'Idea mode: we first generate a script from your prompt, then produce audio/video.',
    languagesAndVoices: 'Languages & voices',
    provider: 'Provider',
    unknownProvider: 'Unknown',
    female: 'Female',
    male: 'Male',
    fast: 'Fast',
    slow: 'Slow',
    autoVoice: 'Auto voice',
    showLess: 'Show less',
    showMoreLanguages: (count: number) => `+${count} more`,
    expectedDuration: 'Expected duration',
    emotion: 'Emotion',
    tokensSpent: 'Tokens spent',
    tokensUnit: 'tokens',
    yourPrompt: 'Your prompt',
    generatedText: 'Generated text',
    generatedAudio: 'Generated audio',
    copy: 'Copy',
    copied: 'Copied',
    deleteProjectTitle: 'Delete project?',
    deleteProjectDescription: 'This will remove the project from your list. You can’t undo this action.',
    deleteProjectWarning: 'Tokens spent to create or process this project will not be compensated or refunded.',
    cancel: 'Cancel',
    processingError: 'Processing error',
    projectRunInterrupted: 'Project run was interrupted',
    projectFailedDetails: 'The project failed during processing. Details are shown below.',
    errorDetails: 'Error details',
    close: 'Close',
    statusUpdating: 'Project status is being updated.',
    openCharacter: (name: string) => `Open character: ${name}`,
    characterBackgroundAlt: (name: string) => `${name} background`,
  },
  ru: {
    projectPreview: 'Предпросмотр проекта',
    projectActions: 'Действия проекта',
    delete: 'Удалить',
    downloadVideo: 'Скачать видео',
    selectedCharacter: 'Выбранный персонаж',
    character: 'Персонаж',
    mode: 'Режим',
    modeScript: 'Сценарий',
    modeIdea: 'Идея',
    modeScriptDescription: 'Режим сценария: используем ваш текст напрямую и генерируем по нему аудио/видео.',
    modeIdeaDescription: 'Режим идеи: сначала генерируем сценарий по запросу, затем создаем аудио/видео.',
    languagesAndVoices: 'Языки и голоса',
    provider: 'Провайдер',
    unknownProvider: 'Неизвестно',
    female: 'Женский',
    male: 'Мужской',
    fast: 'Быстрый',
    slow: 'Медленный',
    autoVoice: 'Автоголос',
    showLess: 'Показать меньше',
    showMoreLanguages: (count: number) => `+${count} еще`,
    expectedDuration: 'Ожидаемая длительность',
    emotion: 'Эмоция',
    tokensSpent: 'Потрачено токенов',
    tokensUnit: 'токенов',
    yourPrompt: 'Ваш запрос',
    generatedText: 'Сгенерированный текст',
    generatedAudio: 'Сгенерированная озвучка',
    copy: 'Копировать',
    copied: 'Скопировано',
    deleteProjectTitle: 'Удалить проект?',
    deleteProjectDescription: 'Проект будет удален из списка. Это действие нельзя отменить.',
    deleteProjectWarning: 'Токены, потраченные на создание и обработку проекта, не компенсируются и не возвращаются.',
    cancel: 'Отмена',
    processingError: 'Ошибка обработки',
    projectRunInterrupted: 'Обработка проекта прервана',
    projectFailedDetails: 'Во время обработки проекта произошла ошибка. Подробности ниже.',
    errorDetails: 'Детали ошибки',
    close: 'Закрыть',
    statusUpdating: 'Статус проекта обновляется.',
    openCharacter: (name: string) => `Открыть персонажа: ${name}`,
    characterBackgroundAlt: (name: string) => `Фон: ${name}`,
  },
};

export function getCharacterProjectCopy(language: AppLanguageCode): CharacterProjectCopy {
  return COPY[language];
}

export function getCharacterProjectStatusLabel(status: ProjectStatus, language: AppLanguageCode): string {
  return STATUS_INFO[language][status]?.label ?? String(status);
}

export function getCharacterProjectStatusDescription(status: ProjectStatus, language: AppLanguageCode): string {
  return STATUS_INFO[language][status]?.description ?? COPY[language].statusUpdating;
}

export function formatCharacterProjectDuration(sec: number | null | undefined, language: AppLanguageCode): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${s}${language === 'ru' ? 'с' : 's'}`;
}

export function getCharacterProjectToneMeta(tone: ContentTone, language: AppLanguageCode): { label: string; emoji: string } {
  switch (tone) {
    case 'playful':
      return { label: language === 'ru' ? 'Игривый' : 'Playful', emoji: '😄' };
    case 'angry':
      return { label: language === 'ru' ? 'Злой' : 'Angry', emoji: '😠' };
    case 'neutral':
    default:
      return { label: language === 'ru' ? 'Нейтральный' : 'Normal', emoji: '🙂' };
  }
}

export function getCharacterProjectVoiceTraitLabel(
  value: string | null | undefined,
  language: AppLanguageCode,
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const copy = COPY[language];
  if (normalized === 'female') return copy.female;
  if (normalized === 'male') return copy.male;
  if (normalized === 'fast') return copy.fast;
  if (normalized === 'slow') return copy.slow;
  return value.trim();
}
