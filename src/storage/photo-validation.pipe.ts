import {
  BadRequestException,
  FileTypeValidator,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
} from '@nestjs/common';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

@Injectable()
export class PhotoValidationPipe implements PipeTransform {
  private readonly typeValidator = new FileTypeValidator({
    fileType: /^image\/(jpeg|png|webp)$/,
    overrideMimeType: true,
  });

  async transform(file?: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      throw new BadRequestException('El archivo photo es obligatorio');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new PayloadTooLargeException('La foto no debe superar 5 MiB');
    }
    if (!file.buffer?.length || !(await this.typeValidator.isValid(file))) {
      throw new BadRequestException(
        'photo debe ser una imagen JPEG, PNG o WebP',
      );
    }
    return file;
  }
}
