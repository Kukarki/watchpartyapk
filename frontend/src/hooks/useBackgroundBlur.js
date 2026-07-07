/**
 * useBackgroundBlur — stub
 *
 * Background blur via TensorFlow.js / MediaPipe Selfie Segmentation requires
 * heavy optional packages (~50 MB):
 *
 *   npm install @tensorflow/tfjs-core @tensorflow/tfjs-backend-webgl \
 *               @tensorflow-models/body-segmentation
 *
 * Until those are installed this hook is a no-op so the rest of the app
 * works without them. The blur button in VideoCall is hidden when isEnabled
 * is permanently false.
 */
export function useBackgroundBlur() {
  return {
    isEnabled:       false,
    isLoading:       false,
    blurError:       null,
    toggle:          () => {},
    processedStream: null,
  };
}
