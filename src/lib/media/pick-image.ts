import * as ImagePicker from 'expo-image-picker';

/**
 * The image a screen should upload. Web has its own implementation in
 * `pick-image.web.ts`, which resolves the same shape from a file input.
 *
 * `file` is only present on the web; native sends `uri`/`name`/`type` instead,
 * which React Native's FormData knows how to read.
 */
export interface PickedImage {
  uri: string;
  name: string;
  type: string;
  file?: File;
}

const FALLBACK_TYPE = 'image/jpeg';

function nameFor(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.fileName) return asset.fileName;
  const extension = (asset.mimeType ?? FALLBACK_TYPE).split('/')[1] ?? 'jpg';
  return `photo.${extension}`;
}

/**
 * Opens the system photo library and returns one square-cropped image, or null
 * when the person cancels. The picker asks for permission itself on iOS and
 * Android.
 */
export async function pickImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets.length) return null;

  const asset = result.assets[0];

  return {
    uri: asset.uri,
    name: nameFor(asset),
    type: asset.mimeType ?? FALLBACK_TYPE,
    file: asset.file,
  };
}
