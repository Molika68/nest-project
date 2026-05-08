import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { HealthController } from './health/health.controller';
import { MaterialsModule } from './materials/materials.module';
import { PetModule } from './pet/pet.module';

@Module({
  imports: [HealthModule, MaterialsModule, PetModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
