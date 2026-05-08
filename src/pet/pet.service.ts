import { Injectable } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { Pet } from './dto/pet.interface';

@Injectable()
export class PetService {
  private mockData: Pet[] = [
    {
      id: '1',
      name: 'dog',
      age: 2,
      color: 'black',
      owner: 'John',
    },
    {
      id: '2',
      name: 'cat',
      age: 1,
      color: 'white',
      owner: 'Jane',
    },
    {
      id: '3',
      name: 'rabbit',
      age: 3,
      color: 'brown',
      owner: 'Bob',
    },
  ];

  create(createPetDto: CreatePetDto) {
    return 'This action adds a new pet';
  }

  findAll() {
    return {
      code: 200,
      data: this.mockData,
      message: 'success',
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} pet`;
  }

  update(id: number, updatePetDto: UpdatePetDto) {
    return `This action updates a #${id} pet`;
  }

  remove(id: number) {
    return `This action removes a #${id} pet`;
  }
}
