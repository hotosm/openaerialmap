import gdalWasm from "@crossbind/port-gdal-wasm/crossbind.config.js";

export default {
  general: {
    name: "oam-optimiser",
  },
  dependencies: [gdalWasm],
  paths: {
    config: import.meta.url,
    // Not under app/: local compose mounts over it.
    output: "dist",
  },
  targetSpecs: [
    {
      platform: "wasm",
      specs: {
        binary: {
          emccFlags: [
            // Emscripten's default limit is 2 GB. wasm32 allows 4 GB.
            "-sMAXIMUM_MEMORY=4GB",
            // Replaces crossbind's fixed pool of 2: one thread per core for
            // GDAL's NUM_THREADS=ALL_CPUS, plus one for the OPFS filesystem.
            "-pthread",
            "-sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency+1",
          ],
        },
        env: {
          // Same as the server's convert step.
          GDAL_CACHEMAX: "512",
        },
      },
    },
  ],
};
