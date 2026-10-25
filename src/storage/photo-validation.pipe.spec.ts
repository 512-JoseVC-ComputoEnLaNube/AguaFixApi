import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { MAX_PHOTO_BYTES, PhotoValidationPipe } from './photo-validation.pipe';

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);

describe('PhotoValidationPipe', () => {
  const pipe = new PhotoValidationPipe();
  const file = (buffer: Buffer, mimetype = 'image/png') =>
    ({ buffer, size: buffer.length, mimetype }) as Express.Multer.File;

  it('exige photo', async () => {
    await expect(pipe.transform()).rejects.toThrow(BadRequestException);
  });
  it('detecta el tipo desde los bytes aunque el cliente declare otro', async () => {
    const photo = await pipe.transform(file(png, 'text/html'));
    expect(photo.mimetype).toBe('image/png');
  });
  it.each([
    Buffer.from('not an image'),
    Buffer.from('<svg></svg>'),
    Buffer.alloc(0),
  ])('rechaza contenido inválido declarado como PNG', async (buffer) => {
    await expect(pipe.transform(file(buffer))).rejects.toThrow(
      BadRequestException,
    );
  });
  it('rechaza más de 5 MiB', async () => {
    await expect(
      pipe.transform(file(Buffer.alloc(MAX_PHOTO_BYTES + 1))),
    ).rejects.toThrow(PayloadTooLargeException);
  });
});
