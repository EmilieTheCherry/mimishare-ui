/**
 * audio_capture.cpp
 * Windows WASAPI per-application audio capture via N-API (node-addon-api).
 *
 * Uses ActivateAudioInterfaceAsync + AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
 * for true per-process isolation (same API as OBS win-capture-audio).
 * Works on Windows 10 2004+ and Windows 11.
 */

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmdeviceapi.h>
#include <audiopolicy.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <ks.h>
#include <ksmedia.h>            // KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, KSAUDIO_SPEAKER_STEREO
#include <functiondiscoverykeys_devpkey.h>
#include <psapi.h>
#include <wrl/client.h>      // WRL::ComPtr  — must come before wrl/implements.h
#include <wrl/implements.h>  // WRL::RuntimeClass, WRL::Make
#include <napi.h>

#include <atomic>
#include <thread>
#include <string>
#include <vector>
#include <mutex>

// Use WRL's ComPtr exclusively — our old hand-rolled one clashed with it.
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Make;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;
using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::FtmBase;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

struct ComInit {
    HRESULT hr;
    ComInit()  { hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED); }
    ~ComInit() { if (SUCCEEDED(hr)) CoUninitialize(); }
};

static std::string WideToUtf8(const wchar_t* w) {
    if (!w || !w[0]) return {};
    int sz = WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
    if (sz <= 1) return {};
    std::string out(sz - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w, -1, out.data(), sz, nullptr, nullptr);
    return out;
}

static std::string ProcessNameFromPid(DWORD pid) {
    HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!h) return "unknown";
    wchar_t path[MAX_PATH] = {};
    DWORD len = MAX_PATH;
    QueryFullProcessImageNameW(h, 0, path, &len);
    CloseHandle(h);
    const wchar_t* slash = wcsrchr(path, L'\\');
    return WideToUtf8(slash ? slash + 1 : path);
}

// ---------------------------------------------------------------------------
// IActivateAudioInterfaceCompletionHandler
// Must be created with Make<ActivationHandler>(), not new.
// ---------------------------------------------------------------------------

class ActivationHandler
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase,
                          IActivateAudioInterfaceCompletionHandler>
{
public:
    HRESULT           activateHr  = E_FAIL;
    ComPtr<IAudioClient> audioClient;
    HANDLE            doneEvent   = CreateEventW(nullptr, TRUE, FALSE, nullptr);

    ~ActivationHandler() {
        if (doneEvent) { CloseHandle(doneEvent); doneEvent = nullptr; }
    }

    STDMETHOD(ActivateCompleted)(IActivateAudioInterfaceAsyncOperation* op) override {
        IUnknown* pUnk = nullptr;
        op->GetActivateResult(&activateHr, &pUnk);
        if (SUCCEEDED(activateHr) && pUnk) {
            pUnk->QueryInterface(IID_PPV_ARGS(&audioClient));
            pUnk->Release();
        }
        SetEvent(doneEvent);
        return S_OK;
    }
};

// ---------------------------------------------------------------------------
// Capture state
// ---------------------------------------------------------------------------

struct CaptureState {
    std::atomic<bool> running{ false };
    std::atomic<bool> initialized{ false };
    std::thread       thread;
    HANDLE            stopEvent = nullptr;

    Napi::ThreadSafeFunction tsfnChunk;
    Napi::ThreadSafeFunction tsfnFormat;
    Napi::ThreadSafeFunction tsfnError;

    static void safeRelease(Napi::ThreadSafeFunction& tsfn) {
        if (tsfn) { try { tsfn.Release(); } catch (...) {} }
    }

    void stop() {
        running = false;
        if (stopEvent) SetEvent(stopEvent);
        if (thread.joinable()) thread.join();
        if (stopEvent) { CloseHandle(stopEvent); stopEvent = nullptr; }
        if (initialized.exchange(false)) {
            safeRelease(tsfnChunk);
            safeRelease(tsfnFormat);
            safeRelease(tsfnError);
        }
    }
};

static CaptureState g_capture;

