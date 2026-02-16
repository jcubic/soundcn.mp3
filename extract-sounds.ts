#!/usr/bin/env -S node --experimental-strip-types

/**
 * Extract sound files from TypeScript DataURI format to MP3 files
 *
 * This script dynamically imports sound files from the soundcn submodule and uses
 * the base64 decoding logic from soundcn/registry/soundcn/hooks/use-sound.ts
 * by temporarily patching the file to export the decodeAudioData function,
 * importing it, then restoring the original file.
 *
 * Usage: node --experimental-strip-types extract-sounds.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import type { SoundAsset } from './soundcn/lib/sound-types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOUNDS_DIR = path.join(__dirname, 'soundcn/registry/soundcn/sounds');
const OUTPUT_DIR = path.join(__dirname, 'src');
const USE_SOUND_FILE = path.join(__dirname, 'soundcn/registry/soundcn/hooks/use-sound.ts');

// Store original content for restoration
let originalUseSoundContent: string | null = null;

/**
 * Patch the use-sound.ts file to export the decodeAudioData function.
 * Uses regex to add 'export' in front of the function declaration.
 * Throws an error if the function is not found.
 */
function patchUseSoundFile(): void {
  originalUseSoundContent = fs.readFileSync(USE_SOUND_FILE, 'utf-8');

  const pattern = /^(async\s+function\s+decodeAudioData)/m;

  if (!pattern.test(originalUseSoundContent)) {
    throw new Error(
      'Could not find "async function decodeAudioData" in use-sound.ts. ' +
      'The file structure may have changed.'
    );
  }

  const patchedContent = originalUseSoundContent.replace(pattern, 'export $1');

  fs.writeFileSync(USE_SOUND_FILE, patchedContent, 'utf-8');
  console.log('🔧 Patched use-sound.ts to export decodeAudioData\n');
}

/**
 * Restore the original use-sound.ts file
 */
function restoreUseSoundFile(): void {
  if (originalUseSoundContent !== null) {
    fs.writeFileSync(USE_SOUND_FILE, originalUseSoundContent, 'utf-8');
    console.log('\n🔄 Restored use-sound.ts to original state');
    originalUseSoundContent = null;
  }
}

/**
 * Recursively find all TypeScript files in a directory
 */
function findAllTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Save decoded audio buffer as an MP3 file
 */
function saveAsMp3(buffer: Buffer, outputPath: string): boolean {
  try {
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error saving file ${outputPath}:`, errMsg);
    return false;
  }
}

/**
 * Extract SoundAsset from dynamically imported module
 */
function extractSoundAsset(module: Record<string, unknown>): SoundAsset | null {
  const soundExport = Object.values(module).find(
    (value): value is SoundAsset =>
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'dataUri' in value
  );

  return soundExport || null;
}

/**
 * Main function to process all sound files
 */
async function main(): Promise<void> {
  console.log('🎵 Sound Extraction Tool\n');
  console.log(`📁 Source directory: ${SOUNDS_DIR}`);
  console.log(`📂 Output directory: ${OUTPUT_DIR}\n`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created output directory: ${OUTPUT_DIR}\n`);
  }

  // Check if source directory exists
  if (!fs.existsSync(SOUNDS_DIR)) {
    console.error(`❌ Source directory not found: ${SOUNDS_DIR}`);
    console.error('💡 Make sure the soundcn submodule is initialized:');
    console.error('   git submodule update --init --recursive');
    process.exit(1);
  }

  // Find all TypeScript files
  console.log('🔍 Scanning for TypeScript files...');
  const tsFiles = findAllTsFiles(SOUNDS_DIR);
  console.log(`📄 Found ${tsFiles.length} TypeScript files\n`);

  if (tsFiles.length === 0) {
    console.log('⚠️  No TypeScript files found. Exiting.');
    return;
  }

  // Patch the use-sound.ts file to export decodeAudioData
  patchUseSoundFile();

  try {
    // Dynamically import the patched module
    const useSoundUrl = pathToFileURL(USE_SOUND_FILE).href + `?t=${Date.now()}`;
    const { decodeAudioData } = await import(useSoundUrl);

    console.log('✅ Imported decodeAudioData from use-sound.ts\n');

    // Process each file
    let successCount = 0;
    let failureCount = 0;

    console.log('⚙️  Processing files...\n');

    for (let index = 0; index < tsFiles.length; index++) {
      const tsFile = tsFiles[index];
      const relativePath = path.relative(SOUNDS_DIR, tsFile);

      try {
        // Dynamic import of the TypeScript sound file
        const fileUrl = pathToFileURL(tsFile).href;
        const module = await import(fileUrl) as Record<string, unknown>;

        // Extract SoundAsset from the imported module
        const soundAsset = extractSoundAsset(module);

        if (!soundAsset) {
          console.warn(`⚠️  [${index + 1}/${tsFiles.length}] No SoundAsset found in ${relativePath}`);
          failureCount++;
          continue;
        }

        const { name, dataUri } = soundAsset;

        // decodeAudioData returns Promise<AudioBuffer> which requires AudioContext (browser API)
        // We call the function's internal logic directly since we just need the raw bytes
        // This is the same logic used inside decodeAudioData before ctx.decodeAudioData is called
        const base64 = dataUri.split(",")[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert Uint8Array to Buffer for file writing
        const audioBuffer = Buffer.from(bytes);

        // Save as MP3 file
        const outputPath = path.join(OUTPUT_DIR, `${name}.mp3`);

        if (saveAsMp3(audioBuffer, outputPath)) {
          console.log(`✅ [${index + 1}/${tsFiles.length}] ${name}.mp3 (${relativePath})`);
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  [${index + 1}/${tsFiles.length}] Failed to process ${relativePath}: ${errMsg}`);
        failureCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully extracted: ${successCount} files`);
    console.log(`   ❌ Failed: ${failureCount} files`);
    console.log(`   📁 Output directory: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));

    if (successCount > 0) {
      console.log('\n✨ Extraction complete!');
    }
  } finally {
    // Always restore the original file, even if there's an error
    restoreUseSoundFile();
  }
}

// Run the script
main().catch(error => {
  // Ensure we restore the file even on fatal errors
  restoreUseSoundFile();

  console.error(`\n❌ Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
