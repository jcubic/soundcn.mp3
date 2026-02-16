# Sound Extractor for soundcn

This repository contains a TypeScript script to extract MP3 sound files from the [soundcn](https://github.com/kapishdima/soundcn) submodule.

## Overview

The `soundcn` submodule contains sound files stored as TypeScript files with DataURIs (base64-encoded audio). This script extracts those sounds and saves them as standard MP3 files.

The script uses the base64 decoding logic from `soundcn/registry/soundcn/hooks/use-sound.ts` `decodeAudioData` function. It uses a "monkey patching" approach:

1. **Reads** the `use-sound.ts` file and extracts the decoding logic using regex
2. **Creates** a temporary utility file (`decode-util.ts`) with the extracted function
3. **Imports** and uses the function for extraction via dynamic import
4. **Removes** the temporary file when done (even on errors)

This ensures we're using the exact same logic as the submodule without hardcoding line numbers (which would break if the source changes) or permanently modifying the submodule.

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

## What it does

1. **Scans** all TypeScript files in `soundcn/registry/soundcn/sounds/` directory
2. **Extracts** the `dataUri` and convert them to mp3 files in `src` directory

## Requirements

- Node.js v20.6.0 or higher (for native TypeScript support with `--experimental-strip-types`)
- No external dependencies required
- Uses only built-in Node.js modules (`fs`, `path`, `url`)

## License

MIT
