import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { BusinessType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureService } from '../fnb/feature/feature.service';

@Injectable()
export class WholesaleScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly features: FeatureService,
  ) {}

  async assertWholesaleBusiness(clientId: string): Promise<void> {
    const businessType = await this.features.getBusinessType(clientId);
    if (businessType !== BusinessType.WHOLESALE && businessType !== BusinessType.HYBRID) {
      throw new ForbiddenException({
        message: 'Wholesale module is not enabled for this business type',
        code: 'WHOLESALE_NOT_ENABLED',
      });
    }
  }

  async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) {
      throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    }
    const b = await this.prisma.branch.findFirst({
      where: { id: branchId, clientId, isActive: true },
      select: { id: true },
    });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  async assertCustomer(clientId: string, customerId: string): Promise<void> {
    const exists = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
  }

  async assertProduct(clientId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, clientId },
      select: { id: true, name: true, isActive: true },
    });
    if (!product) throw new BadRequestException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    return product;
  }
}
