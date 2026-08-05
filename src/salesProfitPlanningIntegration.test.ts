import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const dash = readFileSync(new URL('./components/Dashboard.tsx', import.meta.url), 'utf8')
const backup = readFileSync(new URL('./lib/backup.ts', import.meta.url), 'utf8')
const engine = readFileSync(new URL('./lib/salesProfitPlanning.ts', import.meta.url), 'utf8')

describe('Sales planning integration',()=>{it('adds route',()=>{expect(app).toContain("tab === 'sales-planning'");expect(app).toContain('<SalesProfitPlanningCentre');expect(app).toContain("changeTab('sales-planning')")});it('connects dashboard',()=>{expect(dash).toContain('calculateSalesProfitPlan');expect(dash).toContain('Open Sales & Profit Plan')});it('backs up settings',()=>expect(backup).toContain('normaliseSalesPlanningSettings'));it('separates evidence and assumptions',()=>{expect(engine).toContain('averageRealisedProfit');expect(engine).toContain('planningAverageProfit');expect(engine).toContain('what-if planning model')})})
