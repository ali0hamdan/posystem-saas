import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { FnbRecipesService } from './recipes.service';
import { FnbRecipesController } from './recipes.controller';

@Module({
  imports: [AuthModule],
  controllers: [FnbRecipesController],
  providers: [FnbRecipesService],
  exports: [FnbRecipesService],
})
export class FnbRecipesModule {}
