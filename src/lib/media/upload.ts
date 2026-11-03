/**
 * The bytes the app is about to send to Azure Blob Storage.
 *
 * Native builds only ever have a `file://` URI — `put-blob` streams it with
 * expo-file-system. The web build keeps the `File` the picker handed over, so it
 * can be put straight into a `fetch` body. Both satisfy this shape, which is why
 * the photo picker and the document/media pickers share one upload path.
 */
export interface UploadBody {
  uri: string;
  /** The picked browser file, when there is one. */
  file?: Blob;
}

/** A file chosen on the device, with the details the API needs to sign it. */
export interface PickedFile extends UploadBody {
  name: string;
  type: string;
  size?: number;
}
