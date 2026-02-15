# Sound Extractor for soundcn

This repository contains a TypeScript script to extract MP3 sound files from the [soundcn](https://github.com/kapishdima/soundcn) submodule.

## Overview

The `soundcn` submodule contains sound files stored as TypeScript files with DataURIs (base64-encoded audio). This script extracts those sounds and saves them as standard MP3 files.

The script uses the same decoding logic as `soundcn/registry/soundcn/hooks/use-sound.ts` (lines 26-31) to ensure proper audio extraction.

## Setup

1. Clone this repository with submodules:
   ```bash
   git clone --recursive git@github.com:jcubic/soundcn.mp3.git
   ```

2. If you already cloned without submodules, initialize them:
   ```bash
   git submodule update --init --recursive
   ```

## Usage

Extract all sound files from the submodule:

```bash
npm run extract
```

Or directly:

```bash
./extract-sounds.ts
```

Or with explicit node command:

```bash
node --experimental-strip-types extract-sounds.ts
```

## What it does

1. **Scans** all TypeScript files in `soundcn/registry/soundcn/sounds/` directory
2. **Extracts** the `dataUri` field containing base64-encoded audio data
3. **Converts** DataURI format to binary MP3 files
4. **Saves** all MP3 files to the `src/` directory in the root

## Requirements

- Node.js v20.6.0 or higher (for native TypeScript support with `--experimental-strip-types`)
- No external dependencies required
- Uses only built-in Node.js modules (`fs`, `path`, `url`)

## License

MIT
