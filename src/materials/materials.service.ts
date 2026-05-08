import { Injectable } from '@nestjs/common';

@Injectable()
export class MaterialsService {
  private mockData = [
    { id: 1, name: 'Material 1', description: 'Description of Material 1' },
    { id: 2, name: 'Material 2', description: 'Description of Material 2' },
    { id: 3, name: 'Material 3', description: 'Description of Material 3' },
  ];

  findAll() {
    return {
      code: 200,
      message: 'Success',
      data: this.mockData,
    };
  }
}