// ---------------------------------------------------------------------------
// Capture thread
// ---------------------------------------------------------------------------

static void CaptureThread(DWORD                    targetPid,
                          bool                     includeChildren,
                          HANDLE                   stopEvent,
                          Napi::ThreadSafeFunction tsfnChunk,
                          Napi::ThreadSafeFunction tsfnFormat,
                          Napi::ThreadSafeFunction tsfnError)
{
    ComInit com;

    auto fail = [&](std::string msg) {
        g_capture.initialized = false;
        tsfnError.BlockingCall([msg](Napi::Env env, Napi::Function cb) {
            cb.Call({ Napi::String::New(env, msg) });
        });
        CaptureState::safeRelease(tsfnChunk);
        CaptureState::safeRelease(tsfnFormat);
        CaptureState::safeRelease(tsfnError);
    };

    // ── System loopback (pid == 0): capture all OS audio from default device ─
    if (targetPid == 0) {
        ComPtr<IMMDeviceEnumerator> enumerator;
        if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                    CLSCTX_ALL, IID_PPV_ARGS(&enumerator))))
            return fail("System loopback: CoCreateInstance(MMDeviceEnumerator) failed");

        ComPtr<IMMDevice> device;
        if (FAILED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device)))
            return fail("System loopback: GetDefaultAudioEndpoint failed");

        ComPtr<IAudioClient> sysClient;
        if (FAILED(device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                                     (void**)sysClient.GetAddressOf())))
            return fail("System loopback: Activate(IAudioClient) failed");

        WAVEFORMATEX* sysFmt = nullptr;
        if (FAILED(sysClient->GetMixFormat(&sysFmt)))
            return fail("System loopback: GetMixFormat failed");

        UINT32 sampleRate    = sysFmt->nSamplesPerSec;
        UINT16 channels      = sysFmt->nChannels;
        UINT16 bitsPerSample = sysFmt->wBitsPerSample;
        bool   isFloat       = (sysFmt->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) ||
                               (sysFmt->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
                                reinterpret_cast<WAVEFORMATEXTENSIBLE*>(sysFmt)->SubFormat
                                    == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT);

        { struct FmtInfo { UINT32 sr; UINT16 ch; UINT16 bps; bool flt; };
          FmtInfo fi{ sampleRate, channels, bitsPerSample, isFloat };
          tsfnFormat.BlockingCall([fi](Napi::Env env, Napi::Function cb) {
              Napi::Object o = Napi::Object::New(env);
              o.Set("sampleRate",    Napi::Number::New(env, fi.sr));
              o.Set("channels",      Napi::Number::New(env, fi.ch));
              o.Set("bitsPerSample", Napi::Number::New(env, fi.bps));
              o.Set("isFloat",       Napi::Boolean::New(env, fi.flt));
              cb.Call({ o });
          }); }

        HANDLE sysPktEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
        HRESULT hr = sysClient->Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            0, 0, sysFmt, nullptr
        );
        CoTaskMemFree(sysFmt);

        if (FAILED(hr)) {
            CloseHandle(sysPktEvent);
            return fail("System loopback: IAudioClient::Initialize failed");
        }

        sysClient->SetEventHandle(sysPktEvent);

        ComPtr<IAudioCaptureClient> sysCap;
        if (FAILED(sysClient->GetService(IID_PPV_ARGS(&sysCap)))) {
            CloseHandle(sysPktEvent);
            return fail("System loopback: GetService(IAudioCaptureClient) failed");
        }

        if (FAILED(sysClient->Start())) {
            CloseHandle(sysPktEvent);
            return fail("System loopback: IAudioClient::Start failed");
        }

        LARGE_INTEGER sysQpcFreq, sysQpcBase;
        QueryPerformanceFrequency(&sysQpcFreq);
        QueryPerformanceCounter(&sysQpcBase);
        FILETIME sysFtBase; GetSystemTimePreciseAsFileTime(&sysFtBase);
        ULARGE_INTEGER sysUliBase; sysUliBase.LowPart = sysFtBase.dwLowDateTime; sysUliBase.HighPart = sysFtBase.dwHighDateTime;
        double sysWallMsBase = (double)(sysUliBase.QuadPart - 116444736000000000ULL) / 10000.0;

        HANDLE wh2[2] = { sysPktEvent, stopEvent };
        while (g_capture.running.load(std::memory_order_relaxed)) {
            DWORD w = WaitForMultipleObjects(2, wh2, FALSE, 200);
            if (w == WAIT_OBJECT_0 + 1) break;
            if (w != WAIT_OBJECT_0)     continue;

            UINT32 pktSz = 0;
            while (SUCCEEDED(sysCap->GetNextPacketSize(&pktSz)) && pktSz > 0) {
                BYTE*  data2      = nullptr;
                UINT32 numFrames2 = 0;
                DWORD  flags2     = 0;
                UINT64 sysQpcPos2 = 0;

                hr = sysCap->GetBuffer(&data2, &numFrames2, &flags2, nullptr, &sysQpcPos2);
                if (FAILED(hr)) goto sys_done;

                { double captureMs2 = sysWallMsBase +
                      (double)((LONGLONG)sysQpcPos2 - sysQpcBase.QuadPart) * 1000.0 / (double)sysQpcFreq.QuadPart;

                  bool   silent2      = (flags2 & AUDCLNT_BUFFERFLAGS_SILENT) != 0;
                  size_t sampleCount2 = (size_t)numFrames2 * channels;
                  auto*  heap2        = new std::vector<float>(sampleCount2, 0.0f);

                  if (!silent2 && data2) {
                      if (isFloat) {
                          memcpy(heap2->data(), data2, sampleCount2 * sizeof(float));
                      } else if (bitsPerSample == 16) {
                          auto* src = reinterpret_cast<const int16_t*>(data2);
                          for (size_t j = 0; j < sampleCount2; ++j)
                              (*heap2)[j] = src[j] / 32768.0f;
                      } else if (bitsPerSample == 24) {
                          for (size_t j = 0; j < sampleCount2; ++j) {
                              int32_t s = (int32_t)(
                                  ((uint32_t)data2[j*3+2] << 16) |
                                  ((uint32_t)data2[j*3+1] <<  8) |
                                   (uint32_t)data2[j*3+0]);
                              if (s & 0x800000) s |= (int32_t)0xFF000000;
                              (*heap2)[j] = s / 8388608.0f;
                          }
                      } else if (bitsPerSample == 32) {
                          auto* src = reinterpret_cast<const int32_t*>(data2);
                          for (size_t j = 0; j < sampleCount2; ++j)
                              (*heap2)[j] = src[j] / 2147483648.0f;
                      }
                  }

                  sysCap->ReleaseBuffer(numFrames2);

                  tsfnChunk.NonBlockingCall([heap2, captureMs2](Napi::Env env, Napi::Function cb) {
                      size_t pcmBytes   = heap2->size() * sizeof(float);
                      size_t totalBytes = 8 + pcmBytes;
                      auto ab = Napi::ArrayBuffer::New(env, totalBytes);
                      memcpy(ab.Data(), &captureMs2, 8);
                      memcpy(static_cast<uint8_t*>(ab.Data()) + 8, heap2->data(), pcmBytes);
                      delete heap2;
                      cb.Call({ ab });
                  }); }
            }
        }

    sys_done:
        sysClient->Stop();
        CloseHandle(sysPktEvent);
        g_capture.initialized = false;
        CaptureState::safeRelease(tsfnChunk);
        CaptureState::safeRelease(tsfnFormat);
        CaptureState::safeRelease(tsfnError);
        return;
    }

    // ── 1 & 2. Activate per-process loopback (with retry) ───────────────────
    //
    // We keep params + PROPVARIANT on the heap so their addresses remain valid
    // until the async completion callback fires — stack variables would be
    // dangling by the time ActivateAudioInterfaceAsync calls back.
    //
    // GetMixFormat can also fail if the virtual endpoint hasn't negotiated a
    // format yet (app in session list but no recent audio frames). We retry
    // the full activation up to 5 times with 300ms gaps.

    // Helper: builds params + prop on the heap and runs one activation attempt.
    // Returns the IAudioClient on success, nullptr on failure.
    auto tryActivate = [&]() -> ComPtr<IAudioClient> {
        // Heap-allocate so the pointer stays valid across the async callback.
        auto* heapParams = new AUDIOCLIENT_ACTIVATION_PARAMS{};
        heapParams->ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
        heapParams->ProcessLoopbackParams.TargetProcessId   = targetPid;
        heapParams->ProcessLoopbackParams.ProcessLoopbackMode =
            PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

        auto* heapProp = new PROPVARIANT{};
        heapProp->vt               = VT_BLOB;
        heapProp->blob.cbSize      = sizeof(AUDIOCLIENT_ACTIVATION_PARAMS);
        heapProp->blob.pBlobData   = reinterpret_cast<BYTE*>(heapParams);

        auto handler = Make<ActivationHandler>();
        ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;

        HRESULT hr = ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            __uuidof(IAudioClient),
            heapProp,
            handler.Get(),
            &asyncOp
        );

        ComPtr<IAudioClient> result;
        if (SUCCEEDED(hr)) {
            HANDLE wh[2] = { handler->doneEvent, stopEvent };
            if (WaitForMultipleObjects(2, wh, FALSE, 8000) == WAIT_OBJECT_0) {
                if (SUCCEEDED(handler->activateHr) && handler->audioClient)
                    result = handler->audioClient;
            }
        }

        // Safe to free now — callback has completed (event was signalled).
        delete heapParams;
        delete heapProp;
        return result;
    };

    ComPtr<IAudioClient> audioClient;
    WAVEFORMATEX* mixFmt = nullptr;
    HRESULT hr = E_FAIL;

    const int MAX_ATTEMPTS   = 5;
    const int RETRY_DELAY_MS = 300;

    for (int attempt = 0; attempt < MAX_ATTEMPTS; ++attempt) {
        if (attempt > 0) {
            // Wait before retry, but abort immediately if stop is signalled
            if (WaitForSingleObject(stopEvent, RETRY_DELAY_MS) == WAIT_OBJECT_0)
                return fail("Capture cancelled.");
        }

        audioClient = tryActivate();
        if (!audioClient) continue;

        hr = audioClient->GetMixFormat(&mixFmt);
        if (SUCCEEDED(hr)) break;

        audioClient.Reset();
    }

    // If GetMixFormat failed on all attempts, fall back to the standard Windows
    // audio engine format: 32-bit float, 48 kHz, stereo. This is the mix format
    // used by the vast majority of Windows audio devices and matches what the
    // process loopback endpoint will actually deliver once frames start flowing.
    // Initializing with this format succeeds even when GetMixFormat fails.
    if (FAILED(hr) || !mixFmt) {
        if (mixFmt) { CoTaskMemFree(mixFmt); mixFmt = nullptr; }
        audioClient.Reset();

        // Re-activate once more with the fallback format
        audioClient = tryActivate();
        if (!audioClient)
            return fail("Could not activate audio endpoint for PID "
                        + std::to_string(targetPid) + ". "
                        "The process may have exited or lost its audio session.");

        // Build a standard 48kHz stereo float32 WAVEFORMATEXTENSIBLE on the heap
        // (CoTaskMemAlloc so it can be freed with CoTaskMemFree like a normal mix fmt)
        auto* wfx = reinterpret_cast<WAVEFORMATEXTENSIBLE*>(
            CoTaskMemAlloc(sizeof(WAVEFORMATEXTENSIBLE)));
        if (!wfx) return fail("CoTaskMemAlloc failed");
        ZeroMemory(wfx, sizeof(WAVEFORMATEXTENSIBLE));

        wfx->Format.wFormatTag      = WAVE_FORMAT_EXTENSIBLE;
        wfx->Format.nChannels       = 2;
        wfx->Format.nSamplesPerSec  = 48000;
        wfx->Format.wBitsPerSample  = 32;
        wfx->Format.nBlockAlign     = wfx->Format.nChannels * wfx->Format.wBitsPerSample / 8;
        wfx->Format.nAvgBytesPerSec = wfx->Format.nSamplesPerSec * wfx->Format.nBlockAlign;
        wfx->Format.cbSize          = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
        wfx->Samples.wValidBitsPerSample = 32;
        wfx->dwChannelMask          = KSAUDIO_SPEAKER_STEREO;
        wfx->SubFormat              = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;

        mixFmt = reinterpret_cast<WAVEFORMATEX*>(wfx);
        hr     = S_OK;
    }

    UINT32 sampleRate    = mixFmt->nSamplesPerSec;
    UINT16 channels      = mixFmt->nChannels;
    UINT16 bitsPerSample = mixFmt->wBitsPerSample;
    bool   isFloat       = (mixFmt->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) ||
                           (mixFmt->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
                            reinterpret_cast<WAVEFORMATEXTENSIBLE*>(mixFmt)->SubFormat
                                == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT);

    struct FmtInfo { UINT32 sr; UINT16 ch; UINT16 bps; bool flt; };
    FmtInfo fi{ sampleRate, channels, bitsPerSample, isFloat };
    tsfnFormat.BlockingCall([fi](Napi::Env env, Napi::Function cb) {
        Napi::Object o = Napi::Object::New(env);
        o.Set("sampleRate",    Napi::Number::New(env, fi.sr));
        o.Set("channels",      Napi::Number::New(env, fi.ch));
        o.Set("bitsPerSample", Napi::Number::New(env, fi.bps));
        o.Set("isFloat",       Napi::Boolean::New(env, fi.flt));
        cb.Call({ o });
    });

    // ── 4. Initialise event-driven capture ───────────────────────────────────

    HANDLE packetEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);

    hr = audioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
        0, 0, mixFmt, nullptr
    );
    CoTaskMemFree(mixFmt);

    if (FAILED(hr)) {
        CloseHandle(packetEvent);
        return fail("IAudioClient::Initialize failed (0x" + std::to_string((unsigned)hr) + ")");
    }

    audioClient->SetEventHandle(packetEvent);

    ComPtr<IAudioCaptureClient> captureClient;
    if (FAILED(audioClient->GetService(IID_PPV_ARGS(&captureClient)))) {
        CloseHandle(packetEvent);
        return fail("GetService(IAudioCaptureClient) failed");
    }

    if (FAILED(audioClient->Start())) {
        CloseHandle(packetEvent);
        return fail("IAudioClient::Start failed");
    }

    // ── 5. Read loop ─────────────────────────────────────────────────────────

    // Establish a one-time QPC↔wall-clock baseline so we can convert the per-packet
    // QPC position from GetBuffer into a wall-clock Unix-epoch millisecond value.
    LARGE_INTEGER qpcFreq, qpcBase;
    QueryPerformanceFrequency(&qpcFreq);
    QueryPerformanceCounter(&qpcBase);
    FILETIME ftBase; GetSystemTimePreciseAsFileTime(&ftBase);
    ULARGE_INTEGER uliBase; uliBase.LowPart = ftBase.dwLowDateTime; uliBase.HighPart = ftBase.dwHighDateTime;
    double wallMsBase = (double)(uliBase.QuadPart - 116444736000000000ULL) / 10000.0;

    HANDLE wh[2] = { packetEvent, stopEvent };

    while (g_capture.running.load(std::memory_order_relaxed)) {
        DWORD w = WaitForMultipleObjects(2, wh, FALSE, 200);
        if (w == WAIT_OBJECT_0 + 1) break;
        if (w != WAIT_OBJECT_0)     continue;

        UINT32 packetSize = 0;
        while (SUCCEEDED(captureClient->GetNextPacketSize(&packetSize)) && packetSize > 0) {
            BYTE*  data      = nullptr;
            UINT32 numFrames = 0;
            DWORD  flags     = 0;

            UINT64 qpcPos = 0;
            hr = captureClient->GetBuffer(&data, &numFrames, &flags, nullptr, &qpcPos);
            if (FAILED(hr)) goto done;

            { double captureMs = wallMsBase +
                  (double)((LONGLONG)qpcPos - qpcBase.QuadPart) * 1000.0 / (double)qpcFreq.QuadPart;

            bool   silent      = (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0;
            size_t sampleCount = (size_t)numFrames * channels;

            auto* heap = new std::vector<float>(sampleCount, 0.0f);

            if (!silent && data) {
                if (isFloat) {
                    memcpy(heap->data(), data, sampleCount * sizeof(float));
                } else if (bitsPerSample == 16) {
                    auto* src = reinterpret_cast<const int16_t*>(data);
                    for (size_t j = 0; j < sampleCount; ++j)
                        (*heap)[j] = src[j] / 32768.0f;
                } else if (bitsPerSample == 24) {
                    auto* src = data;
                    for (size_t j = 0; j < sampleCount; ++j) {
                        int32_t s = (int32_t)(
                            ((uint32_t)src[j*3+2] << 16) |
                            ((uint32_t)src[j*3+1] <<  8) |
                             (uint32_t)src[j*3+0]);
                        if (s & 0x800000) s |= (int32_t)0xFF000000;
                        (*heap)[j] = s / 8388608.0f;
                    }
                } else if (bitsPerSample == 32) {
                    auto* src = reinterpret_cast<const int32_t*>(data);
                    for (size_t j = 0; j < sampleCount; ++j)
                        (*heap)[j] = src[j] / 2147483648.0f;
                }
            }

            captureClient->ReleaseBuffer(numFrames);

            // First 8 bytes: captureMs as a little-endian double (Unix epoch ms).
            // Remaining bytes: interleaved float32 PCM samples.
            tsfnChunk.NonBlockingCall([heap, captureMs](Napi::Env env, Napi::Function cb) {
                size_t pcmBytes   = heap->size() * sizeof(float);
                size_t totalBytes = 8 + pcmBytes;
                auto ab = Napi::ArrayBuffer::New(env, totalBytes);
                memcpy(ab.Data(), &captureMs, 8);
                memcpy(static_cast<uint8_t*>(ab.Data()) + 8, heap->data(), pcmBytes);
                delete heap;
                cb.Call({ ab });
            }); }
        }
    }

done:
    audioClient->Stop();
    CloseHandle(packetEvent);
    // Mark as no longer initialized before releasing so stop() won't double-release
    g_capture.initialized = false;
    CaptureState::safeRelease(tsfnChunk);
    CaptureState::safeRelease(tsfnFormat);
    CaptureState::safeRelease(tsfnError);
}

