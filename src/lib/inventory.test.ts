import { describe,it,expect } from 'vitest'
import { expectedProfit,generateSku,nextStatus } from './inventory'
const item={id:'1',sku:'JAE-0007',brand:'Nike',category:'Hoodie',size:'M',condition:'Very good',purchasePrice:6,expectedSalePrice:28,storageLocation:'A1',status:'Prep' as const}
describe('inventory logic',()=>{it('calculates profit',()=>expect(expectedProfit(item)).toBe(22));it('generates next sku',()=>expect(generateSku([item])).toBe('JAE-0008'));it('advances status',()=>expect(nextStatus('Prep')).toBe('Photographed'))})
