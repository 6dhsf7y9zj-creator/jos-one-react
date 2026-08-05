import { describe, expect, it } from 'vitest'
import type { InventoryItem, JosSettings } from '../types/inventory.ts'
import { calculateSalesProfitPlan, defaultSalesPlanningSettings, normaliseSalesPlanningSettings } from './salesProfitPlanning.ts'
const item=(o:Partial<InventoryItem>={}):InventoryItem=>({sku:'A',brand:'Nike',category:'Hoodie',description:'Hoodie',size:'M',condition:'Very Good',status:'Live',grade:'A',purchasePrice:10,expectedSalePrice:40,storageLocation:'A1',pipelineStage:'Live',...o})
const settings=():JosSettings=>({minimumProfit:15,targetRoi:150,storageLocations:['A1'],monthlyProfitTarget:5000,salesPlanning:defaultSalesPlanningSettings,finance:{openingCash:100,emergencyReserve:0,plannedSourcingBudget:100,taxPlanningRate:20,transactions:[]}})
describe('Sales & Profit Planning Engine',()=>{
 it('normalises old settings',()=>{expect(normaliseSalesPlanningSettings(undefined).goldTarget).toBe(5000)})
 it('uses linked realised profit before assumptions',()=>{const s=settings();s.monthlyProfitTarget=100;s.finance!.transactions=[{id:'1',date:'2026-08-01',type:'sale',category:'sale',amount:40,description:'sale',sku:'A'}];const r=calculateSalesProfitPlan([item()],[],s,{},new Date('2026-08-05T12:00:00'));expect(r.averageRealisedProfit).toBe(30);expect(r.salesRequired).toBe(3)})
 it('keeps stock and listing requirements separate',()=>{const s=settings();s.monthlyProfitTarget=100;const r=calculateSalesProfitPlan([item({status:'Prep',pipelineStage:'Preparation'})],[],s,{assumedAverageProfit:25,assumedSellThroughRate:50},new Date('2026-08-05T12:00:00'));expect(r.salesRequired).toBe(4);expect(r.stockRequired).toBe(8);expect(r.additionalListingsRequired).toBe(8)})
 it('does not mutate records',()=>{const items=[item()];const s=settings();const a=JSON.stringify(items),c=JSON.stringify(s);calculateSalesProfitPlan(items,[],s);expect(JSON.stringify(items)).toBe(a);expect(JSON.stringify(s)).toBe(c)})
})