// ---------------------------------------------------------------------------
// enumerateAudioSessions()
// ---------------------------------------------------------------------------

Napi::Value EnumerateAudioSessions(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array result = Napi::Array::New(env);
    ComInit com;

    ComPtr<IMMDeviceEnumerator> enumerator;
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                CLSCTX_ALL, IID_PPV_ARGS(&enumerator)))) {
        Napi::Error::New(env, "CoCreateInstance failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    ComPtr<IMMDevice> device;
    if (FAILED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device))) {
        Napi::Error::New(env, "GetDefaultAudioEndpoint failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    ComPtr<IAudioSessionManager2> mgr;
    if (FAILED(device->Activate(__uuidof(IAudioSessionManager2),
                                CLSCTX_ALL, nullptr, (void**)mgr.GetAddressOf()))) {
        Napi::Error::New(env, "Activate(IAudioSessionManager2) failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    ComPtr<IAudioSessionEnumerator> sessionEnum;
    if (FAILED(mgr->GetSessionEnumerator(&sessionEnum))) {
        Napi::Error::New(env, "GetSessionEnumerator failed").ThrowAsJavaScriptException();
        return env.Null();
    }

    int count = 0;
    sessionEnum->GetCount(&count);
    uint32_t idx = 0;

    for (int i = 0; i < count; ++i) {
        ComPtr<IAudioSessionControl>  ctrl;
        ComPtr<IAudioSessionControl2> ctrl2;

        if (FAILED(sessionEnum->GetSession(i, &ctrl))) continue;
        if (FAILED(ctrl.As(&ctrl2))) continue;

        DWORD pid = 0;
        ctrl2->GetProcessId(&pid);
        if (pid == 0) continue;

        AudioSessionState state = AudioSessionStateInactive;
        ctrl->GetState(&state);

        LPWSTR displayName = nullptr;
        ctrl->GetDisplayName(&displayName);
        std::string dname = displayName ? WideToUtf8(displayName) : "";
        if (displayName) CoTaskMemFree(displayName);

        LPWSTR sessionId = nullptr;
        ctrl2->GetSessionIdentifier(&sessionId);
        std::string sid = sessionId ? WideToUtf8(sessionId) : "";
        if (sessionId) CoTaskMemFree(sessionId);

        std::string procName = ProcessNameFromPid(pid);

        Napi::Object entry = Napi::Object::New(env);
        entry.Set("pid",         Napi::Number::New(env, (double)pid));
        entry.Set("name",        Napi::String::New(env, procName));
        entry.Set("displayName", Napi::String::New(env, dname.empty() ? procName : dname));
        entry.Set("sessionId",   Napi::String::New(env, sid));
        entry.Set("state",       Napi::Number::New(env, (int)state));

        result.Set(idx++, entry);
    }

    return result;
}

// ---------------------------------------------------------------------------
// startCapture(pid, { onChunk, onFormat, onError, includeChildren? })
// ---------------------------------------------------------------------------

Napi::Value StartCapture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsObject()) {
        Napi::TypeError::New(env, "Expected (pid: number, callbacks: object)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    DWORD         pid = info[0].As<Napi::Number>().Uint32Value();
    Napi::Object  cb  = info[1].As<Napi::Object>();

    if (!cb.Has("onChunk") || !cb.Has("onFormat") || !cb.Has("onError")) {
        Napi::TypeError::New(env, "callbacks must have onChunk, onFormat, onError")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Function onChunk  = cb.Get("onChunk").As<Napi::Function>();
    Napi::Function onFormat = cb.Get("onFormat").As<Napi::Function>();
    Napi::Function onError  = cb.Get("onError").As<Napi::Function>();
    bool includeChildren    = !cb.Has("includeChildren") ||
                               cb.Get("includeChildren").As<Napi::Boolean>().Value();

    if (g_capture.running) g_capture.stop();

    g_capture.stopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (!g_capture.stopEvent) {
        Napi::Error::New(env, "CreateEvent failed").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    g_capture.running    = true;
    g_capture.tsfnChunk  = Napi::ThreadSafeFunction::New(env, onChunk,  "audio-chunk",  0, 1);
    g_capture.tsfnFormat = Napi::ThreadSafeFunction::New(env, onFormat, "audio-format", 0, 1);
    g_capture.tsfnError  = Napi::ThreadSafeFunction::New(env, onError,  "audio-error",  0, 1);
    g_capture.initialized = true;

    HANDLE stopEv = g_capture.stopEvent;
    auto   tsfnC  = g_capture.tsfnChunk;
    auto   tsfnF  = g_capture.tsfnFormat;
    auto   tsfnE  = g_capture.tsfnError;

    g_capture.thread = std::thread(CaptureThread, pid, includeChildren, stopEv, tsfnC, tsfnF, tsfnE);
    return env.Undefined();
}

// ---------------------------------------------------------------------------
// stopCapture()
// ---------------------------------------------------------------------------

Napi::Value StopCapture(const Napi::CallbackInfo& info) {
    g_capture.stop();
    return info.Env().Undefined();
}

// ---------------------------------------------------------------------------
// Module init
// ---------------------------------------------------------------------------

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("enumerateAudioSessions", Napi::Function::New(env, EnumerateAudioSessions));
    exports.Set("startCapture",           Napi::Function::New(env, StartCapture));
    exports.Set("stopCapture",            Napi::Function::New(env, StopCapture));
    return exports;
}

NODE_API_MODULE(audio_capture, Init)