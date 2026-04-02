import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

const SAMPLE_RATE = 22050;

export const SOUNDS_ENABLED_KEY = 'flashquest_sounds_enabled';

type SoundName = 'correct' | 'wrong' | 'levelUp' | 'achievement' | 'complete' | 'streak';

interface ToneSpec {
  frequency: number;
  durationMs: number;
  volume: number;
}

const SOUND_SPECS: Record<SoundName, ToneSpec[]> = {
  correct: [{ frequency: 880, durationMs: 100, volume: 0.35 }],
  wrong: [{ frequency: 233, durationMs: 160, volume: 0.25 }],
  streak: [{ frequency: 1047, durationMs: 70, volume: 0.3 }],
  achievement: [
    { frequency: 880, durationMs: 80, volume: 0.3 },
    { frequency: 1109, durationMs: 120, volume: 0.3 },
  ],
  levelUp: [
    { frequency: 523, durationMs: 80, volume: 0.3 },
    { frequency: 659, durationMs: 80, volume: 0.3 },
    { frequency: 784, durationMs: 80, volume: 0.3 },
    { frequency: 1047, durationMs: 160, volume: 0.35 },
  ],
  complete: [
    { frequency: 659, durationMs: 100, volume: 0.3 },
    { frequency: 784, durationMs: 100, volume: 0.3 },
    { frequency: 1047, durationMs: 200, volume: 0.35 },
  ],
};

let soundsEnabled = true;
let soundsLoaded = false;
let preloadPromise: Promise<void> | null = null;
const loadedSounds: Partial<Record<SoundName, Audio.Sound>> = {};

function generateSineWaveSamples(tones: ToneSpec[]): number[] {
  const samples: number[] = [];

  for (const tone of tones) {
    const numSamples = Math.floor((SAMPLE_RATE * tone.durationMs) / 1000);
    const fadeLength = Math.max(1, Math.min(Math.floor(numSamples * 0.1), 400));

    for (let index = 0; index < numSamples; index += 1) {
      const time = index / SAMPLE_RATE;
      const fadeIn = Math.min(index / fadeLength, 1);
      const fadeOut = Math.min((numSamples - 1 - index) / fadeLength, 1);
      const envelope = fadeIn * fadeOut;
      const sample = Math.sin(2 * Math.PI * tone.frequency * time) * tone.volume * envelope * 32767;
      samples.push(Math.max(-32768, Math.min(32767, Math.round(sample))));
    }
  }

  return samples;
}

function writeAsciiString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function samplesToWavBytes(samples: number[]): Uint8Array {
  const dataSize = samples.length * 2;
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + (index * 2), samples[index] ?? 0, true);
  }

  return new Uint8Array(buffer);
}

function getSoundFile(name: SoundName): File {
  return new File(Paths.cache, `flashquest-sfx-${name}.wav`);
}

async function generateAndCacheSound(name: SoundName): Promise<string> {
  const file = getSoundFile(name);

  if (file.exists) {
    return file.uri;
  }

  const samples = generateSineWaveSamples(SOUND_SPECS[name]);
  const wavBytes = samplesToWavBytes(samples);
  file.create({ overwrite: true });
  file.write(wavBytes);
  logger.log('[Sounds] Generated sound file:', file.uri);

  return file.uri;
}

export async function loadSoundsEnabledPreference(): Promise<boolean> {
  try {
    const storedValue = await AsyncStorage.getItem(SOUNDS_ENABLED_KEY);
    const enabled = storedValue !== 'false';
    soundsEnabled = enabled;
    return enabled;
  } catch (error) {
    logger.warn('[Sounds] Failed to load sound preference:', error);
    return soundsEnabled;
  }
}

export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}

export function getSoundsEnabled(): boolean {
  return soundsEnabled;
}

export async function preloadSounds(): Promise<void> {
  if (Platform.OS === 'web' || soundsLoaded) {
    return;
  }

  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const soundNames = Object.keys(SOUND_SPECS) as SoundName[];

      for (const name of soundNames) {
        try {
          const soundUri = await generateAndCacheSound(name);
          const { sound } = await Audio.Sound.createAsync(
            { uri: soundUri },
            { shouldPlay: false, volume: 1 },
          );
          loadedSounds[name] = sound;
          logger.log('[Sounds] Preloaded sound:', name);
        } catch (error) {
          logger.warn(`[Sounds] Failed to preload sound: ${name}`, error);
        }
      }

      soundsLoaded = true;
      logger.log('[Sounds] Sound preload complete');
    } catch (error) {
      logger.warn('[Sounds] Sound preload failed:', error);
    }
  })().finally(() => {
    preloadPromise = null;
  });

  return preloadPromise;
}

export async function playSound(name: SoundName): Promise<void> {
  if (!soundsEnabled || Platform.OS === 'web') {
    return;
  }

  if (!soundsLoaded) {
    await preloadSounds();
  }

  try {
    const sound = loadedSounds[name];
    if (!sound) {
      logger.debug('[Sounds] Sound not available:', name);
      return;
    }

    const status = await sound.getStatusAsync();
    if (!status.isLoaded) {
      return;
    }

    await sound.replayAsync();
  } catch (error) {
    logger.debug(`[Sounds] Failed to play sound: ${name}`, error);
  }
}

export async function unloadSounds(): Promise<void> {
  const soundEntries = Object.entries(loadedSounds) as [SoundName, Audio.Sound | undefined][];

  for (const [name, sound] of soundEntries) {
    try {
      await sound?.unloadAsync();
      delete loadedSounds[name];
    } catch (error) {
      logger.debug('[Sounds] Failed to unload sound:', name, error);
    }
  }

  soundsLoaded = false;
  logger.log('[Sounds] Sounds unloaded');
}
