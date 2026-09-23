import multer from 'multer';

import { ERROR_CODES, IMAGE_UPLOAD } from '@futcheck/shared';

import { badRequest } from '../lib/errors.js';

/**
 * Receives one image into memory.
 *
 * Memory, not disk: nothing untrusted is written anywhere until it has been
 * decoded and re-encoded (see `lib/images.ts`), so a malicious file never exists
 * as a file on this server.
 *
 * The size limit is enforced here, before the bytes are read, and the
 * content-type is only a first filter — the real check is whether the image
 * decodes.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD.maxBytes, files: 1, fields: 8 },
  fileFilter: (_req, file, callback) => {
    if (!(IMAGE_UPLOAD.acceptedMimeTypes as readonly string[]).includes(file.mimetype)) {
      callback(badRequest(ERROR_CODES.UNSUPPORTED_FILE_TYPE));
      return;
    }
    callback(null, true);
  },
}).single('image');
