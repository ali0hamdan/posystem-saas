-- Add WHOLESALE business vertical for B2B / distributor tenants.
ALTER TYPE "BusinessType" ADD VALUE IF NOT EXISTS 'WHOLESALE';
