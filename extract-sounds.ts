#!/usr/bin/env -S node --experimental-strip-types

/**
 * Extract sound files from TypeScript DataURI format to MP3 files
 * 
 * This script reads all TypeScript files in the soundcn submodule's registry/soundcn/sounds directory,
 * extracts the base64-encoded audio data from DataURIs using the same decoding logic as 
 * soundcn/registry/soundcn/hooks/use-sound.ts (lines 26-31), and saves them as MP3 files 
 * in the src directory in the root of this repository.
 * 
 * Decoding logic reference: soundcn/registry/soundcn/hooks/use-sound.ts:26-31
 * 
 * Usage: node --experimental-strip-types extract-sounds.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOUNDS_DIR = path.join(__dirname, 'soundcn/registry/soundcn/sounds');
const OUTPUT_DIR = path.join(__dirname, 'src');

/**
 * Decode audio data from DataURI using the same logic as use-sound.ts
 * 
 * This function replicates the base64 decoding logic from:
 * soundcn/registry/soundcn/hooks/use-sound.ts lines 26-31
 * 
 * Browser version (use-sound.ts):
 *   const base64 = dataUri.split(",")[1];
 *   const binaryString = atob(base64);
 *   const bytes = new Uint8Array(binaryString.length);
 *   for (let i = 0; i < binaryString.length; i++) {
 *     bytes[i] = binaryString.charCodeAt(i);
 *   }
 * 
 * Node.js equivalent:
 *   Buffer.from(base64, 'base64') produces the same result as the above
 * 
 * @param dataUri - The DataURI string (e.g., "data:audio/mpeg;base64,...")
 * @returns Buffer containing the decoded audio data
 */
function decodeAudioDataUri(dataUri: string): Buffer {
  // Line 26 from use-sound.ts: Split to get base64 part after comma
  const base64 = dataUri.split(',')[1];
  
  if (!base64) {
    throw new Error('Invalid DataURI format: missing base64 data');
  }
  
  // Lines 27-31 from use-sound.ts: Convert base64 to bytes
  // In Node.js, Buffer.from(base64, 'base64') is equivalent to:
  // - atob(base64) to decode base64
  // - Creating Uint8Array from the decoded binary string
  const buffer = Buffer.from(base64, 'base64');
  
  return buffer;
}

interface SoundAsset {
  name: string;
  dataUri: string;
  duration?: number;
  format?: string;
  license?: string;
  author?: string;
}

/**
 * Read TypeScript file and extract the SoundAsset object
 * @param filePath - Path to the TypeScript file
 * @returns SoundAsset object or null if extraction fails
 */
function extractSoundAssetFromTsFile(filePath: string): SoundAsset | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract the name field
    const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
    const name = nameMatch ? nameMatch[1] : null;
    
    // Extract the dataUri field (it may span multiple lines but is in quotes)
    const dataUriMatch = content.match(/dataUri:\s*["']([^"']+)["']/);
    const dataUri = dataUriMatch ? dataUriMatch[1] : null;
    
    if (!name || !dataUri) {
      console.warn(`⚠️  Could not extract data from ${filePath}`);
      return null;
    }
    
    return { name, dataUri };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error reading file ${filePath}:`, errMsg);
    return null;
  }
}

/**
 * Recursively find all TypeScript files in a directory
 * @param dir - Directory to search
 * @param fileList - Accumulated list of files
 * @returns List of all TypeScript file paths
 */
function findAllTsFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Save decoded audio buffer as an MP3 file
 * @param buffer - Audio data buffer
 * @param outputPath - Path where the MP3 file should be saved
 * @returns true if successful, false otherwise
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
 * Main function to process all sound files
 */
function main(): void {
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
  
  // Process each file
  let successCount = 0;
  let failureCount = 0;
  
  console.log('⚙️  Processing files...\n');
  
  tsFiles.forEach((tsFile, index) => {
    const relativePath = path.relative(SOUNDS_DIR, tsFile);
    
    // Extract data from TypeScript file
    const soundAsset = extractSoundAssetFromTsFile(tsFile);
    
    if (!soundAsset) {
      failureCount++;
      return;
    }
    
    const { name, dataUri } = soundAsset;
    
    try {
      // Decode audio data using same logic as use-sound.ts lines 26-31
      const audioBuffer = decodeAudioDataUri(dataUri);
      
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
      console.warn(`⚠️  [${index + 1}/${tsFiles.length}] Failed to decode ${relativePath}: ${errMsg}`);
      failureCount++;
    }
  });
  
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
}

// Run the script
main();
