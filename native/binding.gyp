{
  "targets": [
    {
      "target_name": "audio_capture",
      "sources": [ "audio_capture.cpp" ],
      "include_dirs": [
        "F:/Programming/electron-audio-capture/node_modules/.pnpm/node-addon-api@7.1.1/node_modules/node-addon-api"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "NODE_ADDON_API_DISABLE_DEPRECATED",
        "UNICODE",
        "_UNICODE"
      ],
      "conditions": [
        [ "OS=='win'", {
          "libraries": [
            "-lole32.lib",
            "-loleaut32.lib",
            "-luuid.lib",
            "-lksuser.lib",
            "-lmmdevapi.lib",
            "-lruntimeobject.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [ "/std:c++17" ]
            }
          }
        }]
      ]
    }
  ]
}